import api from '@/services/api'
import type { AvailablePR, POListItem, POListResponse, PODetail, PODetailResponse } from '@/types/po'

// only_orderable=true: backend returns only PRs that still have at least one line
// with something left to order (qty_to_order - qty_ordered > 0).
export const getAvailablePRs = async (): Promise<AvailablePR[]> => {
  const res = await api.get('/po/available-prs', { params: { only_orderable: true } })
  return res.data.data
}

// ── PO list page (GET /po, GET /po/export, GET /po/:id, PUT /po/:id/deposit-paid) ──

export interface POListFilters {
  date_from?: string
  date_to?: string
  dept_code?: string
  search?: string
  status?: string
  payment_status?: 'UNPAID' | 'PARTIAL' | 'PAID'
}

export const listPOs = async (params: POListFilters & { page: number; page_size: number }) => {
  const res = await api.get<POListResponse>('/po', { params })
  return res.data.data
}

// No pagination, same filters/fields as listPOs — used to build the .xlsx client-side.
export const exportPOs = async (params: POListFilters): Promise<POListItem[]> => {
  const res = await api.get<{ success: boolean; data: POListItem[] }>('/po/list-export', { params })
  return res.data.data
}

export const getPODetail = async (id: number): Promise<PODetail> => {
  const res = await api.get<PODetailResponse>(`/po/${id}`)
  return res.data.data
}

export const setPODepositPaid = async (id: number, depositPaid: boolean) => {
  const res = await api.put(`/po/${id}/deposit-paid`, { deposit_paid: depositPaid })
  return res.data.data as { id: number; deposit_paid: boolean }
}
