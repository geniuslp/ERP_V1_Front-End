import React from 'react'
import { Tag } from 'antd'
import type { BorrowStatus } from '@/types/stock'

const colorMap: Record<BorrowStatus, string> = {
  DRAFT:               'default',
  PENDING_APPROVAL:    'orange',
  APPROVED:            'blue',
  REJECTED:            'red',
  BORROWED:            'purple',
  RETURNED:            'green',
  PARTIALLY_RETURNED:  'cyan',
}

const labelMap: Record<BorrowStatus, string> = {
  DRAFT:               'Draft',
  PENDING_APPROVAL:    'Pending Approval',
  APPROVED:            'Approved',
  REJECTED:            'Rejected',
  BORROWED:            'Borrowed',
  RETURNED:            'Returned',
  PARTIALLY_RETURNED:  'Partially Returned',
}

interface Props {
  status: BorrowStatus
}

const BorrowStatusBadge: React.FC<Props> = ({ status }) => (
  <Tag color={colorMap[status] ?? 'default'}>{labelMap[status] ?? status}</Tag>
)

export default BorrowStatusBadge
