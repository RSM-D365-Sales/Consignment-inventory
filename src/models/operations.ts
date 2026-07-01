import type { Season } from './types'

/** Lifecycle of a return transfer order from partner warehouse → main DC. */
export type TransferStatus = 'created' | 'picking' | 'shipped' | 'received'

/** Ordered status flow used to advance a transfer one step at a time. */
export const TRANSFER_FLOW: TransferStatus[] = [
  'created',
  'picking',
  'shipped',
  'received',
]

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  created: 'Created',
  picking: 'Picking',
  shipped: 'In transit',
  received: 'Received',
}

/** How many units of a specific inventory line an operation removes on-hand. */
export interface LineRemoval {
  lineId: string
  units: number
}

/** A return transfer order, tracked from creation through receipt. */
export interface TransferOrder {
  /** D365 transfer order number (acts as the id). */
  id: string
  customerId: string
  customerName: string
  season: Season | 'all'
  fromWarehouseId: string
  toWarehouseId: string
  lineCount: number
  totalUnits: number
  totalValue: number
  /** Number of cartons / shipping labels generated. */
  cartons: number
  status: TransferStatus
  createdAtIso: string
  receivedAtIso?: string
  /** Per-line quantities to subtract from partner on-hand once received. */
  removals: LineRemoval[]
  /** True when produced by the live D365 connector vs. the mock. */
  live: boolean
}

/** A liquidation sale of consignment inventory to a discount retailer. */
export interface LiquidationSale {
  id: string
  customerId: string
  customerName: string
  /** Discount buyer, e.g. "Marshalls". */
  buyer: string
  /** Markup over cost, e.g. 30 → sale price = cost × 1.30. */
  marginPct: number
  lineCount: number
  totalUnits: number
  /** Extended value at cost. */
  costValue: number
  /** Negotiated sale value (cost + margin). */
  saleValue: number
  createdAtIso: string
  /** Per-line quantities removed from partner on-hand by the sale. */
  removals: LineRemoval[]
}
