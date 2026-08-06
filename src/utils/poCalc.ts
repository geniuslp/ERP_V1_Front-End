export type DiscType = 'pct' | 'amt'

// Shared by the PO create/edit form (POItemsTable) and the print template
// (PurchaseOrderPrint) so per-line disc_type math can't drift out of sync
// between the two again.
export function calcDisc(lineAmt: number, disc: number, discType: DiscType): number {
  const d = discType === 'pct' ? lineAmt * (disc / 100) : disc
  return Math.min(d, lineAmt)
}
