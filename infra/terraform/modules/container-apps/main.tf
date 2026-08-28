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

  tags = var.tags
}

# --- Long-running apps -------------------------------------------------------------

resource "azurerm_container_app" "main" {
  for_each = var.apps

  name                         = "ca-${var.prefix}-${each.key}"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"

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

      dynamic "env" {
        for_each = each.value.env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = each.value.secret_env
        content {
          name        = env.key
          secret_name = env.value
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

      dynamic "env" {
        for_each = each.value.env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = each.value.secret_env
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

  name                         = substr("caj-${var.prefix}-${each.key}", 0, 32)  # 32-char ARM cap, see scheduled jobs above
  location                     = var.location
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.main.id

  replica_timeout_in_seconds = each.value.timeout_seconds
  replica_retry_limit        = each.value.retry_limit

  event_trigger_config {
    parallelism              = 1
    replica_completion_count = 1

    scale {
      min_executions              = 0
      max_executions              = each.value.max_executions
      polling_interval_in_seconds = 30

      rules {
        name             = "servicebus-${each.key}"
        custom_rule_type = "azure-servicebus"
        metadata = {
          queueName    = each.value.queue
          namespace    = var.servicebus_namespace_name
          messageCount = "1"
        }

        authentication {
          secret_name       = "servicebus-connection"
          trigger_parameter = "connection"
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

  template {
    container {
      name    = each.key
      image   = "${azurerm_container_registry.main.login_server}/${each.value.image}:${var.image_tag}"
      cpu     = each.value.cpu
      memory  = each.value.memory
      command = each.value.command
      args    = each.value.args

      dynamic "env" {
        for_each = each.value.env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = each.value.secret_env
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

  name                         = substr("caj-${var.prefix}-${each.key}", 0, 32)  # 32-char ARM cap, see scheduled jobs above
  location                     = var.location
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.main.id

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

      dynamic "env" {
        for_each = each.value.env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = each.value.secret_env
        content {
          name        = env.key
          secret_name = env.value
        }
      }
    }
  }

  tags = var.tags
}
