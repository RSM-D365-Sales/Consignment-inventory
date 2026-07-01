/**
 * Domain model for the Vince Consignment Inventory Agent.
 *
 * Terminology bridge to D365 Finance & Supply Chain:
 *  - Each retail partner (Nordstrom, Saks, ...) is modeled in D365 as a
 *    dedicated *warehouse* (InventLocation) flagged as a consignment/3PL site.
 *  - "Consignment inventory" is stock that Vince still OWNS but that physically
 *    sits at the partner's facility. In D365 this is on-hand inventory in that
 *    partner's warehouse.
 *  - The "end of season" return is executed as a *Transfer Order* moving stock
 *    from the partner warehouse back to Vince's main Distribution Center.
 */

/** A retail partner that holds Vince consignment inventory. */
export interface Customer {
  id: string
  /** Display name, e.g. "Nordstrom". */
  name: string
  /** Short code used in the UI and as a D365 customer account hint. */
  code: string
  /** Primary contact for end-of-season communications. */
  contactName: string
  contactEmail: string
  /** Storefront / region label shown in the UI. */
  location: string
  /** Brand accent used for this customer's visual chip (hex). */
  accent: string
  /**
   * Primary web domain (e.g. "nordstrom.com"). Used to resolve the partner's
   * logo at runtime from a logo/favicon service. Optional.
   */
  domain?: string
  /** Explicit logo image URL. Takes precedence over the domain lookup. */
  logoUrl?: string
}

/** Product season — drives the "end of season" workflow. */
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Holiday'

/** A single SKU/style on hand at a customer warehouse. */
export interface InventoryLine {
  /** Stable id for the line (customerId + sku). */
  id: string
  customerId: string
  /** D365 item number. */
  itemNumber: string
  /** Human style name, e.g. "Cashmere V-Neck Sweater". */
  styleName: string
  category: ProductCategory
  season: Season
  color: string
  size: string
  /** Units physically on hand at the customer warehouse. */
  unitsOnHand: number
  /** Per-unit cost Vince carries on the books (USD). */
  unitCost: number
  /** Per-unit retail price (USD) — used for sell-through context. */
  retailPrice: number
  /** ISO date the stock was consigned to this partner. */
  consignedDate: string
}

export type ProductCategory =
  | 'Knitwear'
  | 'Outerwear'
  | 'Dresses'
  | 'Tops'
  | 'Bottoms'
  | 'Footwear'
  | 'Accessories'

/** Aggregated position for a single customer (derived from inventory lines). */
export interface CustomerPosition {
  customer: Customer
  totalUnits: number
  /** Extended value at cost (sum of unitsOnHand * unitCost). */
  totalValue: number
  /** Extended value at retail. */
  totalRetail: number
  lineCount: number
  /** Breakdown by category for mini-visuals. */
  byCategory: CategoryAggregate[]
  /** Breakdown by season — relevant to the end-of-season workflow. */
  bySeason: SeasonAggregate[]
}

export interface CategoryAggregate {
  category: ProductCategory
  units: number
  value: number
}

export interface SeasonAggregate {
  season: Season
  units: number
  value: number
}

/** The two metrics the dashboard can be filtered/sorted by. */
export type Metric = 'value' | 'units'

/** Result of submitting an end-of-season return to D365. */
export interface TransferOrderResult {
  transferOrderNumber: string
  fromWarehouseId: string
  toWarehouseId: string
  customerId: string
  season: Season
  lineCount: number
  totalUnits: number
  totalValue: number
  createdAtIso: string
  /** True when produced by the live D365 connector vs. the mock. */
  live: boolean
}

/** Draft email produced for the end-of-season communication. */
export interface EmailDraft {
  to: string
  cc?: string
  subject: string
  /** Plain-text body (used for mailto + copy). */
  bodyText: string
  /** Structured lines so the UI can render a rich table. */
  lines: InventoryLine[]
  customer: Customer
  season: Season
  totalUnits: number
  totalValue: number
}
