import axios from 'axios'
import type {
  PettyCashRequisition, CreatePettyCashRequest, UpdatePettyCashRequest,
  PettyCashListFilter, PettyCashLineOptions, PettyCashSubmitResult, PettyCashApprovalChain,
} from '@/types/pettyCash'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

let lineOptionsCache: PettyCashLineOptions | null = null

export const pettyCashService = {
  // Static lookup (tax forms / WHT income types / VAT rate) — fetched once and cached.
  getLineOptions: async (token: string): Promise<PettyCashLineOptions> => {
    if (lineOptionsCache) return lineOptionsCache
    const res = await axios.get(`${BASE_URL}/petty-cash/line-options`, { headers: authHeader(token) })
    const d = res.data?.data ?? res.data
    lineOptionsCache = {
      tax_forms: d?.tax_forms ?? [],
      wht_income_types: d?.wht_income_types ?? [],
      vat_rate: d?.vat_rate ?? 7,
    }
    return lineOptionsCache
  },

  list: async (token: string, filter: PettyCashListFilter): Promise<PaginatedResponse<PettyCashRequisition>> => {
    const res = await axios.get(`${BASE_URL}/petty-cash`, {
      headers: authHeader(token),
      params: filter,
    })
    return res.data?.data ?? { data: [], total: 0, page: 1, page_size: 20, total_pages: 1 }
  },

  get: async (token: string, id: number | string): Promise<PettyCashRequisition> => {
    const res = await axios.get(`${BASE_URL}/petty-cash/${id}`, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  create: async (token: string, payload: CreatePettyCashRequest): Promise<PettyCashRequisition> => {
    const res = await axios.post(`${BASE_URL}/petty-cash`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  update: async (token: string, id: number | string, payload: UpdatePettyCashRequest): Promise<PettyCashRequisition> => {
    const res = await axios.put(`${BASE_URL}/petty-cash/${id}`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  remove: async (token: string, id: number | string): Promise<void> => {
    await axios.delete(`${BASE_URL}/petty-cash/${id}`, { headers: authHeader(token) })
  },

  submit: async (token: string, id: number | string, approverId?: number | null): Promise<PettyCashSubmitResult> => {
    const res = await axios.post(`${BASE_URL}/petty-cash/${id}/submit`, { approver_id: approverId ?? undefined }, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  getApprovalChain: async (token: string, id: number | string): Promise<PettyCashApprovalChain> => {
    const res = await axios.get(`${BASE_URL}/petty-cash/${id}/approval-chain`, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  approve: async (token: string, id: number | string, comments?: string): Promise<void> => {
    await axios.post(`${BASE_URL}/petty-cash/${id}/approve`, { comments }, { headers: authHeader(token) })
  },

  reject: async (token: string, id: number | string, comments: string): Promise<void> => {
    await axios.post(`${BASE_URL}/petty-cash/${id}/reject`, { comments }, { headers: authHeader(token) })
  },

  // Single-step multipart upload (field "file"); allowed only while the document is DRAFT.
  uploadAttachment: async (token: string, id: number | string, file: File): Promise<void> => {
    const fd = new FormData()
    fd.append('file', file)
    await axios.post(`${BASE_URL}/petty-cash/${id}/attachments`, fd, { headers: authHeader(token) })
  },

  deleteAttachment: async (token: string, id: number | string, attId: number | string): Promise<void> => {
    await axios.delete(`${BASE_URL}/petty-cash/${id}/attachments/${attId}`, { headers: authHeader(token) })
  },

  cancel: async (token: string, id: number | string): Promise<void> => {
    await axios.post(`${BASE_URL}/petty-cash/${id}/cancel`, {}, { headers: authHeader(token) })
  },

  // No petty-cash-specific material search endpoint — the material picker
  // reuses GET /master/allMaterial (MaterialPickerModal), same as PR/PO,
  // extended server-side with an optional project_code param for the
  // stock_on_hand reference hint. See MaterialPickerModal's projectCode prop.
}
