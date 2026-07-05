import React, { memo, useMemo } from "react"
import { Map, Flame, LineChart, Bell, Command, Settings, ChevronsUpDown, Sparkles, BadgeCheck, CreditCard, LogOut, LifeBuoy, Send, Download, Smartphone } from "lucide-react"

import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, Sidebar, SidebarHeader, SidebarFooter, SidebarRail, SidebarGroupContent, useSidebar } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

import { AnalysisPage } from "@/pages/phase3/AnalysisPage"
import { AlertsPage } from "@/pages/alerts/AlertsPage"
import { RiskAssessmentPage } from "@/pages/phase1/RiskAssessmentPage"
import { DetectionPage } from "@/pages/phase2/DetectionPage"
import { SearchForm } from "@/components/sidebar/SearchForm"
import { CommandMenu } from "@/components/sidebar/CommandMenu"

import { useUIStore } from "@/store/use-ui-store"
import { usePWAInstall } from "@/hooks/use-pwa-install"

const NAV_ITEMS = [
  { id: "risk", label: "Risk Assessment", Icon: Map },
  { id: "detection", label: "Detection", Icon: Flame },
  { id: "analysis", label: "Analysis & Trends", Icon: LineChart },
  { id: "alerts", label: "System Alerts", Icon: Bell },
] as const

const UserMenu = memo(function UserMenu() {
  return (
    <SidebarMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size='lg' className='data-[state=open]:bg-background/20 data-[state=open]:backdrop-blur-xl data-[state=open]:text-sidebar-accent-foreground cursor-pointer'>
            <Avatar className='h-8 w-8 rounded-full after:border after:border-border/10 dark:after:border-border'>
              <AvatarImage alt='Guest' />
              <AvatarFallback className='rounded-full'>GU</AvatarFallback>
              <AvatarBadge className="bg-green-600 dark:bg-green-800" />
            </Avatar>
            <div className='grid flex-1 text-left text-sm leading-tight'>
              <span className='truncate font-medium'>Guest User</span>
              <span className='truncate text-xs'>guestuser@wisertech.com</span>
            </div>
            <ChevronsUpDown className='ml-auto size-4' />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='bg-background/60 backdrop-blur-xl w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-2xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20 ring-0' side='right' align='end' sideOffset={19} alignOffset={-10}>
          <DropdownMenuLabel className='p-0 font-normal'>
            <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
              <Avatar className='h-8 w-8 rounded-full after:border after:border-border/10 dark:after:border-border'>
                <AvatarImage alt='Guest User' />
                <AvatarFallback className='rounded-full'>GU</AvatarFallback>
                <AvatarBadge className="bg-green-600 dark:bg-green-800" />
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
  const { activeSidebarTab, setActiveSidebarTab } = useUIStore()
  const [commandOpen, setCommandOpen] = React.useState(false)
  const { isMobile, setOpenMobile } = useSidebar()
  const { installPrompt, isStandalone, isIOS, install } = usePWAInstall()

  // Lazy render: only the active tab is mounted — avoids rendering all 4 views at startup
  const tabContent = useMemo(() => {
    switch (activeSidebarTab) {
      case "risk": return <RiskAssessmentPage />
      case "detection": return <DetectionPage />
      case "analysis": return <AnalysisPage />
      case "alerts": return <AlertsPage />
    }
  }, [activeSidebarTab])

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
                <SidebarMenuButton
                  onClick={() => {
                    setActiveSidebarTab(id)
                    if (isMobile) {
                      setOpenMobile(false)
                    }
                  }}
                  isActive={activeSidebarTab === id}
                >
                  <Icon className={activeSidebarTab === id ? "text-destructive" : ""} />
                  {label}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {tabContent}

        <SidebarGroup className='mt-auto'>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Native install option for Android / Chrome */}
              {installPrompt && (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={install} size='sm' className='text-destructive! hover:text-destructive! hover:bg-destructive/10 cursor-pointer font-semibold animate-pulse'>
                    <Download />
                    <span>Install Wiser</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Install instructions for iOS Safari */}
              {isIOS && !isStandalone && (
                <SidebarMenuItem>
                  <Dialog>
                    <DialogTrigger asChild>
                      <SidebarMenuButton size='sm' className='text-destructive! hover:text-destructive! hover:bg-destructive/10 cursor-pointer font-semibold animate-pulse'>
                        <Smartphone />
                        <span>Install on iOS</span>
                      </SidebarMenuButton>
                    </DialogTrigger>
                    <DialogContent className='bg-background/80 backdrop-blur-xl border border-white/10 border-t-white/20 border-l-white/20 shadow-lg rounded-2xl p-6 text-foreground max-w-xs'>
                      <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                          <Smartphone className="text-destructive size-4" /> Install Wiser Core
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                          Add Wiser Core to your home screen to use it as a standalone full screen app.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 my-2 text-xs">
                        <div className="flex gap-3 items-start">
                          <div className="flex items-center justify-center size-5 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold shrink-0 mt-0.5">1</div>
                          <p>Open this dashboard in the <strong>Safari</strong> app.</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="flex items-center justify-center size-5 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold shrink-0 mt-0.5">2</div>
                          <p>Tap the <strong>Share</strong> button (square with an up arrow) in the Safari toolbar.</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="flex items-center justify-center size-5 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold shrink-0 mt-0.5">3</div>
                          <p>Scroll down the list and select <strong>"Add to Home Screen"</strong>.</p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </SidebarMenuItem>
              )}

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

