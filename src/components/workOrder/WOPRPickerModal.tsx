import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Input, Table, Tag, Button } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { ORDER_TYPE_LABEL } from '@/constants/orderTypes'
import type { WOAvailablePR } from '@/types/workOrder'

// PR document type shown to the user: only these two can reach a work order (see GET /work-order/available-prs).
const PR_TYPE_LABEL: Record<string, string> = { PO_WO: 'PO/WO', WO_ONLY: 'WO' }

interface Props {
  open: boolean
  loading: boolean
  prs: WOAvailablePR[]
  selectedPrId: number | null
  onClose: () => void
  onPick: (pr: WOAvailablePR) => void
}

// Picker for "ดึงข้อมูลจาก PR" on the WO create page — the WO counterpart of PO's PR sidebar. The list is
// already filtered by the backend (approved, PO/WO or WO type, not used by another work order).
const WOPRPickerModal: React.FC<Props> = ({ open, loading, prs, selectedPrId, onClose, onPick }) => {
  const [search, setSearch] = useState('')
  useEffect(() => { if (open) setSearch('') }, [open])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return prs
    return prs.filter((p) =>
      `${p.pr_no} ${p.project_code ?? ''} ${p.project_name ?? ''} ${p.requested_by} ${p.job_code ?? ''}`.toLowerCase().includes(q))
  }, [prs, search])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1500px, 95vw)"
      title="ดึงข้อมูลจาก PR"
      destroyOnClose
    >
      <div style={{ marginBottom: 8, fontSize: 13, color: '#6b7280' }}>
        แสดงเฉพาะ PR ที่อนุมัติแล้ว และประเภทเอกสารเป็น PO/WO หรือ WO ที่ยังไม่ถูกใช้ในหนังสือสั่งจ้างอื่น
      </div>
      <Input
        prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
        placeholder="ค้นหาเลขที่ PR / โครงการ / ผู้ขอซื้อ"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 12 }}
      />
      <Table<WOAvailablePR>
        rowKey="pr_id"
        size="small"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 8, showSizeChanger: false }}
        locale={{ emptyText: prs.length === 0 ? 'ไม่มี PR ที่ดึงได้' : 'ไม่พบ PR ที่ค้นหา' }}
        scroll={{ x: 1300 }}
        columns={[
          { title: 'เลขที่ PR', dataIndex: 'pr_no', width: 150, render: (v: string) => <b style={{ color: '#1d4ed8' }}>{v}</b> },
          {
            title: 'โครงการ', key: 'project', width: 520,
            render: (_: unknown, r) => [r.project_code, r.project_name].filter(Boolean).join(' ') || '-',
          },
          { title: 'Job', dataIndex: 'job_code', width: 70, render: (v?: string | null) => v || '-' },
          {
            title: 'ประเภทเอกสาร', dataIndex: 'pr_type', width: 120,
            render: (v: string) => <Tag color="blue" style={{ margin: 0 }}>{PR_TYPE_LABEL[v] ?? v}</Tag>,
          },
          {
            title: 'ประเภทการซื้อ', dataIndex: 'order_type', width: 130,
            render: (v: string) => ORDER_TYPE_LABEL[v] ?? v,
          },
          { title: 'ผู้ขอซื้อ', dataIndex: 'requested_by', width: 140 },
          { title: 'วันที่', dataIndex: 'pr_date', width: 100, render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '-') },
          {
            title: '', key: 'use', width: 90, fixed: 'right' as const,
            render: (_: unknown, r) => (
              <Button size="small" type={r.pr_id === selectedPrId ? 'default' : 'primary'} onClick={() => onPick(r)}>
                {r.pr_id === selectedPrId ? 'ใช้อยู่' : 'ใช้ PR นี้'}
              </Button>
            ),
          },
        ]}
      />
    </Modal>
  )
}

export default WOPRPickerModal
