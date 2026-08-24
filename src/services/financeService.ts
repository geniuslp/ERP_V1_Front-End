import axios from 'axios'
import type {
  FinancePaymentListParams,
  FinancePaymentListResult,
  FinancePaymentListItem,
  FinancePaymentLogEntry,
  RecordPaymentPayload,
  FinanceDocType,
} from '@/types/finance'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

// Same pagination envelope convention as workOrderService/poService:
// { success, data: { data: [...], total, page, page_size } }, with a bare-array fallback.
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

export const financeService = {
  list: async (token: string, params: FinancePaymentListParams): Promise<FinancePaymentListResult> => {
    const page = params.page ?? 1
    const pageSize = params.page_size ?? 20
    const res = await axios.get(`${BASE_URL}/finance/payments`, {
      headers: authHeader(token),
      params: {
        doc_type: params.doc_type,
        project_code: params.project_code || undefined,
        status: params.status || undefined,
        search: params.search || undefined,
        page,
        page_size: pageSize,
      },
    })
    const meta = unwrapPaginationMeta(res.data, page, pageSize)
    return { items: unwrapListEnvelope(res.data) as FinancePaymentListItem[], ...meta }
  },

  getLog: async (token: string, docType: FinanceDocType, docId: string | number): Promise<FinancePaymentLogEntry[]> => {
    const res = await axios.get(`${BASE_URL}/finance/payments/${docType}/${docId}/log`, {
      headers: authHeader(token),
    })
    return unwrapListEnvelope(res.data) as FinancePaymentLogEntry[]
  },

  recordPayment: async (token: string, payload: RecordPaymentPayload): Promise<FinancePaymentLogEntry> => {
    const res = await axios.post(`${BASE_URL}/finance/payments`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },
}
