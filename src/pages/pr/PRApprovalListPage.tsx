import React, { useEffect, useState } from 'react'
import { Card, Table, Select, Input, Button, Space, Badge, Tag, message } from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { APPROVAL_EMPTY_TEXT, FOR_APPROVAL_QUERY } from '@/utils/approvalAccess'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

interface PRApprovalRow {
  id: number
  pr_no: string
  pr_date: string
  status: string
  requested_by: string
  project_code?: string | null
  project_name?: string | null
  order_type?: string | null
  job_code?: string | null
  approver_name?: string | null
  reject_reason?: string | null
}

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  PENDING_APPROVAL: { color: 'orange', label: 'รออนุมัติ' },
  COMPLETED: { color: 'green', label: 'อนุมัติแล้ว' },
  REJECTED: { color: 'red', label: 'ไม่อนุมัติ' },
}

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'PENDING_APPROVAL', label: 'รออนุมัติ' },
  { value: 'COMPLETED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ไม่อนุมัติ' },
]

// Same pattern as WorkOrderApprovalListPage / POApprovalListPage: the plain list endpoint, scoped to the caller with
// my_approvals=true (assigned to me, plus the ones I already decided). The scope is enforced server-side from the JWT.
const PRApprovalListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<PRApprovalRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/pr`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          my_approvals: true,
          status: statusFilter || undefined,
          search: search || undefined,
          page,
          limit: 20,
        },
      })
      const data = res.data?.data ?? res.data
      setItems(Array.isArray(data?.items) ? data.items : [])
      setTotal(Number(data?.total ?? 0))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList() }, [statusFilter, search, page])

  const open = (id: number) => navigate(`/pr/${id}?${FOR_APPROVAL_QUERY}`)

  const columns: ColumnsType<PRApprovalRow> = [
    { title: 'เลขที่ PR', dataIndex: 'pr_no', key: 'pr_no', width: 140 },
    { title: 'วันที่', dataIndex: 'pr_date', key: 'pr_date', width: 110, render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '-') },
    { title: 'ผู้ขอซื้อ', dataIndex: 'requested_by', key: 'requested_by', width: 160, render: (v?: string) => v || '-' },
    {
      title: 'โครงการ', key: 'project', ellipsis: true,
      render: (_: unknown, r) => (r.project_code ? `${r.project_code} ${r.project_name ?? ''}`.trim() : '-'),
    },
    { title: 'Job', dataIndex: 'job_code', key: 'job_code', width: 80, render: (v?: string | null) => v || '-' },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 130,
      render: (s: string) => {
        const t = STATUS_TAG[s] ?? { color: 'default', label: s }
        return <Tag color={t.color}>{t.label}</Tag>
      },
    },
    {
      title: 'หมายเหตุผู้ขออนุมัติ', dataIndex: 'reject_reason', key: 'reject_reason', ellipsis: true,
      render: (v: string | null | undefined, r) => (r.status === 'REJECTED' && v ? v : '-'),
    },
    {
      title: '', key: 'action', width: 140,
      render: (_: unknown, record) => (
        <Button size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); open(record.id) }}>
          ดูรายละเอียด
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="อนุมัติใบขอซื้อ (PR)"
        subtitle="รายการใบขอซื้อที่รอการอนุมัติ"
        breadcrumbs={[{ title: 'Home' }, { title: 'ใบขอซื้อ' }, { title: 'อนุมัติ PR' }]}
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
            placeholder="ค้นหา เลข PR / หมายเหตุ"
            prefix={<SearchOutlined />}
            style={{ width: 240 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
          dataSource={items}
          columns={columns}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: (p) => setPage(p),
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            showSizeChanger: false,
          }}
          onRow={(record) => ({ onClick: () => open(record.id), style: { cursor: 'pointer' } })}
          locale={{ emptyText: APPROVAL_EMPTY_TEXT }}
          scroll={{ x: 900 }}
          size="small"
        />
      </Card>
    </div>
  )
}

export default PRApprovalListPage
