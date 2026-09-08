import { Link, useNavigate } from 'react-router'
import { Plus, ArrowRight, PackageX, CalendarCheck, ShieldAlert } from 'lucide-react'
import { useDashboardStats, useProducts, useExpiringSoon } from '@/features/products/hooks'
import { StatTile } from './stat-tile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CardEmpty, CardError } from '@/components/card-states'
import { StatusBadge } from '@/features/products/status-badge'
import { CategoryPill } from '@/features/products/category-pill'
import { ProductThumb } from '@/features/products/product-thumb'
import { AiSparkle } from '@/features/ai/ai-badge'
import { formatLKR, formatDate, daysUntil } from '@/lib/format'
import { GenerateProductDialog } from '@/features/ai/generate-product-dialog'

const ROW_LINK =
  'flex items-center gap-3 rounded-md px-2 py-2 text-sm outline-none transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring'

export function DashboardPage() {
  const stats = useDashboardStats()
  const recent = useProducts({ sort: 'created_desc', limit: 5, status: 'any' })
  const expiring = useExpiringSoon()
  const navigate = useNavigate()

  const expiringSoon = expiring.items.slice(0, 5)

  return (
    <div className="page-enter mx-auto flex w-full max-w-350 flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your travel products</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/products/new">
              <Plus />
              New Product
            </Link>
          </Button>
          <GenerateProductDialog
            onApply={(draft, meta) => navigate('/products/new', { state: { draft, meta } })}
          />
        </div>
      </div>

      {stats.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5">
          <CardError onRetry={() => stats.refetch()} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            label="Total Products"
            value={stats.data?.total}
            accent="primary"
            caption="Across all categories and statuses"
          />
          <StatTile
            label="Active Products"
            value={stats.data?.active}
            accent="active"
            caption="Currently available for booking"
          />
          <StatTile
            label="Expired Products"
            value={stats.data?.expired}
            accent="expired"
            caption="Past their validity date"
            info="Status and expiry are independent — a product can be inactive and expired at once, so these counts don't add up to the total."
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recently added</CardTitle>
            <Link
              to="/products"
              className="flex items-center gap-1 rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              View all <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            {recent.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : recent.isError ? (
              <CardError onRetry={() => recent.refetch()} />
            ) : recent.data?.items.length ? (
              recent.data.items.map((p) => (
                <Link key={p.id} to={`/products/${p.id}/edit`} className={ROW_LINK}>
                  <ProductThumb product={p} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{p.name}</span>
                      {p.aiGenerated && <AiSparkle />}
                    </span>
                    <p className="truncate text-xs text-muted-foreground">{p.destination}</p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 md:flex">
                    <CategoryPill category={p.category} />
                    <StatusBadge status={p.status} validUntil={p.validUntil} isExpired={p.isExpired} />
                  </div>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatLKR(p.price)}</span>
                </Link>
              ))
            ) : (
              <CardEmpty icon={PackageX}>No products yet.</CardEmpty>
            )}
          </CardContent>
        </Card>

        <Card className="border-warning/40">
          <CardHeader className="flex-row items-start gap-2 space-y-0">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <CardTitle>Expiring in 7 days</CardTitle>
              <p className="text-xs text-muted-foreground">Review and renew these products</p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            {expiring.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : expiring.isError ? (
              <CardError onRetry={() => expiring.refetch()} />
            ) : expiringSoon.length ? (
              expiringSoon.map((p) => {
                const days = daysUntil(p.validUntil)
                return (
                  <Link key={p.id} to={`/products/${p.id}/edit`} className={ROW_LINK}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.destination}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-warning">
                        {days <= 0 ? 'Expires today' : `${days}d left`}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.validUntil)}</p>
                    </div>
                  </Link>
                )
              })
            ) : (
              <CardEmpty icon={CalendarCheck}>Nothing expiring soon.</CardEmpty>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
