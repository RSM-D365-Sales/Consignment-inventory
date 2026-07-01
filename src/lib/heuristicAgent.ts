import type { AgentReply } from '../models/chat'
import {
  executeTool,
  resolveCategory,
  resolvePartner,
  resolveSeason,
  type AgentData,
} from './agentTools'

const TOOL_LABELS: Record<string, string> = {
  get_portfolio_summary: 'Portfolio summary',
  compare_partners: 'Compared partners',
  get_partner_details: 'Partner details',
  query_inventory: 'Queried inventory',
  draft_season_return: 'Drafted season return',
  list_transfers: 'Listed transfers',
  receive_transfer_order: 'Receive transfer',
  sell_inventory: 'Liquidation sale',
}

/** Canonical names for common off-price / discount buyers. */
const DISCOUNTERS: Record<string, string> = {
  marshalls: 'Marshalls',
  'tj maxx': 'TJ Maxx',
  tjmaxx: 'TJ Maxx',
  'tj. maxx': 'TJ Maxx',
  tjx: 'TJ Maxx',
  ross: 'Ross',
  'nordstrom rack': 'Nordstrom Rack',
  burlington: 'Burlington',
  'off 5th': 'Saks OFF 5TH',
  'off fifth': 'Saks OFF 5TH',
  'century 21': 'Century 21',
  sierra: 'Sierra',
}

function detectBuyer(q: string): string | undefined {
  for (const [k, v] of Object.entries(DISCOUNTERS)) if (q.includes(k)) return v
  const m = q.match(/\bto\s+([a-z][a-z0-9 .'&-]{1,28}?)(?:\s+(?:for|at|with|and)\b|$)/)
  if (m) {
    return m[1]
      .trim()
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
  }
  return undefined
}

/**
 * Offline rule-based agent. Maps the question to a single tool + arguments,
 * runs it against the real data, and returns the tool's summary as the answer.
 * No network, no key — the demo's default so the chat always works.
 */
export function runHeuristic(question: string, data: AgentData): AgentReply {
  const q = question.toLowerCase()
  const metric: 'value' | 'units' =
    /\b(unit|units|piece|pieces|qty|quantity|pairs?)\b/.test(q)
      ? 'units'
      : 'value'

  const partner = resolvePartner(question, data.customers)
  const category = resolveCategory(question)
  const season = resolveSeason(question)

  const has = (...words: string[]) => words.some((w) => q.includes(w))

  // 0a) Sell / liquidate intent.
  if (has('sell', 'liquidate', 'liquidation', 'offload', 'off-price', 'discount')) {
    if (!partner) {
      return {
        text: 'Which partner’s inventory should I sell, and to which discount buyer? e.g. "sell Nordstrom’s inventory to Marshalls for 30% margin".',
        tools: [],
      }
    }
    const marginPct = Number(q.match(/(\d{1,2})\s*%/)?.[1]) || undefined
    return reply(
      'sell_inventory',
      {
        partner: partner.name,
        buyer: detectBuyer(q),
        marginPct,
        season,
      },
      data,
    )
  }

  // 0b) Receive / pick a transfer order.
  const toRef = question.match(/\bTO-[A-Z0-9-]+/i)?.[0]
  if (
    has('receive', 'received', 'accept') ||
    (q.includes('pick') && (q.includes('transfer') || q.includes('order')))
  ) {
    return reply(
      'receive_transfer_order',
      { reference: toRef, partner: partner?.name },
      data,
    )
  }

  // 0c) List / track transfers.
  if (
    has('tracking') ||
    ((has('transfer', 'transfers') || toRef) &&
      has('status', 'track', 'list', 'show', 'open', 'received', 'in transit', 'how many', 'what', 'which'))
  ) {
    return reply('list_transfers', {}, data)
  }

  // 1) Draft / return intent.
  if (has('draft', 'return', 'reconcile', 'end of season', 'end-of-season', 'send back', 'pull back')) {
    if (partner) {
      return reply(
        'draft_season_return',
        { partner: partner.name, season },
        data,
      )
    }
    return {
      text:
        'I can draft an end-of-season return — which partner? For example: "draft the Fall return for Nordstrom."',
      tools: [],
    }
  }

  // 2) Explicit grouping questions ("which category…", "by season…").
  if (has('category', 'categories') && has('which', 'top', 'most', 'breakdown', 'by ')) {
    return reply(
      'query_inventory',
      { groupBy: 'category', metric, partner: partner?.name, season },
      data,
    )
  }
  if (has('which season', 'by season', 'each season', 'per season')) {
    return reply(
      'query_inventory',
      { groupBy: 'season', metric, partner: partner?.name, category },
      data,
    )
  }
  if (has('style', 'styles', 'sku', 'best seller', 'best-seller', 'top item')) {
    return reply(
      'query_inventory',
      { groupBy: 'style', metric, partner: partner?.name, category, season, limit: 5 },
      data,
    )
  }

  // 3) Ranking / comparison across partners.
  if (
    has('compare', 'rank', 'ranking', 'most', 'highest', 'largest', 'biggest', 'leading', 'leader', 'top partner', 'which partner', 'who has', 'who holds') &&
    !partner
  ) {
    return reply('compare_partners', { metric, category, season }, data)
  }

  // 4) Partner-specific.
  if (partner) {
    // Filtered drill-down for that partner.
    if (category || season) {
      return reply(
        'query_inventory',
        { groupBy: 'style', metric, partner: partner.name, category, season, limit: 6 },
        data,
      )
    }
    return reply('get_partner_details', { partner: partner.name, metric }, data)
  }

  // 5) Category/season filter without a partner → see which partners hold it.
  if (category || season) {
    return reply(
      'query_inventory',
      { groupBy: 'partner', metric, category, season },
      data,
    )
  }

  // 6) Portfolio / totals.
  if (has('total', 'overall', 'portfolio', 'summary', 'altogether', 'everything', 'all partners', 'how much', 'how many')) {
    return reply('get_portfolio_summary', {}, data)
  }

  // 7) Fallback — give the overall picture plus a nudge.
  const base = reply('get_portfolio_summary', {}, data)
  return {
    ...base,
    text:
      base.text +
      '\n\nTry: "compare partners by units", "what does Saks hold in knitwear", or "draft the Fall return for Nordstrom".',
  }
}

function reply(
  name: string,
  args: Record<string, unknown>,
  data: AgentData,
): AgentReply {
  const result = executeTool(name, args, data)
  return {
    text: result.summary,
    tools: [{ name, label: TOOL_LABELS[name] ?? name }],
    card: result.card,
  }
}
