import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ChatMessage } from '../models/chat'
import type { AgentData } from '../lib/agentTools'
import { runHeuristic } from '../lib/heuristicAgent'
import { runAzure } from '../lib/azureAgent'
import { useConfig } from './ConfigContext'
import { useInventory } from './InventoryContext'
import { useTransfers } from './TransfersContext'

interface ChatContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  messages: ChatMessage[]
  streaming: boolean
  provider: 'heuristic' | 'azure'
  send: (question: string) => void
  stop: () => void
  clear: () => void
  /** Confirm a draft card → create the D365 transfer order. */
  confirmCard: (messageId: string) => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

let seq = 0
const newId = () => `m${++seq}`

const GREETING: ChatMessage = {
  id: 'greeting',
  role: 'assistant',
  text: "I'm your consignment assistant. Ask me about inventory across partners — or say \"draft the Fall return for Nordstrom\" and I'll prepare it.",
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { config } = useConfig()
  const { customers, lines, positions } = useInventory()
  const { transfers, createTransfer, receiveTransfer, recordSale } =
    useTransfers()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const provider = config.agent.provider

  const data = useMemo<AgentData>(
    () => ({ customers, lines, positions, transfers, config }),
    [customers, lines, positions, transfers, config],
  )

  const patchMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      ),
    [],
  )
  const appendText = useCallback(
    (id: string, delta: string) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, text: m.text + delta } : m)),
      ),
    [],
  )

  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || streaming) return

      const userMsg: ChatMessage = { id: newId(), role: 'user', text: trimmed }
      const assistantId = newId()
      const placeholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        text: '',
        streaming: true,
      }
      // Snapshot prior turns (before adding the placeholder) for context.
      const history = messages.filter((m) => m.id !== 'greeting')
      setMessages((prev) => [...prev, userMsg, placeholder])
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      const run = async () => {
        try {
          if (provider === 'azure') {
            const reply = await runAzure({
              question: trimmed,
              history,
              data,
              azure: config.agent.azure,
              onToken: (delta) => appendText(assistantId, delta),
              signal: controller.signal,
            })
            // Text already streamed via onToken; attach metadata + ensure text.
            patchMessage(assistantId, {
              text: reply.text,
              tools: reply.tools,
              card: reply.card,
              streaming: false,
            })
          } else {
            const reply = runHeuristic(trimmed, data)
            await revealText(reply.text, (d) => appendText(assistantId, d), controller.signal)
            patchMessage(assistantId, {
              tools: reply.tools,
              card: reply.card,
              streaming: false,
            })
          }
        } catch (err) {
          if (controller.signal.aborted) {
            patchMessage(assistantId, { streaming: false })
          } else {
            patchMessage(assistantId, {
              text:
                err instanceof Error
                  ? err.message
                  : 'Something went wrong answering that.',
              error: true,
              streaming: false,
            })
          }
        } finally {
          if (abortRef.current === controller) abortRef.current = null
          setStreaming(false)
        }
      }
      void run()
    },
    [streaming, messages, provider, data, config.agent.azure, appendText, patchMessage],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  const clear = useCallback(() => {
    abortRef.current?.abort()
    setMessages([GREETING])
    setStreaming(false)
  }, [])

  const confirmCard = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId)
      const card = msg?.card
      if (!card || card.status === 'submitting' || card.status === 'created')
        return

      patchMessage(messageId, {
        card: { ...card, status: 'submitting', error: undefined },
      })

      try {
        if (card.kind === 'season-return') {
          const customer = customers.find((c) => c.id === card.customerId)
          if (!customer) throw new Error('Partner not found.')
          const orderLines = lines.filter(
            (l) =>
              l.customerId === customer.id &&
              (card.season === 'all' || l.season === card.season),
          )
          const order = await createTransfer({
            customer,
            season: card.season,
            lines: orderLines,
          })
          patchMessage(messageId, {
            card: { ...card, status: 'created', transferOrderNumber: order.id },
          })
        } else if (card.kind === 'receive-transfer') {
          receiveTransfer(card.transferId)
          patchMessage(messageId, { card: { ...card, status: 'created' } })
        } else {
          // liquidation-sale
          const customer = customers.find((c) => c.id === card.customerId)
          if (!customer) throw new Error('Partner not found.')
          // Use the lines the quote was built from so the sale matches it.
          const saleLines = lines.filter((l) =>
            card.removals.some((r) => r.lineId === l.id),
          )
          const sale = recordSale({
            customer,
            buyer: card.buyer,
            marginPct: card.marginPct,
            lines: saleLines,
          })
          patchMessage(messageId, {
            card: { ...card, status: 'created', saleId: sale.id },
          })
        }
      } catch (err) {
        patchMessage(messageId, {
          card: {
            ...card,
            status: 'error',
            error: err instanceof Error ? err.message : 'Action failed.',
          },
        })
      }
    },
    [messages, customers, lines, createTransfer, receiveTransfer, recordSale, patchMessage],
  )

  const value = useMemo<ChatContextValue>(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen((o) => !o),
      messages,
      streaming,
      provider,
      send,
      stop,
      clear,
      confirmCard,
    }),
    [open, messages, streaming, provider, send, stop, clear, confirmCard],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

/** Reveal heuristic text word-by-word for a streaming feel. */
async function revealText(
  text: string,
  emit: (delta: string) => void,
  signal: AbortSignal,
) {
  const tokens = text.match(/\S+\s*/g) ?? [text]
  for (const tok of tokens) {
    if (signal.aborted) return
    emit(tok)
    await new Promise((r) => setTimeout(r, 16))
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within a ChatProvider')
  return ctx
}
