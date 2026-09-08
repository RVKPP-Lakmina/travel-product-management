import { Link } from 'react-router'
import { Pencil, ImageOff } from 'lucide-react'
import type { ProductResponse } from '@travel/validation'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from './status-badge'
import { CategoryPill } from './category-pill'
import { ValidUntil } from './valid-until'
import { AiSparkle } from '@/features/ai/ai-badge'
import { formatLKR, formatDate } from '@/lib/format'

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((v) => (
          <li key={v} className="flex gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            {v}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Right-anchored quick view — a product's detail without leaving the list.
 * Fed the row's existing `ProductResponse`, so it opens with zero network.
 */
export function ProductPeek({
  product,
  onOpenChange,
}: {
  product: ProductResponse | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={!!product} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 overflow-y-auto p-0">
        {product && (
          <>
            <DialogTitle className="sr-only">{product.name}</DialogTitle>

            <div className="aspect-video w-full shrink-0 overflow-hidden border-b border-border bg-secondary">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <ImageOff className="size-6" />
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-5 p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-1.5">
                  <h2 className="text-base font-semibold leading-6">{product.name}</h2>
                  {product.aiGenerated && <AiSparkle className="mt-1" />}
                </div>
                <p className="text-sm text-muted-foreground">{product.destination}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <CategoryPill category={product.category} />
                  <StatusBadge
                    status={product.status}
                    validUntil={product.validUntil}
                    isExpired={product.isExpired}
                  />
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Price</dt>
                  <dd className="font-medium tabular-nums">{formatLKR(product.price)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Inventory</dt>
                  <dd className="font-medium tabular-nums">{product.inventoryCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Valid from</dt>
                  <dd className="tabular-nums">{formatDate(product.validFrom)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Valid until</dt>
                  <dd>
                    <ValidUntil iso={product.validUntil} isExpired={product.isExpired} />
                  </dd>
                </div>
              </dl>

              {product.description && (
                <p className="text-sm leading-relaxed text-foreground/90">{product.description}</p>
              )}

              <List title="Highlights" items={product.highlights} />
              <List title="Inclusions" items={product.inclusions} />

              {product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-sm bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border p-4">
              <Button asChild className="w-full">
                <Link to={`/products/${product.id}/edit`}>
                  <Pencil />
                  Edit product
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
