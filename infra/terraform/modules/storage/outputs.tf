output "account_name" {
  value = azurerm_storage_account.main.name
}

output "blob_endpoint" {
  value = azurerm_storage_account.main.primary_blob_endpoint
}

output "account_id" {
  value = azurerm_storage_account.main.id
}

output "container_names" {
  value = [for container in azurerm_storage_container.main : container.name]
}
