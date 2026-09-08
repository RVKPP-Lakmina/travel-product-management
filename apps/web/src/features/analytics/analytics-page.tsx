import { Link } from 'react-router'
import { RotateCcw, Info, PackageX, AlertTriangle } from 'lucide-react'
import { useProductAnalytics } from './hooks'
import { AnalyticsSkeleton, GRID_TWO_ONE, GRID_ONE_TWO } from './analytics-skeleton'
import { ChartFrame } from './chart-frame'
import { CategoryBar } from './charts/category-bar'
import { DestinationsBar } from './charts/destinations-bar'
import { StatusDonut } from './charts/status-donut'
import { ExpiryBar } from './charts/expiry-bar'
import { MonthColumns } from './charts/month-columns'
import { StatTile } from '@/features/dashboard/stat-tile'
import { Button } from '@/components/ui/button'
import { formatLKR, formatCompact } from '@/lib/format'

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function AnalyticsPage() {
  const analytics = useProductAnalytics()

  if (analytics.isLoading) return <AnalyticsSkeleton />

  if (analytics.isError) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">Couldn't load analytics.</p>
          <Button variant="outline" onClick={() => analytics.refetch()}>
            <RotateCcw />
            Try again
          </Button>
        </div>
      </Shell>
    )
  }

  const a = analytics.data!
  const { totals } = a

  if (totals.totalProducts === 0) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-secondary/30 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <PackageX className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            No products yet. Add your first product to see analytics.
          </p>
          <Button asChild>
            <Link to="/products/new">Add Product</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell updatedAt={a.generatedAt} onRefresh={() => analytics.refetch()} refreshing={analytics.isFetching}>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile
          label="Catalog Value"
          value={`LKR ${formatCompact(totals.catalogValue)}`}
          accent="primary"
          caption="Sum of price × inventory"
        />
        <StatTile
          label="Total Inventory"
          value={totals.totalInventory}
          accent="active"
          caption={`Across ${totals.totalProducts} products`}
        />
        <StatTile
          label="Average Price"
          value={formatLKR(totals.avgPrice)}
          accent="inactive"
          caption={`Range ${formatCompact(totals.minPrice)}–${formatCompact(totals.maxPrice)}`}
        />
        <StatTile
          label="Expiring ≤ 30 days"
          value={a.expiry.find((b) => b.bucket === 'd7')!.count + a.expiry.find((b) => b.bucket === 'd30')!.count}
          accent="expired"
          caption={`${totals.expired} already expired`}
        />
      </div>

      <ChartFrame
        title="Catalog health"
        caption="Products by time remaining in their validity window"
        height="h-32"
      >
        <ExpiryBar data={a.expiry} />
      </ChartFrame>

      <div className={GRID_TWO_ONE}>
        <ChartFrame
          title="By category"
          caption="Product count per category"
          height="h-72"
          className="lg:col-span-2"
        >
          <CategoryBar data={a.byCategory} />
        </ChartFrame>
        <ChartFrame title="By status" height="h-56" className="lg:col-span-1">
          <StatusDonut data={a.byStatus} total={totals.totalProducts} />
        </ChartFrame>
      </div>

      <div className={GRID_ONE_TWO}>
        <ChartFrame
          title="Top destinations"
          caption={
            totals.distinctDestinations > a.topDestinations.length
              ? `Top ${a.topDestinations.length} of ${totals.distinctDestinations}`
              : undefined
          }
          height="h-64"
          className="lg:col-span-1"
        >
          <DestinationsBar data={a.topDestinations} />
        </ChartFrame>
        <ChartFrame
          title="Products added"
          caption="Last 12 months"
          height="h-64"
          className="lg:col-span-2"
        >
          <MonthColumns data={a.createdByMonth} />
        </ChartFrame>
      </div>

      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          KPI figures treat status and expiry independently (a product can be inactive <em>and</em> expired),
          so they don't sum to the total. The status ring splits the same products into three exclusive
          slices — expired always wins.
        </span>
      </div>
    </Shell>
  )
}

function Shell({
  children,
  updatedAt,
  onRefresh,
  refreshing,
}: {
  children: React.ReactNode
  updatedAt?: string
  onRefresh?: () => void
  refreshing?: boolean
}) {
  return (
    <div className="page-enter mx-auto flex w-full max-w-350 flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Analytics</h1>
          <p className="text-sm text-muted-foreground">Catalog composition and health</p>
        </div>
        {updatedAt && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Updated {relativeTime(updatedAt)}</span>
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
              <RotateCcw className={refreshing ? 'animate-spin' : undefined} />
              Refresh
            </Button>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
