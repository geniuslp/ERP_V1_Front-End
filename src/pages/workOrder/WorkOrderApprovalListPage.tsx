import React, { useEffect, useState } from 'react'
import { Card, Table, Select, Input, Button, Space, Badge, message } from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { workOrderService } from '@/services/workOrderService'
import WOStatusBadge from '@/components/workOrder/WOStatusBadge'
import type { WOListItem } from '@/types/workOrder'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'PENDING_APPROVAL', label: 'รออนุมัติ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ไม่อนุมัติ' },
  { value: 'DRAFT', label: 'แบบร่าง' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
]

// Same pattern as POApprovalListPage: reuses the plain list endpoint filtered to
// status=PENDING_APPROVAL — approver scoping (if any) is enforced server-side by
// GET /work-order, not derived client-side.
const WorkOrderApprovalListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<WOListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL')
  const [search, setSearch] = useState('')

  const fetchList = async () => {
    setLoading(true)
    try {
      const result = await workOrderService.list(accessToken, {
        status: statusFilter || undefined,
        page,
        page_size: 20,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList() }, [statusFilter, page])

  const filtered = items.filter((item) => {
    if (!search) return true
    const q = search.toLowerCase()
    return item.wo_no.toLowerCase().includes(q) || (item.supplier_name ?? '').toLowerCase().includes(q)
  })

  const columns: ColumnsType<WOListItem> = [
    { title: 'เลขที่ WO', dataIndex: 'wo_no', key: 'wo_no', width: 150 },
    { title: 'วันที่', dataIndex: 'wo_date', key: 'wo_date', width: 110, render: (v: string) => v?.slice(0, 10) ?? '-' },
    { title: 'ผู้ว่าจ้าง', dataIndex: 'employer_name', key: 'employer_name' },
    { title: 'ผู้รับจ้าง', dataIndex: 'supplier_name', key: 'supplier_name', render: (v?: string) => v || '-' },
    {
      title: 'มูลค่าสัญญา', dataIndex: 'contract_amount', key: 'contract_amount', width: 160, align: 'right',
      render: (v: number) => (v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    { title: 'สถานะ', dataIndex: 'status', key: 'status', width: 140, render: (s: WOListItem['status']) => <WOStatusBadge status={s} /> },
    { title: 'ผู้สร้าง', dataIndex: 'created_by_name', key: 'created_by_name', render: (v?: string) => v || '-' },
    {
      title: '', key: 'action', width: 140,
      render: (_: unknown, record: WOListItem) => (
        <Button size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/work-order/${record.id}`) }}>
          ดูรายละเอียด
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="อนุมัติหนังสือสั่งจ้าง (WO)"
        subtitle="รายการหนังสือสั่งจ้างที่รอการอนุมัติ"
        breadcrumbs={[{ title: 'Home' }, { title: 'Work Order' }, { title: 'อนุมัติ WO' }]}
      />

      <Card style={cardStyle}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
            options={statusOptions}
          />
          <Input
            placeholder="ค้นหา เลข WO / ผู้รับจ้าง"
            prefix={<SearchOutlined />}
            style={{ width: 240 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          {statusFilter === 'PENDING_APPROVAL' && total > 0 && (
            <Space>
              <Badge count={total} overflowCount={999} color="#faad14" />
              <span style={{ fontSize: 13, color: '#666' }}>รออนุมัติ</span>
            </Space>
          )}
          <Button icon={<ReloadOutlined />} onClick={fetchList} loading={loading}>โหลดใหม่</Button>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: (p) => setPage(p),
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            showSizeChanger: false,
          }}
          onRow={(record) => ({
            onClick: () => navigate(`/work-order/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          scroll={{ x: 900 }}
          size="small"
        />
      </Card>
    </div>
  )
}

export default WorkOrderApprovalListPage
