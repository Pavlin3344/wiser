import { useMapStore } from "@/store/use-map-store"
import { Pause, Play } from "lucide-react"

export function TimeSlider() {
  const { currentTime, setCurrentTime, isPlaying, setIsPlaying } = useMapStore()

  return (
    <div className='flex gap-2'>
      <button onClick={() => setIsPlaying(!isPlaying)} className='flex items-center justify-center w-8 h-8 rounded-full bg-destructive/60 text-destructive-foreground hover:bg-destructive/90 backdrop-blur-xl transition-colors shadow-lg shrink-0 cursor-pointer'>
        {isPlaying ? <Pause className='w-4 h-4 fill-current' /> : <Play className='w-4 h-4 fill-current ml-0.5' />}
      </button>
      <div className='p-2 rounded-full bg-background/60 backdrop-blur-xl border border-white/10 shadow-lg flex items-center gap-4'>
        <input type='range' min='0' max='23' value={currentTime} onChange={(e) => setCurrentTime(Number(e.target.value))} className='w-full h-2 rounded-lg appearance-none cursor-pointer bg-destructive/10 accent-destructive' />
        <div className='text-xs font-mono font-bold text-foreground w-12'>{currentTime}:00</div>
      </div>
    </div>
  )
}
