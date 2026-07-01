import type { Customer, InventoryLine, TransferOrderResult } from '../models/types'
import type { AppConfig } from '../models/config'
import type { CreateTransferInput, D365Service } from './d365Service'

/**
 * Live D365 Finance & Supply Chain connector (scaffold).
 *
 * ── Status ──────────────────────────────────────────────────────────────────
 * This is a documented stub. The method bodies show exactly which D365 OData
 * entities and which auth flow the production integration will use, but they
 * intentionally throw until the backend auth path is in place. A static
 * GitHub Pages site cannot safely hold a client secret or satisfy the D365
 * CORS policy on its own, so going live requires ONE of:
 *
 *   1. A thin auth proxy / Azure Function (recommended) that performs the
 *      OAuth client-credentials flow server-side and forwards OData calls.
 *      The browser calls the proxy; the proxy holds the secret. This also
 *      sidesteps CORS.
 *   2. An Azure AD SPA app registration + MSAL.js with the D365 environment
 *      configured to allow the Pages origin via CORS (authorization-code +
 *      PKCE, no secret in the browser).
 *
 * See docs/FUTURE-INTEGRATION.md for the full runbook.
 *
 * ── Key endpoints (relative to connection.baseUrl) ──────────────────────────
 *   GET  /data/InventGetOnHandV2?$filter=InventLocationId eq '{wh}'
 *   GET  /data/ReleasedProductsV2?$filter=...           (item master enrich)
 *   POST /data/TransferOrderHeaders                      (create TO header)
 *   POST /data/TransferOrderLines                        (add TO lines)
 * All requests carry: Authorization: Bearer {token}, and the company is
 * scoped with the `cross-company` + `$filter=dataAreaId eq '{company}'`
 * convention or the `Company` query option depending on the entity.
 */
export class LiveD365Service implements D365Service {
  readonly live = true

  constructor(private readonly config: AppConfig) {}

  private notReady(method: string): never {
    const target = this.config.connection.baseUrl || '(no environment URL set)'
    throw new Error(
      `Live D365 connector not configured (${method} → ${target}). ` +
        `Set up the auth proxy or MSAL SPA registration described in ` +
        `docs/FUTURE-INTEGRATION.md, then implement this method. ` +
        `Until then, switch the app back to Mock mode in Setup.`,
    )
  }

  // --- Example of the intended shape (left commented for the future build) ---
  //
  // private async odataGet<T>(path: string): Promise<T> {
  //   const token = await this.getAccessToken()
  //   const res = await fetch(`${this.config.connection.baseUrl}${path}`, {
  //     headers: {
  //       Authorization: `Bearer ${token}`,
  //       Accept: 'application/json',
  //     },
  //   })
  //   if (!res.ok) throw new Error(`D365 OData ${res.status}: ${path}`)
  //   const json = await res.json()
  //   return json.value as T
  // }

  async getCustomers(): Promise<Customer[]> {
    // Customers are configured in this app + mapped to warehouses; the live
    // connector would still validate the mappings against CustomersV3.
    return this.notReady('getCustomers')
  }

  async getConsignmentInventory(): Promise<InventoryLine[]> {
    // For each enabled mapping, query InventGetOnHandV2 filtered to that
    // warehouse, then enrich with ReleasedProductsV2 for style/category.
    return this.notReady('getConsignmentInventory')
  }

  async createReturnTransferOrder(
    _input: CreateTransferInput,
  ): Promise<TransferOrderResult> {
    // POST a TransferOrderHeaders record (From = partner warehouse,
    // To = connection.mainDcWarehouseId), then POST one TransferOrderLines
    // record per inventory line, then return the assigned TO number.
    return this.notReady('createReturnTransferOrder')
  }
}
