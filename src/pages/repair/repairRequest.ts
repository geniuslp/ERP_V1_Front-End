import axios from 'axios'

// เอกสารแจ้งซ่อม > 5.1 บันทึกการแจ้งซ่อม — shared types / labels / API calls (backend /repair-requests, migration 076).
const BASE_URL = (import.meta as any).env?.VITE_API_URL

export const REPAIR_MENU_CODE = 'MENU_REPAIR_REQUEST'

export type RepairPriority = 'VERY_URGENT' | 'URGENT' | 'NORMAL'
export type RepairStatus = 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export const PRIORITY: Record<RepairPriority, { label: string; color: string }> = {
  VERY_URGENT: { label: 'ด่วนมาก', color: 'red' },
  URGENT: { label: 'ด่วน', color: 'orange' },
  NORMAL: { label: 'ปกติ', color: 'default' },
}
export const STATUS: Record<RepairStatus, { label: string; color: string }> = {
  DRAFT: { label: 'ร่าง', color: 'default' },
  SUBMITTED: { label: 'ส่งแล้ว', color: 'blue' },
  PENDING_APPROVAL: { label: 'รออนุมัติ', color: 'orange' },
  APPROVED: { label: 'อนุมัติแล้ว', color: 'green' },
  REJECTED: { label: 'ไม่อนุมัติ', color: 'red' },
  CANCELLED: { label: 'ยกเลิก', color: 'default' },
}

export interface RepairItem {
  id?: number
  line_no?: number
  machine_name: string
  machine_code: string | null
  qty: number
  unit: string | null
  symptom: string
}
export interface RepairAttachment {
  id: number
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
}
export interface RepairRequest {
  id: number
  request_no: string
  request_date: string
  project_code: string
  project_name: string | null
  dept_code: string | null
  dept_name: string | null
  branch_code: string | null
  branch_name: string | null
  repairer: string
  equipment_category_id: number | null
  equipment_category_name: string | null
  need_date: string | null
  priority: RepairPriority
  status: RepairStatus
  requested_by: number
  requested_by_name: string | null
  requested_by_username: string | null
  submitted_at: string | null
  // optional approval (077): requires_approval ticked -> PENDING_APPROVAL -> APPROVED | REJECTED
  requires_approval: boolean
  approver_id: number | null
  approver_name: string | null
  approver_username: string | null
  approved_at: string | null
  reject_reason: string | null
  can_approve: boolean
  item_count: number
  first_machine?: string | null
  items?: RepairItem[]
  attachments?: RepairAttachment[]
  can_edit: boolean
}

export interface RepairPayload {
  action: 'draft' | 'submit'
  project_code: string
  dept_code: string | null
  branch_code: string | null
  repairer: string
  equipment_category_id: number | null
  need_date: string | null
  priority: RepairPriority
  items: RepairItem[]
  requires_approval: boolean
  approver_id: number | null
  remove_attachment_ids?: number[]
}

const auth = (token?: string) => ({ Authorization: `Bearer ${token}` })

export const repairErrText = (e: any, fallback: string): string =>
  e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback

export const repairApi = {
  async list(token: string | undefined, params: Record<string, unknown>) {
    const res = await axios.get(`${BASE_URL}/repair-requests`, { headers: auth(token), params })
    return { rows: (res.data?.data ?? []) as RepairRequest[], total: Number(res.data?.total ?? 0) }
  },
  async get(token: string | undefined, id: number | string) {
    const res = await axios.get(`${BASE_URL}/repair-requests/${id}`, { headers: auth(token) })
    return res.data?.data as RepairRequest
  },
  async categories(token: string | undefined) {
    const res = await axios.get(`${BASE_URL}/repair-requests/categories`, { headers: auth(token) })
    return (res.data?.data ?? []) as { id: number; name: string }[]
  },
  // approver pool = Approval Matrix roles of doc type REPAIR
  async approvers(token: string | undefined) {
    const res = await axios.get(`${BASE_URL}/master/eligible-approvers`, { headers: auth(token), params: { doc_type: 'REPAIR' } })
    const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
    return (Array.isArray(raw) ? raw : []) as { id?: number; value?: number; username?: string }[]
  },
  // generic approval engine; comments = the reject reason
  async decide(token: string | undefined, id: number, action: 'approve' | 'reject', comments?: string) {
    await axios.put(`${BASE_URL}/approval/REPAIR/${id}/${action}`, comments ? { comments } : {}, { headers: auth(token) })
  },
  // multipart: "data" = JSON payload, "files" = new attachments
  async save(token: string | undefined, id: number | null, payload: RepairPayload, files: File[]) {
    const fd = new FormData()
    fd.append('data', JSON.stringify(payload))
    files.forEach((f) => fd.append('files', f))
    const url = id ? `${BASE_URL}/repair-requests/${id}` : `${BASE_URL}/repair-requests`
    const res = await (id ? axios.put(url, fd, { headers: auth(token) }) : axios.post(url, fd, { headers: auth(token) }))
    return { data: res.data?.data as RepairRequest, message: String(res.data?.message ?? '') }
  },
}
