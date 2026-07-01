import type { Metric } from '../../models/types'

interface Props {
  value: Metric
  onChange: (metric: Metric) => void
}

/** Segmented control switching the dashboard between dollars and units. */
export function MetricToggle({ value, onChange }: Props) {
  return (
    <div className="segmented" role="tablist" aria-label="Metric">
      <button
        role="tab"
        aria-selected={value === 'value'}
        className={`segmented__btn${value === 'value' ? ' is-active' : ''}`}
        onClick={() => onChange('value')}
      >
        Dollars
      </button>
      <button
        role="tab"
        aria-selected={value === 'units'}
        className={`segmented__btn${value === 'units' ? ' is-active' : ''}`}
        onClick={() => onChange('units')}
      >
        Units
      </button>
    </div>
  )
}
