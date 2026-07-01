import { useMemo, useState } from 'react'
import type { Customer, InventoryLine, Season } from '../models/types'
import type { LiquidationSale } from '../models/operations'
import { useTransfers } from '../context/TransfersContext'
import { lineValue } from '../lib/aggregations'
import { money, units } from '../lib/format'
import { SEASONS } from '../data/mockData'

const DISCOUNTERS = [
  'Marshalls',
  'TJ Maxx',
  'Ross',
  'Nordstrom Rack',
  'Burlington',
  'Saks OFF 5TH',
  'HomeGoods',
  'Sierra',
]

interface Props {
  customer: Customer
  /** Net on-hand lines for this partner. */
  lines: InventoryLine[]
  onClose: () => void
  onSold: (sale: LiquidationSale) => void
}

/**
 * Compact modal to liquidate a partner's inventory to a discount retailer at a
 * cost-plus markup. Mirrors the chat `sell_inventory` action as a one-click UI.
 */
export function SellInventoryDialog({ customer, lines, onClose, onSold }: Props) {
  const { recordSale } = useTransfers()
  const [buyer, setBuyer] = useState('Marshalls')
  const [season, setSeason] = useState<Season | 'all'>('all')
  const [marginPct, setMarginPct] = useState(30)

  const seasonsWithStock = useMemo(() => {
    const s = new Set<Season>()
    for (const l of lines) s.add(l.season)
    return s
  }, [lines])

  const selected = useMemo(
    () => (season === 'all' ? lines : lines.filter((l) => l.season === season)),
    [lines, season],
  )
  const totalUnits = selected.reduce((s, l) => s + l.unitsOnHand, 0)
  const cost = selected.reduce((s, l) => s + lineValue(l), 0)
  const margin = Number.isFinite(marginPct) ? Math.max(0, marginPct) : 0
  const saleValue = Math.round(cost * (1 + margin / 100))

  function confirm() {
    if (selected.length === 0) return
    const sale = recordSale({
      customer,
      buyer: buyer.trim() || 'Discount retailer',
      marginPct: margin,
      lines: selected,
    })
    onSold(sale)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <div className="eyebrow">Liquidation sale</div>
            <h3 style={{ marginTop: 4 }}>Sell {customer.name}'s inventory</h3>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Discount buyer</label>
            <input
              className="input"
              list="discounters"
              autoFocus
              value={buyer}
              placeholder="e.g. Marshalls"
              onChange={(e) => setBuyer(e.target.value)}
            />
            <datalist id="discounters">
              {DISCOUNTERS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>Margin over cost (%)</label>
            <input
              className="input numeric"
              type="number"
              min={0}
              max={90}
              value={marginPct}
              onChange={(e) => setMarginPct(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="field">
          <label>Inventory to sell</label>
          <div className="seasons">
            <button
              className={`chip-toggle${season === 'all' ? ' is-active' : ''}`}
              onClick={() => setSeason('all')}
            >
              All remaining
            </button>
            {SEASONS.map((s) => (
              <button
                key={s}
                className={`chip-toggle${season === s ? ' is-active' : ''}`}
                disabled={!seasonsWithStock.has(s)}
                onClick={() => setSeason(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="sell-preview">
          <div className="sell-preview__scope numeric">
            {units(totalUnits)} units · {money(cost)} at cost
          </div>
          <div className="sell-preview__sale">
            →{' '}
            <strong className="numeric">{money(saleValue)}</strong>{' '}
            <span className="muted">at +{margin}% to {buyer.trim() || 'buyer'}</span>
          </div>
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost btn--sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--accent btn--sm"
            disabled={selected.length === 0}
            onClick={confirm}
          >
            {selected.length === 0
              ? 'No inventory in scope'
              : `Confirm sale · ${money(saleValue)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
