output "namespace_id" {
  value = azurerm_servicebus_namespace.main.id
}

output "namespace_name" {
  value = azurerm_servicebus_namespace.main.name
}

output "namespace_fqdn" {
  value = "${azurerm_servicebus_namespace.main.name}.servicebus.windows.net"
}

output "queue_names" {
  value = [for queue in azurerm_servicebus_queue.main : queue.name]
}

output "default_connection_string" {
  description = "Only populated while local_auth_enabled is true. Prefer the managed identity path."
  value       = var.local_auth_enabled ? azurerm_servicebus_namespace.main.default_primary_connection_string : null
  sensitive   = true
}
