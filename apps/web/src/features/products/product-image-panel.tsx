import { ImagePlus, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react'
import { useGenerateProductImage } from './hooks'
import { Button } from '@/components/ui/button'
import { AiBadge } from '@/features/ai/ai-badge'
import { ApiError } from '@/lib/api'
import { toast } from 'sonner'

interface ProductImagePanelProps {
  productId: string | undefined
  imageUrl: string | null
}

export function ProductImagePanel({ productId, imageUrl }: ProductImagePanelProps) {
  const generateImage = useGenerateProductImage()

  async function handleGenerate() {
    if (!productId) return
    try {
      await generateImage.mutateAsync(productId)
      toast.success('Image generated.')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Image generation failed.')
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Product image</h2>
        <AiBadge />
      </div>

      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-secondary/40">
        {generateImage.isPending ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Sparkles className="size-6 animate-pulse text-amber-500" />
            <p className="text-xs">Generating (5–15s)…</p>
          </div>
        ) : imageUrl ? (
          <img src={imageUrl} alt="Product" className="size-full object-cover" />
        ) : generateImage.isError ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center text-muted-foreground">
            <AlertTriangle className="size-6 text-destructive" />
            <p className="text-xs">Image generation failed.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImagePlus className="size-6" />
            <p className="text-xs">No image yet</p>
          </div>
        )}
      </div>

      {!productId ? (
        <p className="text-xs text-muted-foreground">Save this product first to generate an image.</p>
      ) : (
        <Button
          type="button"
          variant="ai"
          className="w-full"
          onClick={handleGenerate}
          disabled={generateImage.isPending}
        >
          {generateImage.isPending ? (
            <Sparkles className="animate-pulse" />
          ) : imageUrl || generateImage.isError ? (
            <RefreshCw />
          ) : (
            <Sparkles />
          )}
          {generateImage.isPending ? 'Analyzing…' : imageUrl ? 'Regenerate' : 'Generate image with AI'}
        </Button>
      )}
    </div>
  )
}
