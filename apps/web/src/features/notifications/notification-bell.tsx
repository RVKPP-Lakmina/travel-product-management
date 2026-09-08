import { Link } from 'react-router'
import { Bell, CalendarClock, CircleAlert } from 'lucide-react'
import { useExpiringSoon, useDashboardStats, EXPIRING_WINDOW_DAYS } from '@/features/products/hooks'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { daysUntil, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const MAX_ROWS = 5

/**
 * Alerts derived from data the app already fetches — there is no
 * notifications table. Expiring products come from the shared
 * `useExpiringSoon` query (same cache entry as the dashboard card); the
 * expired *count* comes from dashboard stats, because expired rows are
 * filtered out of every list endpoint by `products_listable` and so can
 * never be enumerated here.
 */
export function NotificationBell() {
  const expiring = useExpiringSoon()
  const stats = useDashboardStats()

  const expiredCount = stats.data?.expired ?? 0
  const rows = expiring.items.slice(0, MAX_ROWS)
  const unread = rows.length + (expiredCount > 0 ? 1 : 0)
  const loading = expiring.isLoading || stats.isLoading

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell />
          {!loading && unread > 0 && (
            <span
              className={cn(
                'absolute right-2 top-2 size-2 rounded-full ring-2 ring-card',
                expiredCount > 0 ? 'bg-danger' : 'bg-warning',
              )}
              aria-hidden="true"
            />
          )}
          <span className="sr-only">
            {unread > 0 ? `Notifications, ${unread} needing attention` : 'Notifications'}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-foreground">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : unread === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          <>
            {expiredCount > 0 && (
              <DropdownMenuItem asChild>
                <Link to="/products" className="gap-2">
                  <CircleAlert className="size-4 shrink-0 text-danger" />
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {expiredCount} product{expiredCount === 1 ? '' : 's'} expired
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Update their dates to bring them back
                    </span>
                  </span>
                </Link>
              </DropdownMenuItem>
            )}

            {rows.map((product) => {
              const days = daysUntil(product.validUntil)
              return (
                <DropdownMenuItem key={product.id} asChild>
                  <Link to={`/products/${product.id}/edit`} className="gap-2">
                    <CalendarClock className="size-4 shrink-0 text-warning" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{product.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {days <= 0 ? 'Expires today' : `Expires in ${days}d`} ·{' '}
                        {formatDate(product.validUntil)}
                      </span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              )
            })}

            {expiring.items.length > MAX_ROWS && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/products" className="justify-center text-xs font-medium text-primary">
                    View all {expiring.items.length} expiring within {EXPIRING_WINDOW_DAYS} days
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
