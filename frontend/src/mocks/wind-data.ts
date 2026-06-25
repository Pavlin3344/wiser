export const mockWindVectors: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { speed: 15, direction: 45 }, geometry: { type: "Point", coordinates: [25.4, 42.05] } },
    { type: "Feature", properties: { speed: 22, direction: 60 }, geometry: { type: "Point", coordinates: [25.5, 41.95] } },
    { type: "Feature", properties: { speed: 18, direction: 90 }, geometry: { type: "Point", coordinates: [25.3, 42.1] } },
    { type: "Feature", properties: { speed: 12, direction: 30 }, geometry: { type: "Point", coordinates: [25.7, 41.8] } },
  ],
}
