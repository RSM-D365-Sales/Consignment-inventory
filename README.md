# Vince · Consignment Inventory Agent

A demo web application modeled after the **D365 Finance & Supply Chain Supplier
Communication Agent**, retargeted to manage **consignment inventory** — stock
that Vince owns but that physically sits at retail partners (Nordstrom, Saks
Fifth Avenue, Macy's, Bloomingdale's, …).

Each retail partner is treated as a **virtual warehouse**. The app gives Vince
wholesale operations a visual queue of what's held where, and an agent workflow
that drafts an end-of-season reconciliation email and, on confirmation, creates
a D365 **transfer order** to bring the remaining stock back to the main DC.

> **Status:** demo build. Runs entirely on bundled **mock data** out of the box,
> with a documented seam to a **live D365** connection (see
> [`docs/FUTURE-INTEGRATION.md`](docs/FUTURE-INTEGRATION.md)).

---

## What it does

| Screen | Purpose |
| --- | --- |
| **Inventory Queue** (landing) | A visual, ranked queue of every partner's consignment position. One toggle flips the whole board between **Dollars** and **Units**. Filter by season; see portfolio composition by category. |
| **Customer detail** | Drill into one partner: KPIs, category/season breakdowns, and the full on-hand line list. |
| **Season Return** | The agent workflow. Pick a partner + season → the agent drafts a reconciliation email → review/edit → **Confirm & create transfer order**. Also generates **sample FedEx shipping labels** (1 page/carton) printable to PDF. |
| **Transfers** | Tracks every return transfer order through its lifecycle (Created → Picking → In transit → Received) and lists liquidation sales. **Receiving lowers the partner's on-hand inventory.** Reprint labels per order. |
| **Setup** | Map each partner to its D365 warehouse, set the main DC, enter the D365 environment details, switch between **Demo (mock)** and **Live (D365)** data, and configure the chat **Assistant**. |
| **Assistant** (right-side chat) | Ask natural-language questions about the inventory ("compare partners by units", "what does Saks hold in knitwear?") and drive actions ("draft the Fall return for Nordstrom"). A **tool-calling agent** — answers are grounded in the same data, never hallucinated. |

## The core agent flow

1. Operations selects a retail partner and the season to close out.
2. The agent reads the on-hand consignment inventory D365 shows at that
   partner's warehouse and **drafts a reconciliation email** (editable subject
   and intro, with a line-item table that totals units and extended value).
3. On **Confirm & create transfer order**, the app calls the D365 service to
   create a transfer order **from the partner warehouse → main DC** and shows
   the assigned transfer-order number.
4. Send options for the email: **copy text**, **open in Outlook (mailto)**, and
   a roadmapped **Microsoft Graph draft** path.

## The chat assistant

The right-side **Consignment Assistant** is a **tool-calling agent**, not RAG —
the model calls typed tools ([agentTools.ts](src/lib/agentTools.ts)) that run
the same aggregation logic the app uses, so every number is grounded.

- **Heuristic mode** (default): an offline rule-based router — no key, always
  works. Ideal for demos.
- **Azure OpenAI mode**: natural-language chat via your Azure AI Foundry
  deployment, with function calling and **true SSE token streaming**. Enable it
  in **Setup → Assistant** (BYO-key, demo only).
- **Actions stay human-in-the-loop:** "draft the Nordstrom return", "receive
  TO-…", and "sell Saks' inventory to Marshalls at 30%" each propose a card;
  an explicit click executes (create order / pick & receive / record sale).

Production should route chat through an Azure Function proxy (key stays
server-side) — see [docs/FUTURE-INTEGRATION.md](docs/FUTURE-INTEGRATION.md), Track C.

## Tech

- **React 18 + TypeScript + Vite**
- **HashRouter** so deep links work on GitHub Pages with no server rewrites
- No backend — a `D365Service` interface is the single seam between the UI and
  data. `MockD365Service` powers the demo; `LiveD365Service` is the documented
  scaffold for the real OData integration.
- Tool-calling chat agent with a heuristic (offline) and Azure OpenAI (SSE
  streaming) transport behind a shared tool layer.
- Vince-inspired design system (custom CSS tokens; Cormorant Garamond + Jost).

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build locally
```

## Deploy to GitHub Pages

A workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
builds and publishes `dist/` on every push to `main`.

1. Create a GitHub repo and push this project.
2. In **Settings → Pages**, set **Source = GitHub Actions**.
3. Push to `main`. The site publishes to your Pages URL.

The Vite `base` is `./` (relative) and routing uses `HashRouter`, so the build
works at any Pages path (project site, user site, or custom domain) without a
rebuild.

## Switching to live D365

Open **Setup → Data source → Live · D365 F&SC**. The live connector is a
documented scaffold — it intentionally throws until the OAuth + OData path is
implemented. The full runbook (auth options, OData entities, CORS, transfer
order POST shape) is in [`docs/FUTURE-INTEGRATION.md`](docs/FUTURE-INTEGRATION.md).

## Project layout

```
src/
  models/        types.ts (domain) · config.ts (settings + mappings + agent) · chat.ts
  data/          mockData.ts (Vince consignment sample dataset)
  services/      d365Service.ts (interface) · mock / live impls · factory
  context/       ConfigContext · InventoryContext · ChatContext
  lib/           aggregations · format · emailDraft
                 agentTools (shared tools) · heuristicAgent · azureAgent
  components/    layout · charts · queue card · inventory table · email preview
                 chat/ (ChatPanel · DraftCard)
  pages/         Dashboard · CustomerDetail · SeasonReturn · Setup
  styles/        theme.css (tokens) · app.css (layout + components)
```

## Notes & disclaimers

- Sample data is fictional and generated deterministically for a stable demo.
- "Vince", "Nordstrom", "Saks Fifth Avenue", "Macy's", and "Bloomingdale's" are
  used illustratively for a presales demonstration.
- Partner logos are fetched at runtime by the browser from third-party
  logo/favicon services (by domain) for illustration — no logo files are
  bundled or stored. If a logo can't be resolved, the app falls back to a
  colored monogram.
