import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Customer, InventoryLine, Season } from '../models/types'
import {
  TRANSFER_FLOW,
  type LineRemoval,
  type LiquidationSale,
  type TransferOrder,
} from '../models/operations'
import { lineValue } from '../lib/aggregations'
import { cartonCount } from '../lib/shipping'
import { useConfig } from './ConfigContext'

const STORAGE_KEY = 'vince-consignment-agent.transfers.v1'

interface PersistedState {
  transfers: TransferOrder[]
  sales: LiquidationSale[]
}

interface CreateTransferInput {
  customer: Customer
  season: Season | 'all'
  lines: InventoryLine[]
}

interface RecordSaleInput {
  customer: Customer
  buyer: string
  marginPct: number
  lines: InventoryLine[]
}

interface TransfersContextValue {
  transfers: TransferOrder[]
  sales: LiquidationSale[]
  createTransfer: (input: CreateTransferInput) => Promise<TransferOrder>
  /** Advance a transfer one step along the lifecycle. */
  advanceStatus: (id: string) => void
  /** Jump a transfer straight to received (simulated pick + receipt). */
  receiveTransfer: (id: string) => void
  recordSale: (input: RecordSaleInput) => LiquidationSale
  clearAll: () => void
}

const TransfersContext = createContext<TransfersContextValue | null>(null)

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { transfers: [], sales: [] }
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      transfers: parsed.transfers ?? [],
      sales: parsed.sales ?? [],
    }
  } catch {
    return { transfers: [], sales: [] }
  }
}

function removalsFromLines(lines: InventoryLine[]): LineRemoval[] {
  return lines.map((l) => ({ lineId: l.id, units: l.unitsOnHand }))
}

function totalsOf(lines: InventoryLine[]) {
  let units = 0
  let value = 0
  for (const l of lines) {
    units += l.unitsOnHand
    value += lineValue(l)
  }
  return { units, value }
}

export function TransfersProvider({ children }: { children: ReactNode }) {
  const { config, service } = useConfig()
  const [state, setState] = useState<PersistedState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore quota / private-mode failures */
    }
  }, [state])

  const createTransfer = useCallback(
    async (input: CreateTransferInput): Promise<TransferOrder> => {
      const { customer, season, lines } = input
      const { units, value } = totalsOf(lines)
      const result = await service.createReturnTransferOrder({
        customer,
        season: season === 'all' ? 'Fall' : season,
        lines,
      })

      const order: TransferOrder = {
        id: result.transferOrderNumber,
        customerId: customer.id,
        customerName: customer.name,
        season,
        fromWarehouseId: result.fromWarehouseId,
        toWarehouseId: result.toWarehouseId,
        lineCount: lines.length,
        totalUnits: units,
        totalValue: value,
        cartons: cartonCount(units),
        status: 'created',
        createdAtIso: new Date().toISOString(),
        removals: removalsFromLines(lines),
        live: result.live,
      }

      setState((s) => {
        // Guard against a duplicate id from the mock counter resetting.
        let id = order.id
        const taken = new Set(s.transfers.map((t) => t.id))
        for (let n = 2; taken.has(id); n++) id = `${order.id}-${n}`
        return { ...s, transfers: [{ ...order, id }, ...s.transfers] }
      })
      return order
    },
    [service],
  )

  const advanceStatus = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      transfers: s.transfers.map((t) => {
        if (t.id !== id) return t
        const idx = TRANSFER_FLOW.indexOf(t.status)
        const next = TRANSFER_FLOW[Math.min(idx + 1, TRANSFER_FLOW.length - 1)]
        return {
          ...t,
          status: next,
          receivedAtIso:
            next === 'received'
              ? t.receivedAtIso ?? new Date().toISOString()
              : t.receivedAtIso,
        }
      }),
    }))
  }, [])

  const receiveTransfer = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      transfers: s.transfers.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'received',
              receivedAtIso: t.receivedAtIso ?? new Date().toISOString(),
            }
          : t,
      ),
    }))
  }, [])

  const recordSale = useCallback(
    (input: RecordSaleInput): LiquidationSale => {
      const { customer, buyer, marginPct, lines } = input
      const { units, value } = totalsOf(lines)
      const sale: LiquidationSale = {
        id: `LQ-${config.connection.dataAreaId}-${Date.now()
          .toString(36)
          .slice(-5)
          .toUpperCase()}`,
        customerId: customer.id,
        customerName: customer.name,
        buyer,
        marginPct,
        lineCount: lines.length,
        totalUnits: units,
        costValue: value,
        saleValue: Math.round(value * (1 + marginPct / 100)),
        createdAtIso: new Date().toISOString(),
        removals: removalsFromLines(lines),
      }
      setState((s) => ({ ...s, sales: [sale, ...s.sales] }))
      return sale
    },
    [config.connection.dataAreaId],
  )

  const clearAll = useCallback(
    () => setState({ transfers: [], sales: [] }),
    [],
  )

  const value = useMemo<TransfersContextValue>(
    () => ({
      transfers: state.transfers,
      sales: state.sales,
      createTransfer,
      advanceStatus,
      receiveTransfer,
      recordSale,
      clearAll,
    }),
    [state, createTransfer, advanceStatus, receiveTransfer, recordSale, clearAll],
  )

  return (
    <TransfersContext.Provider value={value}>
      {children}
    </TransfersContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTransfers(): TransfersContextValue {
  const ctx = useContext(TransfersContext)
  if (!ctx) throw new Error('useTransfers must be used within a TransfersProvider')
  return ctx
}
