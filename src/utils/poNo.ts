// po_no itself never changes when a PO is edited-and-resent for re-approval —
// revision_round (COUNT of po_edit_log rows) increments instead. Compose the
// "#R{n}" display suffix here so every page that lists/shows a PO does it the
// same way; never show "#R0" for POs that have never been edited.
export const formatPoNoWithRevision = (poNo: string, revisionRound?: number | null): string =>
  revisionRound && revisionRound > 0 ? `${poNo} #R${revisionRound}` : poNo
