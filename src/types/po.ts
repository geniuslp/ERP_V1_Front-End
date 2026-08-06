export type POStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING_REAPPROVAL'
  | 'SENT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'

// Split out of the combined `status` above per the 2026-07-27 session decision:
// purchase_order now has status (approval) and status_receive (receiving) as
// two independent columns. See CLAUDE.md "หน้า รับเข้า (GRN receiving)".
export type POReceiveStatus = 'NOT_SENT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED'

export interface POListItem {
  po_id: number
  po_no: string
  po_date: string
  status: POStatus
  // Optional: not confirmed present on every PO endpoint yet — the
  // status/status_receive split is confirmed only for the new GRN receiving
  // flow (GET /po/receivable) as of the 2026-07-27 session. Render
  // defensively via <POStatusBadges> until backend confirms it's everywhere.
  status_receive?: POReceiveStatus
  supplier_code: string
  supplier_name?: string
  total_amount: number
  vat_amount: number
  net_amount: number
  currency: string
  expected_date?: string
  created_at: string
  updated_at: string
  // Not in the confirmed list response fields — kept optional since
  // POMyListPage still reads it defensively; unverified on this endpoint.
  can_edit_approved?: boolean
}

export interface POLine {
  id: number
  line_no: number
  mat_code: string
  qty_ordered: number
  qty_received: number
  unit_price: number
  amount: number
  status: string
  remarks?: string
  mat_name?: string
  unit_name?: string
  brand?: string
  spec?: string
  group_name?: string
  subgroup_name?: string
  pr_line_id?: number | null
  discount?: number
  disc_type?: 'pct' | 'amt'
  wht_rate?: number | null
}

export interface PODetail {
  po_id: number
  po_no: string
  po_date: string
  status: POStatus
  status_receive?: POReceiveStatus
  // Links this PO back to the PR it was created from — same fields already
  // confirmed present on GET /po/:id via POCreatePage's edit-load path.
  pr_id?: number
  pr_no?: string
  supplier_code: string
  supplier_name: string
  payment_terms: string | null
  delivery_address: string | null
  warehouse_code: string | null
  currency: string
  total_amount: number
  vat_amount: number
  net_amount: number
  expected_date: string | null
  remarks: string | null
  created_by_name: string
  lines: POLine[]
  // true when status=APPROVED and the PO is under 1 year old — confirmed
  // present on GET /po/:id this session.
  can_edit_approved?: boolean
  approver_id?: number
  approver_name?: string
  use_discount?: boolean
  discount_type?: 'pct' | 'amt'
  discount_amount?: number
  use_vat?: boolean
  use_wht?: boolean
  wht_amount?: number
  // Live-joined from `supplier` via supplier_code, never stored on purchase_order —
  // read-only, must not appear in any edit/create form.
  office_phone?: string
  fax?: string
  sales_person?: string
  contact_email?: string
  contact_phone?: string
}

export interface POLineItem {
  key: string
  no: number
  pr_line_id: number | null
  mat_code: string
  mat_name: string
  unit_name: string
  qty: number
  unit_price: number
  is_from_pr: boolean
  description?: string
  disc?: number
  disc_type?: 'pct' | 'amt'
  wht_rate?: 1 | 3 | 5 | null
}

export interface AvailablePR {
  pr_id: number
  pr_no: string
  status: string
  requested_by_name?: string
  created_at: string
}

export interface MaterialSearchResult {
  mat_code: string
  mat_name: string
  unit: string
  last_price?: number | null
}

export interface POListResponse {
  success: boolean
  data: { data: POListItem[]; total: number; page: number; page_size: number; total_pages: number }
}

export interface PODetailResponse {
  success: boolean
  data: PODetail
}
