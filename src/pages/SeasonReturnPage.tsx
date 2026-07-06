import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useInventory } from '../context/InventoryContext'
import { useConfig } from '../context/ConfigContext'
import { useTransfers } from '../context/TransfersContext'
import type { Season } from '../models/types'
import type { TransferOrder } from '../models/operations'
import { SEASONS } from '../data/mockData'
import {
  assembleBodyText,
  buildMailtoUrl,
  composeEndOfSeasonEmail,
  endOfSeasonIntro,
  endOfSeasonSubject,
} from '../lib/emailDraft'
import { buildLabels, seedFromString } from '../lib/shipping'
import { lineValue } from '../lib/aggregations'
import { EmailPreview } from '../components/EmailPreview'
import { ShippingLabels } from '../components/ShippingLabels'
import { LoadingState } from '../components/ui/States'
import { money, units, dateLong, todayIso } from '../lib/format'

const AS_OF = todayIso()
type SeasonChoice = Season | 'all'
type Stage = 'configure' | 'thinking' | 'draft' | 'submitting' | 'done'

export function SeasonReturnPage() {
  const { customerId: routeCustomerId } = useParams()
  const navigate = useNavigate()
  const { loading, customers, linesForCustomer } = useInventory()
  const { config } = useConfig()
  const { createTransfer } = useTransfers()

  const [searchParams] = useSearchParams()
  const seasonParam = searchParams.get('season')
  const [customerId, setCustomerId] = useState(routeCustomerId ?? '')
  const [season, setSeason] = useState<SeasonChoice>(() =>
    SEASONS.includes(seasonParam as Season) ? (seasonParam as Season) : 'all',
  )
  const [stage, setStage] = useState<Stage>('configure')
  const [subject, setSubject] = useState('')
  const [intro, setIntro] = useState('')
  const [result, setResult] = useState<TransferOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Default to the first partner once data is in.
  useEffect(() => {
    if (!customerId && customers.length) setCustomerId(customers[0].id)
  }, [customers, customerId])

  const customer = customers.find((c) => c.id === customerId)
  const allLines = useMemo(
    () => (customerId ? linesForCustomer(customerId) : []),
    [linesForCustomer, customerId],
  )
  const scopeLines = useMemo(
    () => (season === 'all' ? allLines : allLines.filter((l) => l.season === season)),
    [allLines, season],
  )

  // Draft edits — styles removed from or added to the drafted return, keyed by
  // item number. Cleared whenever the user is back on the configure step so a
  // fresh draft always starts from the season selection.
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (stage === 'configure') {
      setExcluded(new Set())
      setAdded(new Set())
    }
  }, [stage])

  const draftItems = useMemo(() => {
    const items = new Set(scopeLines.map((l) => l.itemNumber))
    for (const item of excluded) items.delete(item)
    for (const item of added) items.add(item)
    return items
  }, [scopeLines, excluded, added])

  const lines = useMemo(
    () => allLines.filter((l) => draftItems.has(l.itemNumber)),
    [allLines, draftItems],
  )

  const totalUnits = lines.reduce((s, l) => s + l.unitsOnHand, 0)
  const totalValue = lines.reduce((s, l) => s + l.unitCost * l.unitsOnHand, 0)

  // Which seasons actually have stock for this partner (for enabling buttons).
  const seasonsWithStock = useMemo(() => {
    const set = new Set<Season>()
    for (const l of allLines) set.add(l.season)
    return set
  }, [allLines])

  // Styles at this partner not currently in the draft — offered by the
  // email's "add line" picker (other seasons, or styles removed above).
  const addableStyles = useMemo(() => {
    const map = new Map<
      string,
      { item: string; name: string; units: number; value: number }
    >()
    for (const l of allLines) {
      if (draftItems.has(l.itemNumber)) continue
      const e = map.get(l.itemNumber) ?? {
        item: l.itemNumber,
        name: l.styleName,
        units: 0,
        value: 0,
      }
      e.units += l.unitsOnHand
      e.value += lineValue(l)
      map.set(l.itemNumber, e)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [allLines, draftItems])

  function removeDraftLine(item: string) {
    if (added.has(item)) {
      setAdded((s) => {
        const next = new Set(s)
        next.delete(item)
        return next
      })
    } else {
      setExcluded((s) => new Set(s).add(item))
    }
  }

  function addDraftLine(item: string) {
    if (excluded.has(item)) {
      setExcluded((s) => {
        const next = new Set(s)
        next.delete(item)
        return next
      })
    } else {
      setAdded((s) => new Set(s).add(item))
    }
  }

  const draft = useMemo(() => {
    if (!customer) return null
    return composeEndOfSeasonEmail({
      customer,
      season: season === 'all' ? 'Fall' : season,
      lines,
      mainDcName: config.connection.mainDcName,
      asOfIso: AS_OF,
    })
  }, [customer, lines, season, config.connection.mainDcName])

  const draftInput = useMemo(
    () =>
      customer
        ? {
            customer,
            season: (season === 'all' ? 'Fall' : season) as Season,
            lines,
            mainDcName: config.connection.mainDcName,
            asOfIso: AS_OF,
          }
        : null,
    [customer, season, lines, config.connection.mainDcName],
  )

  function handleGenerate() {
    if (!customer) return
    setError(null)
    setSubject(endOfSeasonSubject(customer, season === 'all' ? 'Fall' : season, AS_OF))
    setIntro(endOfSeasonIntro(customer, season === 'all' ? 'Fall' : season, AS_OF))
    setStage('thinking')
    // Brief "agent is working" beat so the draft feels generated, not instant.
    window.setTimeout(() => setStage('draft'), 1100)
  }

  const labels = useMemo(() => {
    if (!customer || lines.length === 0) return []
    const mapping = config.mappings.find((m) => m.customerId === customer.id)
    return buildLabels({
      fromName: customer.name,
      fromWarehouse: mapping?.warehouseId ?? `CN-${customer.code}`,
      toName: config.connection.mainDcName,
      toWarehouse: config.connection.mainDcWarehouseId,
      totalUnits,
      reference: 'DRAFT',
      seed: seedFromString(customer.id + season),
      dateLabel: dateLong(AS_OF),
    })
  }, [customer, lines.length, totalUnits, season, config])

  async function handleConfirm() {
    if (!customer || lines.length === 0) return
    setStage('submitting')
    setError(null)
    try {
      const order = await createTransfer({
        customer,
        season,
        lines,
      })
      setResult(order)
      setStage('done')
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to create transfer order in D365.',
      )
      setStage('draft')
    }
  }

  async function handleCopy() {
    if (!draftInput) return
    const body = `Subject: ${subject}\n\n${assembleBodyText(draftInput, intro)}`
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Clipboard unavailable in this browser context.')
    }
  }

  function handleMailto() {
    if (!draftInput) return
    const body = assembleBodyText(draftInput, intro)
    window.location.href = buildMailtoUrl(draft!.to, subject, body)
  }

  if (loading) return <LoadingState />

  return (
    <div className="page">
      <Link to="/" className="back-link eyebrow">
        ← Inventory Queue
      </Link>

      <header className="page__head">
        <div>
          <div className="eyebrow">Agent workflow</div>
          <h1>End-of-Season Return</h1>
          <p className="page__lede soft">
            The agent drafts a reconciliation email of inventory D365 shows at
            the partner, then — on your confirmation — creates the return
            transfer order back to {config.connection.mainDcName}.
          </p>
        </div>
      </header>

      {/* Stepper */}
      <Stepper stage={stage} />

      {/* Configure */}
      <section className="card panel return-config">
        <div className="return-config__grid">
          <div className="field">
            <label>Retail partner</label>
            <select
              className="select"
              value={customerId}
              disabled={stage !== 'configure'}
              onChange={(e) => {
                setCustomerId(e.target.value)
                setStage('configure')
              }}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Season to reconcile</label>
            <div className="seasons">
              <button
                className={`chip-toggle${season === 'all' ? ' is-active' : ''}`}
                disabled={stage !== 'configure'}
                onClick={() => setSeason('all')}
              >
                All remaining
              </button>
              {SEASONS.map((s) => (
                <button
                  key={s}
                  className={`chip-toggle${season === s ? ' is-active' : ''}`}
                  disabled={stage !== 'configure' || !seasonsWithStock.has(s)}
                  onClick={() => setSeason(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="return-config__summary">
            <div className="eyebrow">In scope</div>
            <div className="return-config__nums">
              <span className="numeric">{units(totalUnits)}</span> units ·{' '}
              <span className="numeric">{money(totalValue)}</span> ·{' '}
              {lines.length} lines
            </div>
          </div>
        </div>

        {stage === 'configure' && (
          <div className="return-config__action">
            <button
              className="btn btn--accent"
              disabled={!customer || lines.length === 0}
              onClick={handleGenerate}
            >
              ✦ Generate draft with agent
            </button>
            {lines.length === 0 && (
              <span className="muted" style={{ marginLeft: 12 }}>
                No inventory in scope for this selection.
              </span>
            )}
          </div>
        )}
      </section>

      {/* Thinking */}
      {stage === 'thinking' && <ThinkingPanel customerName={customer?.name ?? ''} />}

      {/* Draft + actions */}
      {(stage === 'draft' || stage === 'submitting') && draft && draftInput && (
        <section className="return-draft">
          <EmailPreview
            draft={draft}
            mainDcName={config.connection.mainDcName}
            subject={subject}
            onSubjectChange={setSubject}
            intro={intro}
            onIntroChange={setIntro}
            onRemoveLine={removeDraftLine}
            addableStyles={addableStyles}
            onAddLine={addDraftLine}
          />

          <aside className="return-actions card">
            <div className="eyebrow">Confirm &amp; execute</div>
            <p className="muted return-actions__desc">
              Confirming creates a D365 transfer order moving{' '}
              <strong className="numeric">{units(totalUnits)}</strong> units (
              {money(totalValue)} at cost) from{' '}
              <strong>{customer?.name}</strong> to{' '}
              <strong>{config.connection.mainDcName}</strong>.
            </p>

            <button
              className="btn btn--accent return-actions__primary"
              disabled={stage === 'submitting' || lines.length === 0}
              onClick={handleConfirm}
            >
              {stage === 'submitting'
                ? 'Creating transfer order…'
                : 'Confirm & create transfer order'}
            </button>

            {error && <div className="return-actions__error">{error}</div>}

            <div className="return-actions__divider" />
            <div className="eyebrow">Send options</div>
            <button className="btn btn--ghost btn--sm" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy email text'}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={handleMailto}>
              Open in Outlook (mailto)
            </button>
            <button className="btn btn--ghost btn--sm" disabled title="Roadmap: Microsoft Graph draft — see docs/FUTURE-INTEGRATION.md">
              Create Graph draft · soon
            </button>

            <button
              className="return-actions__back"
              onClick={() => setStage('configure')}
            >
              ← Change selection
            </button>
          </aside>
        </section>
      )}

      {/* Shipping labels generated alongside the draft */}
      {(stage === 'draft' || stage === 'submitting') && labels.length > 0 && (
        <ShippingLabels labels={labels} title="Return shipping labels" />
      )}

      {/* Done */}
      {stage === 'done' && result && (
        <>
          <SuccessPanel
            result={result}
            customerName={customer?.name ?? ''}
            mainDcName={config.connection.mainDcName}
            onTrack={() => navigate('/transfers')}
            onAnother={() => {
              setResult(null)
              setStage('configure')
            }}
          />
          <ShippingLabels
            labels={buildLabels({
              fromName: result.customerName,
              fromWarehouse: result.fromWarehouseId,
              toName: config.connection.mainDcName,
              toWarehouse: result.toWarehouseId,
              totalUnits: result.totalUnits,
              reference: result.id,
              seed: seedFromString(result.id),
              dateLabel: dateLong(result.createdAtIso),
            })}
            title="Shipping labels"
          />
        </>
      )}
    </div>
  )
}

function Stepper({ stage }: { stage: Stage }) {
  const steps = [
    { key: 'configure', label: 'Select' },
    { key: 'draft', label: 'Review draft' },
    { key: 'done', label: 'Transfer created' },
  ]
  const activeStep = stage === 'configure' ? 0 : stage === 'done' ? 2 : 1
  return (
    <ol className="stepper">
      {steps.map((s, i) => (
        <li
          key={s.key}
          className={`stepper__item${i <= activeStep ? ' is-done' : ''}${
            i === activeStep ? ' is-active' : ''
          }`}
        >
          <span className="stepper__num">{i + 1}</span>
          <span className="stepper__label">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

function ThinkingPanel({ customerName }: { customerName: string }) {
  const steps = [
    `Reading on-hand consignment inventory for ${customerName} from D365…`,
    'Reconciling units and extended value by style…',
    'Composing partner reconciliation email…',
  ]
  return (
    <section className="card thinking">
      <div className="thinking__pulse" />
      <div className="thinking__lines">
        <div className="eyebrow">Agent working</div>
        {steps.map((s, i) => (
          <div
            key={s}
            className="thinking__line"
            style={{ animationDelay: `${i * 0.28}s` }}
          >
            {s}
          </div>
        ))}
      </div>
    </section>
  )
}

function SuccessPanel({
  result,
  customerName,
  mainDcName,
  onTrack,
  onAnother,
}: {
  result: TransferOrder
  customerName: string
  mainDcName: string
  onTrack: () => void
  onAnother: () => void
}) {
  return (
    <section className="card success">
      <div className="success__check">✓</div>
      <h2>Transfer order created</h2>
      <p className="soft">
        D365 {result.live ? '' : '(simulated) '}generated transfer order{' '}
        <strong className="numeric">{result.id}</strong> returning {customerName}
        's {result.season === 'all' ? 'remaining' : result.season} consignment
        inventory. {result.cartons} shipping label
        {result.cartons === 1 ? '' : 's'} generated below.
      </p>
      <div className="success__grid">
        <Detail label="Transfer order" value={result.id} />
        <Detail label="From (partner)" value={result.fromWarehouseId} />
        <Detail label="To (main DC)" value={`${result.toWarehouseId} · ${mainDcName}`} />
        <Detail label="Lines" value={String(result.lineCount)} />
        <Detail label="Units" value={units(result.totalUnits)} />
        <Detail label="Value at cost" value={money(result.totalValue)} />
      </div>
      <div className="row gap-3">
        <button className="btn" onClick={onTrack}>
          Track in Transfers
        </button>
        <button className="btn btn--ghost" onClick={onAnother}>
          Process another partner
        </button>
      </div>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="success__detail">
      <div className="eyebrow">{label}</div>
      <div className="numeric">{value}</div>
    </div>
  )
}
