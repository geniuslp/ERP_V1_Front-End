import api from '@/services/api'
import type { ERPIssue, ERPIssueStatus, ERPIssueType } from '@/types/erpIssue'

const unwrap = <T,>(res: { data: { data?: T } & Record<string, unknown> }): T => (res.data?.data ?? (res.data as unknown)) as T

export interface ERPIssueListParams {
  scope?: 'mine' | 'all' | 'approval'
  status?: string
  issue_type?: string
  search?: string
  date_from?: string
  date_to?: string
}

export interface ERPIssueCreateInput {
  issue_type: ERPIssueType
  title: string
  detail: string
  menu_code?: string
  module_name?: string
  approver_id?: number
  files: File[]
}

export const erpIssueService = {
  /** is_admin = read on MENU_ERP_ISSUE_ADMIN (sees all), can_manage = update on it (status / reply / files). */
  me: async (): Promise<{ is_admin: boolean; can_manage: boolean }> => unwrap(await api.get('/erp-issues/me')),

  list: async (params: ERPIssueListParams): Promise<ERPIssue[]> => {
    const raw = unwrap<ERPIssue[]>(await api.get('/erp-issues', { params }))
    return Array.isArray(raw) ? raw : []
  },

  get: async (id: number | string): Promise<{ issue: ERPIssue; isAdmin: boolean; canManage: boolean }> => {
    const res = await api.get(`/erp-issues/${id}`)
    return {
      issue: res.data?.data as ERPIssue,
      isAdmin: Boolean(res.data?.is_admin),
      canManage: Boolean(res.data?.can_manage),
    }
  },

  /** One multipart request: the ticket and its files are saved together. */
  create: async (input: ERPIssueCreateInput): Promise<{ id: number; issue_no: string; status: ERPIssueStatus }> => {
    const fd = new FormData()
    fd.append('issue_type', input.issue_type)
    fd.append('title', input.title)
    fd.append('detail', input.detail)
    if (input.menu_code) fd.append('menu_code', input.menu_code)
    if (input.module_name) fd.append('module_name', input.module_name)
    if (input.approver_id) fd.append('approver_id', String(input.approver_id))
    input.files.forEach((f) => fd.append('files', f))
    const res = await api.post('/erp-issues', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 0 })
    return unwrap(res)
  },

  /** Admin: status + reply, optionally with files (e.g. screenshots of the fix) that the reporter then sees. */
  updateStatus: async (id: number, status: ERPIssueStatus, adminRemark?: string, files: File[] = []): Promise<void> => {
    if (files.length === 0) {
      await api.put(`/erp-issues/${id}/status`, { status, admin_remark: adminRemark ?? null })
      return
    }
    const fd = new FormData()
    fd.append('status', status)
    fd.append('admin_remark', adminRemark ?? '')
    files.forEach((f) => fd.append('files', f))
    await api.put(`/erp-issues/${id}/status`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 0 })
  },

  approve: async (id: number, comments?: string): Promise<void> => {
    await api.put(`/approval/ERP_ISSUE/${id}/approve`, { comments: comments || null })
  },
  reject: async (id: number, comments: string): Promise<void> => {
    await api.put(`/approval/ERP_ISSUE/${id}/reject`, { comments })
  },
}

export const erpIssueErrText = (err: unknown, fallback: string): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any
  if (e?.response?.status === 413) return 'ไฟล์ใหญ่เกินที่เซิร์ฟเวอร์รับได้ กรุณาลดขนาดไฟล์'
  return e?.response?.data?.error || e?.response?.data?.message || e?.message || fallback
}
