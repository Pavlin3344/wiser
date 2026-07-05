import { useMapStore } from "@/store/use-map-store"
import { toast } from "sonner"

export function useGeolocation() {
  const { setFlyToTarget, mapInstance, setUserLocation } = useMapStore()

  const findMe = () => {
    if (!navigator.geolocation) {
      const isHttp = window.location.protocol === "http:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"

      console.warn("[Wiser] Geolocation is not supported by this browser.")
      toast.error("Geolocation Unsupported", {
        description: isHttp
          ? "Geolocation requires a secure connection (HTTPS) on deployed servers. Please configure SSL/HTTPS."
          : "Geolocation is not supported by your browser or current settings.",
        duration: 8000,
      })
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
          toast.warning("User location map source is not initialized yet")
        }
      },
      (err) => {
        console.warn(`[Wiser] Geolocation error (${err.code}): ${err.message}`)
        toast.warning(`[Wiser] Geolocation error (${err.code}): ${err.message}`)

        let message = `Unable to retrieve your location (Error ${err.code}: ${err.message}).`
        let title = "Location Error"

        if (err.code === 1) {
          // Permission Denied / Insecure origin
          title = "Permission Denied"
          const isHttp = window.location.protocol === "http:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"

          if (isHttp) {
            message = "Location permission denied. Geolocation requires a secure connection (HTTPS) on deployed servers. Please configure SSL/HTTPS."
          } else {
            message = "Location permission denied. Please allow location access in your browser settings."
          }
        } else if (err.code === 2) {
          title = "Position Unavailable"
          message = "Position unavailable. Please check your device's location services or network connection."
        } else if (err.code === 3) {
          title = "Timeout"
          message = "Location request timed out. Please try again."
        }

        toast.error(title, {
          description: message,
          duration: 8000,
        })
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return { findMe }
}
