output "backend_config" {
  description = "Paste into the backend block of envs/prod, or pass with -backend-config."
  value = {
    resource_group_name  = azurerm_resource_group.state.name
    storage_account_name = azurerm_storage_account.state.name
    container_name       = azurerm_storage_container.state.name
    key                  = "prod.terraform.tfstate"
  }
}
