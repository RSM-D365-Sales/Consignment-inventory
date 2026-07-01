import { useNavigate } from 'react-router-dom'
import type { ChatMessage } from '../../models/chat'
import { money, units } from '../../lib/format'

interface Props {
  message: ChatMessage
  onConfirm: (messageId: string) => void
}

/** Renders the right action card for a chat message based on its kind. */
export function ActionCardView({ message, onConfirm }: Props) {
  const card = message.card
  if (!card) return null
  if (card.kind === 'season-return')
    return <SeasonReturnCard message={message} onConfirm={onConfirm} />
  if (card.kind === 'receive-transfer')
    return <ReceiveCardView message={message} onConfirm={onConfirm} />
  return <SaleCardView message={message} onConfirm={onConfirm} />
}

function SeasonReturnCard({ message, onConfirm }: Props) {
  const navigate = useNavigate()
  const card = message.card!
  if (card.kind !== 'season-return') return null
  const seasonLabel = card.season === 'all' ? 'All remaining' : card.season

  return (
    <div className={`draft-card draft-card--${card.status}`}>
      <div className="draft-card__head">
        <span className="eyebrow">Proposed return</span>
        <span className="draft-card__season">{seasonLabel}</span>
      </div>
      <div className="draft-card__partner">{card.customerName}</div>
      <div className="draft-card__stats numeric">
        <span>{units(card.totalUnits)} units</span>
        <span className="dot">·</span>
        <span>{money(card.totalValue)}</span>
        <span className="dot">·</span>
        <span>{card.lineCount} lines</span>
      </div>

      {card.status === 'created' ? (
        <div className="draft-card__done">
          ✓ Transfer order{' '}
          <strong className="numeric">{card.transferOrderNumber}</strong>{' '}
          created — {card.customerName} → main DC.
        </div>
      ) : card.status === 'submitting' ? (
        <div className="draft-card__pending">
          <span className="mini-spinner" /> Creating transfer order…
        </div>
      ) : (
        <>
          {card.status === 'error' && (
            <div className="draft-card__error">{card.error}</div>
          )}
          <div className="draft-card__actions">
            <button
              className="btn btn--ghost btn--sm"
              onClick={() =>
                navigate(
                  `/season-return/${card.customerId}` +
                    (card.season === 'all' ? '' : `?season=${card.season}`),
                )
              }
            >
              Open full draft
            </button>
            <button
              className="btn btn--accent btn--sm"
              onClick={() => onConfirm(message.id)}
            >
              {card.status === 'error' ? 'Retry' : 'Confirm & transfer'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ReceiveCardView({ message, onConfirm }: Props) {
  const card = message.card!
  if (card.kind !== 'receive-transfer') return null
  const seasonLabel = card.season === 'all' ? 'All' : card.season

  return (
    <div className={`draft-card draft-card--${card.status}`}>
      <div className="draft-card__head">
        <span className="eyebrow">Pick &amp; receive</span>
        <span className="draft-card__season">{seasonLabel}</span>
      </div>
      <div className="draft-card__partner">{card.transferId}</div>
      <div className="draft-card__stats numeric">
        <span>{card.customerName}</span>
        <span className="dot">·</span>
        <span>{units(card.totalUnits)} units</span>
        <span className="dot">·</span>
        <span>{card.lineCount} lines</span>
      </div>

      {card.status === 'created' ? (
        <div className="draft-card__done">
          ✓ Received {card.transferId} — {units(card.totalUnits)} units back at
          the main DC. {card.customerName}'s on-hand updated.
        </div>
      ) : card.status === 'submitting' ? (
        <div className="draft-card__pending">
          <span className="mini-spinner" /> Picking &amp; receiving…
        </div>
      ) : (
        <>
          {card.status === 'error' && (
            <div className="draft-card__error">{card.error}</div>
          )}
          <div className="draft-card__actions">
            <button
              className="btn btn--accent btn--sm"
              style={{ flex: 1 }}
              onClick={() => onConfirm(message.id)}
            >
              {card.status === 'error' ? 'Retry' : 'Pick & receive'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function SaleCardView({ message, onConfirm }: Props) {
  const card = message.card!
  if (card.kind !== 'liquidation-sale') return null

  return (
    <div className={`draft-card draft-card--${card.status}`}>
      <div className="draft-card__head">
        <span className="eyebrow">Liquidation sale</span>
        <span className="draft-card__season">+{card.marginPct}%</span>
      </div>
      <div className="draft-card__partner">{card.buyer}</div>
      <div className="draft-card__stats numeric">
        <span>{units(card.totalUnits)} units</span>
        <span className="dot">·</span>
        <span>from {card.customerName}</span>
      </div>
      <div className="draft-card__econ numeric">
        {money(card.costValue)} cost → <strong>{money(card.saleValue)}</strong> sale
      </div>

      {card.status === 'created' ? (
        <div className="draft-card__done">
          ✓ Sold {units(card.totalUnits)} units to {card.buyer} for{' '}
          <strong className="numeric">{money(card.saleValue)}</strong> (+
          {card.marginPct}%). Inventory removed.
        </div>
      ) : card.status === 'submitting' ? (
        <div className="draft-card__pending">
          <span className="mini-spinner" /> Recording sale…
        </div>
      ) : (
        <>
          {card.status === 'error' && (
            <div className="draft-card__error">{card.error}</div>
          )}
          <div className="draft-card__actions">
            <button
              className="btn btn--accent btn--sm"
              style={{ flex: 1 }}
              onClick={() => onConfirm(message.id)}
            >
              {card.status === 'error' ? 'Retry' : `Confirm sale to ${card.buyer}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
