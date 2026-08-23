variable "prefix" {
  type = string
}

# Storage account names are global, lowercase, alphanumeric and at most 24 characters -
# the one naming rule in Azure that will not tolerate the project's usual prefix scheme.
variable "account_name" {
  type = string

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.account_name))
    error_message = "Storage account names are 3-24 characters, lowercase letters and digits only."
  }
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

variable "blob_private_dns_zone_id" {
  type = string
}

variable "replication_type" {
  description = "ZRS keeps three copies across zones in the region. LRS is cheaper and covers only a lost disk."
  type        = string
  default     = "ZRS"
}

variable "soft_delete_days" {
  type    = number
  default = 14
}

variable "tags" {
  type    = map(string)
  default = {}
}
