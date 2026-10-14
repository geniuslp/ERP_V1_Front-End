export interface Customer {
  cus_id: number
  customer_code: string
  customer_name: string
  contact?: string | null
  tel?: string | null
  address?: string | null
  remarks?: string | null
  credit_term?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// Empty optional fields are sent as null.
export interface CustomerPayload {
  customer_code: string
  customer_name: string
  contact: string | null
  tel: string | null
  address: string | null
  remarks: string | null
  credit_term: string | null
  is_active?: boolean
}

export type CustomerStatusFilter = 'all' | 'active' | 'inactive'

export interface CustomerListParams {
  page: number
  page_size: number
  search?: string
  status: CustomerStatusFilter
}

export interface CustomerListResult {
  items: Customer[]
  total: number
}

export interface CustomerImportRow {
  customer_code: string
  customer_name: string
}

export interface CustomerImportResult {
  created: number
  updated: number
  unchanged: number
  total: number
}

export interface CustomerImportRowError {
  row: number
  field?: string
  message: string
}
