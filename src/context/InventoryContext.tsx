import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Customer, CustomerPosition, InventoryLine } from '../models/types'
import { buildPositions, portfolioTotals } from '../lib/aggregations'
import { useConfig } from './ConfigContext'
import { useTransfers } from './TransfersContext'

interface InventoryContextValue {
  loading: boolean
  error: string | null
  customers: Customer[]
  lines: InventoryLine[]
  positions: CustomerPosition[]
  totals: ReturnType<typeof portfolioTotals>
  /** Re-fetch from the active service. */
  refresh: () => void
  /** Lines for one customer. */
  linesForCustomer: (customerId: string) => InventoryLine[]
  positionFor: (customerId: string) => CustomerPosition | undefined
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { service, config } = useConfig()
  const { transfers, sales } = useTransfers()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [baseLines, setBaseLines] = useState<InventoryLine[]>([])
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([service.getCustomers(), service.getConsignmentInventory()])
      .then(([c, l]) => {
        if (cancelled) return
        setCustomers(c)
        setBaseLines(l)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load inventory.')
        setCustomers([])
        setBaseLines([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // Reload when the service identity changes (mock<->live) or on refresh.
  }, [service, nonce])

  // Overlay: subtract units that have left the partner — received transfer
  // orders (goods returned to the DC) and liquidation sales.
  const lines = useMemo(() => {
    const removed = new Map<string, number>()
    for (const t of transfers) {
      if (t.status !== 'received') continue
      for (const r of t.removals)
        removed.set(r.lineId, (removed.get(r.lineId) ?? 0) + r.units)
    }
    for (const sale of sales) {
      for (const r of sale.removals)
        removed.set(r.lineId, (removed.get(r.lineId) ?? 0) + r.units)
    }
    if (removed.size === 0) return baseLines
    return baseLines
      .map((l) => {
        const cut = removed.get(l.id) ?? 0
        return cut > 0
          ? { ...l, unitsOnHand: Math.max(0, l.unitsOnHand - cut) }
          : l
      })
      .filter((l) => l.unitsOnHand > 0)
  }, [baseLines, transfers, sales])

  const positions = useMemo(
    () => buildPositions(customers, lines),
    [customers, lines],
  )
  const totals = useMemo(() => portfolioTotals(positions), [positions])

  const value = useMemo<InventoryContextValue>(
    () => ({
      loading,
      error,
      customers,
      lines,
      positions,
      totals,
      refresh,
      linesForCustomer: (id) => lines.filter((l) => l.customerId === id),
      positionFor: (id) => positions.find((p) => p.customer.id === id),
    }),
    [loading, error, customers, lines, positions, totals, refresh],
  )

  // config.mode is referenced so an explicit mode change re-evaluates context
  // consumers even before the async load resolves.
  void config.mode

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext)
  if (!ctx)
    throw new Error('useInventory must be used within an InventoryProvider')
  return ctx
}
