import React from 'react'
import { Tag } from 'antd'
import type { WOStatus } from '@/types/workOrder'

// Per CLAUDE.md "StatusBadge" convention: DRAFT/default, PENDING_APPROVAL/warning,
// APPROVED/success, REJECTED/error, CANCELLED/gray.
const statusMap: Record<WOStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: 'แบบร่าง' },
  PENDING_APPROVAL: { color: 'processing', label: 'รออนุมัติ' },
  APPROVED: { color: 'success', label: 'อนุมัติแล้ว' },
  REJECTED: { color: 'error', label: 'ไม่อนุมัติ' },
  CANCELLED: { color: 'default', label: 'ยกเลิก' },
}

const WOStatusBadge: React.FC<{ status: WOStatus }> = ({ status }) => {
  const s = statusMap[status] ?? { color: 'default', label: status }
  return <Tag color={s.color}>{s.label}</Tag>
}

export default WOStatusBadge
