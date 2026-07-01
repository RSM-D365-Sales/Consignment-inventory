import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import type { ChatMessage } from '../../models/chat'
import { ActionCardView } from './ActionCardView'

const SUGGESTIONS = [
  'Portfolio summary',
  'Draft the Fall return for Nordstrom',
  'Show my transfers',
  "Sell Saks' inventory to Marshalls at 30%",
]

export function ChatPanel() {
  const { messages, streaming, provider, send, stop, clear, confirmCard, setOpen } =
    useChat()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the latest message in view as text streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  function submit() {
    if (!input.trim() || streaming) return
    send(input)
    setInput('')
  }

  const showSuggestions = messages.length <= 1

  return (
    <aside className="chat-panel">
      <header className="chat-panel__head">
        <div className="row gap-2">
          <span className="chat-panel__dot" />
          <div>
            <div className="chat-panel__title">Consignment Assistant</div>
            <div className="chat-panel__provider eyebrow">
              {provider === 'azure' ? 'Azure OpenAI · Foundry' : 'Heuristic · offline'}
            </div>
          </div>
        </div>
        <div className="row gap-2">
          <button className="icon-btn" title="Clear conversation" onClick={clear}>
            ⟲
          </button>
          <button className="icon-btn" title="Close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
      </header>

      <div className="chat-panel__messages" ref={scrollRef}>
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onConfirm={confirmCard} />
        ))}
      </div>

      <div className="chat-panel__foot">
        {showSuggestions && (
          <div className="chat-suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="chat-suggestion"
                onClick={() => send(s)}
                disabled={streaming}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {provider === 'azure' && (
          <div className="chat-hint muted">
            Live model · BYO-key demo mode.{' '}
            <Link to="/setup">Configure</Link>
          </div>
        )}

        <div className="chat-input">
          <textarea
            className="chat-input__field"
            placeholder="Ask about inventory, or request a season return…"
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
          />
          {streaming ? (
            <button className="chat-send chat-send--stop" onClick={stop} title="Stop">
              ■
            </button>
          ) : (
            <button
              className="chat-send"
              onClick={submit}
              disabled={!input.trim()}
              title="Send"
            >
              ↑
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

function MessageBubble({
  message,
  onConfirm,
}: {
  message: ChatMessage
  onConfirm: (id: string) => void
}) {
  const isUser = message.role === 'user'
  const showTyping = message.streaming && !message.text

  return (
    <div className={`bubble-row bubble-row--${isUser ? 'user' : 'assistant'}`}>
      <div
        className={`bubble bubble--${isUser ? 'user' : 'assistant'}${
          message.error ? ' bubble--error' : ''
        }`}
      >
        {showTyping ? (
          <span className="typing">
            <span />
            <span />
            <span />
          </span>
        ) : (
          <span className="bubble__text">
            {message.text}
            {message.streaming && <span className="caret" />}
          </span>
        )}

        {message.tools && message.tools.length > 0 && (
          <div className="bubble__tools">
            {message.tools.map((t, i) => (
              <span key={i} className="tool-chip">
                {t.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {message.card && <ActionCardView message={message} onConfirm={onConfirm} />}
    </div>
  )
}
