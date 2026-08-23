# Azure Monitor workspace, the alert rules that survive the move, and where they page.
#
# ⚠ Read this before trusting the rules below. Azure Monitor managed Prometheus does not
# scrape Container Apps. Its managed scraper targets AKS; Container Apps emit platform
# metrics to Azure Monitor and their own logs to Log Analytics, and neither carries the
# `wiser_data_*` series that every rule here is written against.
#
# The way that works is the other direction: a small Prometheus in agent mode runs as a
# Container App inside the VNet, scrapes `data-metrics` and the three Spring actuator
# endpoints exactly as it does on Hetzner today, and remote-writes to the workspace below.
# That also settles the objection that put managed Prometheus in the plan in the first
# place - a scraper outside the network would go silent precisely when the tunnel is what
# broke - because the agent is inside the network and pushes outward.
#
# Until that agent exists these rules are correct and evaluate against nothing.
#
# What does not come across: the node-exporter, cAdvisor and postgres-exporter rules.
# Container Apps and Flexible Server publish their own platform metrics, so those become
# metric alerts rather than PromQL, and the exporters are retired.

resource "azurerm_monitor_workspace" "main" {
  name                = "amw-${var.prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_monitor_action_group" "main" {
  name                = "ag-${var.prefix}"
  resource_group_name = var.resource_group_name
  short_name          = var.action_group_short_name

  dynamic "email_receiver" {
    for_each = var.alert_emails
    content {
      name                    = "email-${email_receiver.key}"
      email_address           = email_receiver.value
      use_common_alert_schema = true
    }
  }

  tags = var.tags
}

# The freshness rules, ported as they stand. They are the ones worth carrying: they
# measure whether data is arriving, not whether processes are alive. That distinction was
# learned the hard way here - `zones` sat empty for weeks while every container was green.
resource "azurerm_monitor_alert_prometheus_rule_group" "data_processing" {
  name                = "prg-${var.prefix}-data-processing"
  location            = var.location
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_monitor_workspace.main.id]
  rule_group_enabled  = true
  # Matches the 30s scrape interval the stack moved to; every rule below has a `for` of at
  # least a minute, so the shortest still gets two evaluations before it fires.
  interval = "PT1M"

  rule {
    alert      = "DataMetricsExporterDown"
    expression = "up{job=\"wiser-data-metrics\"} == 0"
    for        = "PT5M"
    severity   = 1
    labels     = { environment = var.environment }
    annotations = {
      summary     = "Data metrics exporter is not responding"
      description = "Freshness of FWI, NDVI and the risk zones is no longer being observed"
    }
    action {
      action_group_id = azurerm_monitor_action_group.main.id
    }
  }

  rule {
    alert      = "DataSourceUnreachable"
    expression = "wiser_data_scrape_success == 0"
    for        = "PT10M"
    severity   = 2
    labels     = { environment = var.environment }
    annotations = {
      summary     = "Data pipeline cannot reach {{ $labels.source }}"
      description = "Metrics from {{ $labels.source }} have been missing for 10 minutes"
    }
    action {
      action_group_id = azurerm_monitor_action_group.main.id
    }
  }

  # The map draws from `zones`. Stale zones look completely normal on screen, which is
  # exactly why this has to be an alert rather than something anyone notices.
  rule {
    alert      = "RiskZonesStale"
    expression = "time() - wiser_data_zones_last_computed_timestamp_seconds > 86400"
    for        = "PT30M"
    severity   = 1
    labels     = { environment = var.environment }
    annotations = {
      summary     = "Risk zones have not been recomputed for over 24 hours"
      description = "The map is showing stale risk - check the risk-zones job"
    }
    action {
      action_group_id = azurerm_monitor_action_group.main.id
    }
  }

  # Empty, not stale. This has happened: the job never ran at all because the host cron it
  # depended on was never part of the repository.
  rule {
    alert      = "RiskZonesMissing"
    expression = "absent(wiser_data_zones_last_computed_timestamp_seconds) and on() (wiser_data_scrape_success{source=\"postgres\"} == 1)"
    for        = "PT30M"
    severity   = 1
    labels     = { environment = var.environment }
    annotations = {
      summary     = "The `zones` table is empty"
      description = "Not a single computed risk zone - the map has nothing to draw"
    }
    action {
      action_group_id = azurerm_monitor_action_group.main.id
    }
  }

  # EFFIS publishes daily; 36 hours allows for a shifted publication time.
  rule {
    alert      = "FwiIngestionStale"
    expression = "time() - wiser_data_fwi_last_observation_timestamp_seconds > 129600"
    for        = "PT1H"
    severity   = 2
    labels     = { environment = var.environment }
    annotations = {
      summary     = "No new FWI for over 36 hours"
      description = "Either the EFFIS ingestion job or the FWI worker has stopped"
    }
    action {
      action_group_id = azurerm_monitor_action_group.main.id
    }
  }

  # A halved grid does not show up as staleness: the data is fresh, half the country has
  # no zones.
  rule {
    alert      = "FwiGridShrunk"
    expression = "wiser_data_fwi_points_latest_day < 2000"
    for        = "PT1H"
    severity   = 2
    labels     = { environment = var.environment }
    annotations = {
      summary     = "The FWI grid is smaller than usual ({{ $value }} points)"
      description = "~2772 points expected - EFFIS may have returned partial coverage"
    }
    action {
      action_group_id = azurerm_monitor_action_group.main.id
    }
  }

  # Sentinel-2 revisits every ~3 days and cloud eats more scenes - hence 7 days.
  rule {
    alert      = "NdviProductsStale"
    expression = "time() - wiser_data_ndvi_last_product_timestamp_seconds > 604800"
    for        = "PT6H"
    severity   = 2
    labels     = { environment = var.environment }
    annotations = {
      summary     = "No new NDVI product for over 7 days"
      description = "Either the Sentinel ingestion job or the NDVI worker has stopped"
    }
    action {
      action_group_id = azurerm_monitor_action_group.main.id
    }
  }

  # A static file, but a fresh storage container has none. Without it the risk model
  # silently loses the fuel correction.
  rule {
    alert      = "FuelMapMissing"
    expression = "wiser_data_fuel_map_present == 0"
    for        = "PT15M"
    severity   = 2
    labels     = { environment = var.environment }
    annotations = {
      summary     = "The fuel map is missing from blob storage"
      description = "Start the fuel-loader job - zones are being computed without the fuel correction"
    }
    action {
      action_group_id = azurerm_monitor_action_group.main.id
    }
  }
}

# The two queue rules do not survive as PromQL: they read `rabbitmq_queue_messages_ready`
# from the RabbitMQ Prometheus plugin, which retires with the broker. Service Bus publishes
# the same two facts as platform metrics, so they become metric alerts on the namespace.
resource "azurerm_monitor_metric_alert" "dead_letters" {
  name                = "ma-${var.prefix}-dead-letters"
  resource_group_name = var.resource_group_name
  scopes              = [var.servicebus_namespace_id]
  description         = "Messages are sitting in a dead-letter queue. They are not lost, but nobody finds out unless this fires."
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.ServiceBus/namespaces"
    metric_name      = "DeadletteredMessages"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 0
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = var.tags
}

# A filling input queue means the consumer is alive but not keeping up, or wedged.
resource "azurerm_monitor_metric_alert" "queue_backlog" {
  name                = "ma-${var.prefix}-queue-backlog"
  resource_group_name = var.resource_group_name
  scopes              = [var.servicebus_namespace_id]
  description         = "Unprocessed messages are accumulating - a worker is behind or stuck."
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT30M"

  criteria {
    metric_namespace = "Microsoft.ServiceBus/namespaces"
    metric_name      = "ActiveMessages"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = var.queue_backlog_threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = var.tags
}
