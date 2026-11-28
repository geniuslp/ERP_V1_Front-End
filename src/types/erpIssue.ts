// ใบแจ้งปัญหาการใช้งาน ERP (backend: /erp-issues, migration 068_erp_issue.sql).

export type ERPIssueType = 'BUG' | 'USAGE' | 'IMPROVE' | 'NEW_MODULE'
export type ERPIssueStatus = 'PENDING_APPROVAL' | 'REJECTED' | 'PENDING' | 'IN_PROGRESS' | 'PREVIEW' | 'RESOLVED' | 'CLOSED'

export const ERP_ISSUE_TYPE_OPTIONS: { value: ERPIssueType; label: string }[] = [
  { value: 'BUG', label: 'แจ้งปัญหา / ระบบผิดพลาด' },
  { value: 'USAGE', label: 'สอบถามวิธีใช้งาน' },
  { value: 'IMPROVE', label: 'ขอปรับปรุงเมนูเดิม' },
  { value: 'NEW_MODULE', label: 'ขอ Module ใหม่ (ต้องขออนุมัติ)' },
]
export const ERP_ISSUE_TYPE_LABEL: Record<ERPIssueType, string> = {
  BUG: 'แจ้งปัญหา',
  USAGE: 'สอบถามวิธีใช้งาน',
  IMPROVE: 'ขอปรับปรุง',
  NEW_MODULE: 'ขอ Module ใหม่',
}

export const ERP_ISSUE_STATUS: Record<ERPIssueStatus, { label: string; color: string }> = {
  PENDING_APPROVAL: { label: 'รออนุมัติ', color: 'orange' },
  REJECTED: { label: 'ไม่อนุมัติ', color: 'red' },
  PENDING: { label: 'Pending', color: 'gold' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ', color: 'blue' },
  PREVIEW: { label: 'Preview (Test on UAT)', color: 'cyan' },
  RESOLVED: { label: 'แก้ไขแล้ว', color: 'green' },
  CLOSED: { label: 'ปิดงาน', color: 'default' },
}

/** Statuses an admin may set. */
export const ERP_ISSUE_ADMIN_STATUSES: ERPIssueStatus[] = ['PENDING', 'IN_PROGRESS', 'PREVIEW', 'RESOLVED', 'CLOSED']

export interface ERPIssueAttachment {
  id: number
  /** null = attached by the reporter; set = attached by the admin with that status update */
  log_id: number | null
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  uploaded_at: string
}

export interface ERPIssueLog {
  id: number
  from_status: string | null
  to_status: string
  changed_by_name: string | null
  changed_at: string
  remarks: string | null
}

export interface ERPIssue {
  id: number
  issue_no: string
  issue_type: ERPIssueType
  menu_code: string | null
  menu_name: string | null
  menu_parent_name: string | null
  module_name: string | null
  title: string
  detail: string
  status: ERPIssueStatus
  reported_by: number
  reported_by_name: string | null
  reported_dept: string | null
  reported_at: string
  approver_id: number | null
  approver_name: string | null
  admin_remark: string | null
  handled_by_name: string | null
  handled_at: string | null
  attachment_count: number
  attachments?: ERPIssueAttachment[]
  logs?: ERPIssueLog[]
}

export const formatIssueMenu = (i: Pick<ERPIssue, 'menu_name' | 'menu_parent_name' | 'menu_code'>): string => {
  if (!i.menu_name) return i.menu_code || '-'
  return i.menu_parent_name ? `${i.menu_parent_name} › ${i.menu_name}` : i.menu_name
}
