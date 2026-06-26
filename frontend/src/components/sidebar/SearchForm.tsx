import { Search } from "lucide-react"

import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar"

export function SearchForm({ onClick, ...props }: React.ComponentProps<"div"> & { onClick?: () => void }) {
  const isMac = false

  return (
    <div {...props}>
      <SidebarGroup className='py-0'>
        <SidebarGroupContent className='relative'>
          <button onClick={onClick} className='flex w-full items-center gap-2 cursor-pointer rounded-lg border border-black/10 dark:border-white/10 bg-background/30 px-3 h-8 text-sm text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-sm'>
            <Search className='size-4 shrink-0' />
            <span className='flex-1 text-left text-xs truncate'>Search system...</span>
            <kbd className='pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-black/10 dark:border-white/10 bg-background/40 px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm'>
              {isMac ? (
                <>
                  <span className='text-xs leading-none mt-0.5'>⌘</span>K
                </>
              ) : (
                <span>Ctrl K</span>
              )}
            </kbd>
          </button>
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  )
}
