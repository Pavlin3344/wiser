/**
 * Prefix for every /api/* call. Empty by default, so a bare fetch("/api/...") still
 * goes through the same-origin nginx proxy - that's Compose and local dev, unchanged.
 *
 * On Azure the frontend and api are separate Container Apps; nginx proxying between
 * them over the platform's own ingress has proven unreliable (SNI, HTTP/1.0, growing
 * forwarded-for headers, retry storms - see project_azure_demo_setup memory), so the
 * Azure build sets VITE_API_BASE_URL to api's own public URL and the browser calls it
 * directly instead.
 *
 * Baked in at build time (Vite inlines import.meta.env.*), not read at container
 * start - the Azure Dockerfile build must pass it as a build arg.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""
