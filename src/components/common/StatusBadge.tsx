import React from 'react'
import { Tag } from 'antd'

const statusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: 'ร่าง' },
  pending: { color: 'orange', label: 'รออนุมัติ' },
  approved: { color: 'green', label: 'อนุมัติแล้ว' },
  rejected: { color: 'red', label: 'ปฏิเสธ' },
  cancelled: { color: 'gray', label: 'ยกเลิก' },
  sent: { color: 'blue', label: 'ส่งแล้ว' },
  partial: { color: 'cyan', label: 'รับบางส่วน' },
  completed: { color: 'green', label: 'เสร็จสิ้น' },
}

interface StatusBadgeProps {
  status: string
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || { color: 'default', label: status }
  return <Tag color={config.color}>{config.label}</Tag>
}

export default StatusBadge
