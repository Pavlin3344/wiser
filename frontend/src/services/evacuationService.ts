import type { FeatureCollection } from "geojson"
import { API_BASE_URL } from "@/lib/api"

/** Raised when the roads table has no pgRouting topology imported yet. */
export class RoutingTopologyMissingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RoutingTopologyMissingError"
  }
}

/**
 * Escape routes from a position, towards the nearest assembly points, along roads
 * the backend has verified do not run beside an active fire.
 */
export async function fetchEvacuationRoutes(lat: number, lng: number): Promise<FeatureCollection> {
  const res = await fetch(`${API_BASE_URL}/api/evacuation/routes?lat=${lat}&lng=${lng}`)

  if (res.status === 409) {
    const body = await res.json().catch(() => ({ message: "Routing topology is not imported." }))
    throw new RoutingTopologyMissingError(body.message ?? "Routing topology is not imported.")
  }
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`)
  }
  return res.json() as Promise<FeatureCollection>
}
