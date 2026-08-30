terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Демо на промо кредит в чужд акаунт (project_azure_demo_setup) - локален state, за да
  # не се разправяме с bootstrap-а. Ако средата преживее демото, разкоментирай това и
  # пусни infra/terraform/bootstrap веднъж, за да не остане state-ът само на един лаптоп.
  # backend "azurerm" {
  #   resource_group_name = "rg-wiser-tfstate"
  #   container_name      = "tfstate"
  #   key                 = "prod.terraform.tfstate"
  #   storage_account_name = "..."
  # }
}

provider "azurerm" {
  features {
    resource_group {
      # Refuse to delete a resource group that still holds something. The databases carry
      # weeks of collected data and this is the command that would take them.
      prevent_deletion_if_contains_resources = true
    }
  }
  subscription_id = var.subscription_id
}

locals {
  prefix = "wiser-${var.environment_name}"

  tags = merge(var.tags, {
    project     = "wiser"
    environment = var.environment_name
    managed_by  = "terraform"
  })
}

# Storage account and registry names are global and alphanumeric-only, so they cannot
# carry the hyphenated prefix everything else uses. A stored suffix keeps them unique
# without making the operator invent a name.
resource "random_string" "suffix" {
  length  = 6
  lower   = true
  upper   = false
  numeric = true
  special = false
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.prefix}"
  location = var.location
  tags     = local.tags
}

module "network" {
  source = "../../modules/network"

  prefix              = local.prefix
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = var.address_space
  tags                = local.tags
}

module "database" {
  source = "../../modules/database"

  prefix              = local.prefix
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  private_endpoints_subnet_id  = module.network.private_endpoints_subnet_id
  postgres_private_dns_zone_id = module.network.private_dns_zone_ids["postgres"]

  administrator_password = var.postgres_administrator_password
  sku_name               = var.postgres_sku
  backup_retention_days  = var.backup_retention_days

  tags = local.tags
}

module "storage" {
  source = "../../modules/storage"

  prefix              = local.prefix
  account_name        = "stwiser${var.environment_name}${random_string.suffix.result}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  private_endpoints_subnet_id = module.network.private_endpoints_subnet_id
  blob_private_dns_zone_id    = module.network.private_dns_zone_ids["blob"]

  tags = local.tags
}

module "messaging" {
  source = "../../modules/messaging"

  prefix              = local.prefix
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}

module "container_apps" {
  source = "../../modules/container-apps"

  prefix              = local.prefix
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  registry_name       = "crwiser${var.environment_name}${random_string.suffix.result}"

  apps_subnet_id            = module.network.apps_subnet_id
  storage_account_id        = module.storage.account_id
  servicebus_namespace_id   = module.messaging.namespace_id
  servicebus_namespace_name = module.messaging.namespace_name

  postgres_fqdn  = module.database.server_fqdns["postgres"]
  timescale_fqdn = module.database.server_fqdns["timescale"]

  image_tag      = var.image_tag
  zone_redundant = var.zone_redundant

  # Every app and job gets the same secret names; each declares which ones it reads.
  secrets = merge(var.secrets, {
    "postgres-password"     = var.postgres_administrator_password
    "servicebus-connection" = module.messaging.default_connection_string
  })

  tags = local.tags
}

module "monitoring" {
  source = "../../modules/monitoring"

  prefix                  = local.prefix
  location                = var.location
  resource_group_name     = azurerm_resource_group.main.name
  servicebus_namespace_id = module.messaging.namespace_id

  environment  = title(var.environment_name)
  alert_emails = var.alert_emails

  tags = local.tags
}

# --- Tailscale subnet router ---------------------------------------------------------
#
# One B1s advertising the VNet. It is what lets Grafana and ELK, which stay on Hetzner,
# keep reading from Azure - and what lets anyone run psql against a database that has no
# public endpoint. Without it the private networking above is also a wall against us.
#
# It carries a public IP for outbound only: Azure's default outbound access is retired for
# new deployments, and a NAT Gateway costs several times the VM. Inbound is denied
# outright - Tailscale connects outward and needs nothing opened.

resource "azurerm_public_ip" "tailscale" {
  name                = "pip-${local.prefix}-tailscale"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = local.tags
}

resource "azurerm_network_security_group" "tailscale" {
  name                = "nsg-${local.prefix}-tailscale"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  security_rule {
    name                       = "deny-all-inbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = local.tags
}

resource "azurerm_network_interface" "tailscale" {
  name                = "nic-${local.prefix}-tailscale"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  # A subnet router forwards traffic that is not addressed to itself, which Azure drops
  # unless the NIC is told to expect it.
  ip_forwarding_enabled = true

  ip_configuration {
    name                          = "internal"
    subnet_id                     = module.network.tailscale_subnet_id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.tailscale.id
  }

  tags = local.tags
}

resource "azurerm_network_interface_security_group_association" "tailscale" {
  network_interface_id      = azurerm_network_interface.tailscale.id
  network_security_group_id = azurerm_network_security_group.tailscale.id
}

resource "azurerm_linux_virtual_machine" "tailscale" {
  name                = "vm-${local.prefix}-tailscale"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  size                = var.tailscale_vm_size

  admin_username                  = "azureuser"
  disable_password_authentication = true

  admin_ssh_key {
    username   = "azureuser"
    public_key = var.ssh_public_key
  }

  network_interface_ids = [azurerm_network_interface.tailscale.id]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
    disk_size_gb         = 30
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }

  custom_data = base64encode(templatefile("${path.module}/tailscale-cloud-init.yaml", {
    auth_key       = var.tailscale_auth_key
    advertise_cidr = var.address_space
  }))

  tags = local.tags
}
