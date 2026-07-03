import { useSidebar } from "@/components/ui/sidebar"
import { TopStats } from "./TopStats"

export function TopBar() {
  const { open } = useSidebar()

  return (
    <div
      className={`absolute top-2 z-10 flex flex-col gap-2 pointer-events-none transition-all duration-300 ease-in-out ${open ? "left-(--sidebar-width,16rem)" : "left-2"
        }`}
    >
      <TopStats />
    </div>
  )
}
