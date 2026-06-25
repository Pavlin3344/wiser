export const mockEvacuationRoutes: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { routeName: "Alpha-1 Safe Corridor", status: "open" },
      geometry: {
        type: "LineString",
        coordinates: [
          [25.5, 42.0],
          [25.55, 42.05],
          [25.65, 42.1],
          [25.8, 42.15],
        ],
      },
    },
    {
      type: "Feature",
      properties: { routeName: "Beta-2 Evac", status: "open" },
      geometry: {
        type: "LineString",
        coordinates: [
          [25.2, 42.1],
          [25.15, 42.2],
          [25.1, 42.3],
        ],
      },
    },
  ],
}
