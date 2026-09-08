import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Search,
  LayoutDashboard,
  Package,
  BarChart3,
  Settings,
  Plus,
  Moon,
  Sun,
  PanelLeft,
  CornerDownLeft,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useProducts } from '@/features/products/hooks'
import { useTheme } from '@/app/theme-provider'
import { useSidebar } from '@/app/sidebar-provider'
import { cn } from '@/lib/utils'

interface Item {
  id: string
  label: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  keywords?: string
  run: () => void
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { toggleCollapsed } = useSidebar()

  // ⌘K / Ctrl+K anywhere, plus a custom event so a visible button (or any
  // other affordance) can open it without prop-drilling.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    function onOpenEvent() {
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-command-palette', onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-command-palette', onOpenEvent)
    }
  }, [])

  function close() {
    setOpen(false)
    setQ('')
    setActiveIndex(0)
  }

  const act = (fn: () => void) => () => {
    close()
    fn()
  }

  const staticItems: Item[] = useMemo(
    () => [
      { id: 'nav-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, keywords: 'home overview', run: act(() => navigate('/')) },
      { id: 'nav-products', label: 'Go to Products', icon: Package, keywords: 'catalog list', run: act(() => navigate('/products')) },
      { id: 'nav-analytics', label: 'Go to Analytics', icon: BarChart3, keywords: 'charts stats', run: act(() => navigate('/analytics')) },
      { id: 'nav-settings', label: 'Go to Settings', icon: Settings, keywords: 'preferences', run: act(() => navigate('/settings')) },
      { id: 'act-new', label: 'Add Product', icon: Plus, keywords: 'create new', run: act(() => navigate('/products/new')) },
      {
        id: 'act-theme',
        label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        icon: theme === 'dark' ? Sun : Moon,
        keywords: 'theme appearance',
        run: act(toggleTheme),
      },
      { id: 'act-sidebar', label: 'Toggle sidebar', icon: PanelLeft, keywords: 'collapse rail', run: act(toggleCollapsed) },
    ],
    // navigate/toggle* are stable; theme is the only real dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  )

  const debouncedQ = useDebounced(q.trim(), 200)
  const searchEnabled = open && debouncedQ.length >= 2
  const productSearch = useProducts(
    { q: debouncedQ, limit: 6, status: 'any' },
    { enabled: searchEnabled },
  )
  const productItems: Item[] =
    searchEnabled && productSearch.data
      ? productSearch.data.items.map((p) => ({
          id: `product-${p.id}`,
          label: p.name,
          hint: p.destination,
          icon: Package,
          run: act(() => navigate(`/products/${p.id}/edit`)),
        }))
      : []

  const filteredStatic = q.trim()
    ? staticItems.filter((it) =>
        `${it.label} ${it.keywords ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : staticItems

  const allItems = [...filteredStatic, ...productItems]
  // Clamp rather than reset-in-effect: the list can shrink as the query
  // narrows or product results arrive.
  const safeIndex = Math.min(activeIndex, Math.max(0, allItems.length - 1))

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [safeIndex])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(Math.min(safeIndex + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(Math.max(safeIndex - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      allItems[safeIndex]?.run()
    }
  }

  const commandsShown = filteredStatic.length
  const productsShown = productItems.length

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent showClose={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Command palette</DialogTitle>

        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Search products or jump to…"
            aria-label="Search products or run a command"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {allItems.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No results.</p>
          ) : (
            <>
              {commandsShown > 0 && (
                <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">Commands</p>
              )}
              {filteredStatic.map((it, i) => (
                <Row key={it.id} item={it} active={safeIndex === i} onHover={() => setActiveIndex(i)} />
              ))}

              {productsShown > 0 && (
                <p className="px-2 pb-1 pt-3 text-xs font-medium text-muted-foreground">Products</p>
              )}
              {productItems.map((it, i) => {
                const idx = commandsShown + i
                return (
                  <Row
                    key={it.id}
                    item={it}
                    active={safeIndex === idx}
                    onHover={() => setActiveIndex(idx)}
                  />
                )
              })}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1">↑</kbd>
            <kbd className="rounded border border-border px-1">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1">
              <CornerDownLeft className="size-3" />
            </kbd>
            select
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="rounded border border-border px-1">esc</kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ item, active, onHover }: { item: Item; active: boolean; onHover: () => void }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      data-active={active}
      onMouseMove={onHover}
      onClick={item.run}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none',
        active ? 'bg-secondary text-foreground' : 'text-foreground/90',
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.hint && <span className="shrink-0 truncate text-xs text-muted-foreground">{item.hint}</span>}
    </button>
  )
}
