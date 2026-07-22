import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Select, DatePicker, Input, Tooltip, message } from 'antd'
import { PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, RollbackOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import BorrowStatusBadge from '@/components/stock/BorrowStatusBadge'
import { useAppSelector } from '@/store'
import { mockBorrowRequests } from '@/utils/mockStockData'
import type { BorrowRequest, BorrowStatus } from '@/types/stock'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const BorrowListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<BorrowRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<BorrowStatus | undefined>()
  const [range, setRange] = useState<any>(null)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/stock/borrow`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { status: status || undefined, search: search || undefined },
      })
      const raw = Array.isArray(res.data) ? res.data : res.data?.data
      setData(Array.isArray(raw) ? raw : [])
    } catch {
      let filtered = mockBorrowRequests
      if (status) filtered = filtered.filter((b) => b.status === status)
      if (search) filtered = filtered.filter((b) => b.borrowNo.includes(search) || b.requestedBy.toLowerCase().includes(search.toLowerCase()))
      setData(filtered)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [status, search])

  const columns = [
    {
      title: 'Borrow No',
      dataIndex: 'borrowNo',
      key: 'borrowNo',
      render: (no: string, record: BorrowRequest) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/stock/borrow/${record.id}`)}>
          {no}
        </a>
      ),
    },
    { title: 'Requested By', dataIndex: 'requestedBy', key: 'requestedBy' },
    { title: 'Purpose', dataIndex: 'purpose', key: 'purpose', ellipsis: true },
    {
      title: 'Borrow Date',
      dataIndex: 'borrowDate',
      key: 'borrowDate',
      render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Expected Return',
      dataIndex: 'expectedReturnDate',
      key: 'expectedReturnDate',
      render: (val?: string) => val ? dayjs(val).format('DD/MM/YYYY') : <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: BorrowStatus) => <BorrowStatusBadge status={s} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: BorrowRequest) => (
        <Space>
          <Tooltip title="View">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/stock/borrow/${record.id}`)} />
          </Tooltip>
          {record.status === 'BORROWED' && (
            <Tooltip title="Return Items">
              <Button size="small" icon={<RollbackOutlined />} onClick={() => navigate(`/stock/borrow/${record.id}`)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Borrow & Return"
        subtitle="Manage borrow requests and returns"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'Borrow & Return' }]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/stock/borrow/create')}
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
          >
            New Borrow Request
          </Button>
        }
      />
      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Select
            placeholder="Status"
            value={status}
            onChange={setStatus}
            allowClear
            style={{ width: 180 }}
            options={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'BORROWED', label: 'Borrowed' },
              { value: 'RETURNED', label: 'Returned' },
              { value: 'PARTIALLY_RETURNED', label: 'Partially Returned' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
          />
          <DatePicker.RangePicker value={range} onChange={setRange} format="DD/MM/YYYY" />
          <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} allowClear />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>Search</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setStatus(undefined); setSearch(''); setRange(null) }}>Reset</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 20, showTotal: (t) => `Total ${t} items` }}
          locale={{ emptyText: 'No borrow requests' }}
        />
      </Card>
    </div>
  )
}

export default BorrowListPage
