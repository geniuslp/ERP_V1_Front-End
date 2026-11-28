export type DiscType = 'pct' | 'amt'

// Shared by the PO create/edit form (POItemsTable) and the print template
// (PurchaseOrderPrint) so per-line disc_type math can't drift out of sync
// between the two again.
export function calcDisc(lineAmt: number, disc: number, discType: DiscType): number {
  const d = discType === 'pct' ? lineAmt * (disc / 100) : disc
  return Math.min(d, lineAmt)
}

export interface AmtDiscLine {
  discType?: DiscType | null
  disc: number
  qty: number
  unitPrice: number
}

// Sums only amt-type per-line discounts (capped per-line at that line's own
// amount) — pct-type discounts are deliberately excluded here since those
// apply directly to their own line's Total instead (see calcDisc/lineAmt in
// PurchaseOrderPrint.tsx). Used both by the print view's "Special Discount"
// summary and POApprovalDetailPage's "ส่วนลด" info-grid field so the two
// can't drift out of sync on what counts as a header-level discount.
export function sumLineAmtDiscounts(lines: AmtDiscLine[]): number {
  return lines.reduce(
    (s, l) => s + (l.discType === 'amt' ? Math.min(l.disc, l.qty * l.unitPrice) : 0),
    0,
  )
}

// ── Special Discount (end-of-bill, step 2 of the stepped discount) ─────────────
// Mirrors erp-api internal/handlers/po_calc.go calcPOLines: a % of, or a baht amount off, the
// total left AFTER the line discounts, split EQUALLY over the lines (rounded to satang, the
// last line takes the remainder). avg = the share is shown inside each line's discount;
// otherwise the whole amount is its own row under the table. VAT / WHT / net per line are
// always after both discounts.
export interface SpecialDiscount {
  type: DiscType
  value: number
  avg: boolean
}

const r2 = (v: number) => Math.round(v * 100) / 100

export function calcSpecialAllocs(
  afterLineDisc: number[],
  sp: SpecialDiscount,
): { special: number; allocs: number[]; error?: string } {
  const n = afterLineDisc.length
  const allocs = new Array<number>(n).fill(0)
  if (!sp.value || sp.value <= 0 || n === 0) return { special: 0, allocs }
  const base = afterLineDisc.reduce((s, v) => s + v, 0)
  const special = r2(sp.type === 'pct' ? (base * Math.min(sp.value, 100)) / 100 : sp.value)
  if (special > r2(base)) return { special, allocs, error: 'Special Discount มากกว่ายอดหลังหักส่วนลดรายการ' }
  const share = r2(special / n)
  for (let i = 0; i < n; i++) {
    allocs[i] = i === n - 1 ? r2(special - share * (n - 1)) : share
    if (sp.avg && afterLineDisc[i] - allocs[i] < -0.005) {
      return { special, allocs, error: `Special Discount ที่เฉลี่ยลงรายการที่ ${i + 1} มากกว่ามูลค่าคงเหลือของรายการนั้น` }
    }
  }
  return { special, allocs }
}
