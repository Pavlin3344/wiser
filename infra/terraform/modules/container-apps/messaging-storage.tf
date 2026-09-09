# MinIO and RabbitMQ, run as Container Apps rather than swapped for Azure-native
# equivalents (Blob Storage, Service Bus). The application code already speaks S3 and
# AMQP 0-9-1 correctly - it just had nothing real to talk to on Azure. Standing up the
# same open-source servers Hetzner runs means zero code changes in ingestion/alerts/the
# Python workers, at the cost of running (and paying for) two more containers.
#
# Both need to be external: this environment's internal-only (app-to-app) ingress
# returns a platform 404 for every app that isn't external - the same bug api hit
# earlier (see project_azure_demo_setup memory). Reusing that workaround here too.

# Reusable fragments for the Python workers (event_jobs/manual_jobs in main.tf) - they
# read Postgres/Timescale/MinIO/RabbitMQ the same way api and ingestion do, just each
# needs a different subset, so these get merged in per job rather than duplicated four
# times. Matches infra/docker/docker-compose.yml's env blocks for the same workers.
locals {
  rabbitmq_env = {
    RABBITMQ_HOST = "ca-${var.prefix}-rabbitmq.${azurerm_container_app_environment.main.default_domain}"
    RABBITMQ_USER = var.rabbitmq_user
  }
  rabbitmq_secret_env = {
    RABBITMQ_PASSWORD = "rabbitmq-password" # gitleaks:allow
  }
  minio_env = {
    MINIO_ENDPOINT  = "https://ca-${var.prefix}-minio.${azurerm_container_app_environment.main.default_domain}"
    MINIO_ROOT_USER = var.minio_root_user
  }
  minio_secret_env = {
    MINIO_ROOT_PASSWORD = "minio-root-password" # gitleaks:allow - secret name, not a value
  }
  # Postgres and Timescale are separate Flexible Server instances (module.database) that
  # happen to share one admin password - the Python client libraries take host/port
  # apart rather than a JDBC URL, unlike the Java services.
  postgres_python_env = {
    POSTGRES_HOST = var.postgres_fqdn
    POSTGRES_PORT = "5432"
  }
  timescale_python_env = {
    TIMESCALE_HOST = var.timescale_fqdn
    TIMESCALE_PORT = "5432"
  }
  postgres_python_secret_env = {
    POSTGRES_PASSWORD = "postgres-password" # gitleaks:allow - secret name, not a value
  }

  # Every app and job gets this: unlike the Hetzner stack, there is no host here whose
  # Docker json files filebeat could read, so each process ships its own logs over the
  # tailnet. Java picks it up in logback-spring.xml, Python in data/processing/log_shipper.py,
  # and both stay inert when it is unset - which is what keeps Compose unchanged.
  # The route and NSG rule that make this address reachable are in envs/prod/main.tf.
  logstash_env = var.logstash_host == "" ? {} : {
    LOGSTASH_HOST = var.logstash_host
    LOGSTASH_PORT = tostring(var.logstash_port)
  }

  # Alongside it, every app and job also gets WISER_LOG_SERVICE = its own key - written
  # inline at each of the four env blocks in main.tf, because it depends on each.key and
  # a local cannot. It is what a log line calls itself in Kibana.
  #
  # One image runs under several names here: wiser-ingestion is the same jar for
  # ingest-effis, ingest-firms, ingest-air-quality, ingest-sentinel and ingest-osm. With
  # the name compiled into logback-spring.xml all five filed their logs as "ingestion",
  # so "which feed failed last night" was a question the logs could not answer - and the
  # answer had to be pieced together from timestamps against the cron expressions here.
  #
  # The keys match the container names Azure reports (ContainerName_s), which is what the
  # azure-log-bridge on the Hetzner box uses for the containers that cannot ship their own
  # logs. Both paths therefore produce the same `service` value, and Kibana sees one name
  # per service rather than one per delivery route.

  # KEDA's rabbitmq scale rule authenticates with a full connection URI, not separate
  # user/password fields - this is the one secret that has to be computed rather than
  # just referencing the shared `secrets` map.
  rabbitmq_connection_string = "amqp://${var.rabbitmq_user}:${var.rabbitmq_password}@ca-${var.prefix}-rabbitmq.${azurerm_container_app_environment.main.default_domain}:5672/wiser"
}

# A separate, small storage account rather than reusing module.storage's: that one has
# public network access disabled and only a blob private endpoint, so Container Apps'
# Azure Files volume mount (which needs a reachable file endpoint + account key) would
# need a second private endpoint and DNS zone just for this. Public network access here
# is fine - the account key gates access, not the network path, and nothing sensitive
# lives in these two shares beyond queue/bucket data already reachable via the servers
# they back.
resource "azurerm_storage_account" "svc" {
  name                     = "stwisersvc${var.prefix == "wiser-prod" ? "prod" : "dev"}${substr(md5(var.prefix), 0, 6)}"
  location                 = var.location
  resource_group_name      = var.resource_group_name
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  tags                     = var.tags
}

resource "azurerm_storage_share" "minio_data" {
  name               = "minio-data"
  storage_account_id = azurerm_storage_account.svc.id
  quota              = 20
}

# rabbitmq.conf and definitions.json (topology: exchanges/queues/bindings) are uploaded
# once, out of band (az storage file upload), same way the compose bind-mounts them -
# Terraform has no clean way to push file *content* into an Azure Files share.
resource "azurerm_storage_share" "rabbitmq_config" {
  name               = "rabbitmq-config"
  storage_account_id = azurerm_storage_account.svc.id
  quota              = 1
}

resource "azurerm_container_app_environment_storage" "minio_data" {
  name                         = "minio-data"
  container_app_environment_id = azurerm_container_app_environment.main.id
  account_name                 = azurerm_storage_account.svc.name
  access_key                   = azurerm_storage_account.svc.primary_access_key
  share_name                   = azurerm_storage_share.minio_data.name
  access_mode                  = "ReadWrite"
}

resource "azurerm_container_app_environment_storage" "rabbitmq_config" {
  name                         = "rabbitmq-config"
  container_app_environment_id = azurerm_container_app_environment.main.id
  account_name                 = azurerm_storage_account.svc.name
  access_key                   = azurerm_storage_account.svc.primary_access_key
  share_name                   = azurerm_storage_share.rabbitmq_config.name
  access_mode                  = "ReadOnly"
}

resource "azurerm_container_app" "minio" {
  name                         = "ca-${var.prefix}-minio"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption" # see azurerm_container_app.main in main.tf

  template {
    min_replicas = 1
    max_replicas = 1

    container {
      name = "minio"
      # Same pinned release Hetzner runs.
      image   = "quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z.hotfix.7aa24e772"
      cpu     = 0.5
      memory  = "1Gi"
      command = ["minio", "server", "/data"]

      env {
        name  = "MINIO_ROOT_USER"
        value = var.minio_root_user
      }
      env {
        name        = "MINIO_ROOT_PASSWORD"
        secret_name = "minio-root-password" # gitleaks:allow - secret name, not a value
      }

      volume_mounts {
        name = "data"
        path = "/data"
      }
    }

    volume {
      name         = "data"
      storage_type = "AzureFile"
      storage_name = azurerm_container_app_environment_storage.minio_data.name
    }
  }

  secret {
    name  = "minio-root-password" # gitleaks:allow - secret name, not a value
    value = var.minio_root_password
  }

  ingress {
    # See the file header: internal-only ingress is broken on this environment, so this
    # has to be external even though nothing outside the environment should call it.
    external_enabled = true
    target_port      = 9000
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = var.tags
}

resource "azurerm_container_app" "rabbitmq" {
  name                         = "ca-${var.prefix}-rabbitmq"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption" # see azurerm_container_app.main in main.tf

  template {
    min_replicas = 1
    max_replicas = 1

    container {
      name   = "rabbitmq"
      image  = "rabbitmq:3-management"
      cpu    = 0.5
      memory = "1Gi"

      # Same provisioning script Hetzner's compose file runs: definitions.json carries
      # no credentials (would be a password hash in git), so the broker boots with no
      # users at all otherwise, and every client gets ACCESS_REFUSED.
      command = ["sh", "-c"]
      args = [
        <<-EOT
        (
          until rabbitmqctl await_startup >/dev/null 2>&1; do sleep 2; done
          rabbitmqctl list_users 2>/dev/null | grep -qx "$RABBITMQ_DEFAULT_USER.*" \
            || rabbitmqctl add_user "$RABBITMQ_DEFAULT_USER" "$RABBITMQ_DEFAULT_PASS" \
            || rabbitmqctl change_password "$RABBITMQ_DEFAULT_USER" "$RABBITMQ_DEFAULT_PASS"
          rabbitmqctl set_user_tags "$RABBITMQ_DEFAULT_USER" administrator
          rabbitmqctl set_permissions -p "$RABBITMQ_DEFAULT_VHOST" "$RABBITMQ_DEFAULT_USER" ".*" ".*" ".*"
        ) &
        exec rabbitmq-server
        EOT
      ]

      env {
        name  = "RABBITMQ_DEFAULT_USER"
        value = var.rabbitmq_user
      }
      env {
        name        = "RABBITMQ_DEFAULT_PASS"
        secret_name = "rabbitmq-password" # gitleaks:allow - secret name, not a value
      }
      env {
        name  = "RABBITMQ_DEFAULT_VHOST"
        value = "wiser"
      }

      # No volume for /var/lib/rabbitmq: Azure Files (SMB) can't enforce the strict
      # owner-only permission bit RabbitMQ demands on .erlang.cookie, and it refuses to
      # start rather than run with a world-readable distribution secret. Ephemeral is
      # fine for a demo - the topology reloads from definitions.json below on every
      # boot regardless, and nothing needs queued messages to survive a restart.
      volume_mounts {
        name = "config"
        path = "/etc/rabbitmq"
      }
    }

    volume {
      name         = "config"
      storage_type = "AzureFile"
      storage_name = azurerm_container_app_environment_storage.rabbitmq_config.name
    }
  }

  secret {
    name  = "rabbitmq-password" # gitleaks:allow - secret name, not a value
    value = var.rabbitmq_password
  }

  ingress {
    external_enabled = true
    target_port      = 5672
    transport        = "tcp"
    exposed_port     = 5672

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = var.tags
}
