# Two PostgreSQL Flexible Servers - the relational one and the time-series one.
#
# This is the resource the whole migration exists for. The Hetzner stack has 23 restart
# policies and zero backups: it survives a process dying, not a disk dying, and both
# databases hold weeks of collected data with no way to recover it. Everything below that
# looks like overhead - backup retention, geo-redundancy, private networking - is the
# reason we are paying 7x.
#
# Kept as two servers rather than two databases on one, because they are genuinely
# different workloads: the relational side wants postgis and pgrouting, the time-series
# side wants timescaledb with its own shared_preload_libraries, and a restart to reload
# one should not take the other down.

locals {
  servers = {
    postgres = {
      database_name = "wiser"
      # Allowlisted extensions must be named before CREATE EXTENSION is permitted at all.
      extensions               = "POSTGIS,PGROUTING"
      shared_preload_libraries = ""
    }
    timescale = {
      database_name = "wiser_timeseries"
      extensions    = "TIMESCALEDB"
      # timescaledb hooks the planner, so unlike postgis it has to be loaded at start.
      shared_preload_libraries = "timescaledb"
    }
  }
}

resource "azurerm_postgresql_flexible_server" "main" {
  for_each = local.servers

  name                = "psql-${var.prefix}-${each.key}"
  location            = var.location
  resource_group_name = var.resource_group_name
  version             = var.postgres_version

  administrator_login    = var.administrator_login
  administrator_password = var.administrator_password

  sku_name   = var.sku_name
  storage_mb = var.storage_mb

  # The entire point. PITR within the retention window is what "we can recover" means here.
  backup_retention_days        = var.backup_retention_days
  geo_redundant_backup_enabled = var.geo_redundant_backup

  # No delegated subnet and no firewall rules: reachable only through the Private Endpoint
  # below. A Flexible Server cannot switch between VNet injection and Private Endpoint
  # later without being recreated, so this choice is effectively permanent.
  public_network_access_enabled = false

  zone = var.availability_zone

  lifecycle {
    # Azure picks a zone when one is not pinned and then reports it back; without this a
    # plan run after creation wants to move the server, which means recreating it.
    ignore_changes = [zone]
  }

  tags = var.tags
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  for_each = local.servers

  name      = each.value.database_name
  server_id = azurerm_postgresql_flexible_server.main[each.key].id
  collation = "en_US.utf8"
  charset   = "UTF8"

  lifecycle {
    # Dropping a database on a `terraform destroy` of the wrong workspace is exactly the
    # failure this migration is meant to make impossible.
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_configuration" "extensions" {
  for_each = local.servers

  name      = "azure.extensions"
  server_id = azurerm_postgresql_flexible_server.main[each.key].id
  value     = each.value.extensions
}

resource "azurerm_postgresql_flexible_server_configuration" "preload" {
  for_each = { for key, server in local.servers : key => server if server.shared_preload_libraries != "" }

  name      = "shared_preload_libraries"
  server_id = azurerm_postgresql_flexible_server.main[each.key].id
  value     = each.value.shared_preload_libraries
}

resource "azurerm_private_endpoint" "main" {
  for_each = local.servers

  name                = "pe-${var.prefix}-${each.key}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_endpoints_subnet_id

  private_service_connection {
    name                           = "psc-${each.key}"
    private_connection_resource_id = azurerm_postgresql_flexible_server.main[each.key].id
    subresource_names              = ["postgresqlServer"]
    is_manual_connection           = false
  }

  # Without this the server's public FQDN keeps resolving to a public address and the
  # endpoint sits there unused - the classic silent half-configuration of Private Link.
  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [var.postgres_private_dns_zone_id]
  }

  tags = var.tags
}
