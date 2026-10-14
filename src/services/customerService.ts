import axios from 'axios'
import type {
  Customer, CustomerImportResult, CustomerImportRow, CustomerListParams, CustomerListResult, CustomerPayload,
} from '@/types/customer'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

// Backend list: { success, data: { data: [...], total, page, page_size, total_pages } }.
// GET /customer filters is_active=true by default; an empty value disables the filter.
const IS_ACTIVE_PARAM = { all: '', active: 'true', inactive: 'false' } as const

export const customerService = {
  async list(token: string, p: CustomerListParams): Promise<CustomerListResult> {
    const res = await axios.get(`${BASE_URL}/master/customer`, {
      headers: authHeader(token),
      params: {
        page: p.page,
        page_size: p.page_size,
        search: p.search || undefined,
        is_active: IS_ACTIVE_PARAM[p.status],
      },
    })
    const body = res.data?.data ?? res.data
    const items: Customer[] = Array.isArray(body) ? body : body?.data ?? body?.items ?? []
    return { items, total: body?.total ?? res.data?.total ?? items.length }
  },

  async create(token: string, payload: CustomerPayload): Promise<Customer> {
    const res = await axios.post(`${BASE_URL}/master/customer`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  async update(token: string, id: number, payload: CustomerPayload): Promise<Customer> {
    const res = await axios.put(`${BASE_URL}/master/customer/${id}`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  // Soft delete (is_active=false) on the backend.
  async remove(token: string, id: number): Promise<void> {
    await axios.delete(`${BASE_URL}/master/customer/${id}`, { headers: authHeader(token) })
  },

  // POST /master/customer/import: 200 { created, updated, unchanged, total } or 400 { errors: [{ row, field, message }] }.
  async importRows(token: string, rows: CustomerImportRow[]): Promise<CustomerImportResult> {
    const res = await axios.post(`${BASE_URL}/master/customer/import`, { rows }, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },
}
