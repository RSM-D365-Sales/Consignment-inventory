import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  CONFIG_STORAGE_KEY,
  DEFAULT_CONFIG,
  PARTNER_ACCENTS,
  type AppConfig,
  type WarehouseMapping,
} from '../models/config'
import { CUSTOMERS } from '../data/mockData'
import type { Customer } from '../models/types'
import { createD365Service, type D365Service } from '../services'

/** Fields captured when onboarding a new retail partner from Setup. */
export interface NewPartnerInput {
  name: string
  warehouseId: string
  siteId: string
  contactEmail?: string
  /** Website or domain used to fetch the partner's logo. Auto-derived if blank. */
  website?: string
}

/** Normalize a website/domain entry (or a name fallback) to a bare domain. */
function toDomain(website: string | undefined, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  const raw = website?.trim() || (slug ? `${slug}.com` : '')
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .trim()
    .toLowerCase()
}

interface ConfigContextValue {
  config: AppConfig
  service: D365Service
  /** Shallow-merge a patch into the config and persist. */
  updateConfig: (patch: Partial<AppConfig>) => void
  /** Patch a single field on the connection object. */
  updateConnection: (
    patch: Partial<AppConfig['connection']>,
  ) => void
  /** Replace one customer's warehouse mapping. */
  updateMapping: (
    customerId: string,
    patch: Partial<WarehouseMapping>,
  ) => void
  /** Patch the agent config (provider). */
  updateAgent: (patch: Partial<AppConfig['agent']>) => void
  /** Patch the Azure OpenAI sub-config. */
  updateAzure: (patch: Partial<AppConfig['agent']['azure']>) => void
  /** Onboard a new retail partner (+ its warehouse mapping). */
  addPartner: (input: NewPartnerInput) => void
  /** Remove a runtime-added partner and its mapping. */
  removePartner: (customerId: string) => void
  resetConfig: () => void
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    // Merge over defaults so new fields added in later versions are populated.
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      connection: { ...DEFAULT_CONFIG.connection, ...parsed.connection },
      mappings: parsed.mappings?.length
        ? parsed.mappings
        : DEFAULT_CONFIG.mappings,
      agent: {
        ...DEFAULT_CONFIG.agent,
        ...parsed.agent,
        azure: { ...DEFAULT_CONFIG.agent.azure, ...parsed.agent?.azure },
      },
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(loadConfig)

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
    } catch {
      // Ignore quota / private-mode write failures — config still lives in memory.
    }
  }, [config])

  const value = useMemo<ConfigContextValue>(() => {
    const service = createD365Service(config)
    return {
      config,
      service,
      updateConfig: (patch) => setConfig((c) => ({ ...c, ...patch })),
      updateConnection: (patch) =>
        setConfig((c) => ({
          ...c,
          connection: { ...c.connection, ...patch },
        })),
      updateMapping: (customerId, patch) =>
        setConfig((c) => ({
          ...c,
          mappings: c.mappings.map((m) =>
            m.customerId === customerId ? { ...m, ...patch } : m,
          ),
        })),
      updateAgent: (patch) =>
        setConfig((c) => ({ ...c, agent: { ...c.agent, ...patch } })),
      updateAzure: (patch) =>
        setConfig((c) => ({
          ...c,
          agent: { ...c.agent, azure: { ...c.agent.azure, ...patch } },
        })),
      addPartner: (input) =>
        setConfig((c) => {
          const code =
            input.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) ||
            'PART'
          const taken = new Set([
            ...CUSTOMERS.map((x) => x.id),
            ...c.customPartners.map((x) => x.id),
          ])
          let id = `CUST-${code}`
          for (let n = 2; taken.has(id); n++) id = `CUST-${code}-${n}`

          const accent =
            PARTNER_ACCENTS[
              (CUSTOMERS.length + c.customPartners.length) %
                PARTNER_ACCENTS.length
            ]
          const domain = toDomain(input.website, input.name)

          const partner: Customer = {
            id,
            name: input.name.trim(),
            code,
            contactName: 'Partner Contact',
            contactEmail:
              input.contactEmail?.trim() ||
              (domain ? `consignment@${domain}` : 'consignment@partner.com'),
            location: 'Added partner',
            accent,
            domain: domain || undefined,
          }
          const mapping: WarehouseMapping = {
            customerId: id,
            warehouseId: input.warehouseId.trim() || `CN-${code}`,
            siteId:
              input.siteId.trim() ||
              `S-${String(c.mappings.length + 1).padStart(2, '0')}`,
            enabled: true,
          }
          return {
            ...c,
            customPartners: [...c.customPartners, partner],
            mappings: [...c.mappings, mapping],
          }
        }),
      removePartner: (customerId) =>
        setConfig((c) => ({
          ...c,
          customPartners: c.customPartners.filter((p) => p.id !== customerId),
          mappings: c.mappings.filter((m) => m.customerId !== customerId),
        })),
      resetConfig: () => setConfig(DEFAULT_CONFIG),
    }
  }, [config])

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used within a ConfigProvider')
  return ctx
}
