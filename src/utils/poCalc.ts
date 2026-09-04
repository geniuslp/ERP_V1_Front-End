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
