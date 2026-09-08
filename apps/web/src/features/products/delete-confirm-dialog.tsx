import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string | null
  count?: number
  onConfirm: () => void
  loading?: boolean
}

export function DeleteConfirmDialog({ open, onOpenChange, productName, count, onConfirm, loading }: DeleteConfirmDialogProps) {
  const isBulk = !!count && count > 1
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isBulk ? `Delete ${count} products?` : 'Delete product?'}</DialogTitle>
          <DialogDescription>
            {isBulk
              ? `This will permanently delete ${count} selected products. This cannot be undone.`
              : `"${productName}" will be permanently deleted. This cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
