variable "prefix" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "servicebus_namespace_id" {
  type = string
}

variable "environment" {
  description = "Value of the `environment` label carried by every alert, as the Alertmanager routing uses today."
  type        = string
  default     = "Production"
}

variable "action_group_short_name" {
  description = "At most 12 characters - Azure puts it in the SMS and push payloads."
  type        = string
  default     = "wiser"

  validation {
    condition     = length(var.action_group_short_name) <= 12
    error_message = "An action group short name is at most 12 characters."
  }
}

variable "alert_emails" {
  type    = list(string)
  default = []
}

variable "queue_backlog_threshold" {
  description = "Active messages that count as a backlog. Five matched the RabbitMQ rule; the queues are normally at zero."
  type        = number
  default     = 5
}

variable "tags" {
  type    = map(string)
  default = {}
}
