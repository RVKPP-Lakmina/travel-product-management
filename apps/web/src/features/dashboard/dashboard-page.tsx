import { Link, useNavigate } from 'react-router'
import { Info, Plus, ArrowRight } from 'lucide-react'
import { useDashboardStats, useProducts } from '@/features/products/hooks'
import { StatTile } from './stat-tile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/features/products/status-badge'
import { formatLKR, daysUntil } from '@/lib/format'
import { GenerateProductDialog } from '@/features/ai/generate-product-dialog'

export function DashboardPage() {
  const stats = useDashboardStats()
  const recent = useProducts({ sort: 'created_desc', limit: 5, status: 'any' })
  const expiringCandidates = useProducts({ sort: 'valid_until_asc', limit: 10, status: 'active' })
  const navigate = useNavigate()

  const expiringSoon = (expiringCandidates.data?.items ?? []).filter((p) => daysUntil(p.validUntil) <= 7).slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your travel products</p>
        </div>
        <div className="flex gap-2">
          <GenerateProductDialog
            onApply={(draft, meta) => navigate('/products/new', { state: { draft, meta } })}
          />
          <Button asChild variant="secondary">
            <Link to="/products/new">
              <Plus />
              New Product
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Total Products" value={stats.data?.total} accent="primary" />
        <StatTile label="Active Products" value={stats.data?.active} accent="active" />
        <StatTile label="Expired Products" value={stats.data?.expired} accent="expired" />
      </div>
      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          These counts are independent — a product can be inactive <em>and</em> expired at once, so they don't
          necessarily add up to the total.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recently added</CardTitle>
            <Link to="/products" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View all <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {recent.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : recent.data?.items.length ? (
              recent.data.items.map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}/edit`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-secondary/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.destination}</p>
                  </div>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatLKR(p.price)}</span>
                </Link>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No products yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expiring in 7 days</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {expiringCandidates.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : expiringSoon.length ? (
              expiringSoon.map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}/edit`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-secondary/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                  </div>
                  <StatusBadge status={p.status} validUntil={p.validUntil} isExpired={p.isExpired} />
                </Link>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing expiring soon.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
