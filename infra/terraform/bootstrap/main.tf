# Creates the storage that holds Terraform's own state. Run once, before anything else.
#
# The chicken and egg: a remote backend needs a storage account, and a storage account is
# a resource. So this root keeps its state locally - it is thirty lines describing three
# resources that never change, and losing that state costs an import, not an outage.
#
#   cd infra/terraform/bootstrap
#   terraform init && terraform apply
#
# Then `envs/prod` can init against the backend this created.

terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

resource "azurerm_resource_group" "state" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

resource "azurerm_storage_account" "state" {
  name                = var.storage_account_name
  location            = var.location
  resource_group_name = azurerm_resource_group.state.name

  account_tier             = "Standard"
  account_replication_type = "ZRS"
  account_kind             = "StorageV2"

  https_traffic_only_enabled      = true
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false

  blob_properties {
    versioning_enabled = true
    # State is the one file where an accidental overwrite is unrecoverable by hand.
    delete_retention_policy {
      days = 30
    }
  }

  tags = var.tags
}

resource "azurerm_storage_container" "state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
}
