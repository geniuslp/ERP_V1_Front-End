import axios from 'axios'
import type { ApprovalExtraApprover } from '@/types'

// Table name in the DB is `approval_delegation` even though the concept
// exposed here is an "extra approver" (additive, not a from/to delegation).
const BASE_URL = (import.meta as any).env?.VITE_API_URL

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

export interface CreateExtraApproverPayload {
  docType: string | null
  userId: number
  reason?: string
}

// Mutable mock store so in-session CRUD persists between calls
let mockIdSeq = 3
const mockExtraApprovers: ApprovalExtraApprover[] = [
  {
    id: 1,
    docType: 'PR',
    userId: 6,
    userName: 'มาลี รักงาน',
    reason: 'ช่วยอนุมัติช่วงงานเร่งด่วน',
    createdAt: '2026-06-25T09:00:00Z',
    createdBy: 1,
  },
  {
    id: 2,
    docType: null,
    userId: 4,
    userName: 'สมชาย ใจดี',
    reason: null,
    createdAt: '2026-05-28T09:00:00Z',
    createdBy: 1,
  },
  {
    id: 3,
    docType: 'PO',
    userId: 5,
    userName: 'วิชัย มั่นคง',
    reason: 'สำรองผู้อนุมัติ PO',
    createdAt: '2026-07-01T09:00:00Z',
    createdBy: 1,
  },
]

const useMock = !BASE_URL

export const approvalDelegationService = {
  getExtraApprovers: async (token: string): Promise<ApprovalExtraApprover[]> => {
    if (useMock) return [...mockExtraApprovers]
    const res = await axios.get(`${BASE_URL}/approval-delegation`, { headers: authHeader(token) })
    const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
    return raw.map((r) => ({
      id: r.id,
      docType: r.doc_type ?? r.docType ?? null,
      userId: r.user_id ?? r.userId,
      userName: r.user_name ?? r.userName,
      reason: r.reason ?? null,
      createdAt: r.created_at ?? r.createdAt,
      createdBy: r.created_by ?? r.createdBy ?? null,
    }))
  },

  createExtraApprover: async (
    token: string,
    payload: CreateExtraApproverPayload & { userName: string },
  ): Promise<ApprovalExtraApprover> => {
    if (useMock) {
      const item: ApprovalExtraApprover = {
        id: ++mockIdSeq,
        docType: payload.docType,
        userId: payload.userId,
        userName: payload.userName,
        reason: payload.reason?.trim() || null,
        createdAt: new Date().toISOString(),
        createdBy: null,
      }
      mockExtraApprovers.push(item)
      return { ...item }
    }
    const body = {
      doc_type: payload.docType,
      user_id: payload.userId,
      reason: payload.reason,
    }
    const res = await axios.post(`${BASE_URL}/approval-delegation`, body, { headers: authHeader(token) })
    const r = res.data?.data ?? res.data
    return {
      id: r.id,
      docType: r.doc_type ?? r.docType ?? null,
      userId: r.user_id ?? r.userId,
      userName: r.user_name ?? r.userName ?? payload.userName,
      reason: r.reason ?? null,
      createdAt: r.created_at ?? r.createdAt,
      createdBy: r.created_by ?? r.createdBy ?? null,
    }
  },

  deleteExtraApprover: async (token: string, id: number): Promise<void> => {
    if (useMock) {
      const idx = mockExtraApprovers.findIndex((d) => d.id === id)
      if (idx !== -1) mockExtraApprovers.splice(idx, 1)
      return
    }
    await axios.delete(`${BASE_URL}/approval-delegation/${id}`, { headers: authHeader(token) })
  },
}
