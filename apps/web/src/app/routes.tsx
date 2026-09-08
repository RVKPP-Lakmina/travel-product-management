import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { ProtectedRoute } from './protected-route'
import { AppLayout } from './layout'
import { LoginPage } from '@/features/auth/login-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { ProductsListPage } from '@/features/products/products-list-page'
import { ProductFormPage } from '@/features/products/product-form-page'
import { SettingsPage } from '@/features/settings/settings-page'

// Analytics pulls in recharts (+ d3). Lazy so that ~150KB stays out of the
// initial bundle for the routes everyone actually lands on first.
const AnalyticsPage = lazy(() =>
  import('@/features/analytics/analytics-page').then((m) => ({ default: m.AnalyticsPage })),
)

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsListPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id/edit" element={<ProductFormPage />} />
          <Route
            path="analytics"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AnalyticsPage />
              </Suspense>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
