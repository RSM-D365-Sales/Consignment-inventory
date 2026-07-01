/** Formatting helpers shared across the UI. */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const USD_CENTS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUM = new Intl.NumberFormat('en-US')

/** $1,234,567 — whole dollars, for headline figures. */
export function money(value: number): string {
  return USD.format(value)
}

/** $295.00 — used for unit prices. */
export function moneyCents(value: number): string {
  return USD_CENTS.format(value)
}

/** Compact form for tight chips: $1.2M, $84K. */
export function moneyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `$${Math.round(value / 1_000)}K`
  }
  return `$${Math.round(value)}`
}

/** 12,480 — thousands separators. */
export function units(value: number): string {
  return NUM.format(value)
}

/** 12.4K compact unit count. */
export function unitsCompact(value: number): string {
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return String(value)
}

/** Today's date as an ISO YYYY-MM-DD string in local time. */
export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "Jun 30, 2026" */
export function dateLong(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
