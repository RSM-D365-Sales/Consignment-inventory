import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './styles/theme.css'
import './styles/app.css'
import { App } from './App'
import { ConfigProvider } from './context/ConfigContext'
import { TransfersProvider } from './context/TransfersContext'
import { InventoryProvider } from './context/InventoryContext'
import { ChatProvider } from './context/ChatContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter keeps deep links working on GitHub Pages (no server rewrites). */}
    <HashRouter>
      <ConfigProvider>
        {/* Transfers sits above Inventory: received transfers reduce on-hand. */}
        <TransfersProvider>
          <InventoryProvider>
            <ChatProvider>
              <App />
            </ChatProvider>
          </InventoryProvider>
        </TransfersProvider>
      </ConfigProvider>
    </HashRouter>
  </StrictMode>,
)
