import axios from 'axios'
import type {
  ApprovalDocType,
  ApprovalConfig,
  ApprovalRole,
  CreateRulePayload,
  CreateRolePayload,
  BatchPayload,
} from '@/types/approval.types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

// Mutable mock stores so in-session CRUD persists between calls
const mockDocTypes: ApprovalDocType[] = [
  { id: 1, doc_type: 'PR',    doc_label: 'ใบขอซื้อ (PR)',   is_active: true },
  { id: 2, doc_type: 'PO',    doc_label: 'ใบสั่งซื้อ (PO)', is_active: true },
  { id: 3, doc_type: 'STOCK', doc_label: 'ใบเบิกวัสดุ',     is_active: true },
]

const mockRoles: ApprovalRole[] = [
  { id: 3, role_code: 'ROLE_SENIOR_ENG',   role_name: 'Senior Engineer',   is_active: true },
  { id: 4, role_code: 'ROLE_PROJECT_MGR',  role_name: 'Project Manager',   is_active: true },
  { id: 5, role_code: 'ROLE_MD',           role_name: 'Managing Director', is_active: true },
  { id: 6, role_code: 'ROLE_SECTION_HEAD', role_name: 'Section Head',      is_active: true },
]

let mockIdSeq = 10
const mockConfigs: ApprovalConfig[] = [
  { id: 1, doc_type: 'PR',    step_no: 1, step_name: 'Senior Engineer approve', approver_role_id: 3, is_active: true },
  { id: 2, doc_type: 'PR',    step_no: 2, step_name: 'PM approve',              approver_role_id: 4, is_active: true },
  { id: 3, doc_type: 'PO',    step_no: 1, step_name: 'MD approve',              approver_role_id: 5, is_active: true },
  { id: 4, doc_type: 'STOCK', step_no: 1, step_name: 'Section Head approve',    approver_role_id: 6, is_active: true },
]

const useMock = !BASE_URL

export const approvalConfigService = {
  // ── Doc Types ────────────────────────────────────────────────
  getDocTypes: async (token: string): Promise<ApprovalDocType[]> => {
    if (useMock) return [...mockDocTypes]
    const res = await axios.get(`${BASE_URL}/approval-doc-types`, { headers: authHeader(token) })
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  },

  createDocType: async (token: string, body: Omit<ApprovalDocType, 'id'>): Promise<ApprovalDocType> => {
    if (useMock) {
      const item: ApprovalDocType = { ...body, id: ++mockIdSeq }
      mockDocTypes.push(item)
      return { ...item }
    }
    const res = await axios.post(`${BASE_URL}/approval-doc-types`, body, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  toggleDocType: async (token: string, id: number, is_active: boolean): Promise<void> => {
    if (useMock) {
      const idx = mockDocTypes.findIndex((d) => d.id === id)
      if (idx !== -1) mockDocTypes[idx].is_active = is_active
      return
    }
    await axios.patch(`${BASE_URL}/approval-doc-types/${id}`, { is_active }, { headers: authHeader(token) })
  },

  // ── Roles ────────────────────────────────────────────────────
  getRoles: async (token: string): Promise<ApprovalRole[]> => {
    if (useMock) return [...mockRoles]
    const res = await axios.get(`${BASE_URL}/roles`, { headers: authHeader(token) })
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  },

  createRole: async (token: string, payload: CreateRolePayload): Promise<ApprovalRole> => {
    if (useMock) {
      const code = 'ROLE_' + payload.role_name.toUpperCase().replace(/\s+/g, '_')
      const item: ApprovalRole = {
        id: ++mockIdSeq,
        role_code: code,
        role_name: payload.role_name,
        description: payload.description,
        is_active: true,
      }
      mockRoles.push(item)
      return { ...item }
    }
    const res = await axios.post(`${BASE_URL}/roles`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  toggleRole: async (token: string, id: number, is_active: boolean): Promise<void> => {
    if (useMock) {
      const idx = mockRoles.findIndex((r) => r.id === id)
      if (idx !== -1) mockRoles[idx].is_active = is_active
      return
    }
    await axios.patch(`${BASE_URL}/roles/${id}`, { is_active }, { headers: authHeader(token) })
  },

  deleteRole: async (token: string, id: number): Promise<void> => {
    if (useMock) {
      const hasRule = mockConfigs.some((c) => c.approver_role_id === id)
      if (hasRule) throw new Error('ไม่สามารถลบ Role ที่มี Rule ผูกอยู่ได้')
      const idx = mockRoles.findIndex((r) => r.id === id)
      if (idx !== -1) mockRoles.splice(idx, 1)
      return
    }
    await axios.delete(`${BASE_URL}/roles/${id}`, { headers: authHeader(token) })
  },

  // ── Approval Config ──────────────────────────────────────────
  getConfigs: async (token: string): Promise<ApprovalConfig[]> => {
    if (useMock) return [...mockConfigs]
    const res = await axios.get(`${BASE_URL}/approval-config`, { headers: authHeader(token) })
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  },

  createConfig: async (token: string, payload: CreateRulePayload): Promise<ApprovalConfig> => {
    if (useMock) {
      const role = mockRoles.find((r) => r.id === payload.approver_role_id)
      const stepNo = mockConfigs.filter((c) => c.doc_type === payload.doc_type).length + 1
      const item: ApprovalConfig = {
        id: ++mockIdSeq,
        doc_type: payload.doc_type,
        approver_role_id: payload.approver_role_id,
        step_no: stepNo,
        step_name: `${role?.role_name ?? 'Unknown'} approve`,
        is_active: true,
      }
      mockConfigs.push(item)
      return { ...item }
    }
    const res = await axios.post(`${BASE_URL}/approval-config`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  toggleConfig: async (token: string, id: number, is_active: boolean): Promise<void> => {
    if (useMock) {
      const idx = mockConfigs.findIndex((c) => c.id === id)
      if (idx !== -1) mockConfigs[idx].is_active = is_active
      return
    }
    await axios.patch(`${BASE_URL}/approval-config/${id}`, { is_active }, { headers: authHeader(token) })
  },

  deleteConfig: async (token: string, id: number): Promise<void> => {
    if (useMock) {
      const idx = mockConfigs.findIndex((c) => c.id === id)
      if (idx !== -1) mockConfigs.splice(idx, 1)
      return
    }
    await axios.delete(`${BASE_URL}/approval-config/${id}`, { headers: authHeader(token) })
  },

  batchUpdate: async (token: string, payload: BatchPayload): Promise<void> => {
    if (useMock) {
      for (const id of payload.delete) {
        const idx = mockConfigs.findIndex((c) => c.id === id)
        if (idx !== -1) mockConfigs.splice(idx, 1)
      }
      for (const p of payload.create) {
        const role = mockRoles.find((r) => r.id === p.approver_role_id)
        const stepNo = mockConfigs.filter((c) => c.doc_type === p.doc_type).length + 1
        mockConfigs.push({
          id: ++mockIdSeq,
          doc_type: p.doc_type,
          approver_role_id: p.approver_role_id,
          step_no: stepNo,
          step_name: `${role?.role_name ?? 'Unknown'} approve`,
          is_active: true,
        })
      }
      return
    }
    await axios.post(`${BASE_URL}/approval-config/batch`, payload, { headers: authHeader(token) })
  },
}
