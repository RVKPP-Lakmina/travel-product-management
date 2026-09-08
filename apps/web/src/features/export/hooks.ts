import { useMutation } from '@tanstack/react-query'
import type { SearchFilter } from '@travel/validation'
import { api } from '@/lib/api'

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function useExportExcel() {
  return useMutation({
    mutationFn: async (filter: SearchFilter) => {
      const { blob, filename } = await api.downloadBlob('/products/export', filter)
      saveBlob(blob, filename)
    },
  })
}
