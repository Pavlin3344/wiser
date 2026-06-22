import type { FeatureCollection } from "geojson"

export const mockFireData: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.5, 42.0] },
      properties: { intensity: "high", title: "EFFIS Anomaly Alpha", date: new Date().toISOString() },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.2, 42.1] },
      properties: { intensity: "moderate", title: "EFFIS Anomaly Beta", date: new Date().toISOString() },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.8, 41.8] },
      properties: { intensity: "critical", title: "EFFIS Anomaly Gamma", date: new Date().toISOString() },
    },
  ],
}
