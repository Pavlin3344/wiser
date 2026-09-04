# The compute layer: registry, environment, the two long-running apps, and the jobs.
#
# The shape of this module is the shape of the argument for Container Apps. Almost nothing
# in Wiser is a server. Two things serve HTTP; everything else is batch that happens to
# boot a JVM or sit in a `basic_consume` loop. Jobs express that directly and scale to
# zero between runs, which is also where most of the saving against always-on containers
# comes from.

resource "azurerm_container_registry" "main" {
  name                = var.registry_name
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "Basic"
  # Images are pushed by CI with a federated credential, never with the admin account.
  admin_enabled = false
  tags          = var.tags
}

# One identity for everything. The apps and jobs differ in what they do, not in what they
# are allowed to reach: every one of them pulls from the registry, and the ones that touch
# data touch the same blob store and the same broker.
resource "azurerm_user_assigned_identity" "apps" {
  name                = "id-${var.prefix}-apps"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.apps.principal_id
}

# Data-plane roles, not management-plane. The workers read and write blobs and messages;
# none of them may reconfigure the account or the namespace.
resource "azurerm_role_assignment" "blob" {
  scope                = var.storage_account_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.apps.principal_id
}

resource "azurerm_role_assignment" "servicebus" {
  scope                = var.servicebus_namespace_id
  role_definition_name = "Azure Service Bus Data Owner"
  principal_id         = azurerm_user_assigned_identity.apps.principal_id
}

# Container Apps insists on a Log Analytics workspace for its own console and system logs
# even though the application logs go to ELK on Hetzner over Tailscale. Kept at the
# shortest retention that is allowed, because it is duplicate storage of the same lines.
resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${var.prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${var.prefix}"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  # VNet-integrated so apps can reach the Private Endpoints. The load balancer stays
  # internal: the only thing that should be publicly reachable is the frontend, and it is
  # published deliberately rather than by default.
  infrastructure_subnet_id       = var.apps_subnet_id
  internal_load_balancer_enabled = var.internal_only

  # Spreads replicas across availability zones. Half of "0 replicas" was never the replica
  # count - it was that both copies would have sat on the same machine.
  zone_redundancy_enabled = var.zone_redundant

  # Azure creates this profile whether or not it's declared - every apply that left it
  # undeclared showed a phantom diff trying to remove it. Declaring it matches reality
  # and stops the drift; it does not change what the environment actually runs.
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }

  tags = var.tags
}

# --- Long-running apps -------------------------------------------------------------

resource "azurerm_container_app" "main" {
  for_each = var.apps

  name                         = "ca-${var.prefix}-${each.key}"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"

  # Same phantom diff the environment's workload_profile block above fixes, one level
  # down: Azure assigns every app and job to the Consumption profile whether or not it is
  # declared, so leaving it out made all 17 resources show "Consumption -> null" on every
  # single plan. Declaring it matches reality and does not change what they run.
  workload_profile_name = "Consumption"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.apps.id]
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.apps.id
  }

  dynamic "secret" {
    for_each = var.secrets
    content {
      name  = secret.key
      value = secret.value
    }
  }

  template {
    # Two replicas is the floor, not a scaling target. A single replica means a deploy is
    # an outage, which is exactly what the current stack does: pushing to main takes the
    # API down for the minutes the JVM needs to come back.
    min_replicas = each.value.min_replicas
    max_replicas = each.value.max_replicas

    container {
      name   = each.key
      image  = "${azurerm_container_registry.main.login_server}/${each.value.image}:${var.image_tag}"
      cpu    = each.value.cpu
      memory = each.value.memory

      # nginx.conf proxies to a fixed "http://wiser-backend:8080" upstream - that's the
      # Compose service name and container port on Hetzner. Container Apps' FQDN is a
      # platform ingress endpoint, not the container itself: other apps reach it over
      # HTTPS on 443, not on api's own target_port, so this drops the port and switches
      # scheme rather than just swapping the host. The image's
      # docker-entrypoint.d/40-backend-host.sh applies it at container start; unset
      # (Hetzner) it defaults back to the Compose upstream and changes nothing.
      #
      # No ".internal." - api is external for now (see the comment on its entry in
      # var.apps): this environment's internal-only ingress returns a platform 404 for
      # every app that isn't external, unrelated to anything in this file.
      #
      # api's application.properties defaults spring.datasource.url to localhost - fine
      # under Compose, where docker-compose.yml overrides it with the postgres service
      # name. Nothing here did the equivalent for Azure, so api was trying to reach a
      # database on its own loopback and crash-looping on a JDBC connect timeout.
      dynamic "env" {
        for_each = merge(each.value.env, local.logstash_env, each.key == "frontend" ? {
          BACKEND_UPSTREAM = "https://ca-${var.prefix}-api.${azurerm_container_app_environment.main.default_domain}"
          } : each.key == "api" ? merge(local.rabbitmq_env, {
            SPRING_DATASOURCE_URL = "jdbc:postgresql://${var.postgres_fqdn}:5432/wiser"
            TIMESCALE_URL         = "jdbc:postgresql://${var.timescale_fqdn}:5432/wiser_timeseries"
            # The browser now calls api directly instead of through nginx's proxy (see
            # project_azure_demo_setup memory: that proxy hop was unreliable on this
            # platform's edge). A direct cross-origin browser call needs api to answer
            # with Access-Control-Allow-Origin, which SecurityConfig reads from this.
            #
            # The custom domain has to be listed too, and it is the one that matters:
            # visitors arrive at https://fire-cast.com, so that - not the app's default
            # hostname - is the Origin api actually sees. With only the default listed,
            # every browser call from the real site was rejected with no
            # Access-Control-Allow-Origin, taking the active-fire feed and the SSE stream
            # down together while the API itself answered fine to curl.
            WISER_CORS_ALLOWED_ORIGINS = join(",", compact([
              "https://ca-${var.prefix}-frontend.${azurerm_container_app_environment.main.default_domain}",
              var.custom_domain != "" ? "https://${var.custom_domain}" : "",
            ]))
            # data-metrics is Python and reads all three the way the workers do - host and
            # port apart, not a JDBC URL. It had none of them, so every probe fell back to
            # its localhost default and the exporter served
            # wiser_data_scrape_success{source=...} 0 for postgres, timescale and minio
            # while looking perfectly healthy. That is the exact failure this exporter was
            # written to catch, happening to the exporter itself.
          }) : each.key == "data-metrics" ? merge(
          local.postgres_python_env, local.timescale_python_env, local.minio_env
        ) : {})
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = merge(
          each.value.secret_env,
          each.key == "api" ? merge(local.rabbitmq_secret_env, {
            # Not a credential - a Container Apps secret *name*, resolved from the actual
            # value in the `secrets` map (envs/prod/main.tf), itself sourced from tfvars.
            POSTGRES_PASSWORD = "postgres-password" # gitleaks:allow
          }) : {},
          each.key == "data-metrics" ? merge(
            local.postgres_python_secret_env, local.minio_secret_env
          ) : {}
        )
        content {
          name        = env.key
          secret_name = env.value
        }
      }

      # Without an explicit probe, Container Apps' own default check gates whether the
      # environment's ingress will route to a replica at all - separate from, and stricter
      # than, the container just being alive. For api that default landed on Spring
      # Security's "/" (403, permitAll doesn't cover it), so the app was reachable via
      # `az containerapp exec` the whole time while ingress kept answering "stopped or
      # does not exist" for every real request. Point it at Spring Boot's own readiness/
      # liveness groups instead - unauthenticated, and (unlike plain /actuator/health)
      # not dragged down by the still-unwired RabbitMQ indicator.
      dynamic "liveness_probe" {
        for_each = each.key == "api" ? [1] : []
        content {
          transport = "HTTP"
          port      = each.value.port
          path      = "/actuator/health/liveness"
        }
      }

      dynamic "readiness_probe" {
        for_each = each.key == "api" ? [1] : []
        content {
          transport = "HTTP"
          port      = each.value.port
          path      = "/actuator/health/readiness"
        }
      }
    }
  }

  ingress {
    # Only the frontend is external. `api` and `data-metrics` are reachable inside the
    # environment and through Tailscale, and nowhere else.
    external_enabled = each.value.external
    target_port      = each.value.port
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = var.tags
}

# --- Jobs ---------------------------------------------------------------------------

# Scheduled work: the five ingestion feeds, the hourly alert pass and the risk-zone
# rebuild. One cron each rather than one job that asks what is due - the schedules are
# independent and a failing EFFIS download must not stop the FIRMS one.
resource "azurerm_container_app_job" "scheduled" {
  for_each = var.scheduled_jobs

  # ARM caps Container App Job names at 32 chars. "caj-wiser-prod-" already eats 15,
  # and a couple of keys (ingest-air-quality, dnbr-scene-fetcher) run over on their own -
  # truncate rather than rename them, since the keys are also what docker-compose.jobs.yml
  # and the docs use on the Hetzner side.
  name                         = substr("caj-${var.prefix}-${each.key}", 0, 32)
  location                     = var.location
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  workload_profile_name        = "Consumption" # see azurerm_container_app.main above

  replica_timeout_in_seconds = each.value.timeout_seconds
  replica_retry_limit        = each.value.retry_limit

  schedule_trigger_config {
    cron_expression          = each.value.cron
    parallelism              = 1
    replica_completion_count = 1
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.apps.id]
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.apps.id
  }

  dynamic "secret" {
    for_each = var.secrets
    content {
      name  = secret.key
      value = secret.value
    }
  }

  template {
    container {
      name    = each.key
      image   = "${azurerm_container_registry.main.login_server}/${each.value.image}:${var.image_tag}"
      cpu     = each.value.cpu
      memory  = each.value.memory
      command = each.value.command
      args    = each.value.args

      # ingestion and alerts are the same Spring Boot stack as api, reading the same
      # SPRING_DATASOURCE_URL/TIMESCALE_URL/POSTGRES_PASSWORD - and hit the exact api
      # crash-loop before this (JDBC connect to localhost, Hibernate can't determine a
      # Dialect). Keyed on image rather than job name so it covers whichever schedules
      # use these two images, not just the ones that exist today.
      dynamic "env" {
        for_each = merge(
          each.value.env,
          local.logstash_env,
          contains(["wiser-ingestion", "wiser-alerts"], each.value.image) ? {
            SPRING_DATASOURCE_URL = "jdbc:postgresql://${var.postgres_fqdn}:5432/wiser"
            TIMESCALE_URL         = "jdbc:postgresql://${var.timescale_fqdn}:5432/wiser_timeseries"
          } : {},
          # MinIO and RabbitMQ run for real now (messaging-storage.tf) - same servers
          # Hetzner runs, just reachable at a different host. AMQP is plain, no TLS:
          # Container Apps' TCP ingress is raw passthrough, it doesn't terminate it.
          each.value.image == "wiser-ingestion" ? merge(local.minio_env, local.rabbitmq_env) : {},
          # risk-zones is Python (data/processing), not Spring - host/port apart, not a
          # JDBC URL, and it reads TIMESCALE_HOST directly rather than a Java-style URL.
          each.value.image == "wiser-worker-risk-zones" ? merge(
            local.postgres_python_env, local.timescale_python_env, local.minio_env
          ) : {}
        )
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = merge(
          each.value.secret_env,
          contains(["wiser-ingestion", "wiser-alerts", "wiser-worker-risk-zones"], each.value.image) ? local.postgres_python_secret_env : {},
          # Both have safe REPLACE_ME_* defaults in application.properties, so wiring them
          # for every ingestion schedule is harmless even for the ones that never read
          # them - simpler than keying each var to the one WISER_JOB value that needs it.
          each.value.image == "wiser-ingestion" ? merge(local.minio_secret_env, local.rabbitmq_secret_env, {
            FIRMS_MAP_KEY            = "firms-map-key"
            COPERNICUS_CLIENT_ID     = "copernicus-client-id"
            COPERNICUS_CLIENT_SECRET = "copernicus-client-secret"
          }) : {},
          each.value.image == "wiser-worker-risk-zones" ? local.minio_secret_env : {}
        )
        content {
          name        = env.key
          secret_name = env.value
        }
      }
    }
  }

  tags = var.tags
}

# Queue-driven work. The three Python consumers do not run on a clock - they wake when a
# message lands. KEDA polls the queue and starts a replica per backlog; between fires the
# dNBR job costs nothing at all, which a resident container never manages.
resource "azurerm_container_app_job" "event" {
  for_each = var.event_jobs

  name                         = substr("caj-${var.prefix}-${each.key}", 0, 32) # 32-char ARM cap, see scheduled jobs above
  location                     = var.location
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  workload_profile_name        = "Consumption" # see azurerm_container_app.main above

  replica_timeout_in_seconds = each.value.timeout_seconds
  replica_retry_limit        = each.value.retry_limit

  # The workers themselves are RabbitMQ consumers (data/processing/*/config.py), and
  # ingestion publishes to RabbitMQ exchanges (infra/docker/rabbitmq/definitions.json) -
  # not Service Bus, which nothing in this whole pipeline ever reads from or writes to.
  # KEDA's native RabbitMQ scaler polls the same broker the worker actually consumes,
  # so a job only starts when a message is genuinely waiting for it.
  event_trigger_config {
    parallelism              = 1
    replica_completion_count = 1

    scale {
      min_executions              = 0
      max_executions              = each.value.max_executions
      polling_interval_in_seconds = 30

      rules {
        name             = "rabbitmq-${each.key}"
        custom_rule_type = "rabbitmq"
        metadata = {
          queueName   = each.value.queue
          queueLength = "1"
        }

        authentication {
          secret_name       = "rabbitmq-connection-string"
          trigger_parameter = "host"
        }
      }
    }
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.apps.id]
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.apps.id
  }

  dynamic "secret" {
    for_each = var.secrets
    content {
      name  = secret.key
      value = secret.value
    }
  }

  secret {
    name  = "rabbitmq-connection-string"
    value = local.rabbitmq_connection_string
  }

  template {
    container {
      name    = each.key
      image   = "${azurerm_container_registry.main.login_server}/${each.value.image}:${var.image_tag}"
      cpu     = each.value.cpu
      memory  = each.value.memory
      command = each.value.command
      args    = each.value.args

      # All three are RabbitMQ consumers; fwi also reads Timescale, dnbr also reads
      # Postgres, and none of them are Spring - see the locals in messaging-storage.tf.
      # ndvi touches neither database, only the queue and blob storage.
      dynamic "env" {
        for_each = merge(
          each.value.env,
          local.logstash_env,
          local.rabbitmq_env,
          local.minio_env,
          each.key == "worker-fwi" ? local.timescale_python_env : {},
          each.key == "worker-dnbr" ? local.postgres_python_env : {}
        )
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = merge(
          each.value.secret_env,
          local.rabbitmq_secret_env,
          local.minio_secret_env,
          contains(["worker-fwi", "worker-dnbr"], each.key) ? local.postgres_python_secret_env : {}
        )
        content {
          name        = env.key
          secret_name = env.value
        }
      }
    }
  }

  tags = var.tags
}

# Run-by-hand work: the one-time fuel map load and the dNBR scene fetcher. These are the
# `docker compose run --rm` jobs from docker-compose.jobs.yml, and they keep the same
# shape - defined next to everything else, started only when someone means it.
resource "azurerm_container_app_job" "manual" {
  for_each = var.manual_jobs

  name                         = substr("caj-${var.prefix}-${each.key}", 0, 32) # 32-char ARM cap, see scheduled jobs above
  location                     = var.location
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  workload_profile_name        = "Consumption" # see azurerm_container_app.main above

  replica_timeout_in_seconds = each.value.timeout_seconds
  replica_retry_limit        = each.value.retry_limit

  manual_trigger_config {
    parallelism              = 1
    replica_completion_count = 1
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.apps.id]
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.apps.id
  }

  dynamic "secret" {
    for_each = var.secrets
    content {
      name  = secret.key
      value = secret.value
    }
  }

  template {
    container {
      name    = each.key
      image   = "${azurerm_container_registry.main.login_server}/${each.value.image}:${var.image_tag}"
      cpu     = each.value.cpu
      memory  = each.value.memory
      command = each.value.command
      args    = each.value.args

      # fuel-loader only ever writes the fuel raster to blob storage. dnbr-scene-fetcher
      # shares data/processing/dnbr/config.py with worker-dnbr - same full set, plus the
      # Copernicus credentials to actually download the scene pair it publishes about.
      dynamic "env" {
        for_each = merge(
          each.value.env,
          local.logstash_env,
          each.value.image == "wiser-worker-fuel" ? local.minio_env : {},
          each.value.image == "wiser-worker-dnbr" ? merge(
            local.rabbitmq_env, local.postgres_python_env, local.minio_env
          ) : {}
        )
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = merge(
          each.value.secret_env,
          each.value.image == "wiser-worker-fuel" ? local.minio_secret_env : {},
          each.value.image == "wiser-worker-dnbr" ? merge(
            local.rabbitmq_secret_env, local.postgres_python_secret_env, local.minio_secret_env,
            {
              COPERNICUS_CLIENT_ID     = "copernicus-client-id"
              COPERNICUS_CLIENT_SECRET = "copernicus-client-secret"
            }
          ) : {}
        )
        content {
          name        = env.key
          secret_name = env.value
        }
      }
    }
  }

  tags = var.tags
}
