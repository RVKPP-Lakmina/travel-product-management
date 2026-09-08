import { useState, type CSSProperties } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  Package,
  BarChart3,
  Settings,
  Menu,
  LogOut,
  Moon,
  Sun,
  Compass,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-provider'
import { useTheme } from '@/app/theme-provider'
import { useSidebar, SIDEBAR_WIDTH, SIDEBAR_RAIL_WIDTH } from '@/app/sidebar-provider'
import { NotificationBell } from '@/features/notifications/notification-bell'
import { CommandPalette } from '@/features/command/command-palette'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Package, end: false },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

function NavItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: (typeof NAV_ITEMS)[number]
  collapsed: boolean
  onNavigate?: () => void
}) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-md py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          collapsed ? 'justify-center px-2' : 'gap-3 px-3',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon className="size-4 shrink-0" />
          {collapsed ? (
            <span className="sr-only">{item.label}</span>
          ) : (
            <>
              <span className="truncate">{item.label}</span>
              {isActive && (
                <span className="ml-auto size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  )

  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavItem key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', collapsed ? 'justify-center' : 'px-1')}>
      <div className="bg-gradient-brand flex size-8 shrink-0 items-center justify-center rounded-md text-white">
        <Compass className="size-4" />
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5">Travel Products</p>
          <p className="truncate text-xs leading-4 text-muted-foreground">Sri Lanka</p>
        </div>
      )}
    </div>
  )
}

function CollapseToggle() {
  const { collapsed, toggleCollapsed } = useSidebar()

  const button = (
    <Button
      variant="ghost"
      onClick={toggleCollapsed}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className={cn('w-full text-muted-foreground', collapsed ? 'justify-center px-2' : 'justify-start')}
    >
      {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      {!collapsed && 'Collapse'}
    </Button>
  )

  if (!collapsed) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">Expand sidebar</TooltipContent>
    </Tooltip>
  )
}

function UserMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {initials}
          <span className="sr-only">Account menu</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-foreground">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={toggleTheme}>
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            signOut()
            navigate('/login')
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { collapsed } = useSidebar()

  return (
    <TooltipProvider delayDuration={200}>
      {/* --sidebar-w is set here rather than on <html> so it stays scoped to
          the app shell. Custom properties inherit through the DOM, so the
          product form's *fixed* action bar picks it up without needing to
          know the sidebar exists. */}
      <div
        className="min-h-dvh bg-background"
        style={{ '--sidebar-w': collapsed ? SIDEBAR_RAIL_WIDTH : SIDEBAR_WIDTH } as CSSProperties}
      >
        {/* Desktop sidebar — 256px, or a 64px icon rail when collapsed */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-w) flex-col border-r border-border bg-card transition-[width] duration-200 md:flex">
          <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'px-2' : 'px-4')}>
            <Brand collapsed={collapsed} />
          </div>
          <div className={cn('flex-1 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
            <NavList collapsed={collapsed} />
          </div>
          <div className={cn('shrink-0 border-t border-border py-2', collapsed ? 'px-2' : 'px-3')}>
            <CollapseToggle />
          </div>
        </aside>

        {/* Mobile / tablet nav sheet — always shows the expanded nav */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent>
            <Brand />
            <NavList onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="transition-[padding] duration-200 md:pl-(--sidebar-w)">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur supports-backdrop-filter:bg-card/80 sm:px-6">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)}>
              <Menu className="size-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
            <div className="min-w-0 flex-1 md:hidden">
              <Brand />
            </div>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
                className="mr-2 hidden h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring md:flex"
              >
                <Search className="size-4" />
                <span>Search…</span>
                <kbd className="ml-2 rounded border border-border px-1 text-xs">⌘K</kbd>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
              >
                <Search className="size-5" />
                <span className="sr-only">Search</span>
              </Button>
              <NotificationBell />
              <UserMenu />
            </div>
          </header>

          <CommandPalette />

          <main className="p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
