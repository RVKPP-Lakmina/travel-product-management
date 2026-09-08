import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Compass } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from './auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('demo@travel.local')
  const [password, setPassword] = useState('')
  // Session persistence is handled by supabase-js (localStorage) — this
  // reflects that default rather than toggling it.
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await signIn(email, password)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="login-orbs relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="bg-gradient-brand flex size-12 items-center justify-center rounded-lg text-white shadow-sm">
            <Compass className="size-6" />
          </div>
          <h1 className="text-lg font-semibold">Travel Product Management</h1>
          <p className="text-sm text-muted-foreground">Sri Lanka Admin Portal</p>
        </div>

        <Card>
          <CardHeader className="sr-only">Sign in</CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!error}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(v) => setRemember(v === true)}
                    aria-label="Remember me"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() =>
                    toast.info('Contact your workspace administrator to reset your password.')
                  }
                  className="rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="mt-1 w-full" loading={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Local demo account: <span className="font-mono">demo@travel.local</span> /{' '}
          <span className="font-mono">DemoPassword123!</span>
        </p>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Travel Products Sri Lanka. All rights reserved.
      </p>
    </div>
  )
}
