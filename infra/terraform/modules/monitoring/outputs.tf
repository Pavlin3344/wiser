output "workspace_id" {
  value = azurerm_monitor_workspace.main.id
}

output "workspace_query_endpoint" {
  value = azurerm_monitor_workspace.main.query_endpoint
}

output "remote_write_endpoint" {
  description = "Where the in-VNet Prometheus agent pushes. Without an agent writing here, every rule in this module evaluates against nothing."
  value       = try(azurerm_monitor_workspace.main.default_data_collection_endpoint_id, null)
}

output "action_group_id" {
  value = azurerm_monitor_action_group.main.id
}
