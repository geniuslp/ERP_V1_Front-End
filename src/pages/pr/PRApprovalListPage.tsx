import React, { useState, useEffect } from 'react'
import { Table, Select, Input, Tag, Button, Space, Badge, message } from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import axios from 'axios'
import { useAppSelector } from '@/store'
import type { PRListItem, PRListResponse, PRStatus } from '@/types/pr'
import PageHeader from '@/components/common/PageHeader'

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'PENDING_APPROVAL', label: 'รออนุมัติ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ไม่อนุมัติ' },
  { value: 'DRAFT', label: 'แบบร่าง' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
]

const statusTag = (status: PRStatus) => {
  const map: Record<PRStatus, { color: string; label: string }> = {
    PENDING_APPROVAL: { color: 'processing', label: 'รออนุมัติ' },
    APPROVED: { color: 'success', label: 'อนุมัติแล้ว' },
    REJECTED: { color: 'error', label: 'ไม่อนุมัติ' },
    DRAFT: { color: 'default', label: 'แบบร่าง' },
    CANCELLED: { color: 'warning', label: 'ยกเลิก' },
  }
  const s = map[status] ?? { color: 'default', label: status }
  return <Tag color={s.color}>{s.label}</Tag>
}

const PRApprovalListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

  // TODO: enable when permission system is ready
  // const userDept = useAppSelector((s) => s.auth.user?.department)
  // const isSeniorPM = userDept === 'Senior Project Mgr'

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<PRListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_APPROVAL')
  const [search, setSearch] = useState('')

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await axios.get<PRListResponse>(`${BASE_URL}/pr`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          status: statusFilter || undefined,
          page,
          limit: 20,
        },
      })
      const data = res.data.data
      setItems(Array.isArray(data.items) ? data.items : [])
      setTotal(data.total ?? 0)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [statusFilter, page])

  const filtered = items.filter((item) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      item.pr_no.toLowerCase().includes(q) ||
      (item.requested_by ?? '').toLowerCase().includes(q)
    )
  })

  const columns: ColumnsType<PRListItem> = [
    {
      title: 'เลข PR',
      dataIndex: 'pr_no',
      key: 'pr_no',
      width: 150,
    },
    {
      title: 'วันที่',
      dataIndex: 'pr_date',
      key: 'pr_date',
      width: 110,
      render: (v: string) => v?.slice(0, 10) ?? '-',
    },
    {
      title: 'ผู้ขอ',
      dataIndex: 'requested_by',
      key: 'requested_by',
    },
    {
      title: 'Location',
      dataIndex: 'location_code',
      key: 'location_code',
      width: 110,
    },
    {
      title: 'Project',
      dataIndex: 'project_code',
      key: 'project_code',
      width: 130,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (v: PRStatus) => statusTag(v),
    },
    {
      title: 'ผู้อนุมัติ',
      dataIndex: 'approver_name',
      key: 'approver_name',
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '',
      key: 'action',
      width: 130,
      render: (_: unknown, record: PRListItem) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/pr/approval/${record.id}`)
          }}
        >
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
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบขอซื้อ' }, { title: 'อนุมัติ PR' }]}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          options={statusOptions}
        />
        <Input
          placeholder="ค้นหา เลข PR / ผู้ขอ"
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
        <Button icon={<ReloadOutlined />} onClick={fetchList} loading={loading}>
          โหลดใหม่
        </Button>
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
          onClick: () => navigate(`/pr/approval/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        scroll={{ x: 800 }}
        size="small"
        style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}
      />
    </div>
  )
}

export default PRApprovalListPage
