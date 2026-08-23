# Service Bus, replacing RabbitMQ.
#
# Basic tier, deliberately: the stack moves roughly 3 000 messages a month, which bills at
# about a hundredth of a cent, while Standard carries an 8.60 EUR base charge - more than
# the RabbitMQ container costs today. Nothing here fans one message out to several
# consumers, so queues are enough and topics are not needed.
#
# ⚠ Basic has no Private Link. Private Endpoints, VNet service endpoints and IP filtering
# are all Premium-only features, and Premium starts around 600 EUR/month. So unlike the
# databases and the blob store, this namespace is reached over its public endpoint,
# protected by TLS and by authorisation rather than by network isolation. That is a real
# difference from the rest of the design and should be said out loud rather than drawn as
# a private link on the diagram.
#
# The six RabbitMQ dead-letter queues disappear: Service Bus dead-letters natively, so
# `infra/docker/rabbitmq/definitions.json` and its `dlx.exchange` stop existing.

resource "azurerm_servicebus_namespace" "main" {
  name                = "sb-${var.prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = var.sku

  # Entra ID auth over shared access keys where the caller can manage an identity. The
  # namespace still issues SAS for anything that cannot.
  local_auth_enabled = var.local_auth_enabled

  tags = var.tags
}

# Only the queues that actually carry traffic. `fire.alerts` and `evacuation.routes` exist
# in the RabbitMQ definitions with neither a producer nor a consumer - the alerts and the
# evacuation routing were both implemented directly in Java instead. Carrying dead config
# into a new broker is how it becomes permanent, so they are left out; add a name here if
# either is ever wired up.
resource "azurerm_servicebus_queue" "main" {
  for_each = var.queues

  name         = each.key
  namespace_id = azurerm_servicebus_namespace.main.id

  # A worker that dies mid-message must not lose it: the lock expires and the message is
  # redelivered. Five minutes covers a dNBR scene, which is the slowest thing handled.
  lock_duration = each.value.lock_duration

  max_delivery_count = each.value.max_delivery_count

  # Explicit dead-lettering on expiry. The Python workers reject malformed messages with
  # `requeue=False` today, which becomes a native dead-letter call.
  dead_lettering_on_message_expiration = true

  default_message_ttl = each.value.ttl

  # Note there is no message-size setting to make here: 256 KB is fixed on Basic and
  # Standard (only Premium can raise it). The daily FWI grid used to be 222.8 KB of that
  # ceiling - 87% - which is why the downloader now writes the grid to blob storage and
  # publishes a 255-byte reference instead. Halving the grid spacing would have broken it.
}
