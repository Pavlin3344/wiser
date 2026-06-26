import { Map, Flame, LineChart, Bell, Command, Settings, ChevronsUpDown, Sparkles, BadgeCheck, CreditCard, LogOut, LifeBuoy, Send } from "lucide-react"

import { SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, Sidebar, SidebarHeader, SidebarFooter, SidebarRail, SidebarGroupContent } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import { AnalysisView } from "@/components/sidebar/AnalysisView"
import { AlertsView } from "@/components/sidebar/AlertsView"
import { FiltersView } from "@/components/sidebar/FiltersView"
import { DetectionView } from "@/components/sidebar/DetectionView"
import { SearchForm } from "@/components/sidebar/SearchForm"
import { CommandMenu } from "@/components/sidebar/CommandMenu"

import { useMapStore } from "@/store/use-map-store"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import React from "react"

export function AppSidebar() {
  const { activeSidebarTab, setActiveSidebarTab } = useMapStore()
  const [commandOpen, setCommandOpen] = React.useState(false)

  const renderSidebarContent = () => {
    switch (activeSidebarTab) {
      case "analysis":
        return <AnalysisView />
      case "alerts":
        return <AlertsView />
      case "detection":
        return <DetectionView />
      case "risk":
      default:
        return <FiltersView />
    }
  }

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
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveSidebarTab("risk")} isActive={activeSidebarTab === "risk"}>
                <Map className={activeSidebarTab === "risk" ? "text-destructive" : ""} />
                Risk Assessment
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveSidebarTab("detection")} isActive={activeSidebarTab === "detection"}>
                <Flame className={activeSidebarTab === "detection" ? "text-destructive" : ""} />
                Detection
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveSidebarTab("analysis")} isActive={activeSidebarTab === "analysis"}>
                <LineChart className={activeSidebarTab === "analysis" ? "text-destructive" : ""} />
                Analysis & Trends
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveSidebarTab("alerts")} isActive={activeSidebarTab === "alerts"}>
                <Bell className={activeSidebarTab === "alerts" ? "text-destructive" : ""} />
                System Alerts
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {renderSidebarContent()}

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
      </SidebarFooter>

      <SidebarRail />
      <CommandMenu open={commandOpen} setOpen={setCommandOpen} />
    </Sidebar>
  )
}
