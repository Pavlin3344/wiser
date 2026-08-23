variable "subscription_id" {
  description = "Also readable from ARM_SUBSCRIPTION_ID. Required as of azurerm 4.x."
  type        = string
}

variable "location" {
  type    = string
  default = "swedencentral"
}

variable "resource_group_name" {
  type    = string
  default = "rg-wiser-tfstate"
}

variable "storage_account_name" {
  description = "Globally unique, 3-24 lowercase alphanumerics."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "Storage account names are 3-24 characters, lowercase letters and digits only."
  }
}

variable "tags" {
  type = map(string)
  default = {
    project = "wiser"
    purpose = "terraform-state"
  }
}
