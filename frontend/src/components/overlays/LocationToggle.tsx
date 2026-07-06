import { MapPin } from "lucide-react"

import { useGeolocation } from "@/hooks/use-geolocation"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function LocationToggle() {
  const { findMe } = useGeolocation()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={findMe} className='cursor-pointer pointer-events-auto p-2 bg-background/60 backdrop-blur-xl rounded-full shadow-lg border border-white/10 border-t-white/20 border-l-white/20 hover:bg-muted/80 transition-colors'>
          <MapPin className='w-5 h-5' />
        </button>
      </TooltipTrigger>
      <TooltipContent side='left' sideOffset={8}>
        Locate Me
      </TooltipContent>
    </Tooltip>
  )
}
