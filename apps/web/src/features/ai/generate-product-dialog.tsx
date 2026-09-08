import { useState } from 'react'
import { Sparkles, Wand2 } from 'lucide-react'
import type { AiGenerateProductResponse } from '@travel/validation'
import { toast } from 'sonner'
import { Sheet, SheetTrigger, ResponsiveDialogContent } from '@/components/ui/sheet'
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AiNote } from './ai-note'
import { AiThinking } from './ai-thinking'
import { GENERATE_PROMPTS } from './examples'
import { useGenerateProduct } from './hooks'
import { ApiError } from '@/lib/api'

interface GenerateProductDialogProps {
  onApply: (draft: AiGenerateProductResponse['draft'], meta: AiGenerateProductResponse['meta']) => void
  trigger?: React.ReactNode
}

export function GenerateProductDialog({ onApply, trigger }: GenerateProductDialogProps) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<AiGenerateProductResponse | null>(null)
  const generate = useGenerateProduct()

  function reset() {
    setPrompt('')
    setResult(null)
    generate.reset()
  }

  async function handleGenerate() {
    if (prompt.trim().length < 5) return
    try {
      const response = await generate.mutateAsync(prompt)
      setResult(response)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Generation failed. Please try again.')
    }
  }

  function handleApply() {
    if (!result) return
    onApply(result.draft, result.meta)
    setOpen(false)
    reset()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="ai">
            <Sparkles />
            Generate with AI
          </Button>
        )}
      </SheetTrigger>
      <ResponsiveDialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" aria-hidden="true" />
            AI Product Generator
          </DialogTitle>
          <DialogDescription>Describe the product in plain language — we'll draft the details for you to review.</DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="flex flex-col gap-4">
            <Textarea
              autoFocus
              rows={4}
              placeholder="Create a Dinner Buffet at Cinnamon Grand Colombo available until the end of this month."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={1000}
            />
            <div className="flex flex-wrap gap-2">
              {GENERATE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {example.length > 46 ? `${example.slice(0, 46)}…` : example}
                </button>
              ))}
            </div>
            {generate.isPending && <AiThinking label="Analyzing your prompt…" />}
            <DialogFooter>
              <Button
                onClick={handleGenerate}
                loading={generate.isPending}
                disabled={prompt.trim().length < 5}
              >
                <Wand2 />
                {generate.isPending ? 'Generating…' : 'Generate'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <p className="text-sm font-semibold">{result.draft.name ?? 'Untitled product'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.draft.description}</p>
              {result.draft.highlights.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {result.draft.highlights.map((h) => (
                    <Badge key={h} variant="outline">
                      {h}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {result.meta.assumptions.length > 0 && (
              <AiNote title="AI assumptions">
                <ul className="list-disc space-y-0.5 pl-4">
                  {result.meta.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </AiNote>
            )}

            {result.meta.unresolvedFields.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Needs your input: <span className="font-medium text-foreground">{result.meta.unresolvedFields.join(', ')}</span>
              </p>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={reset}>
                Regenerate
              </Button>
              <Button onClick={handleApply}>Use these details</Button>
            </DialogFooter>
          </div>
        )}
      </ResponsiveDialogContent>
    </Sheet>
  )
}
