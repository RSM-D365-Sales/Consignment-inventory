import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../context/InventoryContext'
import type { Metric, Season } from '../models/types'
import { MetricToggle } from '../components/ui/MetricToggle'
import { CustomerQueueCard } from '../components/CustomerQueueCard'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States'
import { money, moneyCompact, units } from '../lib/format'
import { buildPositions } from '../lib/aggregations'
import { SEASONS } from '../data/mockData'
import { CATEGORY_COLORS, StackedBar } from '../components/charts/StackedBar'
import type { CategoryAggregate, ProductCategory } from '../models/types'

const AS_OF = '2026-06-30'

export function DashboardPage() {
  const navigate = useNavigate()
  const { loading, error, customers, lines, refresh } = useInventory()
  const [metric, setMetric] = useState<Metric>('value')
  const [season, setSeason] = useState<Season | 'all'>('all')

  // Recompute positions against the season filter so the queue stays in sync.
  const filteredLines = useMemo(
    () => (season === 'all' ? lines : lines.filter((l) => l.season === season)),
    [lines, season],
  )
  const positions = useMemo(
    () => buildPositions(customers, filteredLines),
    [customers, filteredLines],
  )

  const ranked = useMemo(() => {
    const key = metric === 'value' ? 'totalValue' : 'totalUnits'
    return [...positions]
      .filter((p) => p.totalUnits > 0)
      .sort((a, b) => b[key] - a[key])
  }, [positions, metric])

  const max = ranked.length
    ? metric === 'value'
      ? ranked[0].totalValue
      : ranked[0].totalUnits
    : 0

  const totals = useMemo(() => {
    const totalValue = positions.reduce((s, p) => s + p.totalValue, 0)
    const totalUnits = positions.reduce((s, p) => s + p.totalUnits, 0)
    const totalRetail = positions.reduce((s, p) => s + p.totalRetail, 0)
    return { totalValue, totalUnits, totalRetail }
  }, [positions])

  // Portfolio-wide category mix for the summary bar.
  const portfolioMix = useMemo(() => {
    const map = new Map<ProductCategory, CategoryAggregate>()
    for (const p of positions) {
      for (const c of p.byCategory) {
        const e = map.get(c.category) ?? { category: c.category, units: 0, value: 0 }
        e.units += c.units
        e.value += c.value
        map.set(c.category, e)
      }
    }
    return [...map.values()]
      .sort((a, b) => b.value - a.value)
      .map((c) => ({
        label: c.category,
        value: metric === 'value' ? c.value : c.units,
        color: CATEGORY_COLORS[c.category] ?? '#b08d57',
      }))
  }, [positions, metric])

  if (loading) return <LoadingState />
  if (error)
    return (
      <ErrorState
        message={error}
        action={
          <button className="btn btn--ghost btn--sm" onClick={refresh}>
            Retry
          </button>
        }
      />
    )

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <div className="eyebrow">Consignment Portfolio · as of {AS_OF}</div>
          <h1>Inventory Queue</h1>
          <p className="page__lede soft">
            Vince-owned inventory held across {ranked.length} retail partner
            warehouses. Sized by {metric === 'value' ? 'extended value' : 'units on hand'}.
          </p>
        </div>
        <MetricToggle value={metric} onChange={setMetric} />
      </header>

      {/* KPI strip */}
      <section className="kpis">
        <Kpi
          label="Total at cost"
          value={money(totals.totalValue)}
          sub={`${money(totals.totalRetail)} at retail`}
        />
        <Kpi label="Units on hand" value={units(totals.totalUnits)} sub="across all partners" />
        <Kpi label="Partners" value={String(ranked.length)} sub="virtual warehouses" />
        <Kpi
          label="Largest position"
          value={ranked[0] ? ranked[0].customer.name : '—'}
          sub={
            ranked[0]
              ? metric === 'value'
                ? money(ranked[0].totalValue)
                : `${units(ranked[0].totalUnits)} units`
              : ''
          }
        />
      </section>

      {/* Composition + filters */}
      <section className="card panel">
        <div className="panel__head row spread">
          <div>
            <div className="eyebrow">Portfolio composition</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              {metric === 'value' ? 'Extended value' : 'Units'} by category
            </div>
          </div>
          <div className="seasons">
            <button
              className={`chip-toggle${season === 'all' ? ' is-active' : ''}`}
              onClick={() => setSeason('all')}
            >
              All seasons
            </button>
            {SEASONS.map((s) => (
              <button
                key={s}
                className={`chip-toggle${season === s ? ' is-active' : ''}`}
                onClick={() => setSeason(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <StackedBar
          segments={portfolioMix}
          height={14}
          showLegend
          formatValue={(v) => (metric === 'value' ? moneyCompact(v) : units(v))}
        />
      </section>

      {/* The visual queue */}
      {ranked.length === 0 ? (
        <EmptyState
          title="No inventory for this season"
          hint="Try a different season filter."
        />
      ) : (
        <section className="queue-grid">
          {ranked.map((position, i) => (
            <CustomerQueueCard
              key={position.customer.id}
              position={position}
              metric={metric}
              max={max}
              rank={i + 1}
            />
          ))}
        </section>
      )}

      <div className="page__cta-row">
        <button className="btn btn--accent" onClick={() => navigate('/season-return')}>
          Start end-of-season return
        </button>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card kpi">
      <div className="eyebrow">{label}</div>
      <div className="kpi__value numeric">{value}</div>
      {sub && <div className="kpi__sub muted numeric">{sub}</div>}
    </div>
  )
}
