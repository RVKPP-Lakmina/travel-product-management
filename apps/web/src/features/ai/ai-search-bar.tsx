import { useState } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AiSearchBarProps {
  onSearch: (query: string) => void
  onClear: () => void
  loading: boolean
  active: boolean
}

export function AiSearchBar({ onSearch, onClear, loading, active }: AiSearchBarProps) {
  const [value, setValue] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value.trim().length < 2) return
    onSearch(value.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Sparkles
        className={cn('pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2', active ? 'text-amber-500' : 'text-muted-foreground')}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask anything — e.g. show me dinner buffets in Colombo under LKR 10,000"
        className="h-12 w-full rounded-xl border border-input bg-card pl-11 pr-24 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {active && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              onClear()
            }}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
            <span className="sr-only">Clear search</span>
          </button>
        )}
        <button
          type="submit"
          disabled={loading || value.trim().length < 2}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>
    </form>
  )
}
