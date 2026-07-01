export interface StackSegment {
  label: string
  value: number
  color: string
}

interface Props {
  segments: StackSegment[]
  /** Optional fixed height in px. */
  height?: number
  /** Render a legend beneath the bar. */
  showLegend?: boolean
  formatValue?: (value: number) => string
}

/**
 * A single horizontal stacked bar — used to show category or season
 * composition of a customer's inventory in a compact, on-brand way.
 */
export function StackedBar({
  segments,
  height = 10,
  showLegend = false,
  formatValue,
}: Props) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  const visible = segments.filter((s) => s.value > 0)

  return (
    <div className="stacked">
      <div className="stacked__track" style={{ height }}>
        {visible.map((s) => (
          <div
            key={s.label}
            className="stacked__seg"
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color,
            }}
            title={`${s.label}: ${formatValue ? formatValue(s.value) : s.value}`}
          />
        ))}
      </div>
      {showLegend && (
        <ul className="stacked__legend">
          {visible.map((s) => (
            <li key={s.label} className="stacked__legend-item">
              <span
                className="stacked__swatch"
                style={{ background: s.color }}
              />
              <span className="stacked__legend-label">{s.label}</span>
              <span className="stacked__legend-value numeric muted">
                {formatValue ? formatValue(s.value) : s.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Stable color ramp for product categories. */
export const CATEGORY_COLORS: Record<string, string> = {
  Knitwear: '#b08d57',
  Outerwear: '#3f3a36',
  Dresses: '#a6452f',
  Tops: '#7c8470',
  Bottoms: '#6b7b8c',
  Footwear: '#8a6d3f',
  Accessories: '#c9b896',
}

export const SEASON_COLORS: Record<string, string> = {
  Spring: '#7c8470',
  Summer: '#c9a14a',
  Fall: '#a6452f',
  Holiday: '#3f3a36',
}
