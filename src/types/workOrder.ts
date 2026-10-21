export type WOStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PENDING_REAPPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export type WOContractType = 'LABOR_MATERIAL' | 'LABOR_ONLY' | 'RENTAL' | 'SERVICE'

// "สัญญาประเภท" — order here is the dropdown order. Single label map shared by the form,
// detail page and both print templates.
export const WO_CONTRACT_TYPE_OPTIONS: { value: WOContractType; label: string }[] = [
  { value: 'LABOR_MATERIAL', label: 'รับเหมาทั้งค่าของค่าแรง' },
  { value: 'LABOR_ONLY', label: 'รับเหมาค่าแรงอย่างเดียว' },
  { value: 'RENTAL', label: 'ค่าเช่า' },
  { value: 'SERVICE', label: 'ค่าบริการ' },
]
export const WO_CONTRACT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  WO_CONTRACT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

// New/edited documents store M-prefixed job codes (MP, ME, ... — names come from
// GET /master/job-types). P/E/S are legacy values on old documents: still displayed.
export type WOWorkSystem = string

export const WO_WORK_SYSTEM_LABEL: Record<string, string> = {
  P: 'P - งานระบบสุขาภิบาล/ประปา',
  E: 'E - งานระบบไฟฟ้า',
  S: 'S - งานโครงสร้าง',
}

// work_system is an array on the API (older code treated it as a scalar). Renders every
// entry as "CODE - name" (names from /master/job-types), legacy P/E/S via the map above,
// unknown codes as-is.
export const formatWorkSystem = (v: unknown, names: Record<string, string> = {}): string => {
  const list: string[] = Array.isArray(v) ? v : v ? [String(v)] : []
  return list
    .map((code) => (names[code] ? `${code} - ${names[code]}` : WO_WORK_SYSTEM_LABEL[code] ?? code))
    .join(', ')
}

// Project is either an existing project (project_code + joined project_name) or free text
// (project_name_text). project_scope_text is the pre-change fallback.
export const formatWOProject = (wo: {
  project_code?: string | null
  project_name?: string | null
  project_name_text?: string | null
  project_scope_text?: string | null
}): string => {
  if (wo.project_code) return [wo.project_code, wo.project_name].filter(Boolean).join(' ')
  return wo.project_name_text || wo.project_scope_text || ''
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
  supplier_code?: string | null
  supplier_name?: string
  contract_amount: number
  status: WOStatus
  // How many times this WO was edited-and-resent after approval; 0/undefined = original.
  revision_round?: number
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
  project_code?: string | null
  project_name?: string | null
  // Free-text project; exactly one of project_code / project_name_text is set.
  project_name_text?: string | null
  project_scope_text?: string
  // work_order has no supplier_code anymore — responses return it as null and
  // requests must send supplier_id only (never supplier_code).
  supplier_code?: string | null
  supplier_id?: number | null
  supplier_name?: string
  contact_person?: string
  supplier_address?: string
  supplier_phone?: string

  contract_type: WOContractType
  work_system: WOWorkSystem[]
  contract_description?: string | null

  contract_amount: number
  vat_rate: number
  wht_rate: number

  advance_pct?: number
  advance_amount?: number
  progress_payment_note?: string
  retention_pct?: number
  advance_deduct_pct?: number
  advance_deduct_amount?: number
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
  revision_round?: number
  approver_id?: number
  approver_name?: string
  approved_at?: string
  rejected_reason?: string

  created_by_name?: string
  created_at: string
  updated_at: string
}

// ─── Payment Conditions (installments / retention / penalty) ───────────────
// Mirrors erp-api's WorkOrderPaymentInstallment/WorkOrderRetention/WorkOrderPenalty
// response shapes and their *Input submit shapes exactly (models.go). Each array
// is a full-replace: GET /work-order/:woId/payment-conditions returns the current
// state, POST replaces all 3 tables wholesale (rows with `id` are updated, rows
// without are inserted, rows missing from the submitted array are deleted).
export type WOPaymentStatus = 'UNPAID' | 'PAID'

export const WO_PAYMENT_STATUS_LABEL: Record<WOPaymentStatus, string> = {
  UNPAID: 'ยังไม่จ่าย',
  PAID: 'จ่ายแล้ว',
}

export interface WOPaymentInstallment {
  id?: number
  installment_no: number
  description?: string | null
  percent_of_contract?: number | null
  amount: number
  due_date?: string | null
  payment_status: WOPaymentStatus
  paid_date?: string | null
  remarks?: string | null
}

export interface WOPaymentRetention {
  id?: number
  description?: string | null
  percent_of_contract?: number | null
  amount: number
  remarks?: string | null
}

export interface WOPaymentPenalty {
  id?: number
  description?: string | null
  percent_per_day?: number | null
  contract_start_date?: string | null
  contract_end_date?: string | null
  remarks?: string | null
}

export interface WOPaymentConditions {
  installments: WOPaymentInstallment[]
  retentions: WOPaymentRetention[]
  penalties: WOPaymentPenalty[]
}

export interface WOListParams {
  wo_no?: string
  employer_name?: string
  supplier?: string
  status?: string
  // Approval list only: restrict to documents assigned to the current approver.
  my_approvals?: boolean
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
  'id' | 'status' | 'revision_round' | 'approver_name' | 'approved_at' | 'rejected_reason' |
  'created_by_name' | 'created_at' | 'updated_at' | 'supplier_name' | 'supplier_code' | 'project_name'
>
