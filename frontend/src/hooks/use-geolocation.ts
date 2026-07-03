import { useMapStore } from "@/store/use-map-store"

export function useGeolocation() {
  const { setFlyToTarget, mapInstance, setUserLocation } = useMapStore()

  const findMe = () => {
    if (!navigator.geolocation) {
      console.warn("[Wiser] Geolocation is not supported by this browser.")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords

        setUserLocation({ lat: latitude, lng: longitude })
        setFlyToTarget({ lat: latitude, lng: longitude, zoom: 12 })

        const map = mapInstance
        if (!map) return

        const source = map.getSource("user-location") as maplibregl.GeoJSONSource | undefined
        if (source) {
          source.setData({
            type: "Feature",
            geometry: { type: "Point", coordinates: [longitude, latitude] },
            properties: {},
          })
        } else {
          console.warn("[Wiser] Source 'user-location' not initialized yet.")
        }
      },
      (err) => {
        console.warn(`[Wiser] Geolocation error (${err.code}): ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return { findMe }
}

