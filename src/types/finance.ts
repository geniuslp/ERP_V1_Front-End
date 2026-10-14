export type FinanceDocType = 'PO' | 'WO' | 'PC'

export const FINANCE_DOC_TYPE_LABEL: Record<FinanceDocType, string> = {
  PO: 'ใบสั่งซื้อ (PO)',
  WO: 'ใบสั่งงาน (WO)',
  PC: 'เงินสดย่อย',
}

export interface FinanceProject {
  project_code: string
  project_name?: string | null
}

export type ApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED'

export type ReceivingStatus = 'FULLY_RECEIVED' | 'PARTIALLY_RECEIVED' | 'NOT_RECEIVED'

export interface FinancePaymentListItem {
  id: number
  doc_no: string
  doc_type: FinanceDocType
  project_code: string
  project_name?: string | null
  net_amount: number
  status: string
  // Document approval status shown on the finance list (filter param: status=PENDING_APPROVAL|APPROVED).
  approval_status?: ApprovalStatus
  paid_amount: number
  remaining_to_pay: number
  // Distinct projects of the document: 1 for PO/WO, possibly several for petty cash (PC).
  project_count?: number
  projects?: FinanceProject[]
  // Live-computed from GRN vs PO lines — null for WO rows (doc_type === 'WO').
  receivingStatus: ReceivingStatus | null
  // Backend's can_record_payment (false while nothing has been received); absent on older responses.
  canRecordPayment?: boolean
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
  // Save-plan-and-pay in one request: full current installments plus the selected installment_no list.
  installments?: SaveInstallmentRow[]
  installment_numbers?: number[]
}

export interface FinanceInstallment {
  id: number
  installment_no: number
  percent: number
  amount: number
  description?: string | null
  is_paid: boolean
  paid_at?: string | null
  paid_by_name?: string | null
  payment_log_id?: number | null
}

export interface FinanceInstallmentsResult {
  net_amount: number
  installments_sum: number
  installments: FinanceInstallment[]
}

export interface SaveInstallmentRow {
  id?: number
  percent: number
  amount: number
  description: string
}
