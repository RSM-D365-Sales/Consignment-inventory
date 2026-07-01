import { useMemo } from 'react'
import type { EmailDraft, InventoryLine } from '../models/types'
import { lineValue } from '../lib/aggregations'
import { money, units } from '../lib/format'

interface Props {
  draft: EmailDraft
  mainDcName: string
  /** Editable subject/intro are lifted to the parent for the demo. */
  subject: string
  onSubjectChange: (value: string) => void
  intro: string
  onIntroChange: (value: string) => void
}

/**
 * Rich, in-app rendering of the end-of-season email the agent drafts.
 * This is the demo's "Outlook draft" surface. The structured table is built
 * from the same lines the transfer order will use, so what the partner sees
 * and what D365 moves are guaranteed to match.
 */
export function EmailPreview({
  draft,
  mainDcName,
  subject,
  onSubjectChange,
  intro,
  onIntroChange,
}: Props) {
  // Roll lines up to one row per style for a clean partner-facing summary.
  const rows = useMemo(() => groupByStyle(draft.lines), [draft.lines])

  return (
    <div className="email">
      <div className="email__chrome">
        <span className="email__dot" />
        <span className="email__dot" />
        <span className="email__dot" />
        <span className="email__chrome-label eyebrow">Draft · Outlook</span>
      </div>

      <div className="email__headers">
        <div className="email__hrow">
          <span className="email__hlabel">To</span>
          <span className="email__hvalue">
            {draft.customer.contactName} &lt;{draft.to}&gt;
          </span>
        </div>
        <div className="email__hrow">
          <span className="email__hlabel">From</span>
          <span className="email__hvalue muted">
            Vince Wholesale Operations &lt;consignment@vince.com&gt;
          </span>
        </div>
        <div className="email__hrow">
          <span className="email__hlabel">Subject</span>
          <input
            className="email__subject"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            aria-label="Email subject"
          />
        </div>
      </div>

      <div className="email__body">
        <p>Hi {draft.customer.contactName.split(' ')[0]},</p>

        <textarea
          className="email__intro"
          value={intro}
          onChange={(e) => onIntroChange(e.target.value)}
          rows={3}
          aria-label="Email intro paragraph"
        />

        <table className="email__table">
          <thead>
            <tr>
              <th>Style</th>
              <th>Item</th>
              <th className="r">Units</th>
              <th className="r">Ext. value (cost)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item}>
                <td>{r.name}</td>
                <td className="muted numeric">{r.item}</td>
                <td className="r numeric">{units(r.units)}</td>
                <td className="r numeric">{money(r.value)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total — {rows.length} styles</td>
              <td className="r numeric">{units(draft.totalUnits)}</td>
              <td className="r numeric">{money(draft.totalValue)}</td>
            </tr>
          </tfoot>
        </table>

        <p>
          Per our consignment agreement, we'd like to arrange the return of this
          remaining inventory to our <strong>{mainDcName}</strong>. On your
          confirmation, we'll generate the transfer and share return logistics
          and labels.
        </p>
        <p className="muted">
          Please reply with any discrepancies against your floor counts before
          we initiate the transfer.
        </p>
        <p>
          Best regards,
          <br />
          Vince Wholesale Operations
        </p>
      </div>
    </div>
  )
}

function groupByStyle(lines: InventoryLine[]) {
  const map = new Map<
    string,
    { name: string; item: string; units: number; value: number }
  >()
  for (const l of lines) {
    const e = map.get(l.itemNumber) ?? {
      name: l.styleName,
      item: l.itemNumber,
      units: 0,
      value: 0,
    }
    e.units += l.unitsOnHand
    e.value += lineValue(l)
    map.set(l.itemNumber, e)
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
}
