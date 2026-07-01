import type {
  Customer,
  CustomerPosition,
  InventoryLine,
  Metric,
  ProductCategory,
  Season,
} from '../models/types'
import type { ActionCard } from '../models/chat'
import type { AppConfig } from '../models/config'
import {
  TRANSFER_STATUS_LABEL,
  type TransferOrder,
} from '../models/operations'
import { lineValue } from './aggregations'
import { money, units } from './format'

/** Snapshot of app data the tools read from (mock or live, same shape). */
export interface AgentData {
  customers: Customer[]
  lines: InventoryLine[]
  positions: CustomerPosition[]
  transfers: TransferOrder[]
  config: AppConfig
}

export interface ToolResult {
  /** Compact payload returned to the LLM as the tool's result. */
  model: unknown
  /** Human-readable answer — used directly by the heuristic agent. */
  summary: string
  /** Optional rich card to render under the answer. */
  card?: ActionCard
}

/** OpenAI/Azure function-calling tool definition. */
export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

const CATEGORIES: ProductCategory[] = [
  'Knitwear',
  'Outerwear',
  'Dresses',
  'Tops',
  'Bottoms',
  'Footwear',
  'Accessories',
]
const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Holiday']

// ── Resolvers ────────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function resolvePartner(
  text: string | undefined,
  customers: Customer[],
): Customer | undefined {
  if (!text) return undefined
  const q = norm(text)
  if (!q) return undefined
  // Exact-ish: code or name contains / is contained.
  return customers.find((c) => {
    const n = norm(c.name)
    const code = norm(c.code)
    return n.includes(q) || q.includes(code) || code === q || q.includes(n)
  })
}

const CATEGORY_SYNONYMS: Record<string, ProductCategory> = {
  coat: 'Outerwear',
  coats: 'Outerwear',
  jacket: 'Outerwear',
  jackets: 'Outerwear',
  sweater: 'Knitwear',
  sweaters: 'Knitwear',
  knit: 'Knitwear',
  knits: 'Knitwear',
  cashmere: 'Knitwear',
  dress: 'Dresses',
  top: 'Tops',
  blouse: 'Tops',
  tee: 'Tops',
  shirt: 'Tops',
  pant: 'Bottoms',
  pants: 'Bottoms',
  trouser: 'Bottoms',
  trousers: 'Bottoms',
  bottom: 'Bottoms',
  shoe: 'Footwear',
  shoes: 'Footwear',
  sneaker: 'Footwear',
  boot: 'Footwear',
  boots: 'Footwear',
  accessory: 'Accessories',
  belt: 'Accessories',
  scarf: 'Accessories',
  wrap: 'Accessories',
}

export function resolveCategory(
  text: string | undefined,
): ProductCategory | undefined {
  if (!text) return undefined
  const q = norm(text)
  const direct = CATEGORIES.find((c) => norm(c).includes(q) || q.includes(norm(c)))
  if (direct) return direct
  for (const [key, cat] of Object.entries(CATEGORY_SYNONYMS)) {
    if (q.includes(key)) return cat
  }
  return undefined
}

export function resolveSeason(text: string | undefined): Season | undefined {
  if (!text) return undefined
  const q = norm(text)
  if (q.includes('winter')) return 'Holiday'
  if (q.includes('autumn')) return 'Fall'
  return SEASONS.find((s) => norm(s).includes(q) || q.includes(norm(s)))
}

function metricArg(m: unknown): Metric {
  return m === 'units' ? 'units' : 'value'
}

// ── Filtering / aggregation ──────────────────────────────────────────────────

interface LineFilter {
  customerId?: string
  category?: ProductCategory
  season?: Season
}

function filterLines(data: AgentData, f: LineFilter): InventoryLine[] {
  return data.lines.filter(
    (l) =>
      (!f.customerId || l.customerId === f.customerId) &&
      (!f.category || l.category === f.category) &&
      (!f.season || l.season === f.season),
  )
}

function totalsOf(lines: InventoryLine[]) {
  let u = 0
  let v = 0
  for (const l of lines) {
    u += l.unitsOnHand
    v += lineValue(l)
  }
  return { units: u, value: v }
}

const fmt = (metric: Metric, value: number, unitCount: number) =>
  metric === 'value' ? money(value) : `${units(unitCount)} units`

function filterLabel(category?: ProductCategory, season?: Season): string {
  const parts = [category, season].filter(Boolean)
  return parts.length ? ` (${parts.join(', ')})` : ''
}

// ── Tool definitions ─────────────────────────────────────────────────────────

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'get_portfolio_summary',
    description:
      'Total consignment inventory across all retail partners: value at cost, value at retail, units, and partner count. Use for overall/portfolio questions.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'compare_partners',
    description:
      'Rank retail partners by a metric, optionally filtered to a category and/or season. Use for "which partner has the most…", comparisons, and rankings.',
    parameters: {
      type: 'object',
      properties: {
        metric: { type: 'string', enum: ['value', 'units'] },
        category: { type: 'string' },
        season: { type: 'string' },
      },
      required: ['metric'],
    },
  },
  {
    name: 'get_partner_details',
    description:
      "One partner's full position: totals, top categories, and top styles. Use when the question is about a specific partner.",
    parameters: {
      type: 'object',
      properties: {
        partner: { type: 'string', description: 'Partner name or code' },
        metric: { type: 'string', enum: ['value', 'units'] },
      },
      required: ['partner'],
    },
  },
  {
    name: 'query_inventory',
    description:
      'Flexible aggregation of inventory. Filter by partner/category/season and group the results by partner, category, season, or style; ranked by the chosen metric.',
    parameters: {
      type: 'object',
      properties: {
        groupBy: {
          type: 'string',
          enum: ['partner', 'category', 'season', 'style'],
        },
        metric: { type: 'string', enum: ['value', 'units'] },
        partner: { type: 'string' },
        category: { type: 'string' },
        season: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['groupBy', 'metric'],
    },
  },
  {
    name: 'draft_season_return',
    description:
      'Draft an end-of-season consignment return for a partner (optionally a single season). Returns a confirmable card; it does NOT create the transfer order by itself.',
    parameters: {
      type: 'object',
      properties: {
        partner: { type: 'string', description: 'Partner name or code' },
        season: {
          type: 'string',
          description: 'Season to reconcile, or omit for all remaining stock',
        },
      },
      required: ['partner'],
    },
  },
  {
    name: 'list_transfers',
    description:
      'List existing return transfer orders and their statuses (created, picking, in transit, received). Use for "what transfers exist", "status of my returns", tracking questions.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'receive_transfer_order',
    description:
      'Pick and receive an existing transfer order into the main DC (simulated). Identify it by transfer order number or by partner. Returns a confirmable card; receiving lowers that partner on-hand inventory.',
    parameters: {
      type: 'object',
      properties: {
        reference: { type: 'string', description: 'Transfer order number' },
        partner: { type: 'string', description: 'Partner name or code' },
      },
      required: [],
    },
  },
  {
    name: 'sell_inventory',
    description:
      "Sell (liquidate) a partner's consignment inventory to a discount retailer at a markup over cost. Returns a confirmable card; confirming records the sale and removes the inventory.",
    parameters: {
      type: 'object',
      properties: {
        partner: { type: 'string', description: 'Partner name or code' },
        buyer: {
          type: 'string',
          description: 'Discount buyer, e.g. Marshalls, TJ Maxx, Ross',
        },
        marginPct: {
          type: 'number',
          description: 'Markup over cost in percent (default 30)',
        },
        season: { type: 'string', description: 'Optional season to limit the sale' },
      },
      required: ['partner'],
    },
  },
]

/** OpenAI/Azure `tools` array form. */
export function toOpenAITools() {
  return TOOL_DEFS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

// ── Executor ─────────────────────────────────────────────────────────────────

export function executeTool(
  name: string,
  args: Record<string, unknown>,
  data: AgentData,
): ToolResult {
  switch (name) {
    case 'get_portfolio_summary':
      return portfolioSummary(data)
    case 'compare_partners':
      return comparePartners(data, args)
    case 'get_partner_details':
      return partnerDetails(data, args)
    case 'query_inventory':
      return queryInventory(data, args)
    case 'draft_season_return':
      return draftSeasonReturn(data, args)
    case 'list_transfers':
      return listTransfers(data)
    case 'receive_transfer_order':
      return receiveTransferOrder(data, args)
    case 'sell_inventory':
      return sellInventory(data, args)
    default:
      return {
        model: { error: `Unknown tool: ${name}` },
        summary: `I don't have a tool called "${name}".`,
      }
  }
}

function portfolioSummary(data: AgentData): ToolResult {
  const t = totalsOf(data.lines)
  const retail = data.lines.reduce(
    (s, l) => s + l.unitsOnHand * l.retailPrice,
    0,
  )
  const ranked = [...data.positions].sort((a, b) => b.totalValue - a.totalValue)
  const leaders = ranked
    .map((p) => `${p.customer.name} (${money(p.totalValue)})`)
    .join(', ')
  return {
    model: {
      totalValueAtCost: t.value,
      totalValueAtRetail: retail,
      totalUnits: t.units,
      partnerCount: data.positions.length,
      partners: ranked.map((p) => ({
        name: p.customer.name,
        value: p.totalValue,
        units: p.totalUnits,
      })),
    },
    summary: `Across ${data.positions.length} partners, Vince holds ${units(
      t.units,
    )} units worth ${money(t.value)} at cost (${money(
      retail,
    )} at retail). By value: ${leaders}.`,
  }
}

function comparePartners(
  data: AgentData,
  args: Record<string, unknown>,
): ToolResult {
  const metric = metricArg(args.metric)
  const category = resolveCategory(args.category as string)
  const season = resolveSeason(args.season as string)

  const rows = data.customers
    .map((c) => {
      const t = totalsOf(
        filterLines(data, { customerId: c.id, category, season }),
      )
      return { name: c.name, value: t.value, units: t.units }
    })
    .filter((r) => r.units > 0)
    .sort((a, b) =>
      metric === 'value' ? b.value - a.value : b.units - a.units,
    )

  const label = filterLabel(category, season)
  const list = rows
    .map(
      (r, i) =>
        `${i + 1}. ${r.name} — ${fmt(metric, r.value, r.units)}`,
    )
    .join('\n')
  const headline = rows.length
    ? `By ${metric === 'value' ? 'value at cost' : 'units'}${label}, ${
        rows[0].name
      } leads with ${fmt(metric, rows[0].value, rows[0].units)}.`
    : `No inventory matches${label}.`

  return { model: { metric, category, season, ranking: rows }, summary: `${headline}\n${list}` }
}

function partnerDetails(
  data: AgentData,
  args: Record<string, unknown>,
): ToolResult {
  const customer = resolvePartner(args.partner as string, data.customers)
  if (!customer) {
    return {
      model: { error: 'partner_not_found', query: args.partner },
      summary: `I couldn't match a partner named "${args.partner}". Partners: ${data.customers
        .map((c) => c.name)
        .join(', ')}.`,
    }
  }
  const metric = metricArg(args.metric)
  const pos = data.positions.find((p) => p.customer.id === customer.id)!
  const topCats = pos.byCategory
    .slice(0, 3)
    .map((c) => `${c.category} (${fmt(metric, c.value, c.units)})`)
    .join(', ')

  const styles = groupByStyle(
    filterLines(data, { customerId: customer.id }),
  )
    .sort((a, b) => (metric === 'value' ? b.value - a.value : b.units - a.units))
    .slice(0, 3)
    .map((s) => `${s.name} (${fmt(metric, s.value, s.units)})`)
    .join(', ')

  return {
    model: {
      partner: customer.name,
      warehouse: data.config.mappings.find((m) => m.customerId === customer.id)
        ?.warehouseId,
      totalValueAtCost: pos.totalValue,
      totalUnits: pos.totalUnits,
      lineCount: pos.lineCount,
      topCategories: pos.byCategory.slice(0, 3),
    },
    summary: `${customer.name} holds ${units(pos.totalUnits)} units worth ${money(
      pos.totalValue,
    )} at cost across ${pos.lineCount} lines. Top categories: ${topCats}. Top styles: ${styles}.`,
  }
}

function queryInventory(
  data: AgentData,
  args: Record<string, unknown>,
): ToolResult {
  const metric = metricArg(args.metric)
  const groupBy = (args.groupBy as string) || 'style'
  const category = resolveCategory(args.category as string)
  const season = resolveSeason(args.season as string)
  const partner = resolvePartner(args.partner as string, data.customers)
  const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20)

  const lines = filterLines(data, {
    customerId: partner?.id,
    category,
    season,
  })

  const buckets = new Map<string, { label: string; units: number; value: number }>()
  for (const l of lines) {
    const key =
      groupBy === 'partner'
        ? data.customers.find((c) => c.id === l.customerId)?.name ?? l.customerId
        : groupBy === 'category'
          ? l.category
          : groupBy === 'season'
            ? l.season
            : l.styleName
    const b = buckets.get(key) ?? { label: key, units: 0, value: 0 }
    b.units += l.unitsOnHand
    b.value += lineValue(l)
    buckets.set(key, b)
  }

  const rows = [...buckets.values()]
    .sort((a, b) => (metric === 'value' ? b.value - a.value : b.units - a.units))
    .slice(0, limit)

  const scope = [partner?.name, category, season].filter(Boolean).join(' · ')
  const totals = totalsOf(lines)
  const list = rows
    .map((r) => `• ${r.label} — ${fmt(metric, r.value, r.units)}`)
    .join('\n')

  return {
    model: { groupBy, metric, scope: scope || 'all', rows, totals },
    summary: rows.length
      ? `${scope ? scope + ': ' : ''}top ${rows.length} by ${groupBy}, ${
          metric === 'value' ? 'value' : 'units'
        } — total ${fmt(metric, totals.value, totals.units)}.\n${list}`
      : `No inventory matches ${scope || 'that query'}.`,
  }
}

function draftSeasonReturn(
  data: AgentData,
  args: Record<string, unknown>,
): ToolResult {
  const customer = resolvePartner(args.partner as string, data.customers)
  if (!customer) {
    return {
      model: { error: 'partner_not_found', query: args.partner },
      summary: `I couldn't match a partner named "${args.partner}". Partners: ${data.customers
        .map((c) => c.name)
        .join(', ')}.`,
    }
  }
  const season = resolveSeason(args.season as string)
  const lines = filterLines(data, {
    customerId: customer.id,
    season: season ?? undefined,
  })
  if (lines.length === 0) {
    return {
      model: { error: 'no_inventory', partner: customer.name, season },
      summary: `${customer.name} has no ${season ?? ''} inventory to return.`,
    }
  }
  const t = totalsOf(lines)
  const seasonLabel = season ?? 'all remaining'

  const card: ActionCard = {
    kind: 'season-return',
    customerId: customer.id,
    customerName: customer.name,
    season: season ?? 'all',
    totalUnits: t.units,
    totalValue: t.value,
    lineCount: lines.length,
    status: 'proposed',
  }

  return {
    model: {
      drafted: true,
      partner: customer.name,
      season: seasonLabel,
      totalUnits: t.units,
      totalValueAtCost: t.value,
      lineCount: lines.length,
    },
    summary: `Drafted the ${seasonLabel} end-of-season return for ${customer.name}: ${units(
      t.units,
    )} units, ${money(t.value)} at cost across ${lines.length} lines. Review the draft below — you can open the full email or confirm the transfer order.`,
    card,
  }
}

function listTransfers(data: AgentData): ToolResult {
  const t = data.transfers
  if (t.length === 0) {
    return {
      model: { count: 0 },
      summary:
        'No transfer orders have been created yet. Draft an end-of-season return to start one.',
    }
  }
  const counts = new Map<string, number>()
  for (const x of t) counts.set(x.status, (counts.get(x.status) ?? 0) + 1)
  const countStr = [...counts.entries()]
    .map(([s, n]) => `${n} ${TRANSFER_STATUS_LABEL[s as TransferOrder['status']]}`)
    .join(', ')
  const recent = t
    .slice(0, 6)
    .map(
      (x) =>
        `• ${x.id} — ${x.customerName} ${
          x.season === 'all' ? '' : x.season
        } · ${units(x.totalUnits)} units · ${TRANSFER_STATUS_LABEL[x.status]}`,
    )
    .join('\n')
  return {
    model: {
      count: t.length,
      byStatus: Object.fromEntries(counts),
      transfers: t.slice(0, 10).map((x) => ({
        id: x.id,
        partner: x.customerName,
        units: x.totalUnits,
        status: x.status,
      })),
    },
    summary: `${t.length} transfer orders (${countStr}).\n${recent}`,
  }
}

function receiveTransferOrder(
  data: AgentData,
  args: Record<string, unknown>,
): ToolResult {
  const open = data.transfers.filter((t) => t.status !== 'received')
  const ref = (args.reference as string)?.toLowerCase().trim()
  const partner = resolvePartner(args.partner as string, data.customers)

  let target: TransferOrder | undefined
  if (ref) target = open.find((t) => t.id.toLowerCase().includes(ref))
  if (!target && partner)
    target = open.find((t) => t.customerId === partner.id)
  if (!target && !ref && !partner && open.length === 1) target = open[0]

  if (!target) {
    return {
      model: { error: 'no_open_transfer', openCount: open.length },
      summary: open.length
        ? 'Which transfer should I receive? Give me the transfer order number or the partner.'
        : 'There are no open transfer orders to receive.',
    }
  }

  const seasonLabel = target.season === 'all' ? 'all-season' : target.season
  return {
    model: {
      transferId: target.id,
      partner: target.customerName,
      units: target.totalUnits,
    },
    summary: `Ready to pick & receive ${target.id} — ${target.customerName}'s ${seasonLabel} return (${units(
      target.totalUnits,
    )} units across ${target.lineCount} lines). Confirm to receive it into the main DC; ${target.customerName}'s on-hand will drop accordingly.`,
    card: {
      kind: 'receive-transfer',
      transferId: target.id,
      customerName: target.customerName,
      season: target.season,
      totalUnits: target.totalUnits,
      lineCount: target.lineCount,
      status: 'proposed',
    },
  }
}

function sellInventory(
  data: AgentData,
  args: Record<string, unknown>,
): ToolResult {
  const customer = resolvePartner(args.partner as string, data.customers)
  if (!customer) {
    return {
      model: { error: 'partner_not_found', query: args.partner },
      summary: `I couldn't match a partner named "${args.partner}". Partners: ${data.customers
        .map((c) => c.name)
        .join(', ')}.`,
    }
  }
  const season = resolveSeason(args.season as string)
  const lines = filterLines(data, {
    customerId: customer.id,
    season: season ?? undefined,
  })
  if (lines.length === 0) {
    return {
      model: { error: 'no_inventory', partner: customer.name },
      summary: `${customer.name} has no ${season ?? ''} inventory available to sell.`,
    }
  }
  const t = totalsOf(lines)
  const marginPct = Math.min(Math.max(Number(args.marginPct) || 30, 0), 90)
  const buyer = (args.buyer as string)?.trim() || 'a discount retailer'
  const saleValue = Math.round(t.value * (1 + marginPct / 100))
  const seasonLabel = season ?? 'all remaining'

  return {
    model: {
      partner: customer.name,
      buyer,
      marginPct,
      units: t.units,
      costValue: t.value,
      saleValue,
    },
    summary: `Proposed sale of ${customer.name}'s ${seasonLabel} inventory to ${buyer}: ${units(
      t.units,
    )} units, ${money(t.value)} at cost → ${money(
      saleValue,
    )} at +${marginPct}% margin. Confirm to record the sale and remove the inventory.`,
    card: {
      kind: 'liquidation-sale',
      customerId: customer.id,
      customerName: customer.name,
      buyer,
      marginPct,
      totalUnits: t.units,
      lineCount: lines.length,
      costValue: t.value,
      saleValue,
      removals: lines.map((l) => ({ lineId: l.id, units: l.unitsOnHand })),
      status: 'proposed',
    },
  }
}

function groupByStyle(lines: InventoryLine[]) {
  const map = new Map<string, { name: string; units: number; value: number }>()
  for (const l of lines) {
    const e = map.get(l.itemNumber) ?? { name: l.styleName, units: 0, value: 0 }
    e.units += l.unitsOnHand
    e.value += lineValue(l)
    map.set(l.itemNumber, e)
  }
  return [...map.values()]
}
