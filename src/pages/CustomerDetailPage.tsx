import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useInventory } from '../context/InventoryContext'
import { useConfig } from '../context/ConfigContext'
import type { Metric } from '../models/types'
import { money, moneyCompact, units, unitsCompact } from '../lib/format'
import { MetricToggle } from '../components/ui/MetricToggle'
import { InventoryTable } from '../components/InventoryTable'
import {
  CATEGORY_COLORS,
  SEASON_COLORS,
  StackedBar,
} from '../components/charts/StackedBar'
import { LoadingState, EmptyState } from '../components/ui/States'
import { PartnerLogo } from '../components/PartnerLogo'
import { SellInventoryDialog } from '../components/SellInventoryDialog'
import type { LiquidationSale } from '../models/operations'

export function CustomerDetailPage() {
  const { customerId = '' } = useParams()
  const navigate = useNavigate()
  const { loading, positionFor, linesForCustomer } = useInventory()
  const { config } = useConfig()
  const [metric, setMetric] = useState<Metric>('value')
  const [showSell, setShowSell] = useState(false)
  const [saleBanner, setSaleBanner] = useState<LiquidationSale | null>(null)

  const position = positionFor(customerId)
  const lines = useMemo(
    () => linesForCustomer(customerId),
    [linesForCustomer, customerId],
  )

  if (loading) return <LoadingState />
  if (!position)
    return (
      <EmptyState
        title="Customer not found"
        hint="This partner is not in the current dataset."
      />
    )

  const { customer } = position
  const mapping = config.mappings.find((m) => m.customerId === customer.id)

  const catSegments = position.byCategory.map((c) => ({
    label: c.category,
    value: metric === 'value' ? c.value : c.units,
    color: CATEGORY_COLORS[c.category] ?? '#b08d57',
  }))
  const seasonSegments = position.bySeason.map((s) => ({
    label: s.season,
    value: metric === 'value' ? s.value : s.units,
    color: SEASON_COLORS[s.season] ?? '#7c8470',
  }))

  const fmt = (v: number) =>
    metric === 'value' ? moneyCompact(v) : unitsCompact(v)

  return (
    <div className="page">
      <Link to="/" className="back-link eyebrow">
        ← Inventory Queue
      </Link>

      {saleBanner && (
        <div className="notice notice--ok">
          <span>
            ✓ Sold <strong className="numeric">{units(saleBanner.totalUnits)}</strong>{' '}
            units to <strong>{saleBanner.buyer}</strong> for{' '}
            <strong className="numeric">{money(saleBanner.saleValue)}</strong> (+
            {saleBanner.marginPct}%). Inventory updated —{' '}
            <Link to="/transfers">view in Transfers</Link>.
          </span>
          <button className="icon-btn" onClick={() => setSaleBanner(null)} title="Dismiss">
            ✕
          </button>
        </div>
      )}

      <header className="page__head detail-head">
        <div className="row gap-4">
          <PartnerLogo customer={customer} size={64} rounded={8} />
          <div>
            <h1>{customer.name}</h1>
            <p className="soft">
              {customer.location} · Warehouse{' '}
              <strong className="numeric">
                {mapping?.warehouseId ?? '—'}
              </strong>{' '}
              · Contact {customer.contactName}
            </p>
          </div>
        </div>
        <MetricToggle value={metric} onChange={setMetric} />
      </header>

      <section className="kpis">
        <div className="card kpi">
          <div className="eyebrow">At cost</div>
          <div className="kpi__value numeric">{money(position.totalValue)}</div>
          <div className="kpi__sub muted numeric">
            {money(position.totalRetail)} retail
          </div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Units on hand</div>
          <div className="kpi__value numeric">{units(position.totalUnits)}</div>
          <div className="kpi__sub muted">{position.lineCount} style/size lines</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Categories</div>
          <div className="kpi__value numeric">{position.byCategory.length}</div>
          <div className="kpi__sub muted">
            top: {position.byCategory[0]?.category ?? '—'}
          </div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Return destination</div>
          <div className="kpi__value" style={{ fontSize: '1.2rem' }}>
            {config.connection.mainDcWarehouseId}
          </div>
          <div className="kpi__sub muted">{config.connection.mainDcName}</div>
        </div>
      </section>

      <section className="detail-breakdowns">
        <div className="card panel">
          <div className="eyebrow">By category</div>
          <StackedBar
            segments={catSegments}
            height={14}
            showLegend
            formatValue={fmt}
          />
        </div>
        <div className="card panel">
          <div className="eyebrow">By season</div>
          <StackedBar
            segments={seasonSegments}
            height={14}
            showLegend
            formatValue={fmt}
          />
        </div>
      </section>

      <section className="card panel">
        <div className="panel__head row spread">
          <div>
            <div className="eyebrow">On-hand detail</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              {position.lineCount} lines at {customer.name}
            </div>
          </div>
          <div className="row gap-2">
            <button
              className="btn btn--ghost btn--sm"
              disabled={lines.length === 0}
              onClick={() => setShowSell(true)}
            >
              Sell to discount retailer
            </button>
            <button
              className="btn btn--accent btn--sm"
              onClick={() => navigate(`/season-return/${customer.id}`)}
            >
              Draft season return →
            </button>
          </div>
        </div>
        <InventoryTable lines={lines} />
      </section>

      {showSell && (
        <SellInventoryDialog
          customer={customer}
          lines={lines}
          onClose={() => setShowSell(false)}
          onSold={(sale) => setSaleBanner(sale)}
        />
      )}
    </div>
  )
}
