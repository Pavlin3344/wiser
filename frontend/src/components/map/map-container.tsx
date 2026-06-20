import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapContainerProps {
  basemap: "topographic" | "satellite";
  mapView: "2d" | "3d";
  showFires: boolean;
}

const mockFireData = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.5, 42.0] },
      properties: { intensity: "high" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.2, 42.1] },
      properties: { intensity: "moderate" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.8, 41.8] },
      properties: { intensity: "critical" },
    },
  ],
};

export function MapContainer({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  basemap,
  mapView,
  showFires,
}: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  const currentStyleUrl = useRef<string>("");

  useEffect(() => {
    if (map.current) return;

    const initialStyle = "https://demotiles.maplibre.org/style.json";
    currentStyleUrl.current = initialStyle;

    map.current = new maplibregl.Map({
      container: mapContainer.current!,
      style: initialStyle,
      center: [25.5, 42.0],
      zoom: 7,
      attributionControl: false,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-left");

    map.current.on("load", () => {
      map.current?.addSource("active-fires", {
        type: "geojson",
        data: mockFireData,
      });

      map.current?.addLayer({
        id: "fire-points",
        type: "circle",
        source: "active-fires",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 12],
          "circle-color": "#ef4444",
          "circle-opacity": 0.8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
        layout: {
          visibility: showFires ? "visible" : "none",
        },
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize();
    });

    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!map.current) return;

    const mapInstance = map.current;

    const applyUpdates = () => {
      mapInstance.setProjection({
        type: mapView === "3d" ? "globe" : "mercator",
      });

      mapInstance.flyTo({
        pitch: 0,
        bearing: 0,
        zoom: mapView === "3d" ? 2 : 7,
        duration: 1500,
      });

      if (mapInstance.getLayer("fire-points")) {
        mapInstance.setLayoutProperty(
          "fire-points",
          "visibility",
          showFires ? "visible" : "none",
        );
      }
    };

    if (mapInstance.isStyleLoaded()) {
      applyUpdates();
    } else {
      mapInstance.once("style.load", applyUpdates);
    }
  }, [mapView, showFires]);

  return <div ref={mapContainer} className="h-full w-full" />;
}
