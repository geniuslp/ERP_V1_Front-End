// Petty cash requisition (ใบเบิกเงินสดย่อย) — request for cash reimbursement/advance to buy
// materials for one or more projects. NOT a stock-issue document: mat_code on each line is
// reference-only (material picker / stock_on_hand display), nothing here deducts stock.
//
// One document can span multiple projects: project_code lives on each LINE
// (petty_cash_requisition_line.project_code, NOT NULL), never on the header — the header has
// no project_code column at all. See erp-api/internal/handlers/petty_cash.go for the
// authoritative shape.

export type PettyCashStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface PettyCashLine {
  id: number
  pc_id: number
  line_no: number
  project_code: string
  mat_code: string
  cost_subgroup_id?: number | null
  description?: string | null
  qty: number
  unit_price: number
  discount: number
  disc_type: 'pct' | 'amt'
  line_discount: number
  line_vat: number
  line_wht: number
  line_net: number
  wht_rate?: number | null
  remarks?: string | null

  // Line-level amount + tax data. Nullable keys are omitted by the API when empty — read with ?? ''.
  // Old documents may have no `amount` (fall back to qty * unit_price).
  amount: number
  supplier_id?: number | null
  supplier_name?: string | null
  supplier_address?: string | null
  supplier_tax_id?: string | null
  has_tax_invoice?: boolean
  tax_invoice_no?: string | null
  tax_invoice_date?: string | null
  has_wht?: boolean
  wht_base_amount?: number | null
  tax_form_code?: string | null
  wht_income_type_id?: number | null
  wht_pay_date?: string | null
  // read-only response extras
  mat_name_th?: string | null
  cost_code?: string | null
  cost_group_name?: string | null
  cost_subgroup_name?: string | null
  wht_income_label?: string | null

  // display-only, joined at read time — resolved per-LINE from this line's own project_code.
  project_name?: string | null
  item_name?: string | null
  unit?: string | null
  stock_on_hand: number
}

export interface PettyCashAttachment {
  id: number
  file_name: string
  file_path: string // absolute URL
  file_size?: number | null
  file_type?: string | null
  uploaded_at?: string | null
  uploaded_by_name?: string | null
}

export interface PettyCashRequisition {
  id: number
  pc_no: string
  pc_date: string
  requested_by: number
  purpose?: string | null
  currency: string
  total_amount: number
  use_discount: boolean
  discount_type: 'pct' | 'amt'
  discount_amount: number
  use_vat: boolean
  vat_amount: number
  use_wht: boolean
  wht_amount: number
  net_amount: number
  status: PettyCashStatus
  approver_id?: number | null
  remarks?: string | null
  // Tab A header keys — NULL columns are omitted from responses (omitempty), always read with `?? ''`.
  doc_type?: string | null
  branch_code?: string | null
  payee_emp_code?: string | null
  payee_name?: string | null
  project_code?: string | null
  project_name?: string | null
  order_type?: string | null
  dept_code?: string | null
  dept_name?: string | null
  ref_doc_no?: string | null
  approver_remarks?: string | null
  created_at: string
  updated_at: string
  created_by: number
  updated_by?: number | null

  // aggregated (distinct, from every line) — the header itself has no single project
  project_codes?: string[] | null
  requested_by_name?: string | null
  approver_name?: string | null
  lines?: PettyCashLine[]
  attachments?: PettyCashAttachment[]
}

// Exactly the line keys the backend accepts (no qty / unit_price / discount / wht_rate).
export interface CreatePettyCashLineItem {
  project_code: string
  mat_code?: string
  description: string
  cost_subgroup_id?: number | null
  remarks: string
  amount: number
  supplier_id?: number | null
  supplier_name: string
  supplier_address: string
  supplier_tax_id: string
  has_tax_invoice: boolean
  tax_invoice_no: string
  tax_invoice_date: string // YYYY-MM-DD or ''
  has_wht: boolean
  wht_base_amount?: number | null
  tax_form_code: string
  wht_income_type_id?: number | null
  wht_pay_date: string // YYYY-MM-DD or ''
}

// GET /petty-cash/line-options
export interface PettyCashLineOptions {
  tax_forms: { code: string; label_th: string }[]
  wht_income_types: { id: number; code: string; label_th: string; rate: number }[]
  vat_rate: number
}

// Line as held in the create page's state (and edited by PettyCashLineModal).
export interface PettyCashLineForm {
  key: string
  /** Blank row appended by "เพิ่มรายการ"; cleared once the line modal is confirmed. Never sent to the backend. */
  isNew?: boolean
  id?: number
  project_code: string
  mat_code: string
  mat_name_th: string
  description: string
  cost_subgroup_id: number | null
  cost_code: string
  cost_group_name: string
  cost_subgroup_name: string
  remarks: string
  amount: number
  supplier_id: number | null
  supplier_name: string
  supplier_address: string
  supplier_tax_id: string
  has_tax_invoice: boolean
  tax_invoice_no: string
  tax_invoice_date: string
  has_wht: boolean
  wht_base_amount: number | null
  tax_form_code: string
  wht_income_type_id: number | null
  wht_income_label: string
  wht_rate: number | null
  wht_pay_date: string
  line_vat: number
  line_wht: number
  line_net: number
}

export interface CreatePettyCashRequest {
  purpose?: string
  currency?: string
  // Header flags/totals are derived server-side from the lines — no longer sent.
  use_discount?: boolean
  discount_type?: 'pct' | 'amt'
  discount_amount?: number
  use_vat?: boolean
  use_wht?: boolean
  approver_id?: number | null
  status?: 'DRAFT' | 'PENDING_APPROVAL'
  remarks?: string
  // Tab A — send ALL of these on every save (empty string clears the stored value).
  doc_type?: string
  branch_code?: string
  payee_emp_code?: string
  payee_name?: string
  project_code?: string
  project_name?: string
  order_type?: string
  dept_code?: string
  dept_name?: string
  ref_doc_no?: string
  lines: CreatePettyCashLineItem[]
}

export type UpdatePettyCashRequest = CreatePettyCashRequest

export interface PettyCashListFilter {
  status?: string
  // filters: document has at least one line with this project
  project_code?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

// POST /petty-cash/:id/submit → data
export interface PettyCashSubmitResult {
  id: number
  doc_no: string
  status: PettyCashStatus
  approver_id?: number | null
  approver_name?: string | null
}

// GET /petty-cash/:id/approval-chain → data. status is uppercase or null.
export interface PettyCashApprovalChain {
  doc_no: string
  approvers: {
    user_id: number
    employee_code?: string | null
    step_no: number
    full_name: string
    level?: string | number | null
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  }[]
}
