import { useEffect, useMemo, useState } from 'react'
import type { EmailDraft, InventoryLine } from '../models/types'
import { lineValue } from '../lib/aggregations'
import { money, units } from '../lib/format'

export interface AddableStyle {
  item: string
  name: string
  units: number
  value: number
}

interface Props {
  draft: EmailDraft
  mainDcName: string
  /** Editable subject/intro are lifted to the parent for the demo. */
  subject: string
  onSubjectChange: (value: string) => void
  intro: string
  onIntroChange: (value: string) => void
  /** When provided, each table row gets a remove control. */
  onRemoveLine?: (itemNumber: string) => void
  /** Partner styles not in the draft, offered by the add-line picker. */
  addableStyles?: AddableStyle[]
  onAddLine?: (itemNumber: string) => void
  /** When provided, the units figure per row is editable. */
  onUnitsChange?: (itemNumber: string, units: number) => void
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
  onRemoveLine,
  addableStyles,
  onAddLine,
  onUnitsChange,
}: Props) {
  // Roll lines up to one row per style for a clean partner-facing summary.
  const rows = useMemo(() => groupByStyle(draft.lines), [draft.lines])
  const [pendingAdd, setPendingAdd] = useState('')
  const editable = Boolean(onRemoveLine)

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
              {editable && <th aria-label="Remove line" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={editable ? 5 : 4} className="muted">
                  No styles in this draft — add one below.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.item}>
                <td>{r.name}</td>
                <td className="muted numeric">{r.item}</td>
                <td className="r numeric">
                  {onUnitsChange ? (
                    <UnitsCell
                      value={r.units}
                      onCommit={(n) => onUnitsChange(r.item, n)}
                    />
                  ) : (
                    units(r.units)
                  )}
                </td>
                <td className="r numeric">{money(r.value)}</td>
                {editable && (
                  <td className="email__removecell">
                    <button
                      className="email__remove"
                      title={`Remove ${r.name} from this return`}
                      aria-label={`Remove ${r.name} from this return`}
                      onClick={() => onRemoveLine!(r.item)}
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total — {rows.length} styles</td>
              <td className="r numeric">{units(draft.totalUnits)}</td>
              <td className="r numeric">{money(draft.totalValue)}</td>
              {editable && <td />}
            </tr>
          </tfoot>
        </table>

        {onAddLine && addableStyles && addableStyles.length > 0 && (
          <div className="email__addline">
            <select
              className="select email__addselect"
              value={pendingAdd}
              onChange={(e) => setPendingAdd(e.target.value)}
              aria-label="Style to add to this return"
            >
              <option value="">Add a style to this return…</option>
              {addableStyles.map((s) => (
                <option key={s.item} value={s.item}>
                  {s.name} ({s.item}) — {units(s.units)} units · {money(s.value)}
                </option>
              ))}
            </select>
            <button
              className="btn btn--ghost btn--sm"
              disabled={!pendingAdd}
              onClick={() => {
                onAddLine(pendingAdd)
                setPendingAdd('')
              }}
            >
              + Add line
            </button>
          </div>
        )}

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

/**
 * Editable units figure. Commits on blur or Enter; the parent clamps the
 * request to the style's on-hand total and the field resyncs to whatever
 * quantity was actually applied. Escape reverts.
 */
function UnitsCell({
  value,
  onCommit,
}: {
  value: number
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  function commit() {
    const n = Number.parseInt(text.replace(/[^\d]/g, ''), 10)
    setText(String(value))
    if (Number.isFinite(n) && n >= 1 && n !== value) onCommit(n)
  }

  return (
    <input
      className="email__units numeric"
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setText(String(value))
      }}
      aria-label="Units to return"
      title="Edit units to return — capped at units on hand"
    />
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
