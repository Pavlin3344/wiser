import { useSidebar } from "@/components/ui/sidebar"
import { TopStats } from "@/components/overlays/TopStats"
import { SpatialContext } from "@/components/overlays/SpatialContext"

export function TopBar() {
  const { open, isMobile } = useSidebar()
  const leftClass = (!isMobile && open) ? "left-(--sidebar-width,16rem)" : "left-2"

  return (
    <div
      className={`absolute top-2 z-10 flex flex-col gap-2 pointer-events-none transition-all duration-300 ease-in-out ${leftClass}`}
    >
      <TopStats />
      <SpatialContext />
    </div>
  )
}
