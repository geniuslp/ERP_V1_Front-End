import React from 'react'
import { Tag, Space } from 'antd'
import type { POStatus, POReceiveStatus } from '@/types/po'

// Approval-status color/label map — deduplicated from the identical local
// `statusTag` copies that used to live in POStatusPage.tsx, POHistoryPage.tsx,
// POMyListPage.tsx and POApprovalDetailPage.tsx. Kept in sync with the real
// DB CHECK constraint on purchase_order.status.
const approvalMap: Record<POStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: 'แบบร่าง' },
  PENDING_APPROVAL: { color: 'processing', label: 'รออนุมัติ' },
  APPROVED: { color: 'success', label: 'อนุมัติแล้ว' },
  REJECTED: { color: 'error', label: 'ไม่อนุมัติ' },
  PENDING_REAPPROVAL: { color: 'gold', label: 'รออนุมัติอีกครั้ง' },
  SENT: { color: 'blue', label: 'ส่งแล้ว' },
  PARTIALLY_RECEIVED: { color: 'cyan', label: 'รับสินค้าบางส่วน' },
  RECEIVED: { color: 'green', label: 'รับสินค้าแล้ว' },
  CANCELLED: { color: 'warning', label: 'ยกเลิก' },
}

// New status_receive field (2026-07-27 session) — independent from approval
// status now that PO has status/status_receive as two separate columns.
const receiveMap: Record<POReceiveStatus, { color: string; label: string }> = {
  NOT_SENT: { color: 'default', label: 'ยังไม่ส่งของ' },
  SENT: { color: 'blue', label: 'ส่งของแล้ว' },
  PARTIALLY_RECEIVED: { color: 'cyan', label: 'รับของบางส่วน' },
  RECEIVED: { color: 'success', label: 'รับของครบแล้ว' },
}

export const POApprovalStatusTag: React.FC<{ status: POStatus }> = ({ status }) => {
  const s = approvalMap[status] ?? { color: 'default', label: status }
  return <Tag color={s.color}>{s.label}</Tag>
}

export const POReceiveStatusTag: React.FC<{ status: POReceiveStatus }> = ({ status }) => {
  const s = receiveMap[status] ?? { color: 'default', label: status }
  return <Tag color={s.color}>{s.label}</Tag>
}

interface POStatusBadgesProps {
  status: POStatus
  // Optional because status_receive isn't confirmed present on every PO
  // endpoint yet — only render the second badge once the backend includes it.
  statusReceive?: POReceiveStatus
}

const POStatusBadges: React.FC<POStatusBadgesProps> = ({ status, statusReceive }) => (
  <Space size={4}>
    <POApprovalStatusTag status={status} />
    {statusReceive && <POReceiveStatusTag status={statusReceive} />}
  </Space>
)

export default POStatusBadges
