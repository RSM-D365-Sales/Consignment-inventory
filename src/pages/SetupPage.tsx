import { useState } from 'react'
import { useConfig } from '../context/ConfigContext'
import { useInventory } from '../context/InventoryContext'
import { useTransfers } from '../context/TransfersContext'
import { useChat } from '../context/ChatContext'
import type { DataMode } from '../models/config'
import { PartnerLogo } from '../components/PartnerLogo'

export function SetupPage() {
  const {
    config,
    updateConfig,
    updateConnection,
    updateMapping,
    updateAgent,
    updateAzure,
    addPartner,
    removePartner,
    resetConfig,
  } = useConfig()
  const { customers, refresh } = useInventory()
  const { transfers, sales, clearAll } = useTransfers()
  const { clear: clearChat } = useChat()
  const [showLiveWarning, setShowLiveWarning] = useState(false)
  const [showAddPartner, setShowAddPartner] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [newPartner, setNewPartner] = useState({
    name: '',
    website: '',
    warehouseId: '',
    siteId: '',
  })

  const customPartnerIds = new Set(config.customPartners.map((p) => p.id))
  const customerFor = (id: string) => customers.find((c) => c.id === id)

  function submitNewPartner() {
    if (!newPartner.name.trim()) return
    addPartner(newPartner)
    setNewPartner({ name: '', website: '', warehouseId: '', siteId: '' })
    setShowAddPartner(false)
  }

  function resetDemoData() {
    clearAll() // wipe transfer orders + liquidation sales (restores on-hand overlay)
    refresh() // re-fetch full base inventory from the active service
    clearChat() // reset the assistant conversation to its greeting
    setConfirmReset(false)
    setResetDone(true)
  }

  function setMode(mode: DataMode) {
    if (mode === 'live') {
      setShowLiveWarning(true)
    }
    updateConfig({ mode })
  }

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.name ?? id

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <div className="eyebrow">Configuration</div>
          <h1>Setup</h1>
          <p className="page__lede soft">
            Map each retail partner to its D365 consignment warehouse, set the
            main distribution center, and choose the data source. Changes save
            automatically to this browser.
          </p>
        </div>
      </header>

      {/* Data mode */}
      <section className="card panel">
        <div className="panel__head">
          <div className="eyebrow">Data source</div>
        </div>
        <div className="mode-toggle">
          <button
            className={`mode-card${config.mode === 'mock' ? ' is-active' : ''}`}
            onClick={() => setMode('mock')}
          >
            <div className="mode-card__title">Demo · Mock data</div>
            <div className="mode-card__desc muted">
              Bundled sample inventory. No connection required. Transfer orders
              are simulated. Recommended for demos.
            </div>
          </button>
          <button
            className={`mode-card${config.mode === 'live' ? ' is-active' : ''}`}
            onClick={() => setMode('live')}
          >
            <div className="mode-card__title">Live · D365 F&amp;SC</div>
            <div className="mode-card__desc muted">
              Reads on-hand inventory and writes transfer orders to D365.
              Requires the auth proxy / MSAL setup in the integration runbook.
            </div>
          </button>
        </div>
        {config.mode === 'live' && showLiveWarning && (
          <div className="notice notice--warn">
            <strong>Live mode is a scaffold.</strong> The connector throws until
            the OAuth + OData path is implemented. See{' '}
            <code>docs/FUTURE-INTEGRATION.md</code>. Switch back to Demo to keep
            the dashboard populated.
          </div>
        )}
      </section>

      {/* Assistant */}
      <section className="card panel">
        <div className="panel__head">
          <div className="eyebrow">Assistant (chat agent)</div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            How the right-side chat answers questions. Both modes query the same
            inventory data.
          </div>
        </div>
        <div className="mode-toggle">
          <button
            className={`mode-card${
              config.agent.provider === 'heuristic' ? ' is-active' : ''
            }`}
            onClick={() => updateAgent({ provider: 'heuristic' })}
          >
            <div className="mode-card__title">Heuristic · offline</div>
            <div className="mode-card__desc muted">
              Rule-based answers over the inventory data. No model, no key,
              always available. Great for demos.
            </div>
          </button>
          <button
            className={`mode-card${
              config.agent.provider === 'azure' ? ' is-active' : ''
            }`}
            onClick={() => updateAgent({ provider: 'azure' })}
          >
            <div className="mode-card__title">Azure OpenAI · Foundry</div>
            <div className="mode-card__desc muted">
              Natural-language chat via your Azure OpenAI deployment with
              function calling and streaming. BYO-key (demo).
            </div>
          </button>
        </div>
        {config.agent.provider === 'azure' && (
          <>
            <div className="notice notice--warn">
              <strong>BYO-key demo mode.</strong> This key is stored in your
              browser and sent directly to Azure OpenAI. Use a throwaway,
              spending-capped key — never a production secret. For production,
              point the endpoint at the Function proxy so the key stays
              server-side (see <code>docs/FUTURE-INTEGRATION.md</code>).
            </div>
            <div className="form-grid">
              <Field
                label="Azure OpenAI endpoint"
                value={config.agent.azure.endpoint}
                placeholder="https://my-aoai.openai.azure.com"
                onChange={(v) => updateAzure({ endpoint: v })}
              />
              <Field
                label="Deployment name"
                value={config.agent.azure.deployment}
                placeholder="gpt-4.1"
                onChange={(v) => updateAzure({ deployment: v })}
              />
              <Field
                label="API version"
                value={config.agent.azure.apiVersion}
                placeholder="2024-10-21"
                onChange={(v) => updateAzure({ apiVersion: v })}
              />
              <Field
                label="API key (demo only)"
                type="password"
                value={config.agent.azure.apiKey}
                placeholder="Throwaway key"
                onChange={(v) => updateAzure({ apiKey: v })}
              />
            </div>
          </>
        )}
      </section>

      {/* Connection */}
      <section className="card panel">
        <div className="panel__head">
          <div className="eyebrow">D365 environment</div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            Used by the live connector. Secrets are never stored here — auth is
            brokered by the proxy / MSAL flow.
          </div>
        </div>
        <div className="form-grid">
          <Field
            label="Environment URL"
            value={config.connection.baseUrl}
            placeholder="https://vince.operations.dynamics.com"
            onChange={(v) => updateConnection({ baseUrl: v })}
          />
          <Field
            label="Legal entity (DataAreaId)"
            value={config.connection.dataAreaId}
            placeholder="VINC"
            onChange={(v) => updateConnection({ dataAreaId: v })}
          />
          <Field
            label="Azure AD tenant id"
            value={config.connection.tenantId}
            placeholder="00000000-0000-0000-0000-000000000000"
            onChange={(v) => updateConnection({ tenantId: v })}
          />
          <Field
            label="App (client) id"
            value={config.connection.clientId}
            placeholder="App registration client id"
            onChange={(v) => updateConnection({ clientId: v })}
          />
        </div>
      </section>

      {/* Main DC */}
      <section className="card panel">
        <div className="panel__head">
          <div className="eyebrow">Main distribution center</div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            Destination warehouse for every end-of-season return.
          </div>
        </div>
        <div className="form-grid">
          <Field
            label="Main DC warehouse id"
            value={config.connection.mainDcWarehouseId}
            placeholder="DC-MAIN"
            onChange={(v) => updateConnection({ mainDcWarehouseId: v })}
          />
          <Field
            label="Main DC display name"
            value={config.connection.mainDcName}
            placeholder="Vince Main Distribution Center"
            onChange={(v) => updateConnection({ mainDcName: v })}
          />
        </div>
      </section>

      {/* Warehouse mappings */}
      <section className="card panel">
        <div className="panel__head">
          <div className="eyebrow">Partner warehouse mapping</div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            One consignment warehouse per retail partner.
          </div>
        </div>
        <div className="table-wrap">
          <table className="table mapping-table">
            <thead>
              <tr>
                <th>Retail partner</th>
                <th>D365 warehouse id</th>
                <th>Site id</th>
                <th className="th-center">Active</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {config.mappings.map((m) => (
                <tr key={m.customerId}>
                  <td className="td-style">
                    <span className="mapping-partner">
                      {customerFor(m.customerId) && (
                        <PartnerLogo
                          customer={customerFor(m.customerId)!}
                          size={24}
                          rounded={5}
                        />
                      )}
                      <span>{customerName(m.customerId)}</span>
                      {customPartnerIds.has(m.customerId) && (
                        <span className="mapping-tag">Added</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <input
                      className="input input--inline numeric"
                      value={m.warehouseId}
                      onChange={(e) =>
                        updateMapping(m.customerId, {
                          warehouseId: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input input--inline numeric"
                      value={m.siteId}
                      onChange={(e) =>
                        updateMapping(m.customerId, { siteId: e.target.value })
                      }
                    />
                  </td>
                  <td className="td-center">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={m.enabled}
                        onChange={(e) =>
                          updateMapping(m.customerId, {
                            enabled: e.target.checked,
                          })
                        }
                      />
                      <span className="switch__track" />
                    </label>
                  </td>
                  <td className="td-center">
                    {customPartnerIds.has(m.customerId) && (
                      <button
                        className="icon-btn icon-btn--danger"
                        title={`Remove ${customerName(m.customerId)}`}
                        onClick={() => removePartner(m.customerId)}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showAddPartner ? (
          <div className="partner-add">
            <div className="partner-add__grid">
              <div className="field">
                <label>Retail partner name</label>
                <input
                  className="input"
                  autoFocus
                  placeholder="e.g. Neiman Marcus"
                  value={newPartner.name}
                  onChange={(e) =>
                    setNewPartner((p) => ({ ...p, name: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && submitNewPartner()}
                />
              </div>
              <div className="field">
                <label>Website (for logo)</label>
                <input
                  className="input"
                  placeholder="auto from name"
                  value={newPartner.website}
                  onChange={(e) =>
                    setNewPartner((p) => ({ ...p, website: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && submitNewPartner()}
                />
              </div>
              <div className="field">
                <label>D365 warehouse id</label>
                <input
                  className="input numeric"
                  placeholder="auto from name"
                  value={newPartner.warehouseId}
                  onChange={(e) =>
                    setNewPartner((p) => ({
                      ...p,
                      warehouseId: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && submitNewPartner()}
                />
              </div>
              <div className="field">
                <label>Site id</label>
                <input
                  className="input numeric"
                  placeholder="auto"
                  value={newPartner.siteId}
                  onChange={(e) =>
                    setNewPartner((p) => ({ ...p, siteId: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && submitNewPartner()}
                />
              </div>
            </div>
            <div className="partner-add__actions">
              <button
                className="btn btn--accent btn--sm"
                disabled={!newPartner.name.trim()}
                onClick={submitNewPartner}
              >
                Add partner
              </button>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setShowAddPartner(false)
                  setNewPartner({
                    name: '',
                    website: '',
                    warehouseId: '',
                    siteId: '',
                  })
                }}
              >
                Cancel
              </button>
              <span className="muted partner-add__hint">
                In demo mode, added partners get sample inventory automatically.
              </span>
            </div>
          </div>
        ) : (
          <button
            className="btn btn--ghost btn--sm partner-add__toggle"
            onClick={() => setShowAddPartner(true)}
          >
            + Add retail partner
          </button>
        )}
      </section>

      {/* Demo data reset */}
      <section className="card panel">
        <div className="panel__head">
          <div className="eyebrow">Demo data</div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            Restore full sample inventory and remove every transfer order and
            liquidation sale you've created during the demo. Partner mappings and
            settings above are kept — use “Reset to defaults” below for those.
          </div>
        </div>

        <div className="reset-data">
          <div className="reset-data__stat muted">
            {transfers.length} transfer{transfers.length === 1 ? '' : 's'} ·{' '}
            {sales.length} liquidation sale{sales.length === 1 ? '' : 's'}{' '}
            currently recorded
          </div>

          {confirmReset ? (
            <div className="notice notice--warn reset-data__confirm">
              <strong>Reset demo data?</strong> This clears all transfer orders
              and liquidation sales, restores full on-hand inventory, and clears
              the assistant chat. This can't be undone.
              <div className="reset-data__actions">
                <button
                  className="btn btn--sm reset-data__danger"
                  onClick={resetDemoData}
                >
                  Yes, reset everything
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn--ghost btn--sm reset-data__trigger"
              onClick={() => {
                setResetDone(false)
                setConfirmReset(true)
              }}
            >
              Reset demo data
            </button>
          )}

          {resetDone && !confirmReset && (
            <div className="notice notice--ok">
              Demo data reset — inventory restored, transfers and sales cleared.
            </div>
          )}
        </div>
      </section>

      <div className="page__cta-row">
        <button className="btn btn--ghost" onClick={resetConfig}>
          Reset to defaults
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  placeholder,
  type = 'text',
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  type?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
