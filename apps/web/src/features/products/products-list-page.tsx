import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, FileSpreadsheet, ChevronDown, Trash2, PackageSearch, PackageX, AlertTriangle, RotateCcw, CalendarX } from 'lucide-react'
import { searchFilterSchema, type SearchFilter, type ProductResponse } from '@travel/validation'
import {
  useProducts,
  useProductsByFilter,
  useExpiredProducts,
  useDeleteProduct,
  useGenerateProductImage,
} from './hooks'
import { useAiSearch } from '@/features/ai/hooks'
import { useExportExcel } from '@/features/export/hooks'
import { SEARCH_QUERIES } from '@/features/ai/examples'
import { AiSearchBar } from '@/features/ai/ai-search-bar'
import { FilterChips } from '@/features/ai/filter-chips'
import { GenerateProductDialog } from '@/features/ai/generate-product-dialog'
import { ProductCollection, type SortValue } from './product-collection'
import { ProductPeek } from './product-peek'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'

const PAGE_SIZE = 20
type Tab = 'all' | 'expired'

export function ProductsListPage() {
  const [tab, setTab] = useState<Tab>('all')
  const [aiFilter, setAiFilter] = useState<SearchFilter | null>(null)
  const [aiMeta, setAiMeta] = useState<{ source: 'ai' | 'heuristic'; explanation: string } | null>(null)
  const [sort, setSort] = useState<SortValue>('created_desc')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<ProductResponse | null>(null)
  const [peekTarget, setPeekTarget] = useState<ProductResponse | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const navigate = useNavigate()
  const aiSearch = useAiSearch()
  const deleteProduct = useDeleteProduct()
  const exportExcel = useExportExcel()
  const generateImage = useGenerateProductImage()

  const active = aiFilter !== null

  const plain = useProducts({
    sort,
    status: 'any',
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })
  const filteredQuery: SearchFilter | null = useMemo(
    () => (aiFilter ? { ...aiFilter, sort, limit: PAGE_SIZE, offset: page * PAGE_SIZE } : null),
    [aiFilter, sort, page],
  )
  const filtered = useProductsByFilter(filteredQuery)
  const expired = useExpiredProducts({
    limit: PAGE_SIZE,
    offset: tab === 'expired' ? page * PAGE_SIZE : 0,
  })

  const query = tab === 'expired' ? expired : active ? filtered : plain
  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const expiredTotal = expired.data?.total ?? 0

  function switchTab(next: Tab) {
    setTab(next)
    setPage(0)
    setSelected(new Set())
  }

  function changeSort(next: SortValue) {
    setSort(next)
    setPage(0)
  }

  async function handleSearch(q: string) {
    setPage(0)
    try {
      const res = await aiSearch.mutateAsync(q)
      setAiFilter(res.filter)
      setAiMeta({ source: res.source, explanation: res.explanation })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Search failed. Please try again.')
    }
  }

  function handleRemoveChip(patch: Partial<SearchFilter>) {
    setPage(0)
    setAiFilter((f) => (f ? searchFilterSchema.parse({ ...f, ...patch }) : f))
  }

  function handleClearSearch() {
    setPage(0)
    setAiFilter(null)
    setAiMeta(null)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((p) => p.id))))
  }

  async function handleBulkDelete() {
    await Promise.all([...selected].map((id) => deleteProduct.mutateAsync(id)))
    setSelected(new Set())
    setBulkDeleteOpen(false)
    toast.success('Selected products deleted.')
  }

  function handleGenerateImage(product: ProductResponse) {
    toast.promise(generateImage.mutateAsync(product.id), {
      loading: `Generating an image for ${product.name}…`,
      success: 'Image generated.',
      error: (err) => (err instanceof ApiError ? err.message : 'Image generation failed.'),
    })
  }

  function currentExportFilter(): SearchFilter {
    return aiFilter ?? searchFilterSchema.parse({ sort })
  }

  const collectionProps = {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    onPageChange: setPage,
    onDelete: setDeleteTarget,
    onGenerateImage: handleGenerateImage,
    onPeek: setPeekTarget,
  }

  return (
    <div className="page-enter mx-auto flex w-full max-w-350 flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your travel product catalog</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/products/new">
              <Plus />
              Add Product
            </Link>
          </Button>
          <GenerateProductDialog
            onApply={(draft, meta) => navigate('/products/new', { state: { draft, meta } })}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Export
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => exportExcel.mutate(currentExportFilter())}
                disabled={exportExcel.isPending}
              >
                <FileSpreadsheet className="size-4" />
                Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => switchTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="expired">
            Expired
            {expiredTotal > 0 && (
              <span className="tabular-nums text-xs text-muted-foreground">{expiredTotal}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-5 flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <AiSearchBar
              onSearch={handleSearch}
              onClear={handleClearSearch}
              loading={aiSearch.isPending}
              active={active}
            />
            {active && aiFilter && aiMeta ? (
              <FilterChips
                filter={aiFilter}
                source={aiMeta.source}
                explanation={aiMeta.explanation}
                onRemove={handleRemoveChip}
                onClear={handleClearSearch}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Try:</span>
                {SEARCH_QUERIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSearch(q)}
                    className="rounded-full border border-border px-2.5 py-1 font-medium text-foreground outline-none transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected.size > 0 && (
            <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 />
                Delete Selected
              </Button>
              <button
                type="button"
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
            </div>
          )}

          {query.isLoading ? (
            <LoadingState />
          ) : query.isError ? (
            <ErrorState onRetry={() => query.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState active={active} />
          ) : (
            <ProductCollection
              {...collectionProps}
              sort={sort}
              onSortChange={changeSort}
              selection={{
                selected,
                onToggleSelect: toggleSelect,
                onToggleSelectAll: toggleSelectAll,
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="expired" className="mt-5 flex flex-col gap-5">
          <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground">
            <CalendarX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              These products are past their validity date and are hidden from listings, search, and export.
              Open one to update its dates and bring it back.
            </span>
          </div>

          {expired.isLoading ? (
            <LoadingState />
          ) : expired.isError ? (
            <ErrorState onRetry={() => expired.refetch()} />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-secondary/30 px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <CalendarX className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">No expired products. Nice.</p>
            </div>
          ) : (
            <ProductCollection {...collectionProps} />
          )}
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        productName={deleteTarget?.name ?? null}
        loading={deleteProduct.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteProduct.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
          toast.success('Product deleted.')
        }}
      />
      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        productName={null}
        count={selected.size}
        loading={deleteProduct.isPending}
        onConfirm={handleBulkDelete}
      />

      <ProductPeek product={peekTarget} onOpenChange={(open) => !open && setPeekTarget(null)} />
    </div>
  )
}

function LoadingState() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border p-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ active }: { active: boolean }) {
  const Icon = active ? PackageSearch : PackageX
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-secondary/30 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{active ? 'No matching products' : 'No products yet'}</p>
        <p className="text-sm text-muted-foreground">
          {active ? 'Try removing a filter or searching for something else.' : 'Create your first product to get started.'}
        </p>
      </div>
      {!active && (
        <Button asChild>
          <Link to="/products/new">
            <Plus />
            Add Product
          </Link>
        </Button>
      )}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium">Couldn't load products</p>
        <p className="text-sm text-muted-foreground">Something went wrong while fetching your catalog.</p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <RotateCcw />
        Try again
      </Button>
    </div>
  )
}
