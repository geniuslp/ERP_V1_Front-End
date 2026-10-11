// Tooltip text for the disabled Edit button; lists PO numbers when known and
// falls back to the generic message when the API sent none.
export const poLinkedTooltip = (poNos: string) =>
  poNos ? `ไม่สามารถแก้ไขได้ มี PO ผูกอยู่: ${poNos}` : PO_LINKED_EDIT_BLOCKED_MESSAGE

export const PO_LINKED_EDIT_BLOCKED_MESSAGE =
  'มี PO ผูกกับ PR นี้อยู่ ไม่สามารถแก้ไขได้ กรุณายกเลิกหรือปลด PO ก่อน'
