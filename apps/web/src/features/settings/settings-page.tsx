import { useNavigate } from 'react-router'
import { LogOut } from 'lucide-react'
import { useTheme } from '@/app/theme-provider'
import { useSidebar } from '@/app/sidebar-provider'
import { useDensity } from '@/app/density-provider'
import { useAuth } from '@/features/auth/auth-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

function SettingRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string
  description: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {title}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const { collapsed, setCollapsed } = useSidebar()
  const { density, setDensity } = useDensity()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage how this workspace looks and behaves</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            title="Dark mode"
            description="Switch between the light and dark theme"
            htmlFor="setting-theme"
          >
            <Switch id="setting-theme" checked={theme === 'dark'} onCheckedChange={toggleTheme} />
          </SettingRow>
          <SettingRow
            title="Collapse sidebar"
            description="Show navigation as a compact icon rail. Applies on screens 1024px and wider."
            htmlFor="setting-sidebar"
          >
            <Switch id="setting-sidebar" checked={collapsed} onCheckedChange={setCollapsed} />
          </SettingRow>
          <SettingRow
            title="Compact tables"
            description="Tighter row height in the product and expired lists."
            htmlFor="setting-density"
          >
            <Switch
              id="setting-density"
              checked={density === 'compact'}
              onCheckedChange={(v) => setDensity(v ? 'compact' : 'comfortable')}
            />
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow title="Signed in as" description="The email address for this session">
            <span className="truncate text-sm text-muted-foreground">{user?.email}</span>
          </SettingRow>
          <SettingRow title="Sign out" description="End this session on this device">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                signOut()
                navigate('/login')
              }}
            >
              <LogOut />
              Sign out
            </Button>
          </SettingRow>
        </CardContent>
      </Card>
    </div>
  )
}
