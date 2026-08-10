import axios from 'axios'
import type { POListResponse, PODetailResponse, POLineItemsResponse } from '@/types/po'
import type { POData } from '@/pages/po/PurchaseOrderPrint'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

console.log('BASE_URL:', BASE_URL)

const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Cache-Control': 'no-cache',
})

export const poApprovalService = {
  
  getList: (
    token: string,
    params: {
      status?: string
      page?: number
      limit?: number
      my?: boolean
      po_no?: string
      supplier?: string
      created_by_name?: string
    } = {},
  ) =>
    axios.get<POListResponse>(`${BASE_URL}/po`, {
      headers: authHeader(token),
      params,
    }),

  getDetail: (token: string, id: number | string) =>
    axios.get<PODetailResponse>(`${BASE_URL}/po/${id}`, {
      headers: authHeader(token),
    }),

  approve: (token: string, id: number | string) =>
    axios.put(`${BASE_URL}/po/${id}/approve`, {}, {
      headers: authHeader(token),
    }),

  reject: (token: string, id: number | string, reason: string) =>
    axios.put(`${BASE_URL}/po/${id}/reject`, { reason }, {
      headers: authHeader(token),
    }),

  cancel: (token: string, id: number | string) =>
    axios.put(`${BASE_URL}/po/${id}/cancel`, {}, {
      headers: authHeader(token),
    }),

  getPrintData: (token: string, id: number | string) =>
    axios.get<{ data: POData }>(`${BASE_URL}/po/${id}/print-data`, {
      headers: authHeader(token),
    }),

  getLineItems: (
    token: string,
    params: {
      date_from?: string
      date_to?: string
      po_no?: string
      mat_code?: string
      requested_by?: number
      job_code?: string
      project_code?: string
      page?: number
      page_size?: number
    } = {},
  ) =>
    axios.get<POLineItemsResponse>(`${BASE_URL}/po/line-items`, {
      headers: authHeader(token),
      params,
    }),
}
