import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTransfers } from '../context/TransfersContext'
import { useInventory } from '../context/InventoryContext'
import { useConfig } from '../context/ConfigContext'
import type { Customer } from '../models/types'
import {
  TRANSFER_FLOW,
  TRANSFER_STATUS_LABEL,
  type TransferOrder,
} from '../models/operations'
import { money, units, dateLong, todayIso } from '../lib/format'
import { buildLabels, printLabels, seedFromString } from '../lib/shipping'
import { PartnerLogo } from '../components/PartnerLogo'
import { EmptyState } from '../components/ui/States'

const AS_OF = todayIso()

export function TransfersPage() {
  const { transfers, sales, advanceStatus, receiveTransfer, clearAll } =
    useTransfers()
  const { customers } = useInventory()
  const { config } = useConfig()

  const partnerFor = (t: { customerId: string; customerName: string }): Customer =>
    customers.find((c) => c.id === t.customerId) ?? {
      id: t.customerId,
      name: t.customerName,
      code: t.customerName.slice(0, 4).toUpperCase(),
      contactName: '',
      contactEmail: '',
      location: '',
      accent: '#8a7b52',
    }

  const kpis = useMemo(() => {
    const open = transfers.filter((t) => t.status !== 'received')
    const received = transfers.filter((t) => t.status === 'received')
    const inTransitUnits = transfers
      .filter((t) => t.status === 'picking' || t.status === 'shipped')
      .reduce((s, t) => s + t.totalUnits, 0)
    const liquidationRevenue = sales.reduce((s, l) => s + l.saleValue, 0)
    return {
      open: open.length,
      received: received.length,
      inTransitUnits,
      liquidationRevenue,
    }
  }, [transfers, sales])

  function labelsFor(t: TransferOrder) {
    return buildLabels({
      fromName: t.customerName,
      fromWarehouse: t.fromWarehouseId,
      toName: config.connection.mainDcName,
      toWarehouse: t.toWarehouseId,
      totalUnits: t.totalUnits,
      reference: t.id,
      seed: seedFromString(t.id),
      dateLabel: dateLong(t.createdAtIso),
    })
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <div className="eyebrow">Operations · as of {AS_OF}</div>
          <h1>Transfers</h1>
          <p className="page__lede soft">
            End-of-season return transfer orders and liquidation sales. Receiving
            a transfer lowers the partner's on-hand inventory.
          </p>
        </div>
        {(transfers.length > 0 || sales.length > 0) && (
          <button className="btn btn--ghost btn--sm" onClick={clearAll}>
            Clear all
          </button>
        )}
      </header>

      <section className="kpis">
        <Kpi label="Open transfers" value={String(kpis.open)} sub="not yet received" />
        <Kpi label="Received" value={String(kpis.received)} sub="back at main DC" />
        <Kpi
          label="Units in transit"
          value={units(kpis.inTransitUnits)}
          sub="picking + shipped"
        />
        <Kpi
          label="Liquidation revenue"
          value={money(kpis.liquidationRevenue)}
          sub={`${sales.length} sale${sales.length === 1 ? '' : 's'}`}
        />
      </section>

      {/* Transfer orders */}
      <section className="card panel">
        <div className="panel__head">
          <div className="eyebrow">Return transfer orders</div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            {transfers.length} total
          </div>
        </div>

        {transfers.length === 0 ? (
          <EmptyState
            title="No transfers yet"
            hint="Create one from Season Return, or ask the assistant to draft a return."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Transfer order</th>
                  <th>Season</th>
                  <th className="th-right">Units</th>
                  <th className="th-right">Value</th>
                  <th className="th-center">Cartons</th>
                  <th>Status</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => {
                  const idx = TRANSFER_FLOW.indexOf(t.status)
                  const next = TRANSFER_FLOW[idx + 1]
                  return (
                    <tr key={t.id}>
                      <td>
                        <span className="mapping-partner">
                          <PartnerLogo customer={partnerFor(t)} size={26} rounded={5} />
                          <span>{t.customerName}</span>
                        </span>
                      </td>
                      <td className="numeric muted">{t.id}</td>
                      <td className="muted">
                        {t.season === 'all' ? 'All' : t.season}
                      </td>
                      <td className="td-right numeric">{units(t.totalUnits)}</td>
                      <td className="td-right numeric">{money(t.totalValue)}</td>
                      <td className="td-center numeric">{t.cartons}</td>
                      <td>
                        <span className={`status-pill status-pill--${t.status}`}>
                          {TRANSFER_STATUS_LABEL[t.status]}
                        </span>
                      </td>
                      <td className="td-right">
                        <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => printLabels(labelsFor(t))}
                          >
                            Labels
                          </button>
                          {next && (
                            <button
                              className="btn btn--sm"
                              onClick={() =>
                                next === 'received'
                                  ? receiveTransfer(t.id)
                                  : advanceStatus(t.id)
                              }
                            >
                              Mark {TRANSFER_STATUS_LABEL[next]}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Liquidation sales */}
      {sales.length > 0 && (
        <section className="card panel">
          <div className="panel__head">
            <div className="eyebrow">Liquidation sales</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              Inventory sold to discount retailers
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>From partner</th>
                  <th className="th-right">Units</th>
                  <th className="th-right">Cost</th>
                  <th className="th-right">Sale</th>
                  <th className="th-right">Margin</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="td-style">{s.buyer}</td>
                    <td className="muted">{s.customerName}</td>
                    <td className="td-right numeric">{units(s.totalUnits)}</td>
                    <td className="td-right numeric muted">{money(s.costValue)}</td>
                    <td className="td-right numeric">{money(s.saleValue)}</td>
                    <td className="td-right numeric">+{s.marginPct}%</td>
                    <td className="muted">{dateLong(s.createdAtIso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="page__cta-row">
        <Link to="/season-return" className="btn btn--accent">
          New season return
        </Link>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card kpi">
      <div className="eyebrow">{label}</div>
      <div className="kpi__value numeric">{value}</div>
      {sub && <div className="kpi__sub muted">{sub}</div>}
    </div>
  )
}
