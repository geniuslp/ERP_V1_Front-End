export type WOStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export type WOContractType = 'LABOR_MATERIAL' | 'LABOR_ONLY'

// P/E/S per the paper form's "งานระบบ" field — code meaning not yet confirmed by
// backend/CLAUDE.md beyond the letters themselves; labels below are a best-guess
// placeholder (Plumbing / Electrical / Structural-Sanitary), flag for confirmation
// before relying on them elsewhere.
export type WOWorkSystem = 'P' | 'E' | 'S'

export const WO_WORK_SYSTEM_LABEL: Record<WOWorkSystem, string> = {
  P: 'P - งานระบบสุขาภิบาล/ประปา',
  E: 'E - งานระบบไฟฟ้า',
  S: 'S - งานโครงสร้าง',
}

// ⚠️ Starting assumption based on common contract types, NOT confirmed against actual
// business usage — flag back for review/adjustment before this ships as final.
export type WOContractDescriptionType =
  | 'RENOVATION'
  | 'NEW_CONSTRUCTION'
  | 'REPAIR'
  | 'MAINTENANCE'
  | 'INSTALLATION'
  | 'DEMOLITION'

export const WO_CONTRACT_DESCRIPTION_LABEL: Record<WOContractDescriptionType, string> = {
  RENOVATION: 'งานปรับปรุง',
  NEW_CONSTRUCTION: 'งานก่อสร้างใหม่',
  REPAIR: 'งานซ่อมแซม',
  MAINTENANCE: 'งานบำรุงรักษา',
  INSTALLATION: 'งานติดตั้ง',
  DEMOLITION: 'งานรื้อถอน',
}

// Submit-payload shape for one cost-code line item — mostly mirrors PO's line
// submit shape (mat_code/qty_ordered/unit_price/disc_type/wht_rate in
// POCreatePage's buildPayload) with cost_code standing in for mat_code, EXCEPT
// the discount field: WorkOrderLineInput (erp-api models.go) uses json key
// `disc`, not `discount` like PO's CreatePOLine — a genuine backend
// inconsistency between the two modules, not something to "fix" by renaming
// the Go struct. Silently dropped every WO line discount pre-fix since Go
// ignores unrecognized JSON keys instead of erroring.
export interface WorkOrderLine {
  line_no: number
  cost_code: string
  description?: string
  qty: number
  unit_price: number
  disc?: number
  disc_type?: 'pct' | 'amt'
  wht_rate?: number | null
}

export interface WOListItem {
  id: number
  wo_no: string
  wo_date: string
  employer_name: string
  supplier_code: string
  supplier_name?: string
  contract_amount: number
  status: WOStatus
  created_by_name?: string
  created_at: string
  updated_at: string
}

export interface WorkOrder {
  id: number
  wo_no: string
  wo_date: string
  ref_no?: string

  employer_name: string
  project_scope_text?: string
  supplier_code: string
  supplier_name?: string
  contact_person?: string
  supplier_address?: string
  supplier_phone?: string

  contract_type: WOContractType
  work_system: WOWorkSystem
  contract_description?: WOContractDescriptionType | string

  contract_amount: number
  vat_rate: number
  wht_rate: number

  advance_pct?: number
  advance_amount?: number
  progress_payment_note?: string
  retention_pct?: number
  advance_deduct_pct?: number
  other_deduction_note?: string

  start_date?: string
  duration_days?: number
  end_date?: string
  penalty_pct_per_day?: number
  warranty_years?: number

  // ── Cost-code line items (mirrors PO's use_discount/discount_type/use_vat/
  // use_wht header flags + per-line discount/wht_rate — see WorkOrderLine) ──
  use_discount?: boolean
  discount_type?: 'pct' | 'amt'
  use_vat?: boolean
  use_wht?: boolean
  lines?: WorkOrderLine[]

  other_terms?: string

  status: WOStatus
  approver_id?: number
  approver_name?: string
  approved_at?: string
  rejected_reason?: string

  created_by_name?: string
  created_at: string
  updated_at: string
}

export interface WOListParams {
  wo_no?: string
  employer_name?: string
  supplier?: string
  status?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export interface WOListResult {
  items: WOListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Everything the create/edit form collects, sent as-is to POST/PUT /work-order.
export type WorkOrderPayload = Omit<
  WorkOrder,
  'id' | 'status' | 'approver_id' | 'approver_name' | 'approved_at' | 'rejected_reason' |
  'created_by_name' | 'created_at' | 'updated_at' | 'supplier_name'
>
