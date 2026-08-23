output "frontend_url" {
  description = "The only publicly reachable thing in the deployment."
  value       = "https://${module.container_apps.app_fqdns["frontend"]}"
}

output "registry_login_server" {
  description = "Where CI pushes images before an apply can reference them."
  value       = module.container_apps.registry_login_server
}

output "postgres_fqdns" {
  description = "Private addresses. Resolvable only from inside the VNet or over the Tailscale subnet router."
  value       = module.database.server_fqdns
}

output "storage_account_name" {
  value = module.storage.account_name
}

output "servicebus_namespace_fqdn" {
  value = module.messaging.namespace_fqdn
}

output "apps_identity_client_id" {
  description = "Set as AZURE_CLIENT_ID inside the containers for DefaultAzureCredential."
  value       = module.container_apps.identity_client_id
}

output "monitor_workspace_id" {
  value = module.monitoring.workspace_id
}

output "tailscale_router_private_ip" {
  value = azurerm_network_interface.tailscale.private_ip_address
}
