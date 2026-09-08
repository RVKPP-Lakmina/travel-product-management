const currencyFormatter = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
})

export function formatLKR(amount: number): string {
  return currencyFormatter.format(amount)
}

const amountFormatter = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 })

/**
 * Bare grouped number, no currency symbol — for table columns already
 * headed "Price (LKR)". Use `formatLKR` where the amount stands alone
 * (cards, dashboard rows, tooltips).
 */
export function formatAmount(amount: number): string {
  return amountFormatter.format(amount)
}

const compactFormatter = new Intl.NumberFormat('en-LK', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** e.g. 78200 → "78.2K". For tight widths and chart labels. */
export function formatCompact(amount: number): string {
  return compactFormatter.format(amount)
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${iso}T00:00:00`)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}
