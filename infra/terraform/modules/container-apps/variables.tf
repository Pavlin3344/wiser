variable "prefix" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "apps_subnet_id" {
  type = string
}

variable "storage_account_id" {
  type = string
}

variable "servicebus_namespace_id" {
  type = string
}

variable "servicebus_namespace_name" {
  type = string
}

# Private FQDNs from the database module - the api app needs these to build its JDBC
# URLs. Resolvable only from inside the VNet, which is exactly where this app runs.
variable "postgres_fqdn" {
  type = string
}

variable "timescale_fqdn" {
  type = string
}

# Registry names are global and alphanumeric only - same class of rule as storage accounts.
variable "registry_name" {
  type = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9]{5,50}$", var.registry_name))
    error_message = "Container registry names are 5-50 alphanumeric characters."
  }
}

variable "image_tag" {
  description = "Tag CI pushed. Deliberately not `latest`: a revision has to be pinned to something to be rollback-able."
  type        = string
}

variable "internal_only" {
  description = "Keep the environment's load balancer internal. The frontend is still published through its own ingress."
  type        = bool
  default     = false
}

variable "minio_root_user" {
  type = string
}

variable "minio_root_password" {
  type      = string
  sensitive = true
}

variable "rabbitmq_user" {
  type = string
}

variable "rabbitmq_password" {
  type      = string
  sensitive = true
}

variable "logstash_host" {
  description = "Tailnet address of the Hetzner Logstash. Empty disables shipping entirely - the appenders stay inert and logs go only to the console, which Log Analytics still captures."
  type        = string
  default     = ""
}

variable "logstash_port" {
  type    = number
  default = 5045
}

variable "zone_redundant" {
  type    = bool
  default = true
}

variable "secrets" {
  description = "Secret name to value, mounted on every app and job. Supplied through TF_VAR_secrets or a gitignored tfvars, never committed."
  type        = map(string)
  sensitive   = true
  default     = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}

# --- The catalogue -------------------------------------------------------------------
#
# Sizes come from cAdvisor on the Hetzner box, not from the compose limits: measured, the
# whole stack fits in half a gigabyte per service. Container Apps bills in steps of 0.25
# vCPU paired with 0.5 GiB, so 0.25/0.5Gi is the floor and only `api` sits above it -
# not for throughput but for startup, since a JVM on a quarter of a core crawls and fast
# rollout is the reason for choosing Container Apps in the first place.

variable "apps" {
  description = "The only two things in Wiser that are actually servers, plus the metrics exporter that has to stay reachable to be scraped."
  type = map(object({
    image        = string
    port         = number
    external     = bool
    cpu          = number
    memory       = string
    min_replicas = number
    max_replicas = number
    env          = map(string)
    secret_env   = map(string)
  }))

  default = {
    frontend = {
      image        = "wiser-frontend"
      port         = 80
      external     = true
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 2
      max_replicas = 4
      env          = {}
      secret_env   = {}
    }
    api = {
      image = "wiser-api"
      port  = 8080
      # Should be internal-only - nothing but frontend and Tailscale need to reach it.
      # It's external because this environment's internal (app-to-app) ingress returns a
      # platform "stopped or does not exist" 404 for every internal-only app, verified by
      # testing data-metrics too and by the exact same endpoint working the moment ingress
      # was flipped external. Revert once that's understood; nothing here caused it -
      # SNI, the DB wiring, explicit health probes and an explicit workload_profile block
      # were all tried first and none of them were it.
      external     = true
      cpu          = 0.5
      memory       = "1Gi"
      min_replicas = 2
      max_replicas = 4
      env          = {}
      secret_env   = {}
    }
    # Measures data freshness rather than process liveness - the lesson from `zones`
    # sitting empty for weeks while every container was green. It must be scraped, so it
    # is an app with internal ingress and not a job.
    data-metrics = {
      image        = "wiser-data-metrics"
      port         = 9105
      external     = false
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 1
      max_replicas = 1
      env          = {}
      secret_env   = {}
    }
  }
}

# The Java entries rely on the one-shot mode `alerts` and `ingestion` gained in
# IngestionApplication/AlertsApplication: WISER_JOB names the single task to run, and the
# app skips Tomcat, skips arming its @Scheduled timers, does that one thing and exits.
# Before it existed every one of these jobs ran its work correctly and was then killed at
# replica_timeout and recorded as Failed - a healthy pipeline that looked broken.
variable "scheduled_jobs" {
  type = map(object({
    image           = string
    cron            = string
    cpu             = number
    memory          = string
    timeout_seconds = number
    retry_limit     = number
    command         = list(string)
    args            = list(string)
    env             = map(string)
    secret_env      = map(string)
  }))

  default = {
    # EFFIS publishes the fire weather index once a day; 04:00 UTC clears their window.
    ingest-effis = {
      image      = "wiser-ingestion", cron = "0 4 * * *"
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 1800, retry_limit = 2
      command    = [], args = []
      env        = { WISER_JOB = "effis" }
      secret_env = {}
    }
    # FIRMS hotspots, hourly - matches the satellite overpass cadence.
    ingest-firms = {
      image      = "wiser-ingestion", cron = "0 * * * *"
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 900, retry_limit = 2
      command    = [], args = []
      env        = { WISER_JOB = "firms" }
      secret_env = {}
    }
    # Open-Meteo air quality, hourly - the upstream model publishes hourly.
    ingest-air-quality = {
      image      = "wiser-ingestion", cron = "10 * * * *"
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 900, retry_limit = 2
      command    = [], args = []
      env        = { WISER_JOB = "air-quality" }
      secret_env = {}
    }
    # Sentinel-2 revisits roughly every three days; no point asking more often.
    ingest-sentinel = {
      image      = "wiser-ingestion", cron = "0 5 */3 * *"
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 1800, retry_limit = 2
      command    = [], args = []
      env        = { WISER_JOB = "sentinel" }
      secret_env = {}
    }
    # OSM critical infrastructure. Monthly, because Overpass is a shared public service and
    # a country-wide amenity query is expensive, while hospitals and schools rarely move.
    # Easy to miss - it is a fifth ingestion schedule, not a fourth.
    #
    # Enabled, unlike the Compose default. Nothing else fills critical_infrastructure, and
    # empty it takes proximity alerts down with it: with the table empty, an hourly alert
    # pass over 51 active detections produced "0 new alerts created" every time, and the
    # evacuation endpoints have no assembly points to route to either. Monthly against
    # Overpass is a fair price for the two features that depend on it.
    ingest-osm = {
      image      = "wiser-ingestion", cron = "0 3 1 * *"
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 3600, retry_limit = 1
      command    = [], args = []
      env        = { WISER_JOB = "osm", OSM_IMPORT_SCHEDULED = "true" }
      secret_env = {}
    }
    # Proximity alerts against the detections ingested in the same hour.
    alerts = {
      image   = "wiser-alerts", cron = "30 * * * *"
      cpu     = 0.5, memory = "1Gi", timeout_seconds = 900, retry_limit = 2
      command = [], args = []
      # Notification e-mail stays off - EmailNotificationService gates on this before it
      # ever touches spring.mail, so leaving SMTP unset below is safe. To turn it on:
      # add smtp-host/smtp-port/smtp-user/smtp-password/alerts-notify-to to `secrets` in
      # terraform.tfvars, add matching entries to secret_env here, then flip this to true.
      env = {
        # Unlike ingestion's five feeds this service has only one task, so the value just
        # selects one-shot mode rather than naming the work. Without it the app starts
        # Tomcat, arms the hourly timer and never exits.
        WISER_JOB             = "alerts"
        ALERTS_NOTIFY_ENABLED = "false"
        ALERTS_NOTIFY_FROM    = "wiser@wisertech.com"
      }
      secret_env = {}
    }
    # Rebuilds `zones` from FWI + NDVI + fuel. Every six hours because EFFIS does not
    # publish at a predictable time of day.
    risk-zones = {
      image      = "wiser-worker-risk-zones", cron = "0 */6 * * *"
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 3600, retry_limit = 1
      command    = [], args = []
      env        = { RISK_ZONES_INTERVAL_SECONDS = "0" }
      secret_env = {}
    }
  }
}

variable "event_jobs" {
  description = "Queue consumers. They do not run on a clock - KEDA starts a replica when a message lands and stops it when the queue drains."
  type = map(object({
    image           = string
    queue           = string
    max_executions  = number
    cpu             = number
    memory          = string
    timeout_seconds = number
    retry_limit     = number
    command         = list(string)
    args            = list(string)
    env             = map(string)
    secret_env      = map(string)
  }))

  default = {
    worker-fwi = {
      image      = "wiser-worker-fwi", queue = "weather.ingest", max_executions = 2
      cpu        = 0.25, memory = "0.5Gi", timeout_seconds = 1800, retry_limit = 2
      command    = [], args = []
      env        = {}
      secret_env = {}
    }
    # rasterio holds whole Sentinel-2 bands in memory - the heaviest of the workers.
    worker-ndvi = {
      image      = "wiser-worker-ndvi", queue = "satellite.ingest", max_executions = 1
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 3600, retry_limit = 2
      command    = [], args = []
      env        = {}
      secret_env = {}
    }
    # Two scenes at once, so the same ceiling. Idle almost always: it only wakes when a
    # fire has gone out and a pre/post pair has been published.
    worker-dnbr = {
      image      = "wiser-worker-dnbr", queue = "analysis.tasks", max_executions = 1
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 3600, retry_limit = 2
      command    = [], args = []
      env        = {}
      secret_env = {}
    }
  }
}

variable "manual_jobs" {
  description = "The `docker compose run --rm` jobs: started when someone means it, never on a schedule."
  type = map(object({
    image           = string
    cpu             = number
    memory          = string
    timeout_seconds = number
    retry_limit     = number
    command         = list(string)
    args            = list(string)
    env             = map(string)
    secret_env      = map(string)
  }))

  default = {
    # One-time bootstrap of the EFFIS fuel raster.
    fuel-loader = {
      image      = "wiser-worker-fuel"
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 3600, retry_limit = 1
      command    = [], args = []
      env        = {}
      secret_env = {}
    }
    # Stands in for the Phase 3 producer until the backend publishes `analysis.tasks`
    # itself. Takes arguments, so it is always started with an override.
    dnbr-scene-fetcher = {
      image      = "wiser-worker-dnbr"
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 3600, retry_limit = 1
      command    = ["python", "dnbr/fetch_scene_pair.py"]
      args       = ["--dry-run"]
      env        = {}
      secret_env = {}
    }
  }
}

variable "custom_domain" {
  description = "Apex or subdomain to bind to the frontend app with a free Azure-managed certificate (e.g. \"fire-cast.com\"). Empty skips the binding entirely. The DNS records it needs have to already resolve before applying - see custom-domain.tf."
  type        = string
  default     = ""
}
