output "server_fqdns" {
  description = "Keyed by server (postgres, timescale). Resolves to a private address inside the VNet only."
  value       = { for key, server in azurerm_postgresql_flexible_server.main : key => server.fqdn }
}

output "database_names" {
  value = { for key, database in azurerm_postgresql_flexible_server_database.main : key => database.name }
}

output "administrator_login" {
  value = var.administrator_login
}
