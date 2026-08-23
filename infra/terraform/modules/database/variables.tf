variable "prefix" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "private_endpoints_subnet_id" {
  type = string
}

variable "postgres_private_dns_zone_id" {
  type = string
}

variable "postgres_version" {
  description = "Major version. Production runs pg16 today; changing this in place is not a thing Flexible Server does."
  type        = string
  default     = "16"
}

variable "administrator_login" {
  type    = string
  default = "wiser"
}

variable "administrator_password" {
  type      = string
  sensitive = true
}

# Measured on the Hetzner box through cAdvisor rather than guessed from the compose limits:
# nothing in the stack needs more than half a gigabyte, so the burstable tier fits and is
# roughly half the price of the smallest General Purpose SKU.
variable "sku_name" {
  type    = string
  default = "B_Standard_B2s"
}

variable "storage_mb" {
  type    = number
  default = 32768
}

variable "backup_retention_days" {
  description = "PITR window. This is the number that makes the migration worth its cost."
  type        = number
  default     = 14

  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "A retention shorter than a week defeats the reason for moving off Hetzner."
  }
}

variable "geo_redundant_backup" {
  description = "Backups replicated to the paired region. Off by default: zone redundancy already covers a lost datacentre and this doubles backup storage cost."
  type        = bool
  default     = false
}

variable "availability_zone" {
  type    = string
  default = "1"
}

variable "tags" {
  type    = map(string)
  default = {}
}
