import type { Customer, InventoryLine, TransferOrderResult } from '../models/types'
import type { AppConfig } from '../models/config'
import {
  CUSTOMERS,
  INVENTORY_LINES,
  generateInventoryForCustomer,
} from '../data/mockData'
import { lineValue } from '../lib/aggregations'
import type { CreateTransferInput, D365Service } from './d365Service'

/** Simulated network latency so the demo feels like real round-trips. */
const LATENCY_MS = 350

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/**
 * In-memory implementation backed by the bundled mock dataset.
 *
 * It deliberately mirrors what the live connector will do — same method
 * signatures, same shapes — so the UI cannot tell the difference. Transfer
 * order numbers are generated locally and counted within the session.
 */
export class MockD365Service implements D365Service {
  readonly live = false
  private transferSeq = 4200

  constructor(private readonly config: AppConfig) {}

  getCustomers(): Promise<Customer[]> {
    return delay([...CUSTOMERS, ...this.config.customPartners])
  }

  getConsignmentInventory(): Promise<InventoryLine[]> {
    // Bundled partners use the fixed dataset; runtime-added partners get
    // freshly generated (but deterministic) sample inventory.
    const added = this.config.customPartners.flatMap((p) =>
      generateInventoryForCustomer(p),
    )
    return delay([...INVENTORY_LINES, ...added])
  }

  createReturnTransferOrder(
    input: CreateTransferInput,
  ): Promise<TransferOrderResult> {
    const { customer, season, lines } = input
    const totalUnits = lines.reduce((sum, l) => sum + l.unitsOnHand, 0)
    const totalValue = lines.reduce((sum, l) => sum + lineValue(l), 0)

    const mapping = this.config.mappings.find(
      (m) => m.customerId === customer.id,
    )

    const result: TransferOrderResult = {
      transferOrderNumber: `TO-${this.config.connection.dataAreaId}-${++this
        .transferSeq}`,
      fromWarehouseId: mapping?.warehouseId ?? `CN-${customer.code}`,
      toWarehouseId: this.config.connection.mainDcWarehouseId,
      customerId: customer.id,
      season,
      lineCount: lines.length,
      totalUnits,
      totalValue,
      // Fixed timestamp basis kept out of here — the caller stamps the real
      // time so this class stays free of Date.now() for deterministic demos.
      createdAtIso: new Date().toISOString(),
      live: false,
    }

    return delay(result, 700)
  }
}
