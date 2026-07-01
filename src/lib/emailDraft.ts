import type {
  Customer,
  EmailDraft,
  InventoryLine,
  Season,
} from '../models/types'
import { lineValue } from './aggregations'
import { dateLong, money, units } from './format'

const SENDER_SIGNOFF = 'Vince Wholesale Operations\nconsignment@vince.com'

export interface EmailDraftInput {
  customer: Customer
  season: Season
  /** Lines to include — typically all lines for the selected season. */
  lines: InventoryLine[]
  /** Main DC name for the return destination, from setup config. */
  mainDcName: string
  /** Today's date (ISO) — passed in to stay deterministic/testable. */
  asOfIso: string
}

/** The editable opening paragraph the agent proposes. */
export function endOfSeasonIntro(
  customer: Customer,
  season: Season,
  asOfIso: string,
): string {
  return (
    `As we close out the ${season} season, our records show the following ` +
    `Vince consignment inventory currently held at ${customer.name} as of ` +
    `${dateLong(asOfIso)}:`
  )
}

/** Subject line for the reconciliation email. */
export function endOfSeasonSubject(
  customer: Customer,
  season: Season,
  asOfIso: string,
): string {
  return `End-of-Season Consignment Reconciliation — ${season} ${new Date(
    asOfIso,
  ).getFullYear()} (Vince × ${customer.name})`
}

/**
 * Compose the end-of-season consignment reconciliation email.
 *
 * Modeled after the D365 Supplier Communication Agent, but pointed at retail
 * consignment partners. The body summarizes the inventory D365 shows on hand
 * at the partner's facility and proposes returning it to the main DC.
 */
export function composeEndOfSeasonEmail(input: EmailDraftInput): EmailDraft {
  const { customer, season, lines, asOfIso } = input
  const totalUnits = lines.reduce((sum, l) => sum + l.unitsOnHand, 0)
  const totalValue = lines.reduce((sum, l) => sum + lineValue(l), 0)
  const subject = endOfSeasonSubject(customer, season, asOfIso)
  const intro = endOfSeasonIntro(customer, season, asOfIso)

  return {
    to: customer.contactEmail,
    cc: undefined,
    subject,
    bodyText: assembleBodyText(input, intro),
    lines,
    customer,
    season,
    totalUnits,
    totalValue,
  }
}

/**
 * Build the plain-text body from a (possibly user-edited) intro paragraph.
 * Used for the copy-to-clipboard and mailto: paths so the text always
 * reflects what's shown in the preview.
 */
export function assembleBodyText(
  input: EmailDraftInput,
  intro: string,
): string {
  const { customer, lines, mainDcName } = input
  const totalUnits = lines.reduce((sum, l) => sum + l.unitsOnHand, 0)
  const totalValue = lines.reduce((sum, l) => sum + lineValue(l), 0)

  return [
    `Hi ${firstName(customer.contactName)},`,
    '',
    intro,
    '',
    buildPlainTextTable(lines),
    '',
    `Total: ${units(totalUnits)} units · ${money(totalValue)} at cost across ${lines.length} style/size lines.`,
    '',
    `Per our consignment agreement, we'd like to arrange the return of this remaining inventory to our ${mainDcName}. On your confirmation, we'll generate the transfer and share return logistics and labels.`,
    '',
    `Please reply with any discrepancies against your floor counts before we initiate the transfer. If everything reconciles, no action is needed on your end — we'll proceed.`,
    '',
    'Thank you for your partnership this season.',
    '',
    'Best regards,',
    SENDER_SIGNOFF,
  ].join('\n')
}

function buildPlainTextTable(lines: InventoryLine[]): string {
  const byStyle = new Map<
    string,
    { name: string; item: string; units: number; value: number }
  >()
  for (const l of lines) {
    const entry = byStyle.get(l.itemNumber) ?? {
      name: l.styleName,
      item: l.itemNumber,
      units: 0,
      value: 0,
    }
    entry.units += l.unitsOnHand
    entry.value += lineValue(l)
    byStyle.set(l.itemNumber, entry)
  }
  return [...byStyle.values()]
    .sort((a, b) => b.value - a.value)
    .map(
      (r) =>
        `  • ${r.name} (${r.item}) — ${units(r.units)} units · ${money(r.value)}`,
    )
    .join('\n')
}

/**
 * Build a mailto: URL for the "open in Outlook / default mail client" path.
 * NOTE: this is the demo-stage real-send path. Production should prefer the
 * Microsoft Graph draft flow documented in docs/FUTURE-INTEGRATION.md.
 */
export function buildMailtoUrl(
  to: string,
  subject: string,
  bodyText: string,
  cc?: string,
): string {
  const params = new URLSearchParams({ subject, body: bodyText })
  if (cc) params.set('cc', cc)
  const query = params.toString().replace(/\+/g, '%20')
  return `mailto:${encodeURIComponent(to)}?${query}`
}

function firstName(full: string): string {
  return full.split(' ')[0] ?? full
}
