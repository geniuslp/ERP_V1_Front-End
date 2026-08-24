import React, { useEffect, useState } from 'react'
import { Card, Table, Input, DatePicker, Button, Space, Empty } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { stockTransferService } from '@/services/stockTransfer.service'
import type { StockTransferListItem } from '@/types/stockTransfer'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const LIST_PATH = '/stock/wh-requisition-approval'

// This page is a focused "things waiting on me" view — always hard-filtered to status=DRAFT,
// no status selector (unlike StockTransferListView, which shows all statuses). Project isn't a
// server-side filter param on stockTransferService.list, so it's filtered client-side over the
// fetched DRAFT page below.
const StockWhRequisitionApprovalListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [data, setData] = useState<StockTransferListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)

  const fetchList = async (nextPage = page) => {
    if (!accessToken) return
    setLoading(true)
    try {
      const result = await stockTransferService.list(accessToken, {
        transferType: 'WH_TO_PROJECT',
        status: 'DRAFT',
        fromWarehouseCode: warehouseFilter || undefined,
        search: search || undefined,
        dateFrom: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
        dateTo: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
        page: nextPage,
        pageSize,
      })
      setData(result.items)
      setTotal(result.total)
      setPage(nextPage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList(1) }, [])

  const handleReset = () => {
    setSearch('')
    setProjectFilter('')
    setWarehouseFilter('')
    setDateRange(null)
    fetchList(1)
  }

  const filtered = projectFilter
    ? data.filter((r) => {
        const q = projectFilter.toLowerCase()
        return (r.to_project_name || '').toLowerCase().includes(q) || (r.to_project_code || '').toLowerCase().includes(q)
      })
    : data

  const columns = [
    {
      title: 'เลขที่เอกสาร',
      dataIndex: 'transfer_no',
      key: 'transfer_no',
      render: (v: string, record: StockTransferListItem) => (
        <a onClick={() => navigate(`${LIST_PATH}/${record.transfer_id}`)} style={{ color: '#2563eb', fontWeight: 600 }}>
          {v}
        </a>
      ),
    },
    {
      title: 'วันที่',
      dataIndex: 'transfer_date',
      key: 'transfer_date',
      render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'โครงการ',
      key: 'project',
      render: (_: unknown, r: StockTransferListItem) => r.to_project_name || r.to_project_code || '—',
    },
    {
      title: 'คลัง',
      key: 'warehouse',
      render: (_: unknown, r: StockTransferListItem) => r.from_warehouse_name || r.from_warehouse_code || '—',
    },
    { title: 'ผู้ขอ', dataIndex: 'requested_by_name', key: 'requested_by_name' },
    { title: 'จำนวนรายการ', dataIndex: 'line_count', key: 'line_count', width: 110, align: 'right' as const },
    {
      title: '',
      key: 'action',
      width: 120,
      render: (_: unknown, record: StockTransferListItem) => (
        <Button size="small" type="primary" onClick={() => navigate(`${LIST_PATH}/${record.transfer_id}`)}>
          ตรวจสอบ
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ตรวจสอบ/อนุมัติใบเบิก"
        subtitle="รายการใบเบิกที่รอตรวจสอบและยืนยัน"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'ตรวจสอบ/อนุมัติใบเบิก' }]}
      />

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="ค้นหาเลขที่เอกสาร"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => fetchList(1)}
            style={{ width: 200 }}
            allowClear
          />
          <Input
            placeholder="โครงการ"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{ width: 160 }}
            allowClear
          />
          <Input
            placeholder="รหัสคลัง"
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            style={{ width: 140 }}
            allowClear
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(val) => setDateRange(val as [Dayjs, Dayjs] | null)}
            format="DD/MM/YYYY"
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchList(1)}>ค้นหา</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>ล้างตัวกรอง</Button>
        </Space>

        {!loading && total === 0 ? (
          <Empty description="ไม่มีใบเบิกที่รอตรวจสอบในขณะนี้" style={{ padding: '40px 0' }} />
        ) : (
          <Table
            rowKey="transfer_id"
            loading={loading}
            columns={columns}
            dataSource={filtered}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: false,
              onChange: (p) => fetchList(p),
            }}
            locale={{ emptyText: 'ไม่พบรายการ' }}
          />
        )}
      </Card>
    </div>
  )
}

export default StockWhRequisitionApprovalListPage
