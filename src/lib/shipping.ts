/**
 * Sample shipping-label generation for the demo.
 *
 * These produce illustrative, clearly-marked SAMPLE labels — they are not
 * genuine carrier labels and contain no real tracking numbers or carrier
 * artwork. The production path (real FedEx Ship Manager / carrier API labels,
 * or BOL-driven labels) is documented in docs/FUTURE-INTEGRATION.md.
 */

export const UNITS_PER_CARTON = 48
export const MAX_CARTONS = 16
export const CARRIER = 'FedEx Ground'

/** Cartons needed for a shipment, bounded for a tidy demo. */
export function cartonCount(totalUnits: number): number {
  return Math.min(
    MAX_CARTONS,
    Math.max(1, Math.ceil(totalUnits / UNITS_PER_CARTON)),
  )
}

export interface LabelInput {
  fromName: string
  fromWarehouse: string
  toName: string
  toWarehouse: string
  totalUnits: number
  /** Transfer order number, or "DRAFT" before one is created. */
  reference: string
  /** Stable seed (e.g. derived from the reference) for deterministic numbers. */
  seed: number
  dateLabel: string
}

export interface ShippingLabel {
  carton: number
  cartons: number
  fromName: string
  fromWarehouse: string
  toName: string
  toWarehouse: string
  units: number
  weightLb: number
  tracking: string
  reference: string
  service: string
  dateLabel: string
  /** Deterministic bar widths (1–3 px) for the faux barcode. */
  bars: number[]
}

function hash(n: number): number {
  const x = Math.sin(n) * 10000
  return x - Math.floor(x)
}

/** A demo tracking-style number (12 digits) — NOT a real carrier number. */
function trackingNumber(seed: number, carton: number): string {
  let s = ''
  for (let i = 0; i < 12; i++) {
    s += Math.floor(hash(seed + carton * 17 + i * 7) * 10)
  }
  return s.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')
}

function barWidths(seed: number, carton: number): number[] {
  return Array.from({ length: 48 }, (_, i) => {
    const r = hash(seed + carton * 31 + i)
    return r > 0.7 ? 3 : r > 0.4 ? 2 : 1
  })
}

export function buildLabels(input: LabelInput): ShippingLabel[] {
  const cartons = cartonCount(input.totalUnits)
  const baseUnits = Math.floor(input.totalUnits / cartons)
  const remainder = input.totalUnits - baseUnits * cartons

  return Array.from({ length: cartons }, (_, i) => {
    const carton = i + 1
    // Spread the remainder across the first few cartons.
    const units = baseUnits + (i < remainder ? 1 : 0)
    // ~0.55 lb per garment + ~1.5 lb carton tare.
    const weightLb = Math.round(units * 0.55 + 1.5)
    return {
      carton,
      cartons,
      fromName: input.fromName,
      fromWarehouse: input.fromWarehouse,
      toName: input.toName,
      toWarehouse: input.toWarehouse,
      units,
      weightLb,
      tracking: trackingNumber(input.seed, carton),
      reference: input.reference,
      service: CARRIER,
      dateLabel: input.dateLabel,
      bars: barWidths(input.seed, carton),
    }
  })
}

/** Stable seed from a reference string. */
export function seedFromString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000
  return h + 1
}

// --- Print-to-PDF -----------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  )
}

/**
 * Open the labels in a print window so the user can Save as PDF / print.
 * Self-contained HTML + inline styles; clearly watermarked as a sample.
 */
export function printLabels(labels: ShippingLabel[]): void {
  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) return

  const pages = labels
    .map((l) => {
      const bars = l.bars
        .map((w) => `<span class="bar" style="width:${w}px"></span>`)
        .join('')
      return `
      <div class="label">
        <div class="watermark">SAMPLE · NOT A REAL SHIPPING LABEL</div>
        <div class="hd">
          <div class="carrier">FedEx</div>
          <div class="svc">${escapeHtml(l.service)}</div>
        </div>
        <div class="addr">
          <div class="block"><div class="k">FROM</div><div class="v">${escapeHtml(
            l.fromName,
          )}</div><div class="wh">Warehouse ${escapeHtml(
            l.fromWarehouse,
          )}</div></div>
          <div class="block"><div class="k">SHIP TO</div><div class="v">${escapeHtml(
            l.toName,
          )}</div><div class="wh">Warehouse ${escapeHtml(
            l.toWarehouse,
          )}</div></div>
        </div>
        <div class="big">CARTON ${l.carton} OF ${l.cartons}</div>
        <div class="meta">
          <span>${l.units} units</span><span>${l.weightLb} lb</span>
          <span>Ref ${escapeHtml(l.reference)}</span><span>${escapeHtml(
            l.dateLabel,
          )}</span>
        </div>
        <div class="barcode">${bars}</div>
        <div class="track">${escapeHtml(l.tracking)}</div>
      </div>`
    })
    .join('')

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"/>
  <title>Sample shipping labels</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; background:#fff; color:#111; }
    .label { position: relative; width: 4in; min-height: 6in; margin: 0.4in auto; border: 2px solid #111; padding: 16px; page-break-after: always; overflow: hidden; }
    .watermark { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; transform: rotate(-24deg); font-size: 20px; font-weight:700; letter-spacing:2px; color: rgba(180,30,30,0.12); pointer-events:none; }
    .hd { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #111; padding-bottom:8px; }
    .carrier { font-size:30px; font-weight:800; letter-spacing:-1px; }
    .svc { font-size:12px; font-weight:700; text-transform:uppercase; }
    .addr { display:flex; gap:12px; margin-top:12px; }
    .block { flex:1; }
    .k { font-size:9px; letter-spacing:1px; color:#555; }
    .v { font-size:15px; font-weight:700; }
    .wh { font-size:11px; color:#333; }
    .big { margin:14px 0; font-size:26px; font-weight:800; text-align:center; border-top:1px solid #111; border-bottom:1px solid #111; padding:10px 0; }
    .meta { display:flex; flex-wrap:wrap; gap:6px 14px; font-size:11px; color:#222; }
    .barcode { display:flex; align-items:flex-end; gap:1px; height:64px; margin-top:16px; }
    .barcode .bar { display:block; height:100%; background:#111; }
    .track { text-align:center; font-family: 'Courier New', monospace; font-size:15px; letter-spacing:2px; margin-top:6px; }
    @media print { .label { margin: 0 auto; } }
  </style></head><body>${pages}
  <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
  </body></html>`)
  win.document.close()
}
