import React, { memo } from "react"
import { Map, Flame, LineChart, Bell, Command, Settings, ChevronsUpDown, Sparkles, BadgeCheck, CreditCard, LogOut, LifeBuoy, Send } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, Sidebar, SidebarHeader, SidebarFooter, SidebarRail, SidebarGroupContent } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import { AnalysisView } from "@/components/sidebar/AnalysisView"
import { AlertsView } from "@/components/sidebar/AlertsView"
import { FiltersView } from "@/components/sidebar/FiltersView"
import { DetectionView } from "@/components/sidebar/DetectionView"
import { SearchForm } from "@/components/sidebar/SearchForm"
import { CommandMenu } from "@/components/sidebar/CommandMenu"

import { useMapStore } from "@/store/use-map-store"

const NAV_ITEMS = [
  { id: "risk", label: "Risk Assessment", Icon: Map },
  { id: "detection", label: "Detection", Icon: Flame },
  { id: "analysis", label: "Analysis & Trends", Icon: LineChart },
  { id: "alerts", label: "System Alerts", Icon: Bell },
] as const

type Tab = (typeof NAV_ITEMS)[number]["id"]

const TAB_CONTENT: Record<Tab, React.ReactNode> = {
  risk: <FiltersView />,
  detection: <DetectionView />,
  analysis: <AnalysisView />,
  alerts: <AlertsView />,
}

const UserMenu = memo(function UserMenu() {
  return (
    <SidebarMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size='lg' className='data-[state=open]:bg-background/20 data-[state=open]:backdrop-blur-xl data-[state=open]:text-sidebar-accent-foreground hover:bg-background/30'>
            <Avatar className='h-8 w-8 rounded-full'>
              <AvatarImage alt='Guest' />
              <AvatarFallback className='rounded-full'>GU</AvatarFallback>
            </Avatar>
            <div className='grid flex-1 text-left text-sm leading-tight'>
              <span className='truncate font-medium'>Guest User</span>
              <span className='truncate text-xs'>guestuser@wisertech.com</span>
            </div>
            <ChevronsUpDown className='ml-auto size-4' />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='bg-background/60 backdrop-blur-xl w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg' side='right' align='end' sideOffset={4}>
          <DropdownMenuLabel className='p-0 font-normal'>
            <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
              <Avatar className='h-8 w-8 rounded-full'>
                <AvatarImage alt='Guest User' />
                <AvatarFallback className='rounded-full'>GU</AvatarFallback>
              </Avatar>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-medium'>Guest User</span>
                <span className='truncate text-xs'>guestuser@wisertech.com</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={true}>
              <Sparkles />
              Upgrade to Pro
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={true}>
              <BadgeCheck />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem disabled={true}>
              <CreditCard />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem disabled={true}>
              <Bell />
              Notifications
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Settings />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem disabled={true}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenu>
  )
})

export function AppSidebar() {
  const { activeSidebarTab, setActiveSidebarTab } = useMapStore()
  const [commandOpen, setCommandOpen] = React.useState(false)

  return (
    <Sidebar
      variant='floating'
      collapsible='offcanvas'
      className='
        h-[calc(100vh-2.5rem)]

        [--sidebar-background:transparent]
        [--sidebar-border:transparent]

        [&>div]:bg-background/60
        [&>div]:backdrop-blur-xl
        [&>div]:shadow-lg!
        [&>div]:border
        [&>div]:border-white/10
        [&>div]:border-t-white/20
        [&>div]:border-l-white/20
      '
    >
      <div className='absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none rounded-2xl z-0' />

      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <a href='#'>
                <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-destructive text-sidebar-primary-foreground'>
                  <Command className='size-4' />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-medium'>Wiser Core</span>
                  <span className='truncate text-xs'>Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SearchForm onClick={() => setCommandOpen(true)} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map(({ id, label, Icon }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton onClick={() => setActiveSidebarTab(id)} isActive={activeSidebarTab === id}>
                  <Icon className={activeSidebarTab === id ? "text-destructive" : ""} />
                  {label}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {TAB_CONTENT[activeSidebarTab]}

        <SidebarGroup className='mt-auto'>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild size='sm'>
                  <a href='#'>
                    <LifeBuoy />
                    <span>Support</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild size='sm'>
                  <a href='#'>
                    <Send />
                    <span>Feedback</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>

      <SidebarRail />
      <CommandMenu open={commandOpen} setOpen={setCommandOpen} />
    </Sidebar>
  )
}
