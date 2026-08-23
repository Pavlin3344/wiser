variable "prefix" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "sku" {
  description = "Basic carries the whole workload for ~0.0001 EUR/month. Premium exists only if Private Link becomes mandatory, and it starts around 600 EUR/month."
  type        = string
  default     = "Basic"

  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.sku)
    error_message = "sku must be Basic, Standard or Premium."
  }
}

variable "local_auth_enabled" {
  description = "Shared access keys. Kept on while the Python workers still authenticate with a connection string; turn off once every consumer uses a managed identity."
  type        = bool
  default     = true
}

# The four queues that carry real traffic today, each named exactly as the RabbitMQ queue
# it replaces so the message contract does not have to change.
variable "queues" {
  type = map(object({
    lock_duration      = string
    max_delivery_count = number
    ttl                = string
  }))

  default = {
    # EFFIS fire weather index, daily. Now a reference to a blob, not the grid itself.
    "weather.ingest" = {
      lock_duration      = "PT5M"
      max_delivery_count = 5
      ttl                = "P1D"
    }
    # Sentinel-2 scene uploaded, ~every 3 days. NDVI worker consumes.
    "satellite.ingest" = {
      lock_duration      = "PT5M"
      max_delivery_count = 5
      ttl                = "P3D"
    }
    # FIRMS detections, hourly. Read by the SSE stream the dashboard listens to.
    "fire.detections" = {
      lock_duration      = "PT1M"
      max_delivery_count = 5
      ttl                = "PT6H"
    }
    # Phase 3 post-fire analysis. Slowest handler in the stack: two Sentinel scenes read
    # into memory, so the lock has to outlive the computation.
    "analysis.tasks" = {
      lock_duration      = "PT5M"
      max_delivery_count = 3
      ttl                = "P7D"
    }
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}
