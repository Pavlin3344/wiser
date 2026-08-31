# Optional custom domain on the frontend app, e.g. fire-cast.com. Added instead of a
# registrar-level "forward with masking": masking wraps the destination in an iframe
# hosted by the registrar, which our CSP's frame-ancestors 'none' (frontend/nginx.conf)
# correctly refuses to render - see project_azure_demo_setup memory. A real binding
# serves the app directly under the custom domain, so no CSP exception is needed.
#
# The DNS records have to already resolve before this applies, or Azure's domain
# validation fails the apply. For an apex domain (no subdomain, e.g. "fire-cast.com"
# itself) that's an A + TXT pair, not a CNAME:
#   A    @      <this environment's static IP - `az containerapp env show --query properties.staticIp`>
#   TXT  asuid  <the frontend app's verification code - `az containerapp show -n ca-<prefix>-frontend --query properties.customDomainVerificationId`>
# A subdomain (e.g. "app.fire-cast.com") would instead need a CNAME to the frontend
# app's default *.azurecontainerapps.io hostname, plus a TXT at asuid.<subdomain>. See
# https://learn.microsoft.com/azure/container-apps/custom-domains-managed-certificates
resource "azurerm_container_app_custom_domain" "frontend" {
  count = var.custom_domain != "" ? 1 : 0

  name             = var.custom_domain
  container_app_id = azurerm_container_app.main["frontend"].id

  # Left for Azure to manage: once the domain validates, it auto-issues and binds a
  # free managed certificate and fills these two fields in itself. Without
  # ignore_changes, every later plan sees them as drift back to null and wants to
  # unbind the certificate it just issued.
  lifecycle {
    ignore_changes = [certificate_binding_type, container_app_environment_certificate_id]
  }
}
