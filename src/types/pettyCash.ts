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
  amount: number
  discount: number
  disc_type: 'pct' | 'amt'
  line_discount: number
  line_vat: number
  line_wht: number
  line_net: number
  wht_rate?: number | null
  remarks?: string | null

  // display-only, joined at read time — resolved per-LINE from this line's own project_code.
  project_name?: string | null
  item_name?: string | null
  unit?: string | null
  stock_on_hand: number
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
  created_at: string
  updated_at: string
  created_by: number
  updated_by?: number | null

  // aggregated (distinct, from every line) — the header itself has no single project
  project_codes?: string[] | null
  requested_by_name?: string | null
  approver_name?: string | null
  lines?: PettyCashLine[]
}

export interface CreatePettyCashLineItem {
  project_code: string
  mat_code: string
  cost_subgroup_id?: number | null
  description?: string
  qty: number
  unit_price: number
  discount?: number
  disc_type?: 'pct' | 'amt'
  wht_rate?: number | null
  remarks?: string | null
}

export interface CreatePettyCashRequest {
  purpose?: string
  currency?: string
  use_discount: boolean
  discount_type: 'pct' | 'amt'
  discount_amount?: number
  use_vat: boolean
  use_wht: boolean
  approver_id?: number | null
  status?: 'DRAFT' | 'PENDING_APPROVAL'
  remarks?: string
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
