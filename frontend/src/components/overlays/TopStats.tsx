import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { useDataStore } from "@/store/use-data-store"

const riskStyles = {
  Low: "text-green-500 bg-green-500/10",
  Moderate: "text-amber-500 bg-amber-500/10",
  High: "text-orange-500 bg-orange-500/10",
  Critical: "text-red-500 bg-red-500/10",
}

export function TopStats() {
  const activeFireCount = useDataStore((s) => s.activeFireCount)
  const overallRiskLevel = useDataStore((s) => s.overallRiskLevel)

  return (
    <div className='flex items-center gap-2 pointer-events-none transition-all duration-300 ease-in-out'>
      <div className='pointer-events-auto'>
        <SidebarTrigger className='bg-background/60 backdrop-blur-xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20 hover:bg-background/80 h-10 w-10 rounded-full cursor-pointer' />
      </div>

      <div className='relative pointer-events-auto bg-background/60 backdrop-blur-xl shadow-lg rounded-full border border-white/10 border-t-white/20 border-l-white/20 flex items-center h-10 px-3 gap-2'>
        <div className='absolute inset-0 rounded-full bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

        <div className='flex items-center gap-2'>
          <span className='relative flex h-2 w-2'>
            <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75'></span>
            <span className='relative inline-flex rounded-full h-2 w-2 bg-destructive'></span>
          </span>
          <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Active Fires</span>
          <Badge variant='destructive' className='h-5 px-1.5 text-xs font-bold'>
            {activeFireCount}
          </Badge>
        </div>
      </div>

      <div className='relative pointer-events-auto bg-background/60 backdrop-blur-xl shadow-lg rounded-full border border-white/10 border-t-white/20 border-l-white/20 flex items-center h-10 px-3 gap-2'>
        <div className='absolute inset-0 rounded-full bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

        <div className='flex items-center gap-2'>
          <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Risk</span>
          <Badge variant='default' className={`h-5 px-1.5 text-xs font-bold ${riskStyles[overallRiskLevel]}`}>
            {overallRiskLevel}
          </Badge>
        </div>
      </div>
    </div>
  )
}
