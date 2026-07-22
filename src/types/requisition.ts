// Material Requisition module (ใบขอเบิกวัสดุ) — distinct from the existing physical
// borrow/return lifecycle in `@/types/stock` (BORROWED/RETURNED). This flow is
// DRAFT → PENDING_APPROVAL → APPROVED/REJECTED only, backed by `GET/POST /borrow`.
// Routed separately at /stock/requisition/* to avoid colliding with the existing
// /stock/borrow/* module — see conversation decision before assuming these merge.

export type RequisitionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'

export interface RequisitionListItem {
  borrow_id: number
  borrow_no: string
  borrow_date: string
  borrower_name: string
  warehouse_code: string
  purpose?: string
  status: RequisitionStatus
  line_count: number
  total_qty_requested: number
}

export interface RequisitionLine {
  borrow_line_id?: number
  line_no?: number
  stock_item_id: number
  mat_code: string
  item_name: string
  mat_type: string
  unit: string
  qty_requested: number
  qty_approved?: number
  current_qty?: number
}

export interface RequisitionStatusLog {
  from_status?: string
  to_status: string
  changed_by_name: string
  changed_at: string
  remarks?: string
}

export interface RequisitionDetail {
  borrow_id: number
  borrow_no: string
  borrow_date: string
  expected_return?: string
  borrower_id: number
  borrower_name: string
  warehouse_code: string
  purpose?: string
  status: RequisitionStatus
  approved_by?: number
  approved_by_name?: string
  approved_at?: string
  remarks?: string
  lines: RequisitionLine[]
  status_log: RequisitionStatusLog[]
}

export interface StockItemOption {
  stock_item_id: number
  mat_code: string
  item_name: string
  mat_type: string
  unit: string
  current_qty: number
}

export const REQUISITION_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
}

export const REQUISITION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'ร่าง',
  PENDING_APPROVAL: 'รอการอนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
}
