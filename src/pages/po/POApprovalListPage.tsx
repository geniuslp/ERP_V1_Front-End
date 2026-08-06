import React, { useState, useEffect } from 'react'
import { Table, Select, Input, Button, Space, Badge, message } from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { useAppSelector } from '@/store'
import type { POListItem } from '@/types/po'
import PageHeader from '@/components/common/PageHeader'
import { poApprovalService } from '@/services/poApprovalService'
import POStatusBadges from '@/components/po/POStatusBadge'

// TODO: enable when permission system is ready
// const userDept = useAppSelector((s) => s.auth.user?.department)
// const isManager = ['MANAGER', 'DIRECTOR', 'MD'].includes(userDept ?? '')

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'PENDING_APPROVAL', label: 'รออนุมัติ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ไม่อนุมัติ' },
  { value: 'DRAFT', label: 'แบบร่าง' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
]

const POApprovalListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<POListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_APPROVAL')
  const [search, setSearch] = useState('')

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await poApprovalService.getList(accessToken, {
        status: statusFilter || undefined,
        page,
        limit: 20,
      })
      const data = res.data.data
      setItems(Array.isArray(data.data) ? data.data : [])
      setTotal(data.total ?? 0)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'โหลดข้อมูลไม่สำเร็จ',
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
      item.po_no.toLowerCase().includes(q) ||
      item.supplier_name.toLowerCase().includes(q)
    )
  })

  const columns: ColumnsType<POListItem> = [
    {
      title: 'เลข PO',
      dataIndex: 'po_no',
      key: 'po_no',
      width: 150,
    },
    {
      title: 'วันที่',
      dataIndex: 'po_date',
      key: 'po_date',
      width: 110,
      render: (v: string) => v?.slice(0, 10) ?? '-',
    },
    {
      title: 'Supplier',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
    },
    {
      title: 'มูลค่า',
      key: 'net_amount',
      width: 160,
      align: 'right',
      render: (_: unknown, r: POListItem) =>
        `${r.net_amount.toLocaleString('th-TH')} ${r.currency}`,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (_v: unknown, r: POListItem) => <POStatusBadges status={r.status} statusReceive={r.status_receive} />,
    },
    {
      title: 'ผู้สร้าง',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
    },
    {
      title: 'วันที่ต้องการ',
      dataIndex: 'expected_date',
      key: 'expected_date',
      width: 120,
      render: (v: string | null) => v?.slice(0, 10) ?? '-',
    },
    {
      title: '',
      key: 'action',
      width: 140,
      render: (_: unknown, record: POListItem) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/po/approval/${record.po_id}`)
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
        title="อนุมัติใบสั่งซื้อ (PO)"
        subtitle="รายการใบสั่งซื้อที่รอการอนุมัติ"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบสั่งซื้อ' }, { title: 'อนุมัติ PO' }]}
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
          placeholder="ค้นหา เลข PO / Supplier"
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
        rowKey="po_id"
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
          onClick: () => navigate(`/po/approval/${record.po_id}`),
          style: { cursor: 'pointer' },
        })}
        scroll={{ x: 900 }}
        size="small"
        style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}
      />
    </div>
  )
}

export default POApprovalListPage
