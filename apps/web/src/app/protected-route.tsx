import { Navigate, Outlet } from 'react-router'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
