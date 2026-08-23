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
      image        = "wiser-api"
      port         = 8080
      external     = false
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

# ⚠ The Java entries assume `alerts` and `ingestion` have gained a one-shot mode that runs
# a single task and exits. They are `@Scheduled` batch that boots Tomcat today, and until
# that refactor lands these jobs will start, serve nothing and time out. That is step 5 of
# the migration plan, not something Terraform can do.
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
    # OSM critical infrastructure. Monthly, and off unless enabled: Overpass is a shared
    # public service and a country-wide amenity query is expensive, while hospitals and
    # schools rarely move. Easy to miss - it is a fifth ingestion schedule, not a fourth.
    ingest-osm = {
      image      = "wiser-ingestion", cron = "0 3 1 * *"
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 3600, retry_limit = 1
      command    = [], args = []
      env        = { WISER_JOB = "osm", OSM_IMPORT_SCHEDULED = "false" }
      secret_env = {}
    }
    # Proximity alerts against the detections ingested in the same hour.
    alerts = {
      image      = "wiser-alerts", cron = "30 * * * *"
      cpu        = 0.5, memory = "1Gi", timeout_seconds = 900, retry_limit = 2
      command    = [], args = []
      env        = {}
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
