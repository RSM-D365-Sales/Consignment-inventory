import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useConfig } from '../../context/ConfigContext'
import { useChat } from '../../context/ChatContext'
import { ChatPanel } from '../chat/ChatPanel'

const NAV = [
  { to: '/', label: 'Inventory Queue', end: true },
  { to: '/season-return', label: 'Season Return', end: false },
  { to: '/transfers', label: 'Transfers', end: false },
  { to: '/setup', label: 'Setup', end: false },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { config } = useConfig()
  const { open, toggle } = useChat()
  const live = config.mode === 'live'

  return (
    <div className={`shell${open ? ' chat-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">VINCE</div>
          <div className="brand__sub eyebrow">Consignment Agent</div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav__link${isActive ? ' nav__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <div className="agent-card">
            <div className="agent-card__dot" />
            <div>
              <div className="agent-card__name">Consignment Agent</div>
              <div className="agent-card__desc muted">
                Modeled on the D365 Supplier Communication Agent
              </div>
            </div>
          </div>
          <span className={`pill ${live ? 'pill--live' : 'pill--mock'}`}>
            <span className="pill__dot" />
            {live ? 'Live · D365' : 'Demo · Mock data'}
          </span>
        </div>
      </aside>

      <main className="content">{children}</main>

      {open ? (
        <ChatPanel />
      ) : (
        <button
          className="chat-launcher"
          onClick={toggle}
          aria-label="Open the consignment assistant"
        >
          <span className="chat-launcher__icon">✦</span>
          <span className="chat-launcher__label">Ask the agent</span>
        </button>
      )}
    </div>
  )
}
