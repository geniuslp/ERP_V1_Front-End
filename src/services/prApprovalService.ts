import axios from 'axios'
import type { PRListResponse, PRDetailResponse } from '@/types/pr'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

export const prApprovalService = {
  getList: (
    token: string,
    params: { status?: string; page?: number; limit?: number } = {},
  ) =>
    axios.get<PRListResponse>(`${BASE_URL}/pr`, {
      headers: authHeader(token),
      params,
    }),

  getDetail: (token: string, id: number | string) =>
    axios.get<PRDetailResponse>(`${BASE_URL}/pr/${id}`, {
      headers: authHeader(token),
    }),

  approve: (token: string, id: number | string) =>
    axios.put(`${BASE_URL}/pr/${id}/approve`, {}, {
      headers: authHeader(token),
    }),

  reject: (token: string, id: number | string, reason: string) =>
    axios.put(`${BASE_URL}/pr/${id}/reject`, { reason }, {
      headers: authHeader(token),
    }),
}
