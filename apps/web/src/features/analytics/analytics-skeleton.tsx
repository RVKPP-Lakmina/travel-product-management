import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Shared so the page and this skeleton can't drift out of alignment. */
export const GRID_TWO_ONE = 'grid grid-cols-1 gap-4 lg:grid-cols-3'
export const GRID_ONE_TWO = 'grid grid-cols-1 gap-4 lg:grid-cols-3'

function FrameSkeleton({ height, className }: { height: string; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-44" />
      </CardHeader>
      <CardContent>
        <Skeleton className={`w-full ${height}`} />
      </CardContent>
    </Card>
  )
}

export function AnalyticsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-350 flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-10 w-20" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>

      <FrameSkeleton height="h-32" />

      <div className={GRID_TWO_ONE}>
        <FrameSkeleton height="h-72" className="lg:col-span-2" />
        <FrameSkeleton height="h-56" className="lg:col-span-1" />
      </div>

      <div className={GRID_ONE_TWO}>
        <FrameSkeleton height="h-64" className="lg:col-span-1" />
        <FrameSkeleton height="h-64" className="lg:col-span-2" />
      </div>
    </div>
  )
}
