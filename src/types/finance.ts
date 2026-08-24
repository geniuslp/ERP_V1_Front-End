export type FinanceDocType = 'PO' | 'WO'

export interface FinancePaymentListItem {
  id: number
  doc_no: string
  doc_type: FinanceDocType
  project_code: string
  net_amount: number
  status: string
  paid_amount: number
  remaining_to_pay: number
}

export interface FinancePaymentListParams {
  doc_type: FinanceDocType
  project_code?: string
  status?: string
  search?: string
  page?: number
  page_size?: number
}

export interface FinancePaymentListResult {
  items: FinancePaymentListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface FinancePaymentLogEntry {
  id: number
  doc_type: FinanceDocType
  doc_id: number
  doc_no: string
  amount_paid: number
  paid_date: string
  paid_by: number
  paid_by_name: string
  remark?: string
  reverses_id?: number | null
  created_at: string
  created_by: number
}

export interface RecordPaymentPayload {
  doc_type: FinanceDocType
  doc_id: number
  amount_paid: number
  paid_date?: string
  paid_by: number
  remark?: string
  reverses_id?: number
}
