import type {
  Customer,
  InventoryLine,
  Season,
  TransferOrderResult,
} from '../models/types'

export interface CreateTransferInput {
  customer: Customer
  season: Season
  lines: InventoryLine[]
}

/**
 * The single seam between this app and D365 Finance & Supply Chain.
 *
 * Every screen talks to this interface and never to a concrete data source,
 * so flipping from mock to live (or swapping the live transport later) never
 * touches the UI. The mock and live implementations both satisfy it.
 */
export interface D365Service {
  readonly live: boolean
  /** Retail partners that hold Vince consignment inventory. */
  getCustomers(): Promise<Customer[]>
  /** On-hand consignment inventory across all mapped partner warehouses. */
  getConsignmentInventory(): Promise<InventoryLine[]>
  /**
   * Create the end-of-season return as a D365 transfer order from the
   * partner's consignment warehouse back to the main DC.
   */
  createReturnTransferOrder(
    input: CreateTransferInput,
  ): Promise<TransferOrderResult>
}
