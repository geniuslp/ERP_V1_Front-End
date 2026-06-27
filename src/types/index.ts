// ─── Auth & User ───────────────────────────────────────────────
export interface User {
  id: string
  username: string
  fullName: string
  full_name?: string
  email: string
  role: string
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
export type PermissionAction = 'read' | 'write' | 'edit' | 'delete'

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
  estimatedPrice: number
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

export interface Memo {
  id: string
  memoNo: string
  title: string
  projectName?: string
  projectCode?: string
  requestedBy: string
  requestedById: string
  department?: string
  note?: string
  items: MemoItem[]
  totalAmount: number
  status: MemoStatus
  linkedPoIds?: string[]
  createdAt: string
  updatedAt: string
}

export interface MemoFormValues {
  title: string
  project_code?: string
  department?: string
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
