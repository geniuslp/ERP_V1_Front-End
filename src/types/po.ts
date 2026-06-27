export type POStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface POListItem {
  id: number
  po_no: string
  po_date: string
  status: POStatus
  supplier_name: string
  total_amount: number
  net_amount: number
  currency: string
  created_by_name: string
  expected_date: string | null
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
  brand_name?: string
  spec_description?: string
  group_name?: string
  subgroup_name?: string
}

export interface PODetail {
  id: number
  po_no: string
  po_date: string
  status: POStatus
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
  wht_rate?: 1 | 3 | 5 | null
}

export interface MaterialSearchResult {
  mat_code: string
  mat_name: string
  unit: string
  last_price?: number | null
}

export interface POListResponse {
  success: boolean
  data: { items: POListItem[]; total: number; page: number; limit: number }
}

export interface PODetailResponse {
  success: boolean
  data: PODetail
}
