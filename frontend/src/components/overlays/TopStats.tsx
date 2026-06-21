import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"

export function TopStats() {
  const { open } = useSidebar()

  return (
    <div className='absolute top-2 left-2 z-10 flex items-center gap-2 pointer-events-none'>
      {!open && (
        <div className='pointer-events-auto'>
          <SidebarTrigger className='bg-background/70 backdrop-blur-md border shadow-sm hover:bg-background h-10 w-10 rounded-xl cursor-pointer' />
        </div>
      )}

      <div className='pointer-events-auto bg-background/70 backdrop-blur-md shadow-sm rounded-full flex items-center h-10 px-3 gap-2'>
        <div className='flex items-center gap-2'>
          <span className='relative flex h-2 w-2'>
            <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75'></span>
            <span className='relative inline-flex rounded-full h-2 w-2 bg-destructive'></span>
          </span>
          <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Active Fires</span>
          <Badge variant='destructive' className='h-5 px-1.5 text-xs font-bold'>
            12
          </Badge>
        </div>
      </div>

      <div className='pointer-events-auto bg-background/70 backdrop-blur-md shadow-sm rounded-full flex items-center h-10 px-3 gap-2'>
        <div className='flex items-center gap-2'>
          <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Risk</span>
          <Badge variant='default' className='h-5 px-1.5 text-xs font-bold text-amber-500 bg-amber-500/10'>
            Moderate
          </Badge>
        </div>
      </div>
    </div>
  )
}
