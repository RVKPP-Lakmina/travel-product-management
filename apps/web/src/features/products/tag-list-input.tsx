import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface TagListInputProps {
  label: string
  values: string[] | undefined
  onChange: (values: string[]) => void
  placeholder?: string
  aiPopulated?: boolean
}

export function TagListInput({ label, values: rawValues, onChange, placeholder, aiPopulated }: TagListInputProps) {
  const values = rawValues ?? []
  const [draft, setDraft] = useState('')

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed])
    setDraft('')
  }

  function remove(value: string) {
    onChange(values.filter((v) => v !== value))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {label}
        {aiPopulated && (
          <Badge variant="ai" className="px-1.5 py-0 text-[10px]">
            AI
          </Badge>
        )}
      </label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="outline" className="gap-1 pr-1.5">
              {v}
              <button type="button" onClick={() => remove(v)} className="rounded-full p-0.5 hover:bg-secondary">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="secondary" size="icon" onClick={commit}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
