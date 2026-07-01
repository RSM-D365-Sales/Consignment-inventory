# Integration Roadmap

This demo runs on mock data and renders the end-of-season email **in-app**.
This document is the runbook for taking each piece to production. It is split
into two tracks that can be done independently:

- **Track A — Email delivery** (in-app preview → real Outlook draft)
- **Track B — Live D365** (mock data → real OData reads + transfer-order writes)

---

## Track A — Email delivery

The agent currently composes the email and shows it in a polished in-app
preview (`src/components/EmailPreview.tsx`). Three delivery options, in order of
increasing fidelity:

### A1. In-app preview (today)

- **Where:** `SeasonReturnPage` → `EmailPreview`.
- Editable subject + intro; line-item table built from the same lines as the
  transfer order. "Copy email text" puts the assembled body on the clipboard.
- **Good for:** demos and review. No auth, no external dependencies.

### A2. Open in Outlook via `mailto:` (today, one click)

- **Where:** `lib/emailDraft.ts → buildMailtoUrl()`, wired to the
  **"Open in Outlook (mailto)"** button.
- Opens the user's default mail client with recipient, subject, and body
  prefilled. The user reviews and sends.
- **Limitations:** plain text only; some clients truncate very long bodies
  (~1,800–2,000 chars is a safe ceiling). For long inventory lists, prefer A3.

### A3. Real Outlook draft via Microsoft Graph (roadmap)

Creates an actual draft in the user's mailbox — HTML table, no length limit,
appears in Outlook "Drafts" for review before sending.

**Steps**

1. **App registration** (Azure AD): add the SPA redirect URI for the Pages
   origin; delegated scope `Mail.ReadWrite` (and `Mail.Send` only if you want
   the agent to send, not just draft).
2. **Auth in the browser:** add `@azure/msal-browser`, sign the user in with
   authorization-code + PKCE (no secret in the browser).
3. **Create the draft:**

   ```http
   POST https://graph.microsoft.com/v1.0/me/messages
   Authorization: Bearer {token}
   Content-Type: application/json

   {
     "subject": "{draft.subject}",
     "body": { "contentType": "HTML", "content": "{html table}" },
     "toRecipients": [{ "emailAddress": { "address": "{draft.to}" } }]
   }
   ```

4. Optionally open the draft in Outlook on the web using the returned
   `webLink`.

**Where to wire it:** replace the disabled **"Create Graph draft · soon"**
button handler in `SeasonReturnPage.tsx`. Build the HTML body from
`draft.lines` (reuse the grouping in `EmailPreview`/`assembleBodyText`).

---

## Track B — Live D365 Finance & Supply Chain

The UI talks only to the `D365Service` interface
(`src/services/d365Service.ts`). `MockD365Service` powers the demo;
`LiveD365Service` is the scaffold to complete. Flip between them in
**Setup → Data source**.

### The hosting constraint

GitHub Pages is **static** — it can't hold a client secret and the D365
environment won't allow arbitrary browser origins through CORS. Pick one:

| Option | Auth flow | Pros | Cons |
| --- | --- | --- | --- |
| **B1. Auth proxy / Azure Function** (recommended) | OAuth **client-credentials** server-side; browser calls the proxy | Secret stays server-side; sidesteps CORS; central place for throttling/retry | Requires hosting a small function |
| **B2. MSAL SPA + D365 CORS** | **Authorization-code + PKCE** in the browser | No backend to host | Must configure D365 to allow the Pages origin; user signs in; per-user permissions |

Either way, `LiveD365Service` gets an access token and calls OData.

### Reads — on-hand consignment inventory

For each **enabled** warehouse mapping (`config.mappings`), query on-hand and
enrich with the item master:

```http
GET {baseUrl}/data/InventGetOnHandV2?$filter=InventLocationId eq '{warehouseId}'
GET {baseUrl}/data/ReleasedProductsV2?$filter=ItemNumber eq '{item}'    # style, category
```

Map results into `InventoryLine` (see the shape in `models/types.ts`). Scope to
the legal entity with the `cross-company` option + `dataAreaId` filter, or the
`Company` query option depending on the entity.

> **Note on cost vs. retail:** `unitCost`/`retailPrice` come from the costing /
> price entities (e.g. `InventItemPrice`, trade agreements). Decide the source
> of truth before go-live; the mock carries both per line.

### Writes — the end-of-season transfer order

`createReturnTransferOrder()` should create a transfer order **from** the
partner warehouse **to** `config.connection.mainDcWarehouseId`:

```http
POST {baseUrl}/data/TransferOrderHeaders
{
  "InventLocationIdFrom": "{mapping.warehouseId}",
  "InventLocationIdTo":   "{connection.mainDcWarehouseId}",
  "dataAreaId":           "{connection.dataAreaId}"
}

# then, per inventory line:
POST {baseUrl}/data/TransferOrderLines
{
  "TransferOrderNumber": "{returned header number}",
  "ItemNumber":          "{line.itemNumber}",
  "TransferQuantity":     {line.unitsOnHand},
  ...size/color inventory dimensions...
}
```

Return the assigned `TransferOrderNumber` as `TransferOrderResult.transferOrderNumber`
with `live: true`. The success panel already renders it.

> **Inventory dimensions:** transfer lines need the full dimension set
> (size, color, config, plus warehouse/site/location). Confirm the partner
> warehouses' storage-dimension setup so line posts validate.

### Implementation checklist

- [ ] Choose B1 (proxy) or B2 (MSAL) and stand up auth.
- [ ] Implement `getAccessToken()` + `odataGet`/`odataPost` in `LiveD365Service`.
- [ ] Implement `getConsignmentInventory()` (loop mappings → InventGetOnHandV2 → enrich).
- [ ] Implement `createReturnTransferOrder()` (header + lines).
- [ ] Validate warehouse mappings in `getCustomers()` against `CustomersV3`.
- [ ] Set real values in **Setup** (environment URL, tenant, client id, company,
      main DC, per-partner warehouse ids).
- [ ] Switch **Setup → Data source → Live** and smoke-test against a sandbox.

---

## Track C — Chat assistant

The right-side **Consignment Assistant** answers natural-language questions and
can draft end-of-season returns. It is built as a **tool-calling agent**: the
model never sees raw tables — it calls typed tools that run the *same*
aggregation logic the app uses, so every figure is grounded.

### Pieces

- **Tools** (`src/lib/agentTools.ts`) — `get_portfolio_summary`,
  `compare_partners`, `get_partner_details`, `query_inventory`,
  `draft_season_return`. Pure functions over the current data (mock or live).
  `TOOL_DEFS` doubles as the OpenAI/Azure function schema.
- **Heuristic agent** (`src/lib/heuristicAgent.ts`) — offline rule-based router.
  Default; no key, always works. Great for demos and as a fallback.
- **Azure OpenAI agent** (`src/lib/azureAgent.ts`) — function-calling loop with
  **true SSE token streaming**. Switch to it in **Setup → Assistant**.
- **Actions stay human-in-the-loop:** `draft_season_return` only *proposes* a
  card; creating the transfer order requires the user to click **Confirm &
  transfer**, which calls the same `D365Service.createReturnTransferOrder`.

### Demo path (today): Azure OpenAI BYO-key

Setup → Assistant → **Azure OpenAI**, then enter endpoint, deployment, API
version, and a **throwaway** key. The browser calls:

```http
POST {endpoint}/openai/deployments/{deployment}/chat/completions?api-version={ver}
api-key: {key}
{ "messages": [...], "tools": [...], "tool_choice": "auto", "stream": true }
```

> **Why BYO-key is demo-only:** the key sits in browser localStorage. Use a
> spending-capped throwaway key. Also note **CORS** — if your Azure OpenAI
> resource blocks the Pages origin, the browser call fails; that's the cue to
> move to the proxy below.

### Production path: Function proxy (recommended)

Reuse the **same** Azure Function from Track B. Add a `/api/chat` route that:

1. holds the Azure OpenAI key (and the model deployment) server-side,
2. runs the tool-calling loop server-side — and can execute tools that read
   **live D365** data and (on confirmation) write transfer orders,
3. streams tokens back to the browser via SSE.

Then point **Setup → Assistant → endpoint** at the Function instead of Azure
OpenAI directly. The client code already streams SSE, so the browser side is
unchanged — only the URL and the fact that no key is needed.

### Alternative: Azure AI Foundry Agent Service

Instead of raw chat-completions, you can host the agent in **Foundry Agent
Service** for managed threads, tool orchestration, and built-in tools (e.g.
connect a data source directly). Keep the same five tools as the agent's
function tools. This is heavier to stand up but removes the loop/▷thread
plumbing from your proxy. Recommended once the demo graduates to a product.

### Model choice

GPT‑4.1 or GPT‑4o for the strongest tool-calling; o4‑mini as a cheaper option
for a cost-sensitive demo. Set the deployment name in Setup.

---

## Track D — Fulfillment, tracking & liquidation

The demo simulates the operational lifecycle that follows the email: shipping
labels, a transfer-tracking board, receiving (which lowers partner on-hand),
and liquidation sales. Each piece has a real production path.

### D1. Shipping labels (sample → real carrier)

- **Today:** `lib/shipping.ts` generates clearly-marked **SAMPLE** labels — one
  page per carton (~48 units/carton), with demo tracking numbers and a faux
  barcode, printable to PDF. No carrier artwork or real tracking numbers.
- **Production:** call a carrier API (FedEx Ship Manager / Web Services, or a
  multi-carrier aggregator like EasyPost/Shippo) from the proxy to rate, buy,
  and render real labels (PDF/ZPL) with genuine tracking numbers. Persist the
  tracking number on the `TransferOrder`. The carton-splitting logic
  (`cartonCount`/`buildLabels`) stays; only the label source changes.

### D2. Transfer lifecycle + receiving

- **Today:** `TransfersContext` persists transfer orders with a status flow
  (Created → Picking → In transit → Received). Advancing/receiving is manual on
  the **Transfers** page or via the chat `receive_transfer_order` tool.
  Receiving applies the order's per-line `removals` as an overlay in
  `InventoryContext`, lowering the partner's on-hand.
- **Production:** drive status from D365 transfer-order ship/receive postings
  (read `TransferOrderHeaders`/`Lines` status, or subscribe to business events).
  Receiving posts the **arrival/receipt** against the transfer order, and the
  partner on-hand drops because D365 reflects it — the app just reads it.

### D3. Pick & ship from a BOL (roadmap)

The chat "pick & receive" is simulated. The intended build:

1. User uploads a **Bill of Lading** (PDF/CSV/EDI 856 ASN).
2. Parse it (document AI / EDI parser in the proxy) into picked quantities.
3. Reconcile picked vs. expected on the transfer order; post the actual
   receipt to D365 and flag short/over-ships.

Wire point: replace the `receiveTransfer` simulation with a BOL upload +
parse + post step; the `removals` become the parsed picked quantities rather
than the full expected quantity.

### D4. Liquidation to discount retailers

- **Today:** the chat `sell_inventory` tool proposes a sale (e.g. "sell
  Nordstrom's inventory to Marshalls at 30% margin" → sale price = cost × 1.30),
  and on confirm records a `LiquidationSale` and removes the inventory. Shown on
  the Transfers page with cost vs. sale value.
- **Production:** turn the confirmed sale into a **D365 sales order** to the
  discount customer (pricing = cost + margin, or a trade agreement), reserve/
  ship against it, and optionally send an EDI **850/855** to the buyer.
  Decide the margin convention with finance (cost-plus markup vs. gross-margin
  target) — the app currently uses cost-plus markup.

---

### Alignment to the D365 Supplier Communication Agent

This app mirrors that agent's pattern — *read context → draft a communication →
take an ERP action on confirmation* — but for **outbound consignment to retail
partners** instead of inbound supply. If/when this graduates from a standalone
demo into the platform, the natural home is a Power Apps / Dataverse-hosted
agent reusing the same `D365Service` contract and the same email composer.
