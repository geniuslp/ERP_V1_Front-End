import React from 'react'
import { Tag } from 'antd'
import type { GRNQualityStatus } from '@/types'

const map: Record<GRNQualityStatus, { color: string; label: string }> = {
  PENDING: { color: 'default', label: 'รอตรวจสอบ' },
  PASSED: { color: 'success', label: 'ผ่าน' },
  FAILED: { color: 'error', label: 'ไม่ผ่าน' },
  PARTIAL: { color: 'warning', label: 'ผ่านบางส่วน' },
}

const GRNQualityBadge: React.FC<{ status: GRNQualityStatus }> = ({ status }) => {
  const s = map[status] ?? { color: 'default', label: status }
  return <Tag color={s.color}>{s.label}</Tag>
}

export default GRNQualityBadge
