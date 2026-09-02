output "vnet_id" {
  value = azurerm_virtual_network.main.id
}

output "apps_subnet_id" {
  value = azurerm_subnet.apps.id
}

# The apps and jobs get their addresses from here and none of them is individually stable,
# so anything that has to name them - an NSG rule, a route - names the range instead.
output "apps_subnet_address_prefix" {
  value = one(azurerm_subnet.apps.address_prefixes)
}

output "private_endpoints_subnet_id" {
  value = azurerm_subnet.private_endpoints.id
}

output "tailscale_subnet_id" {
  value = azurerm_subnet.tailscale.id
}

output "private_dns_zone_ids" {
  description = "Keyed by service (postgres, blob) for the private_dns_zone_group of each endpoint."
  value       = { for key, zone in azurerm_private_dns_zone.main : key => zone.id }
}
