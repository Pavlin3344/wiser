output "registry_login_server" {
  value = azurerm_container_registry.main.login_server
}

output "registry_id" {
  value = azurerm_container_registry.main.id
}

output "identity_id" {
  value = azurerm_user_assigned_identity.apps.id
}

output "identity_principal_id" {
  value = azurerm_user_assigned_identity.apps.principal_id
}

output "identity_client_id" {
  description = "The value DefaultAzureCredential needs as AZURE_CLIENT_ID inside the containers."
  value       = azurerm_user_assigned_identity.apps.client_id
}

output "environment_id" {
  value = azurerm_container_app_environment.main.id
}

output "environment_default_domain" {
  value = azurerm_container_app_environment.main.default_domain
}

output "app_fqdns" {
  description = "Keyed by app. The frontend's is the public one; the rest resolve inside the environment."
  value       = { for key, app in azurerm_container_app.main : key => app.ingress[0].fqdn }
}

output "log_analytics_workspace_id" {
  value = azurerm_log_analytics_workspace.main.id
}
