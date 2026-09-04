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
  supplier_id?: number
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
  created_by_name?: string
  // purchase_order.job_code — header-level "ประเภท Job" (shared 12-code
  // JOB_TYPES list with PR). Replaces the old work_type column; always
  // present on GET /po (never null). Distinct from the per-line derived
  // job_code on POLine below and from job_names (per-line display) below.
  job_code: string
  // Added for POStatusPage "Job" / "Last Edited By" columns (2026-08-07).
  // Backend returns job_name (not job_code) since this is display-only on
  // the PO list — deduplicated server-side but deduped defensively client-side too.
  job_names?: string[]
  updated_by_name?: string
  // Confirmed present on GET /po (list) as of this session — backend now
  // selects po.project_code directly (internal/handlers/po.go List).
  project_code?: string
  // NOT confirmed present on GET /po (list) as of 2026-08-07 — only seen on
  // PODetail so far. Used defensively for the "Amount (after-discount)"
  // column; verify the list SQL/handler actually selects this before relying
  // on it in production.
  discount_amount?: number
  // COUNT of po_edit_log rows for this PO — 0 if never edited-and-resent for
  // re-approval, confirmed present on GET /po (list) as of this session.
  revision_round?: number
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
  // cost_subgroup_id is the field actually persisted on purchase_order_line —
  // job_code is derived read-only server-side via cost_subgroup -> cost_group
  // -> cost_job (strict single-parent chain, confirmed this session).
  cost_subgroup_id?: number | null
  job_code?: string | null
  job_name?: string
}

export interface POAttachment {
  id: number
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  uploaded_by: number
  uploaded_at: string
}

export interface PODetail {
  po_id: number
  po_no: string
  po_date: string
  status: POStatus
  status_receive?: POReceiveStatus
  // Present in the raw GET /po/:id JSON (models.go's PurchaseOrder.CreatedAt,
  // json:"created_at") but never typed here before — needed client-side to
  // mirror the backend's 1-year edit-approved window (po.go's edit-approved
  // handler: `time.Since(createdAt) >= 365*24*time.Hour` → 400) for
  // PENDING_REAPPROVAL POs, since `can_edit_approved` (po.go:488) is only
  // computed for status=="APPROVED" and not recomputed for PENDING_REAPPROVAL.
  created_at?: string
  // Links this PO back to the PR it was created from — same fields already
  // confirmed present on GET /po/:id via POCreatePage's edit-load path.
  pr_id?: number
  pr_no?: string
  supplier_id?: number
  supplier_name: string
  payment_terms: string | null
  // po.location_text is what GET /po/:id actually returns (json:"location_text,omitempty"
  // on the backend) — this is the "ที่อยู่จัดส่ง" value. There is no delivery_address or
  // warehouse_address field on this endpoint; don't reintroduce either.
  location_text?: string | null
  // purchase_order.receiver_name/receiver_phone — optional free text,
  // unvalidated on the backend (internal/handlers/po.go). Nullable on
  // GET /po/:id, accepted on POST/PUT /po/:id and PUT /po/:id/edit-approved.
  receiver_name?: string | null
  receiver_phone?: string | null
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
  // COUNT of po_edit_log rows — 0 if never edited-and-resent for re-approval,
  // confirmed present on GET /po/:id as of this session.
  revision_round?: number
  // purchase_order.order_type — same 'stock'/'cost' domain as PR's order_type.
  order_type?: 'stock' | 'cost'
  // purchase_order.job_code — header-level "ประเภท Job", shares the 12-code
  // JOB_TYPES constant (constants/jobTypes.ts) with PR's job_code. Replaces
  // the old work_type column (single-letter P/E/S/F/G/H, 6 values, renamed
  // by backend to job_code — old 'G' meant GAS System and was migrated to
  // 'MG'; bare 'G' is now exclusively General Code). Always present on
  // GET /po/:id (never null); optional on create/update (backend auto-fills
  // from the linked PR's job_code when omitted and pr_id is set). Distinct
  // from POLine.job_code (per-line, derived read-only from cost_subgroup_id).
  job_code: string
  // GET /po/:id nests attachments by source doc. `po` is always present
  // (`[]` at minimum); `pr`/`memo` keys are entirely absent from the JSON
  // when that chain link doesn't exist (e.g. no `pr` key if the PO has no
  // originating PR) — check key presence (`'pr' in attachments`), don't
  // just check array length, to tell "no chain link" apart from "chain
  // link exists but has zero files".
  attachments?: {
    po: POAttachment[]
    pr?: POAttachment[]
    memo?: POAttachment[]
  }
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
  spec?: string
  is_from_pr: boolean
  // Snapshot of qty_remaining on the PR line at the moment it was picked in
  // PRItemSelectionModal — client-side max for the qty input (task: prevent
  // over-ordering a single PR line across multiple POs before server checks).
  pr_qty_remaining?: number
  description?: string
  disc?: number
  disc_type?: 'pct' | 'amt'
  wht_rate?: 1 | 3 | 5 | null
  // Cost Code selection for this line — same cost_subgroup_id persisted on
  // purchase_order_line as POLine above. Auto-filled from the source PR
  // line's cost_subgroup_id when is_from_pr, but always stays editable.
  cost_subgroup_id?: number | null
  // Display-only "code — name" label, same convention as PRItemsTable's
  // costCodeLabel. The submitted value is cost_subgroup_id, not this.
  cost_code_label?: string | null
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

// GET /po/line-items — now grouped by PO (status = 'APPROVED' only), one
// object per PO with a nested `lines` array per purchase_order_line
// (internal/handlers/po.go ListLineItems, updated this session). When a
// filter like mat_code/job_code narrows the match, backend excludes
// non-matching lines/POs but `amount` still reflects the PO's real
// after-discount total, not the sum of the filtered lines.
export interface POLineItemLine {
  mat_code: string
  mat_name?: string
  qty_ordered: number
  unit_price: number
  amount: number
  job_code?: string
  job_name?: string
}

export interface POLineItemGroup {
  po_id?: number
  po_no: string
  po_date: string
  supplier_name?: string
  contact_phone?: string
  requested_by: string
  project_code?: string
  status: POStatus
  amount: number
  lines: POLineItemLine[]
}

export interface CostJobOption {
  job_code: string
  job_name?: string
}

export interface POLineItemsResponse {
  success: boolean
  data: { data: POLineItemGroup[]; total: number; page: number; page_size: number; total_pages: number }
}
