import type { Season } from './types'
import type { LineRemoval } from './operations'

/** Lifecycle of an action card the user can confirm from chat. */
export type CardStatus = 'proposed' | 'submitting' | 'created' | 'error'

/**
 * A proposed end-of-season return surfaced inline in chat. The model can
 * *draft* it (read-only), but creating the transfer order always requires an
 * explicit human click on the card — keeping a person in the loop for the ERP
 * write.
 */
export interface SeasonReturnCard {
  kind: 'season-return'
  customerId: string
  customerName: string
  season: Season | 'all'
  totalUnits: number
  totalValue: number
  lineCount: number
  status: CardStatus
  transferOrderNumber?: string
  error?: string
}

/** A proposed pick + receipt of an existing transfer order. */
export interface ReceiveCard {
  kind: 'receive-transfer'
  transferId: string
  customerName: string
  season: Season | 'all'
  totalUnits: number
  lineCount: number
  status: CardStatus
  error?: string
}

/** A proposed liquidation sale of a partner's inventory to a discount buyer. */
export interface SaleCard {
  kind: 'liquidation-sale'
  customerId: string
  customerName: string
  buyer: string
  marginPct: number
  totalUnits: number
  lineCount: number
  costValue: number
  saleValue: number
  removals: LineRemoval[]
  status: CardStatus
  saleId?: string
  error?: string
}

export type ActionCard = SeasonReturnCard | ReceiveCard | SaleCard

/** A short trace of a tool the agent ran, shown as a chip under the answer. */
export interface ToolTrace {
  name: string
  label: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  tools?: ToolTrace[]
  card?: ActionCard
  /** True while tokens are still streaming into `text`. */
  streaming?: boolean
  /** True for an error bubble. */
  error?: boolean
}

/** What an agent returns for one user turn. */
export interface AgentReply {
  text: string
  tools: ToolTrace[]
  card?: ActionCard
}
