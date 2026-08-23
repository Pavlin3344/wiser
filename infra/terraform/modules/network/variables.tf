variable "prefix" {
  description = "Name prefix for every resource in this module, e.g. wiser-prod."
  type        = string
}

variable "location" {
  description = "Azure region. Sweden Central is ~18% cheaper than West Europe for identical SKUs."
  type        = string
}

variable "resource_group_name" {
  type = string
}

# /21 rather than something tighter: the Container Apps environment alone claims a /23,
# and Azure reserves five addresses in every subnet.
variable "address_space" {
  description = "CIDR for the whole VNet."
  type        = string
  default     = "10.60.0.0/21"

  validation {
    condition     = tonumber(split("/", var.address_space)[1]) <= 21
    error_message = "The Container Apps subnet needs a /23, so the VNet must be /21 or larger."
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}
