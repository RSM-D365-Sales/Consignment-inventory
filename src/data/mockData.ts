import type {
  Customer,
  InventoryLine,
  ProductCategory,
  Season,
} from '../models/types'

/**
 * Mock consignment dataset for the Vince demo.
 *
 * This stands in for what the live D365 connector would return from
 * InventOnHand / inventory aggregate queries filtered to each partner's
 * consignment warehouse. Numbers are intentionally realistic for a
 * contemporary apparel brand so the dashboard tells a believable story.
 */

export const CUSTOMERS: Customer[] = [
  {
    id: 'CUST-NORD',
    name: 'Nordstrom',
    code: 'NORD',
    contactName: 'Dana Whitfield',
    contactEmail: 'dana.whitfield@nordstrom.com',
    location: 'Seattle, WA · 28 doors',
    accent: '#6b7b8c',
    domain: 'nordstrom.com',
  },
  {
    id: 'CUST-SAKS',
    name: 'Saks Fifth Avenue',
    code: 'SAKS',
    contactName: 'Marco Bellini',
    contactEmail: 'marco.bellini@saks.com',
    location: 'New York, NY · 19 doors',
    accent: '#3f3a36',
    domain: 'saksfifthavenue.com',
  },
  {
    id: 'CUST-MACY',
    name: "Macy's",
    code: 'MACY',
    contactName: 'Priya Nair',
    contactEmail: 'priya.nair@macys.com',
    location: 'New York, NY · 41 doors',
    accent: '#a6452f',
    domain: 'macys.com',
  },
  {
    id: 'CUST-BLOOM',
    name: "Bloomingdale's",
    code: 'BLOOM',
    contactName: 'Theo Garrett',
    contactEmail: 'theo.garrett@bloomingdales.com',
    location: 'New York, NY · 16 doors',
    accent: '#8a7b52',
    domain: 'bloomingdales.com',
  },
]

interface StyleSeed {
  itemNumber: string
  styleName: string
  category: ProductCategory
  season: Season
  color: string
  unitCost: number
  retailPrice: number
}

// A catalog of representative Vince styles. Each becomes one or more inventory
// lines (across sizes) at each customer warehouse.
const STYLE_CATALOG: StyleSeed[] = [
  { itemNumber: 'VK-1042', styleName: 'Cashmere V-Neck Sweater', category: 'Knitwear', season: 'Fall', color: 'Heather Steel', unitCost: 88, retailPrice: 295 },
  { itemNumber: 'VK-1188', styleName: 'Wool-Cashmere Funnel Neck', category: 'Knitwear', season: 'Fall', color: 'Camel', unitCost: 102, retailPrice: 345 },
  { itemNumber: 'VK-1207', styleName: 'Boiled Cashmere Cardigan', category: 'Knitwear', season: 'Holiday', color: 'Off White', unitCost: 124, retailPrice: 425 },
  { itemNumber: 'VO-2301', styleName: 'Belted Wool Coat', category: 'Outerwear', season: 'Fall', color: 'Charcoal', unitCost: 168, retailPrice: 595 },
  { itemNumber: 'VO-2355', styleName: 'Quilted Liner Jacket', category: 'Outerwear', season: 'Holiday', color: 'Black', unitCost: 142, retailPrice: 495 },
  { itemNumber: 'VD-3110', styleName: 'Silk Slip Dress', category: 'Dresses', season: 'Spring', color: 'Dusty Rose', unitCost: 96, retailPrice: 325 },
  { itemNumber: 'VD-3142', styleName: 'Tiered Midi Dress', category: 'Dresses', season: 'Summer', color: 'Optic White', unitCost: 84, retailPrice: 285 },
  { itemNumber: 'VT-4021', styleName: 'Silk Charmeuse Blouse', category: 'Tops', season: 'Spring', color: 'Pale Blue', unitCost: 62, retailPrice: 225 },
  { itemNumber: 'VT-4088', styleName: 'Pima Cotton Long-Sleeve Tee', category: 'Tops', season: 'Summer', color: 'White', unitCost: 24, retailPrice: 85 },
  { itemNumber: 'VB-5012', styleName: 'Washed Cotton Wide-Leg Pant', category: 'Bottoms', season: 'Spring', color: 'Sea Salt', unitCost: 58, retailPrice: 195 },
  { itemNumber: 'VB-5077', styleName: 'Tailored Wool Trouser', category: 'Bottoms', season: 'Fall', color: 'Black', unitCost: 66, retailPrice: 245 },
  { itemNumber: 'VF-6203', styleName: 'Leather Lace-Up Sneaker', category: 'Footwear', season: 'Spring', color: 'Cream', unitCost: 78, retailPrice: 225 },
  { itemNumber: 'VF-6240', styleName: 'Suede Block-Heel Boot', category: 'Footwear', season: 'Fall', color: 'Cognac', unitCost: 96, retailPrice: 350 },
  { itemNumber: 'VA-7050', styleName: 'Cashmere Travel Wrap', category: 'Accessories', season: 'Holiday', color: 'Grey Flannel', unitCost: 72, retailPrice: 245 },
  { itemNumber: 'VA-7081', styleName: 'Leather Belt', category: 'Accessories', season: 'Spring', color: 'Tan', unitCost: 28, retailPrice: 95 },
]

// Named Vince SKUs pinned to a specific partner with exact colors and size
// runs, so they always appear in the demo and survive a demo-data reset
// (the reset re-fetches this dataset).
interface PinnedLineSeed {
  customerId: string
  itemNumber: string
  styleName: string
  category: ProductCategory
  season: Season
  color: string
  unitCost: number
  retailPrice: number
  consignedDate: string
  sizeRun: [size: string, unitsOnHand: number][]
}

const PINNED_LINES: PinnedLineSeed[] = [
  {
    customerId: 'CUST-MACY',
    itemNumber: 'V170813201',
    styleName: 'Scallop-Detail Cotton Button-Front Shirt',
    category: 'Tops',
    season: 'Spring',
    color: 'White',
    unitCost: 86,
    retailPrice: 295,
    consignedDate: '2026-02-15',
    sizeRun: [
      ['XS', 38],
      ['S', 52],
      ['M', 46],
    ],
  },
  {
    customerId: 'CUST-MACY',
    itemNumber: 'V170831098',
    styleName: 'Scallop-Detail Cotton Midi Skirt',
    category: 'Bottoms',
    season: 'Spring',
    color: 'White',
    unitCost: 94,
    retailPrice: 325,
    consignedDate: '2026-02-15',
    sizeRun: [
      ['XS', 24],
      ['M', 40],
      ['XL', 18],
    ],
  },
  {
    customerId: 'CUST-MACY',
    itemNumber: 'V206622516',
    styleName: 'Mid-Rise Shine Crepe Pull-On Pant',
    category: 'Bottoms',
    season: 'Summer',
    color: 'Taupe',
    unitCost: 98,
    retailPrice: 345,
    consignedDate: '2026-04-15',
    sizeRun: [
      ['L', 34],
      ['XL', 22],
    ],
  },
]

const SIZES_APPAREL = ['XS', 'S', 'M', 'L', 'XL']
const SIZES_FOOTWEAR = ['6', '7', '8', '9', '10']
const SIZES_ONE = ['OS']

function sizesFor(category: ProductCategory): string[] {
  if (category === 'Footwear') return SIZES_FOOTWEAR
  if (category === 'Accessories') return SIZES_ONE
  return SIZES_APPAREL
}

// Deterministic pseudo-random so the demo data is stable across reloads
// (no Math.random — the same seed always yields the same dashboard).
function seededInt(seed: number, min: number, max: number): number {
  const x = Math.sin(seed) * 10000
  const frac = x - Math.floor(x)
  return Math.floor(min + frac * (max - min + 1))
}

// Per-customer scale factor so each partner has a distinct footprint.
const CUSTOMER_SCALE: Record<string, number> = {
  'CUST-NORD': 1.35,
  'CUST-SAKS': 0.8,
  'CUST-MACY': 1.6,
  'CUST-BLOOM': 0.65,
}

function buildInventory(): InventoryLine[] {
  const lines: InventoryLine[] = []
  let seed = 1

  for (const customer of CUSTOMERS) {
    const scale = CUSTOMER_SCALE[customer.id] ?? 1
    for (const style of STYLE_CATALOG) {
      const sizes = sizesFor(style.category)
      // Not every customer carries every size of every style.
      const carriedSizes = sizes.filter(() => seededInt(seed++, 0, 10) > 2)
      for (const size of carriedSizes) {
        const base = seededInt(seed++, 4, 60)
        const unitsOnHand = Math.max(1, Math.round(base * scale))
        const consignMonth = seededInt(seed++, 1, 11)
        lines.push({
          id: `${customer.id}-${style.itemNumber}-${size}`,
          customerId: customer.id,
          itemNumber: style.itemNumber,
          styleName: style.styleName,
          category: style.category,
          season: style.season,
          color: style.color,
          size,
          unitsOnHand,
          unitCost: style.unitCost,
          retailPrice: style.retailPrice,
          consignedDate: `2025-${String(consignMonth).padStart(2, '0')}-15`,
        })
      }
    }
  }

  for (const pin of PINNED_LINES) {
    for (const [size, unitsOnHand] of pin.sizeRun) {
      lines.push({
        id: `${pin.customerId}-${pin.itemNumber}-${size}`,
        customerId: pin.customerId,
        itemNumber: pin.itemNumber,
        styleName: pin.styleName,
        category: pin.category,
        season: pin.season,
        color: pin.color,
        size,
        unitsOnHand,
        unitCost: pin.unitCost,
        retailPrice: pin.retailPrice,
        consignedDate: pin.consignedDate,
      })
    }
  }

  return lines
}

export const INVENTORY_LINES: InventoryLine[] = buildInventory()

/** Stable hash so a given partner always generates the same sample data. */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h
}

/**
 * Generate a believable consignment footprint for a partner added at runtime,
 * so a newly onboarded retailer shows real inventory in mock mode instead of an
 * empty shelf. Deterministic in the partner id — same partner, same numbers.
 */
export function generateInventoryForCustomer(
  customer: Customer,
): InventoryLine[] {
  const lines: InventoryLine[] = []
  let seed = (hashString(customer.id) % 90000) + 1000
  const scale = 0.6 + (hashString(customer.code) % 80) / 100 // ~0.6–1.4

  for (const style of STYLE_CATALOG) {
    const sizes = sizesFor(style.category)
    const carriedSizes = sizes.filter(() => seededInt(seed++, 0, 10) > 3)
    for (const size of carriedSizes) {
      const base = seededInt(seed++, 4, 55)
      const unitsOnHand = Math.max(1, Math.round(base * scale))
      const consignMonth = seededInt(seed++, 1, 11)
      lines.push({
        id: `${customer.id}-${style.itemNumber}-${size}`,
        customerId: customer.id,
        itemNumber: style.itemNumber,
        styleName: style.styleName,
        category: style.category,
        season: style.season,
        color: style.color,
        size,
        unitsOnHand,
        unitCost: style.unitCost,
        retailPrice: style.retailPrice,
        consignedDate: `2025-${String(consignMonth).padStart(2, '0')}-15`,
      })
    }
  }
  return lines
}

export const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Holiday']
