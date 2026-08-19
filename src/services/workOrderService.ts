import axios from 'axios'
import type { WOListItem, WOListParams, WOListResult, WorkOrder, WorkOrderPayload } from '@/types/workOrder'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

// Backend wraps list responses in a pagination envelope: { success, data: { data: [...], total, page, page_size } }
// — same convention as /po, /requisition, etc. Falls back to a bare array for safety.
const unwrapListEnvelope = (resData: any): any[] => {
  if (Array.isArray(resData)) return resData
  const payload = resData?.data
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

const unwrapPaginationMeta = (resData: any, fallbackPage: number, fallbackPageSize: number) => {
  const payload = resData?.data
  const total = Number(payload?.total ?? unwrapListEnvelope(resData).length)
  const page = Number(payload?.page ?? fallbackPage)
  const pageSize = Number(payload?.page_size ?? fallbackPageSize)
  const totalPages = Number(payload?.total_pages ?? Math.max(1, Math.ceil(total / pageSize)))
  return { total, page, pageSize, totalPages }
}

export const workOrderService = {
  list: async (token: string, params: WOListParams): Promise<WOListResult> => {
    const page = params.page ?? 1
    const pageSize = params.page_size ?? 20
    const res = await axios.get(`${BASE_URL}/work-order`, {
      headers: authHeader(token),
      params: {
        wo_no: params.wo_no || undefined,
        employer_name: params.employer_name || undefined,
        supplier: params.supplier || undefined,
        status: params.status || undefined,
        date_from: params.date_from || undefined,
        date_to: params.date_to || undefined,
        page,
        page_size: pageSize,
      },
    })
    const meta = unwrapPaginationMeta(res.data, page, pageSize)
    return { items: unwrapListEnvelope(res.data) as WOListItem[], ...meta }
  },

  get: async (token: string, id: string | number): Promise<WorkOrder> => {
    const res = await axios.get(`${BASE_URL}/work-order/${id}`, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  create: async (token: string, payload: WorkOrderPayload): Promise<WorkOrder> => {
    const res = await axios.post(`${BASE_URL}/work-order`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  update: async (token: string, id: string | number, payload: WorkOrderPayload): Promise<WorkOrder> => {
    const res = await axios.put(`${BASE_URL}/work-order/${id}`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  approve: async (token: string, id: string | number): Promise<void> => {
    await axios.post(`${BASE_URL}/work-order/${id}/approve`, {}, { headers: authHeader(token) })
  },

  reject: async (token: string, id: string | number, reason: string): Promise<void> => {
    await axios.post(`${BASE_URL}/work-order/${id}/reject`, { reason }, { headers: authHeader(token) })
  },
}
