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

  minio_root_user     = var.minio_root_user
  minio_root_password = var.minio_root_password
  rabbitmq_user       = var.rabbitmq_user
  rabbitmq_password   = var.rabbitmq_password

  # Reachable only because of the route table and NSG rule below - see the comment there.
  logstash_host = var.hetzner_tailscale_ip
  logstash_port = var.logstash_port

  image_tag      = var.image_tag
  zone_redundant = var.zone_redundant
  custom_domain  = var.custom_domain

  # Every app and job gets the same secret names; each declares which ones it reads.
  secrets = merge(var.secrets, {
    "postgres-password"     = var.postgres_administrator_password
    "servicebus-connection" = module.messaging.default_connection_string
    "minio-root-password"   = var.minio_root_password
    "rabbitmq-password"     = var.rabbitmq_password
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

  # The one hole in the deny below, and narrower than it looks. An NSG on a NIC is
  # evaluated for traffic passing *through* it, not only traffic addressed to it, and a
  # forwarded packet still carries its original destination - so this names Hetzner's
  # tailnet address, not this VM's. "VirtualNetwork" would not match: 100.116.156.92 is
  # outside the VNet. Nothing that is not the apps subnet, speaking TCP, to that one host,
  # on that one port, gets past priority 4096.
  security_rule {
    name                       = "allow-apps-to-hetzner-logs"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = tostring(var.logstash_port)
    source_address_prefix      = module.network.apps_subnet_address_prefix
    destination_address_prefix = "${var.hetzner_tailscale_ip}/32"
  }

  # Everything else stays shut. Note this rule outranks Azure's own AllowVnetInBound
  # (65000), which is why the exception above has to be explicit.
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

# --- Azure -> Hetzner, the return direction -------------------------------------------
#
# The router already carries Hetzner -> Azure; that is what lets Grafana and psql reach
# private resources. This is the other way round: the apps and jobs ship their logs to
# Logstash, which lives only at a tailnet address. Three things have to line up - a route
# that aims the packets at the router instead of the internet, the NSG rule above that
# lets the router forward them, and a masquerade on the router itself so Hetzner has a
# source address it can reply to. Miss any one of them and the connection times out
# rather than fails, which is the slowest kind of fault to chase.
resource "azurerm_route_table" "tailnet" {
  name                = "rt-${local.prefix}-tailnet"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}

# One host, not the whole 100.64.0.0/10 tailnet range. A workload-profiles Container Apps
# environment reserves 100.100.0.0/17 and three /19 blocks for its own infrastructure, and
# every one of them sits inside that /10 - routing it would hand the platform's own
# addressing to a B1s VM. Logs need exactly one address.
resource "azurerm_route" "hetzner" {
  name                   = "hetzner-tailnet"
  resource_group_name    = azurerm_resource_group.main.name
  route_table_name       = azurerm_route_table.tailnet.name
  address_prefix         = "${var.hetzner_tailscale_ip}/32"
  next_hop_type          = "VirtualAppliance"
  next_hop_in_ip_address = azurerm_network_interface.tailscale.private_ip_address
}

# The apps subnet only. Associating snet-tailscale as well would route the router's own
# traffic for this address straight back at itself.
resource "azurerm_subnet_route_table_association" "apps" {
  subnet_id      = module.network.apps_subnet_id
  route_table_id = azurerm_route_table.tailnet.id
}

resource "azurerm_network_interface" "tailscale" {
  name                = "nic-${local.prefix}-tailscale"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  # A subnet router forwards traffic that is not addressed to itself, which Azure drops
  # unless the NIC is told to expect it.
  ip_forwarding_enabled = true

  ip_configuration {
    name      = "internal"
    subnet_id = module.network.tailscale_subnet_id
    # Static, and pinned to the address the NIC already holds. azurerm_route.hetzner uses
    # this as its next hop; under Dynamic a recreated NIC could take a different lease and
    # the route would quietly point at nothing - logs would stop with no error anywhere.
    # Not ForceNew, so switching costs an in-place update and does not touch the VM.
    private_ip_address_allocation = "Static"
    private_ip_address            = "10.60.2.36"
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

  lifecycle {
    # custom_data is ForceNew: editing the cloud-init destroys and recreates this VM. That
    # costs a new tailnet identity, re-approval of the advertised 10.60.0.0/21, and an auth
    # key that has to still be valid - i.e. Grafana, Kibana and every psql session over the
    # tunnel go dark for as long as that takes.
    #
    # So the YAML stays the source of truth for the next rebuild, and changes to it are
    # applied to the running box by hand instead. If a plan ever shows this VM being
    # replaced, that is a mistake, not an upgrade.
    ignore_changes = [custom_data]
  }

  tags = local.tags
}
