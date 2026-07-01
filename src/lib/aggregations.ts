import type {
  CategoryAggregate,
  Customer,
  CustomerPosition,
  InventoryLine,
  ProductCategory,
  Season,
  SeasonAggregate,
} from '../models/types'

/** Extended value at cost for a single line. */
export function lineValue(line: InventoryLine): number {
  return line.unitsOnHand * line.unitCost
}

/** Extended value at retail for a single line. */
export function lineRetail(line: InventoryLine): number {
  return line.unitsOnHand * line.retailPrice
}

/**
 * Roll up a customer's inventory lines into a single position summary,
 * including per-category and per-season breakdowns for the visuals.
 */
export function buildPosition(
  customer: Customer,
  lines: InventoryLine[],
): CustomerPosition {
  const categoryMap = new Map<ProductCategory, CategoryAggregate>()
  const seasonMap = new Map<Season, SeasonAggregate>()

  let totalUnits = 0
  let totalValue = 0
  let totalRetail = 0

  for (const line of lines) {
    const value = lineValue(line)
    totalUnits += line.unitsOnHand
    totalValue += value
    totalRetail += lineRetail(line)

    const cat = categoryMap.get(line.category) ?? {
      category: line.category,
      units: 0,
      value: 0,
    }
    cat.units += line.unitsOnHand
    cat.value += value
    categoryMap.set(line.category, cat)

    const sea = seasonMap.get(line.season) ?? {
      season: line.season,
      units: 0,
      value: 0,
    }
    sea.units += line.unitsOnHand
    sea.value += value
    seasonMap.set(line.season, sea)
  }

  return {
    customer,
    totalUnits,
    totalValue,
    totalRetail,
    lineCount: lines.length,
    byCategory: [...categoryMap.values()].sort((a, b) => b.value - a.value),
    bySeason: [...seasonMap.values()],
  }
}

/** Build positions for every customer from a flat set of lines. */
export function buildPositions(
  customers: Customer[],
  lines: InventoryLine[],
): CustomerPosition[] {
  return customers.map((customer) =>
    buildPosition(
      customer,
      lines.filter((l) => l.customerId === customer.id),
    ),
  )
}

export interface PortfolioTotals {
  totalUnits: number
  totalValue: number
  totalRetail: number
  customerCount: number
}

export function portfolioTotals(
  positions: CustomerPosition[],
): PortfolioTotals {
  let totalUnits = 0
  let totalValue = 0
  let totalRetail = 0
  for (const p of positions) {
    totalUnits += p.totalUnits
    totalValue += p.totalValue
    totalRetail += p.totalRetail
  }
  return {
    totalUnits,
    totalValue,
    totalRetail,
    customerCount: positions.length,
  }
}
