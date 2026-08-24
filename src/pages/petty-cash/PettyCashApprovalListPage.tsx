import React, { useEffect, useState } from 'react'
import { Table, Select, Input, Button, Space, Badge, message } from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { useAppSelector } from '@/store'
import PageHeader from '@/components/common/PageHeader'
import StatusBadge from '@/components/common/StatusBadge'
import { pettyCashService } from '@/services/pettyCashService'
import type { PettyCashRequisition } from '@/types/pettyCash'

const statusOptions = [
  { value: 'PENDING_APPROVAL', label: 'รออนุมัติ' },
  { value: '', label: 'ทุกสถานะ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ปฏิเสธ' },
]

const PettyCashApprovalListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<PettyCashRequisition[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL')
  const [search, setSearch] = useState('')

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await pettyCashService.list(accessToken, {
        status: statusFilter || undefined,
        page,
        page_size: 20,
      })
      setItems(res.data)
      setTotal(res.total)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList() }, [statusFilter, page])

  const filtered = items.filter((r) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return r.pc_no.toLowerCase().includes(q) || (r.project_codes ?? []).some((c) => c.toLowerCase().includes(q))
  })

  const columns: ColumnsType<PettyCashRequisition> = [
    { title: 'เลขที่', dataIndex: 'pc_no', key: 'pc_no', width: 160 },
    { title: 'วันที่', dataIndex: 'pc_date', key: 'pc_date', width: 110, render: (v: string) => v?.slice(0, 10) ?? '-' },
    {
      title: 'โครงการ',
      key: 'project',
      render: (_: unknown, r) => (r.project_codes && r.project_codes.length > 0 ? r.project_codes.join(', ') : '-'),
    },
    { title: 'ผู้ขอเบิก', dataIndex: 'requested_by_name', key: 'requested_by_name' },
    {
      title: 'มูลค่าสุทธิ',
      key: 'net_amount',
      width: 160,
      align: 'right',
      render: (_: unknown, r) => `${r.net_amount.toLocaleString('th-TH')} ${r.currency}`,
    },
    { title: 'สถานะ', dataIndex: 'status', key: 'status', width: 130, render: (v: string) => <StatusBadge status={v} /> },
    {
      title: '',
      key: 'action',
      width: 140,
      render: (_: unknown, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/petty-cash/${r.id}`) }}>
          ดูรายละเอียด
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="อนุมัติเบิกเงินสดย่อย"
        subtitle="รายการใบเบิกเงินสดย่อยที่รอการอนุมัติ"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'เบิกเงินสดย่อย' }, { title: 'อนุมัติ' }]}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select style={{ width: 160 }} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} options={statusOptions} />
        <Input
          placeholder="ค้นหา เลขที่ / โครงการ"
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
        onRow={(record) => ({ onClick: () => navigate(`/petty-cash/${record.id}`), style: { cursor: 'pointer' } })}
        scroll={{ x: 900 }}
        size="small"
        style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}
      />
    </div>
  )
}

export default PettyCashApprovalListPage
