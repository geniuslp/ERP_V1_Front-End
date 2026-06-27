import React from 'react'
import { Tag } from 'antd'
import type { MemoStatus } from '@/types'

const STATUS_CONFIG: Record<MemoStatus, { label: string; color: string }> = {
  DRAFT:            { label: 'ร่าง',           color: 'default' },
  PENDING_APPROVAL: { label: 'รอการอนุมัติ',   color: 'orange'  },
  APPROVED:         { label: 'อนุมัติแล้ว',    color: 'green'   },
  REJECTED:         { label: 'ถูกปฏิเสธ',      color: 'red'     },
  CANCELLED:        { label: 'ยกเลิก',          color: 'default' },
  draft:            { label: 'ร่าง',           color: 'default' },
  pending_po:       { label: 'รอสร้าง PO',     color: 'orange'  },
  po_created:       { label: 'สร้าง PO แล้ว',  color: 'green'   },
  cancelled:        { label: 'ยกเลิก',          color: 'default' },
}

interface MemoStatusBadgeProps {
  status: MemoStatus
}

const MemoStatusBadge: React.FC<MemoStatusBadgeProps> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'default' }
  return <Tag color={cfg.color}>{cfg.label}</Tag>
}

export default MemoStatusBadge
