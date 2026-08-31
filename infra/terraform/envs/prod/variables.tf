variable "subscription_id" {
  description = "Also readable from ARM_SUBSCRIPTION_ID. Required as of azurerm 4.x."
  type        = string
}

variable "environment_name" {
  type    = string
  default = "prod"
}

# Sweden Central is ~18% cheaper than West Europe for identical SKUs, which was measured
# against the Retail Prices API rather than assumed.
variable "location" {
  type    = string
  default = "swedencentral"
}

variable "address_space" {
  type    = string
  default = "10.60.0.0/21"
}

variable "postgres_administrator_password" {
  type      = string
  sensitive = true
}

variable "postgres_sku" {
  type    = string
  default = "B_Standard_B2s"
}

variable "backup_retention_days" {
  type    = number
  default = 14
}

variable "image_tag" {
  description = "The tag CI pushed to the registry. Not `latest` - a revision has to be pinned to be rollback-able."
  type        = string
}

variable "custom_domain" {
  description = "Apex or subdomain to bind to the frontend app with a free Azure-managed certificate (e.g. \"fire-cast.com\"). Empty skips it. See modules/container-apps/custom-domain.tf for the DNS records it needs first."
  type        = string
  default     = ""
}

variable "zone_redundant" {
  type    = bool
  default = true
}

variable "secrets" {
  description = "Extra secrets for the apps and jobs: copernicus-client-secret, api-key, and anything else the containers read."
  type        = map(string)
  sensitive   = true
  default     = {}
}

variable "alert_emails" {
  type    = list(string)
  default = []
}

variable "ssh_public_key" {
  description = "Public key for the subnet router. The VM denies all inbound, so this is for a Tailscale-side session, not the public IP."
  type        = string
}

variable "tailscale_auth_key" {
  description = "Reusable, pre-authorised, tagged auth key. Generate in the Tailscale admin console."
  type        = string
  sensitive   = true
}

variable "tailscale_vm_size" {
  type    = string
  default = "Standard_B1s"
}

# Real MinIO/RabbitMQ servers, run as Container Apps - see messaging-storage.tf. Same
# accounts as Hetzner's infra/docker/.env, reused rather than invented, since the buckets
# and vhost topology already assume them.
variable "minio_root_user" {
  type = string
}

variable "minio_root_password" {
  type      = string
  sensitive = true
}

variable "rabbitmq_user" {
  type = string
}

variable "rabbitmq_password" {
  type      = string
  sensitive = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
