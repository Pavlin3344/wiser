# Blob Storage, replacing MinIO. Same two containers, same keys - the workers address
# objects by `bucket` and `path` in the message contract, and neither of those changes.

resource "azurerm_storage_account" "main" {
  name                = var.account_name
  location            = var.location
  resource_group_name = var.resource_group_name

  account_tier = "Standard"
  account_kind = "StorageV2"
  access_tier  = "Hot"
  # Zone-redundant: a lost datacentre should not cost the Sentinel scenes and the FWI
  # grids, which are the inputs nothing else can regenerate on demand.
  account_replication_type = var.replication_type

  https_traffic_only_enabled      = true
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false

  blob_properties {
    # Soft delete is the cheap half of durability: it covers the overwrite-by-a-bad-deploy
    # case that backups of a database never see, because these are files, not rows.
    delete_retention_policy {
      days = var.soft_delete_days
    }
    container_delete_retention_policy {
      days = var.soft_delete_days
    }
    versioning_enabled = true
  }

  tags = var.tags
}

# The same two names the compose stack uses. `satellite-imagery` holds raw scenes,
# `processed-products` holds everything a worker derived: NDVI, fuel, dNBR rasters, and
# since the claim check also the daily FWI grid as `fwi/<date>/points.json`.
resource "azurerm_storage_container" "main" {
  for_each = toset(["satellite-imagery", "processed-products"])

  name                  = each.value
  storage_account_id    = azurerm_storage_account.main.id
  container_access_type = "private"
}

resource "azurerm_private_endpoint" "blob" {
  name                = "pe-${var.prefix}-blob"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_endpoints_subnet_id

  private_service_connection {
    name                           = "psc-blob"
    private_connection_resource_id = azurerm_storage_account.main.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [var.blob_private_dns_zone_id]
  }

  tags = var.tags
}
