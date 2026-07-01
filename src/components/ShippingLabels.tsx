import { CARRIER, printLabels, type ShippingLabel } from '../lib/shipping'

interface Props {
  labels: ShippingLabel[]
  /** Optional title override. */
  title?: string
}

/**
 * On-screen preview of the sample shipping labels with a print/save-PDF action.
 * Labels are illustrative specimens only — see lib/shipping.ts.
 */
export function ShippingLabels({ labels, title = 'Shipping labels' }: Props) {
  if (labels.length === 0) return null

  return (
    <section className="card panel ship">
      <div className="panel__head">
        <div>
          <div className="eyebrow">{title}</div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            {labels.length} carton{labels.length > 1 ? 's' : ''} · {CARRIER} ·{' '}
            <span className="ship__sample">sample</span>
          </div>
        </div>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => printLabels(labels)}
        >
          Print / save PDF
        </button>
      </div>

      <div className="ship__gallery">
        {labels.slice(0, 3).map((l) => (
          <MiniLabel key={l.carton} label={l} />
        ))}
        {labels.length > 3 && (
          <button
            className="ship__more"
            onClick={() => printLabels(labels)}
            title="Print all labels"
          >
            +{labels.length - 3}
            <span>more</span>
          </button>
        )}
      </div>
    </section>
  )
}

function MiniLabel({ label }: { label: ShippingLabel }) {
  return (
    <div className="mini-label">
      <div className="mini-label__wm">SAMPLE</div>
      <div className="mini-label__hd">
        <span className="mini-label__carrier">FedEx</span>
        <span className="mini-label__svc">{label.service}</span>
      </div>
      <div className="mini-label__addr">
        <div>
          <div className="mini-label__k">FROM</div>
          <div className="mini-label__v">{label.fromName}</div>
        </div>
        <div className="mini-label__arrow">→</div>
        <div>
          <div className="mini-label__k">TO</div>
          <div className="mini-label__v">{label.toName}</div>
        </div>
      </div>
      <div className="mini-label__big">
        Carton {label.carton} / {label.cartons}
      </div>
      <div className="mini-label__barcode">
        {label.bars.map((w, i) => (
          <span key={i} style={{ width: w }} />
        ))}
      </div>
      <div className="mini-label__track numeric">{label.tracking}</div>
      <div className="mini-label__meta muted">
        {label.units} units · {label.weightLb} lb · Ref {label.reference}
      </div>
    </div>
  )
}
