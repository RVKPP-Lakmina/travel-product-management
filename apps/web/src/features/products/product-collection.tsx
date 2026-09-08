import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ProductResponse } from '@travel/validation'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableHeader, TableBody, TableRow, TableHead } from '@/components/ui/table'
import { ProductRow } from './product-row'
import { ProductCard } from './product-card'
import { Pagination } from './pagination'
import { cn } from '@/lib/utils'

/** The sort options that make sense in this table AND exist server-side. */
export type SortValue = 'created_desc' | 'price_asc' | 'price_desc' | 'valid_until_asc'

interface SelectionProps {
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
}

interface ProductCollectionProps {
  items: ProductResponse[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onDelete: (p: ProductResponse) => void
  onGenerateImage: (p: ProductResponse) => void
  onPeek: (p: ProductResponse) => void
  /** Omit to render a non-selectable table (e.g. the Expired tab). */
  selection?: SelectionProps
  /** Omit to render non-sortable headers. */
  sort?: SortValue
  onSortChange?: (sort: SortValue) => void
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
  className,
}: {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onClick: () => void
  className?: string
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group -mx-1 inline-flex items-center gap-1 rounded-sm px-1 uppercase tracking-wide outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'text-foreground' : 'hover:text-foreground',
        )}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {active ? (
          direction === 'asc' ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowDown className="size-3 opacity-0 transition-opacity group-hover:opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

export function ProductCollection({
  items,
  total,
  page,
  pageSize,
  onPageChange,
  onDelete,
  onGenerateImage,
  onPeek,
  selection,
  sort,
  onSortChange,
}: ProductCollectionProps) {
  const sortable = !!onSortChange

  function cyclePrice() {
    onSortChange?.(sort === 'price_asc' ? 'price_desc' : 'price_asc')
  }
  function cycleValidUntil() {
    onSortChange?.(sort === 'valid_until_asc' ? 'created_desc' : 'valid_until_asc')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selection && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={selection.selected.size > 0 && selection.selected.size === items.length}
                    onCheckedChange={selection.onToggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead>Product</TableHead>
              <TableHead className="hidden lg:table-cell">Category</TableHead>
              {sortable ? (
                <SortHeader
                  label="Price (LKR)"
                  className="text-right"
                  active={sort === 'price_asc' || sort === 'price_desc'}
                  direction={sort === 'price_asc' ? 'asc' : 'desc'}
                  onClick={cyclePrice}
                />
              ) : (
                <TableHead className="text-right">Price (LKR)</TableHead>
              )}
              <TableHead className="hidden text-right lg:table-cell">Stock</TableHead>
              {sortable ? (
                <SortHeader
                  label="Valid Until"
                  active={sort === 'valid_until_asc'}
                  direction="asc"
                  onClick={cycleValidUntil}
                />
              ) : (
                <TableHead>Valid Until</TableHead>
              )}
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                selectable={!!selection}
                selected={selection?.selected.has(product.id) ?? false}
                onToggleSelect={() => selection?.onToggleSelect(product.id)}
                onDelete={() => onDelete(product)}
                onGenerateImage={() => onGenerateImage(product)}
                onPeek={() => onPeek(product)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {items.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            selectable={!!selection}
            selected={selection?.selected.has(product.id) ?? false}
            onToggleSelect={() => selection?.onToggleSelect(product.id)}
            onDelete={() => onDelete(product)}
            onGenerateImage={() => onGenerateImage(product)}
            onPeek={() => onPeek(product)}
          />
        ))}
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </div>
  )
}
