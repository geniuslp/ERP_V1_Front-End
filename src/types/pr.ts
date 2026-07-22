export type PRStatus = 'DRAFT' | 'COMPLETED' | 'STOCK_CHECK' | 'PARTIALLY_FILLED' | 'FULFILLED' | 'CANCELLED'

export interface PRListItem {
  id: number
  pr_no: string
  status: PRStatus
  requested_by: string
  approver_name: string | null
  location_code: string
  project_code: string | null
  remarks: string | null
  pr_date: string
}

export interface PRLine {
  id: number
  line_no: number
  mat_code: string
  qty_requested: number
  qty_reserved: number
  qty_to_order: number
  status: string
  remarks?: string
  mat_name?: string
  unit_name?: string
  brand_name?: string
  spec_name?: string
  group_name?: string
  subgroup_name?: string
}

export interface PRPriceHistoryEntry {
  price: number
  date: string
  qty: number
  supplier_name: string
  po_no: string
  source_pr_no?: string | null
  project_code?: string | null
  project_name?: string | null
}

export interface PRReferencedPO {
  po_id: number
  po_no: string
  qty: number
}

export interface PRLineWithPOStatus {
  id: number
  line_no: number
  mat_code: string
  mat_name: string
  unit: string
  qty_requested: number
  qty_reserved: number
  qty_ordered: number
  qty_remaining: number
  referenced_pos: PRReferencedPO[]
  last_price?: number | null
  last_price_date?: string | null
  price_history?: PRPriceHistoryEntry[]
  selected_unit_price?: number
}

export interface PRLinesWithPOStatusResponse {
  pr_no: string
  lines: PRLineWithPOStatus[]
}

export interface PRAttachment {
  id: number
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  uploaded_at: string
  uploaded_by: number
}

export interface PRDetail extends PRListItem {
  requester_id: number
  approver_id: number | null
  lines: PRLine[]
  attachments: PRAttachment[]
}

export interface PRListResponse {
  success: boolean
  data: {
    items: PRListItem[]
    total: number
    page: number
    limit: number
  }
}

export interface PRDetailResponse {
  success: boolean
  data: PRDetail
}
