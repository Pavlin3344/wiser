# VNet, subnets and the private DNS that makes Private Endpoints resolvable.
#
# The whole point of the migration is durability, and durability here means the databases
# are never reachable from the internet. Everything that can take a Private Endpoint gets
# one; what cannot is called out at its own resource.

resource "azurerm_virtual_network" "main" {
  name                = "vnet-${var.prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = [var.address_space]
  tags                = var.tags
}

# Container Apps wants a dedicated, delegated subnet and refuses anything smaller than /23
# for a workload-profile environment. It is the largest subnet here by a wide margin and
# the reason the VNet is a /21 rather than something tighter.
resource "azurerm_subnet" "apps" {
  name                 = "snet-apps"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [cidrsubnet(var.address_space, 2, 0)]

  delegation {
    name = "container-apps"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "private_endpoints" {
  name                 = "snet-private-endpoints"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [cidrsubnet(var.address_space, 6, 16)]
}

# The Tailscale subnet router lives here. One small VM advertising this VNet is what lets
# Grafana and ELK on Hetzner keep reading from Azure without any of it being public.
resource "azurerm_subnet" "tailscale" {
  name                 = "snet-tailscale"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [cidrsubnet(var.address_space, 6, 17)]
}

# Private DNS is the half of Private Link that is easy to forget: without these zones the
# service's public FQDN keeps resolving to a public IP and the Private Endpoint sits unused.
locals {
  private_dns_zones = {
    postgres = "privatelink.postgres.database.azure.com"
    blob     = "privatelink.blob.core.windows.net"
  }
}

resource "azurerm_private_dns_zone" "main" {
  for_each            = local.private_dns_zones
  name                = each.value
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "main" {
  for_each              = azurerm_private_dns_zone.main
  name                  = "link-${each.key}"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = each.value.name
  virtual_network_id    = azurerm_virtual_network.main.id
  registration_enabled  = false
  tags                  = var.tags
}
