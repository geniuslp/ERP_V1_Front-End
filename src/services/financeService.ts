import axios from 'axios'
import type {
  FinancePaymentListParams,
  FinancePaymentListResult,
  FinancePaymentListItem,
  FinancePaymentLogEntry,
  RecordPaymentPayload,
  FinanceDocType,
  FinanceInstallmentsResult,
  SaveInstallmentRow,
} from '@/types/finance'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

export const RECORD_PAYMENT_BLOCKED_TIP = 'ยังไม่ได้รับของ ไม่สามารถบันทึกการจ่ายเงินได้'
// can_record_payment from the backend wins; if it is missing, fall back to the receipt status.
export const isRecordPaymentBlocked = (item?: Pick<FinancePaymentListItem, 'canRecordPayment' | 'receivingStatus'> | null) =>
  !!item && (item.canRecordPayment !== undefined ? !item.canRecordPayment : item.receivingStatus === 'NOT_RECEIVED')

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
    // Every other field on this row already matches the backend's snake_case
    // naming 1:1 (doc_no/project_code/net_amount/etc.) so no mapping is
    // needed for those — receiving_status is remapped to receivingStatus
    // (camelCase) since it's a computed/derived field, not a raw DB column
    // passthrough like the others.
    const items = unwrapListEnvelope(res.data).map((raw: any) => ({
      ...raw,
      receivingStatus: raw.receiving_status ?? null,
      canRecordPayment: raw.can_record_payment ?? undefined,
    })) as FinancePaymentListItem[]
    return { items, ...meta }
  },

  getLog: async (token: string, docType: FinanceDocType, docId: string | number): Promise<FinancePaymentLogEntry[]> => {
    const res = await axios.get(`${BASE_URL}/finance/payments/${docType}/${docId}/log`, {
      headers: authHeader(token),
    })
    return unwrapListEnvelope(res.data) as FinancePaymentLogEntry[]
  },

  getOne: async (token: string, docType: FinanceDocType, docId: string | number): Promise<FinancePaymentListItem> => {
    const res = await axios.get(`${BASE_URL}/finance/payments/${docType}/${docId}`, { headers: authHeader(token) })
    const raw = res.data?.data ?? res.data
    return {
      ...raw,
      receivingStatus: raw?.receiving_status ?? null,
      canRecordPayment: raw?.can_record_payment ?? undefined,
    } as FinancePaymentListItem
  },

  // Backend creates the linked negative reversal row itself (amount derived server-side).
  cancelPayment: async (token: string, paymentId: number, reason: string): Promise<{ id: number; doc_no: string; reversed_id: number }> => {
    const res = await axios.post(`${BASE_URL}/finance/payments/${paymentId}/cancel`, { reason }, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  recordPayment: async (token: string, payload: RecordPaymentPayload): Promise<FinancePaymentLogEntry> => {
    const res = await axios.post(`${BASE_URL}/finance/payments`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  getInstallments: async (token: string, docType: FinanceDocType, docId: string | number): Promise<FinanceInstallmentsResult> => {
    const res = await axios.get(`${BASE_URL}/finance/payments/${docType}/${docId}/installments`, { headers: authHeader(token) })
    const raw = res.data?.data ?? res.data
    return {
      net_amount: Number(raw?.net_amount ?? 0),
      installments_sum: Number(raw?.installments_sum ?? 0),
      installments: Array.isArray(raw?.installments) ? raw.installments : [],
    }
  },

  // Full replace — rows are renumbered by the backend in request order.
  saveInstallments: async (token: string, docType: FinanceDocType, docId: string | number, installments: SaveInstallmentRow[]): Promise<void> => {
    await axios.put(`${BASE_URL}/finance/payments/${docType}/${docId}/installments`, { installments }, { headers: authHeader(token) })
  },
}
