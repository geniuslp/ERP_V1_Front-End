// Aliased: index.ts already has its own legacy lowercase `POStatus` (mock-era,
// unrelated) below — import the real uppercase DB-backed type under a
// different name to avoid colliding with it.
import type { POStatus as RealPOStatus, POReceiveStatus } from './po'

// ─── Auth & User ───────────────────────────────────────────────
export interface User {
  id: string
  username: string
  fullName: string
  full_name?: string
  email: string
  roles: string[]
  avatar?: string
  department?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
}

// ─── Permission & Menu ─────────────────────────────────────────
export type PermissionAction = 'read' | 'write' | 'edit' | 'update' | 'delete'

export interface MenuPermission {
  userId: string
  menuId: string
  actions: PermissionAction[]
}

export interface MenuConfig {
  id: string
  key: string
  label: string
  icon?: string
  path?: string
  parentId?: string | null
  order: number
  isActive: boolean
  children?: MenuConfig[]
}

// ─── PR ────────────────────────────────────────────────────────
export type PRStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'

export type PROrderType = 'stock' | 'cost'

export type PRType = 'PO_WO' | 'PO_ONLY' | 'WO_ONLY'

export interface PRAttachment {
  file_path: string
  file_name: string
  file_size: number
  file_type: string
}

export interface CreatePRLineRequest {
  line_no: number
  mat_code: string
  qty_requested: number
  qty_to_order: number
  cost_subgroup_id: number | null
  deduct_stock: boolean
}

export interface CreatePRRequest {
  pr_no: string
  pr_date: string
  requested_by: number
  created_by: number
  location_text: string
  warehouse_code?: string
  required_date?: string
  project_code?: string
  order_type?: PROrderType
  pr_type?: PRType
  // purchase_request.job_code — document-level "ประเภท Job" classification,
  // one of the 12 JOB_TYPES codes (constants/jobTypes.ts). Required (NOT
  // NULL) on the backend.
  job_code: string
  // Required only when no Memo is linked — disabled/cleared (never sent)
  // while memo_id is set, since the Memo already carries department context.
  dept_code?: string
  remarks?: string
  status: 'DRAFT' | 'COMPLETED'
  memo_id: number | null
  lines: CreatePRLineRequest[]
  attachments: PRAttachment[]
}

export interface UpdatePRRequest extends CreatePRRequest {}

export interface PRItem {
  id: string
  description: string
  quantity: number
  unit: string
  estimatedPrice: number
}

export interface PurchaseRequest {
  id: string
  prNumber: string
  title: string
  requester: string
  department: string
  status: PRStatus
  priority: 'low' | 'medium' | 'high' | 'urgent'
  requestDate: string
  requiredDate: string
  totalAmount: number
  items: PRItem[]
  remarks?: string
  approver?: string
  approvedDate?: string
}

// ─── PO ────────────────────────────────────────────────────────
export type POStatus = 'draft' | 'sent' | 'partial' | 'completed' | 'cancelled'

export interface POItem {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  prId?: string
  vendor: string
  status: POStatus
  orderDate: string
  deliveryDate: string
  totalAmount: number
  items: POItem[]
  terms?: string
  createdBy: string
}

// ─── Memo ──────────────────────────────────────────────────────
export interface MemoItem {
  id: string
  description: string
  unit: string
  quantity: number
  remark?: string
}

export type MemoStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'draft'
  | 'pending_po'
  | 'po_created'
  | 'cancelled'

export interface MemoAttachment {
  filePath: string
  fileName: string
  fileSize: number
  fileType: string
}

export interface Memo {
  id: string
  memoNo: string
  title: string
  projectName?: string
  projectCode?: string
  requestedBy: string
  requestedById: string
  approverName?: string
  department?: string
  deliveryLocation?: string
  note?: string
  items: MemoItem[]
  status: MemoStatus
  linkedPoIds?: string[]
  attachments?: MemoAttachment[]
  createdAt: string
  updatedAt: string
}

export interface MemoFormValues {
  title: string
  project_code?: string
  department?: string
  delivery_location?: string
  note?: string
  items: Omit<MemoItem, 'id'>[]
}

// ─── Master Data ───────────────────────────────────────────────
export interface Group {
  id: string
  groupCode: string
  groupName: string
  isActive: boolean
}

export interface SubGroup {
  id: string
  subGroupCode: string
  subGroupName: string
  groupId: string
  isActive: boolean
}

export interface Material {
  id: string
  mat_code: string
  mat_name_th: string
  brand_name: string
  unit_name: string
  spec_description?: string
  is_active: boolean
  [key: string]: any
}

// ─── Master Data: Stock ───────────────────────────────────────
export type StockItemType = 'RETURNABLE' | 'CONSUMABLE'
export type StockTrackingType = 'sku' | 'serial'

export interface StockCategory {
  id: string
  code: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
}

export interface StockItem {
  id: string
  matCode: string
  itemName: string
  description?: string
  categoryId?: string
  categoryName?: string
  itemType: StockItemType
  trackingType: StockTrackingType
  unit: string
  unitCost: number
  qty: number
  qrCode?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface StockImportRowError {
  row: number
  message: string
}

export interface StockImportResult {
  successCount: number
  failedCount: number
  errors: StockImportRowError[]
}

export interface StockLookupResult {
  matCode: string
  itemName?: string
  qtyOnHand: number
  unit?: string
  found: boolean
}

// ─── Goods Receipt (รับเข้า) ────────────────────────────────────
// NOTE: these mirror the real API response shapes exactly (snake_case),
// verified directly against the Go handlers — not assumed/mocked shapes.

// GRN prefix keeps these distinct from the unrelated same-named
// POListItem/PODetail/POLine in `@/types/po` (different field shape —
// this is the /po/search + /po/:id shape used only by the GRN receiving flow).
export interface GRNPoListItem {
  po_id: number
  po_no: string
  po_date?: string
  expected_date?: string | null
  // Stale — purchase_order no longer has a supplier_code column (migrated to
  // supplier_id, see CLAUDE.md). Left typed here since other GRN pages still
  // reference it against endpoints not yet separately verified, but
  // GET /po/:id (used by GoodsReceiptDetailPage) never actually returns this
  // field — use supplier_id/supplier_name below for that endpoint instead.
  supplier_code: string
  supplier_id?: number
  supplier_name?: string
  // po.location_text — GET /po/:id returns this (json:"location_text,omitempty").
  // Purely informational on the receiving page: the PO's own reference
  // location, distinct from (and never used to default) the physical
  // warehouse the user selects to receive into.
  location_text?: string | null
  warehouse_code?: string
  status: string
  currency: string
  net_amount?: number
}

// Matches models.POLine's actual JSON tags (internal/models/models.go) as
// returned by GET /po/:id — the line's real PK comes back as `line_id`,
// not `po_line_id`.
export interface GRNPoLine {
  line_id: number
  line_no: number
  mat_code: string
  mat_name: string
  qty_ordered: number
  qty_received: number
  current_stock_qty: number | null
}

export interface GRNPoDetail extends Omit<GRNPoListItem, 'net_amount'> {
  net_amount?: number
  lines: GRNPoLine[]
}

export interface GRNHistoryItem {
  grn_id: number
  grn_no: string
  grn_date: string
  po_no: string
  supplier_code: string
  warehouse_code?: string
  status: string
  score_quality?: number
  score_quantity?: number
  score_ontime?: number
  score_notes?: string
  received_by_name?: string
  line_count: number
  total_qty_received: number
}

export interface GRNCreateLine {
  po_line_id: number
  mat_code: string
  add_qty: number
}

export interface GRNCreatePayload {
  po_id: number
  warehouse_code: string
  supplier_code: string
  delivery_note?: string
  lines: GRNCreateLine[]
}

export interface GRNCreateResult {
  grn_id: number
  grn_no: string
  po_status: string
}

export interface GRNScorePayload {
  score_quality: number
  score_quantity: number
  score_ontime: number
  score_notes?: string
}

export interface GRNScoreResult {
  grn_id: number
  status: string
}

// ─── PO Receivable / GRN v2 (2026-07-27 session) ───────────────────────
// New two-step receiving flow: search receivable POs -> load only the
// still-receivable lines -> POST /grn as a draft -> POST /grn/:id/confirm.
// Distinct from the GRN types above (which back the older /po/search +
// /grn/receive + /grn/:id/score flow, still in use by
// GoodsReceiptSearchPage/GoodsReceiptDetailPage/GRNHistoryPage).
// 🔴 GET /po/receivable and GET /po/:id/receivable-lines are NOT deployed
// yet as of this session — grnReceivingService mocks these shapes until the
// backend confirms they're live. See CLAUDE.md "หน้า รับเข้า (GRN receiving)".
export interface ReceivablePoItem {
  po_id: number
  po_no: string
  po_date: string
  supplier_code: string
  supplier_name?: string
  status: RealPOStatus
  status_receive: POReceiveStatus
  // COUNT of po_edit_log rows — 0 if never edited-and-resent for re-approval.
  revision_round?: number
}

export interface ReceivablePoLine {
  po_line_id: number
  line_no: number
  mat_code: string
  mat_name: string
  qty_ordered: number
  qty_received: number
  qty_remaining: number
  unit_name?: string
}

export interface ReceivablePoLinesResponse {
  po_id: number
  po_no: string
  supplier_code: string
  warehouse_code?: string
  lines: ReceivablePoLine[]
}

export interface GRNv2CreateLine {
  po_line_id: number
  mat_code: string
  qty_accepted: number
}

export interface GRNv2CreatePayload {
  po_id: number
  warehouse_code: string
  delivery_note?: string
  lines: GRNv2CreateLine[]
}

export interface GRNv2CreateResult {
  grn_id: number
  grn_no: string
  status: string
}

export type GRNQualityStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'PARTIAL'

export interface GRNv2ListItem {
  grn_id: number
  grn_no: string
  grn_date: string
  po_id: number
  po_no: string
  supplier_code: string
  warehouse_code?: string
  status: string
  quality_status: GRNQualityStatus
}

export interface GRNv2Line {
  grn_line_id: number
  po_line_id: number
  mat_code: string
  mat_name: string
  qty_accepted: number
  quality_status: GRNQualityStatus
}

export interface GRNv2Detail {
  grn_id: number
  grn_no: string
  grn_date: string
  po_id: number
  po_no: string
  supplier_code: string
  warehouse_code?: string
  delivery_note?: string
  status: string
  quality_status: GRNQualityStatus
  lines: GRNv2Line[]
}

export interface StockTransactionLog {
  id: number
  txn_no: string
  txn_type: string
  item_id: number
  mat_code: string
  item_name: string
  from_location: string | null
  to_location: string | null
  qty: number
  qty_before: number | null
  qty_after: number | null
  ref_doc_type: string | null
  ref_doc_id: number | null
  remarks: string | null
  txn_date: string
  created_by_name: string
  created_at: string
  po_id?: number | null
  po_no?: string | null
  score_quality?: number | null
  score_quantity?: number | null
  score_ontime?: number | null
  score_notes?: string | null
}

// ─── System Config ─────────────────────────────────────────────
export interface SystemConfig {
  key: string
  value: string
  description: string
  group: string
}

export interface Role {
  id: string
  name: string
  description: string
  isActive: boolean
}

export interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ─── Approval Extra Approver ───────────────────────────────────
export interface ApprovalExtraApprover {
  id: number
  docType: string | null      // null = applies to all doc types
  userId: number
  userName: string
  reason: string | null
  createdAt: string
  createdBy: number | null
}
