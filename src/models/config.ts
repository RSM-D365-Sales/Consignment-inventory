import { CUSTOMERS } from '../data/mockData'
import type { Customer } from './types'

/** How the app sources data and executes transfers. */
export type DataMode = 'mock' | 'live'

/**
 * Maps a customer (retail partner) to the D365 warehouse that represents
 * their consignment site. One mapping per customer; the main DC is held
 * separately on the connection.
 */
export interface WarehouseMapping {
  customerId: string
  /** D365 InventLocationId (warehouse). */
  warehouseId: string
  /** D365 InventSiteId the warehouse belongs to. */
  siteId: string
  /** Whether this mapping is considered active/verified. */
  enabled: boolean
}

/** Connection + company context for the D365 F&SC environment. */
export interface D365Connection {
  /** Environment URL, e.g. https://vince.operations.dynamics.com */
  baseUrl: string
  /** Azure AD tenant (directory) id. */
  tenantId: string
  /** Azure AD application (client) id for the OAuth app registration. */
  clientId: string
  /** Legal entity / company (DataAreaId), e.g. "VINC". */
  dataAreaId: string
  /** D365 InventLocationId for the main distribution center. */
  mainDcWarehouseId: string
  /** Friendly name for the main DC, used in emails + UI. */
  mainDcName: string
}

/** Which backend answers chat questions. */
export type AgentProvider = 'heuristic' | 'azure'

/**
 * Azure OpenAI (in Azure AI Foundry) connection for the chat assistant.
 *
 * SECURITY: `apiKey` here is a BYO-key convenience for the static demo only —
 * it lives in browser localStorage and is sent directly to Azure OpenAI from
 * the browser. Use a throwaway/spending-capped key, never a production secret.
 * For production, route chat through the Azure Function proxy instead (the key
 * stays server-side). See docs/FUTURE-INTEGRATION.md.
 */
export interface AzureOpenAIConfig {
  /** Resource endpoint, e.g. https://my-aoai.openai.azure.com */
  endpoint: string
  /** Deployment name of the chat model (e.g. a GPT-4.1 / GPT-4o deployment). */
  deployment: string
  /** REST API version, e.g. 2024-10-21. */
  apiVersion: string
  /** Demo-only key (see security note above). */
  apiKey: string
}

export interface AgentConfig {
  provider: AgentProvider
  azure: AzureOpenAIConfig
}

/** Full persisted application configuration. */
export interface AppConfig {
  mode: DataMode
  connection: D365Connection
  mappings: WarehouseMapping[]
  agent: AgentConfig
  /**
   * Retail partners added at runtime via Setup (the bundled four live in the
   * mock dataset). These persist to the browser and flow through the whole app
   * — dashboard, season return, and mapping — alongside the built-in partners.
   */
  customPartners: Customer[]
}

/** Sensible defaults so the demo runs immediately in mock mode. */
export const DEFAULT_CONFIG: AppConfig = {
  mode: 'mock',
  connection: {
    baseUrl: 'https://vince.operations.dynamics.com',
    tenantId: '',
    clientId: '',
    dataAreaId: 'VINC',
    mainDcWarehouseId: 'DC-MAIN',
    mainDcName: 'Vince Main Distribution Center (NJ)',
  },
  mappings: CUSTOMERS.map((c, i) => ({
    customerId: c.id,
    // Pre-seed plausible warehouse codes so the demo's Setup page looks wired.
    warehouseId: `CN-${c.code}`,
    siteId: `S-${String(i + 1).padStart(2, '0')}`,
    enabled: true,
  })),
  agent: {
    provider: 'heuristic',
    azure: {
      endpoint: '',
      deployment: '',
      apiVersion: '2024-10-21',
      apiKey: '',
    },
  },
  customPartners: [],
}

/** Accent palette cycled through when a new partner is added. */
export const PARTNER_ACCENTS = [
  '#8a6d3f',
  '#6b7b8c',
  '#7c8470',
  '#a6452f',
  '#9a8c98',
  '#5f7a55',
]

export const CONFIG_STORAGE_KEY = 'vince-consignment-agent.config.v1'
