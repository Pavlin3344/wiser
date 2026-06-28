import { MapPin } from "lucide-react"

import { useGeolocation } from "@/hooks/use-geolocation"

export function LocationToggle() {
  const { findMe } = useGeolocation()

  return (
    <button onClick={findMe} className='cursor-pointer pointer-events-auto p-2 bg-background/60 backdrop-blur-xl rounded-full shadow-lg border border-white/20 hover:bg-destructive/80 transition-colors' title='Locate Me'>
      <MapPin className='w-5 h-5' />
    </button>
  )
}
