import { useNavigate } from 'react-router-dom'
import type { CustomerPosition, Metric } from '../models/types'
import { money, moneyCompact, units, unitsCompact } from '../lib/format'
import { CATEGORY_COLORS, StackedBar } from './charts/StackedBar'
import { PartnerLogo } from './PartnerLogo'

interface Props {
  position: CustomerPosition
  metric: Metric
  /** Largest metric value across the queue — drives the comparison bar. */
  max: number
  rank: number
}

/**
 * One card in the landing "visual queue". Each card represents a retail
 * partner's virtual consignment warehouse, sized by the active metric so the
 * whole queue reads as a ranked bar chart of partners.
 */
export function CustomerQueueCard({ position, metric, max, rank }: Props) {
  const navigate = useNavigate()
  const { customer } = position

  const primary = metric === 'value' ? position.totalValue : position.totalUnits
  const primaryLabel =
    metric === 'value' ? money(position.totalValue) : `${units(position.totalUnits)} units`
  const secondaryLabel =
    metric === 'value'
      ? `${units(position.totalUnits)} units`
      : money(position.totalValue)
  const fill = max > 0 ? Math.max(6, (primary / max) * 100) : 0

  const segments = position.byCategory.map((c) => ({
    label: c.category,
    value: metric === 'value' ? c.value : c.units,
    color: CATEGORY_COLORS[c.category] ?? '#b08d57',
  }))

  return (
    <article
      className="queue-card"
      onClick={() => navigate(`/customer/${customer.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/customer/${customer.id}`)
      }}
    >
      <div className="queue-card__head">
        <div className="row gap-3">
          <PartnerLogo customer={customer} size={52} rounded={6} />
          <div>
            <h3 className="queue-card__name">{customer.name}</h3>
            <div className="queue-card__loc muted">{customer.location}</div>
          </div>
        </div>
        <div className="queue-card__rank eyebrow">#{rank}</div>
      </div>

      <div className="queue-card__metric">
        <div className="queue-card__primary numeric">{primaryLabel}</div>
        <div className="queue-card__secondary muted numeric">
          {secondaryLabel} · {position.lineCount} lines
        </div>
      </div>

      <div className="queue-card__bar">
        <div
          className="queue-card__bar-fill"
          style={{
            width: `${fill}%`,
            background: customer.accent,
          }}
        />
      </div>

      <div className="queue-card__breakdown">
        <StackedBar
          segments={segments}
          height={8}
          formatValue={(v) =>
            metric === 'value' ? moneyCompact(v) : `${unitsCompact(v)}`
          }
        />
        <div className="queue-card__cats">
          {position.byCategory.slice(0, 3).map((c) => (
            <span key={c.category} className="queue-card__cat muted">
              <span
                className="queue-card__cat-dot"
                style={{ background: CATEGORY_COLORS[c.category] }}
              />
              {c.category}
            </span>
          ))}
        </div>
      </div>

      <div className="queue-card__foot">
        <button
          className="btn btn--ghost btn--sm"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/season-return/${customer.id}`)
          }}
        >
          Draft season return →
        </button>
      </div>
    </article>
  )
}
