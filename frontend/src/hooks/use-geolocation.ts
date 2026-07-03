import { useMapStore } from "@/store/use-map-store"

export function useGeolocation(mapRef?: React.RefObject<maplibregl.Map | null>) {
  const { setFlyToTarget } = useMapStore()

  const findMe = () => {
    if (!navigator.geolocation) {
      console.warn("[Wiser] Geolocation is not supported by this browser.")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords

        setFlyToTarget({ lat: latitude, lng: longitude, zoom: 12 })

        const map = mapRef?.current
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
