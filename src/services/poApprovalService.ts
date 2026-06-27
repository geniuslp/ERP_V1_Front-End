import axios from 'axios'
import type { POListResponse, PODetailResponse } from '@/types/po'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

console.log('BASE_URL:', BASE_URL)

const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Cache-Control': 'no-cache',
})

export const poApprovalService = {
  
  getList: (
    token: string,
    params: { status?: string; page?: number; limit?: number } = {},
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
}
