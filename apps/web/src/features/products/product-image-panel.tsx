import { ImagePlus, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react'
import { useGenerateProductImage } from './hooks'
import { Button } from '@/components/ui/button'
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
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Visual Studio</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Generative Asset
        </span>
      </div>

      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-secondary/40">
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
        <Button type="button" variant="ai" className="w-full" onClick={handleGenerate} loading={generateImage.isPending}>
          {imageUrl || generateImage.isError ? <RefreshCw /> : <Sparkles />}
          {imageUrl ? 'Regenerate' : 'Generate image with AI'}
        </Button>
      )}
    </div>
  )
}
