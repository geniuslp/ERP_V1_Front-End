// Warehouse Stock Transfer / Requisition module — new `stock_transfer` table, distinct
// from the existing Material Requisition module (@/types/requisition, backed by `/borrow`)
// which already owns the /stock/requisition/* routes. Routed at /stock/wh-requisition/*
// and /stock/wh-transfer/* instead, per conversation decision, to avoid colliding with
// that existing feature. Backend endpoints (`/stock-transfer/*`) may not be live yet —
// stockTransfer.service.ts falls back to mock data with this exact shape until then.

export type StockTransferType = 'WH_TO_PROJECT' | 'WH_TO_WH' | 'PROJECT_TO_WH'

export type StockTransferStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'

export const STOCK_TRANSFER_STATUS_COLOR: Record<StockTransferStatus, string> = {
  DRAFT: 'default',
  CONFIRMED: 'success',
  CANCELLED: 'default',
}

export const STOCK_TRANSFER_STATUS_LABEL: Record<StockTransferStatus, string> = {
  DRAFT: 'ร่าง',
  CONFIRMED: 'ยืนยันแล้ว',
  CANCELLED: 'ยกเลิก',
}

export interface StockTransferListItem {
  transfer_id: number
  transfer_no: string
  transfer_type: StockTransferType
  transfer_date: string
  from_warehouse_code?: string
  from_warehouse_name?: string
  from_project_code?: string
  from_project_name?: string
  to_warehouse_code?: string
  to_warehouse_name?: string
  to_project_code?: string
  to_project_name?: string
  requested_by_name: string
  status: StockTransferStatus
  checked_by_name?: string
  line_count: number
  is_stock_house?: boolean
  container_no?: string | null
}

export interface StockTransferLine {
  transfer_line_id?: number
  line_no?: number
  item_id?: number
  mat_code: string
  item_name: string
  unit: string
  qty_on_hand?: number
  qty_requested: number
  qty_confirmed?: number
  remarks?: string
}

export interface StockTransferStatusLog {
  from_status?: string
  to_status: StockTransferStatus
  changed_by_name: string
  changed_at: string
  remarks?: string
}

export interface StockTransferDetail {
  transfer_id: number
  transfer_no: string
  transfer_type: StockTransferType
  transfer_date: string
  from_warehouse_code?: string
  from_warehouse_name?: string
  from_project_code?: string
  from_project_name?: string
  to_warehouse_code?: string
  to_warehouse_name?: string
  to_project_code?: string
  to_project_name?: string
  purpose?: string
  status: StockTransferStatus
  requested_by_name: string
  checked_by_name?: string
  checked_at?: string
  is_stock_house?: boolean
  container_no?: string | null
  lines: StockTransferLine[]
  status_log: StockTransferStatusLog[]
}

export interface StockItemOption {
  item_id: number
  mat_code: string
  item_name: string
  unit: string
  qty_on_hand: number
}

export interface StockTransferCreatePayload {
  transfer_type: StockTransferType
  from_warehouse_code?: string
  to_warehouse_code?: string
  to_project_code?: string
  from_project_code?: string
  purpose?: string
  is_stock_house?: boolean
  container_no?: string | null
  lines: {
    item_id?: number
    mat_code: string
    unit: string
    qty_requested: number
    remarks?: string
  }[]
}

export interface StockTransactionHistoryItem {
  txn_id: number
  txn_date: string
  mat_code: string
  item_name: string
  from_location: string
  from_is_warehouse: boolean
  to_location: string
  to_is_warehouse: boolean
  qty: number
  ref_doc_type: string
  ref_doc_no?: string
  ref_doc_id?: number
  created_by_name: string
  // Set client-side by stockTransfer.service.ts#history to record which backend (REQUISITION
  // vs STOCK_TRANSFER) a merged row came from, since that determines its detail route.
  source_type?: 'REQUISITION' | 'STOCK_TRANSFER'
}

export interface ProjectStockBalanceItem {
  project_code: string
  project_name: string
  mat_code: string
  item_name: string
  unit: string
  qty_on_hand: number
}
