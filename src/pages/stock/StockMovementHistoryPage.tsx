import React, { useEffect, useState } from 'react'
import { Card, Table, Select, DatePicker, Input, Button, Space } from 'antd'
import { SearchOutlined, ReloadOutlined, ArrowRightOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { stockTransferService } from '@/services/stockTransfer.service'
import type { StockTransactionHistoryItem } from '@/types/stockTransfer'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const StockMovementHistoryPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [data, setData] = useState<StockTransactionHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [matCode, setMatCode] = useState('')
  const [txnType, setTxnType] = useState<string | undefined>()
  const [warehouseCode, setWarehouseCode] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)

  const fetchData = async (nextPage = page) => {
    if (!accessToken) return
    setLoading(true)
    try {
      const result = await stockTransferService.history(accessToken, {
        matCode: matCode || undefined,
        transferType: txnType,
        warehouseCode: warehouseCode || undefined,
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

  useEffect(() => { fetchData(1) }, [])

  const handleReset = () => {
    setMatCode('')
    setTxnType(undefined)
    setWarehouseCode('')
    setDateRange(null)
    fetchData(1)
  }

  const detailPath = (r: StockTransactionHistoryItem) => {
    if (!r.ref_doc_id) return null
    return r.source_type === 'REQUISITION' ? `/stock/wh-requisition/${r.ref_doc_id}` : `/stock/wh-transfer/${r.ref_doc_id}`
  }

  const columns = [
    { title: 'วันที่', dataIndex: 'txn_date', key: 'txn_date', render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—') },
    {
      title: 'รหัสวัสดุ / ชื่อ', key: 'item',
      render: (_: unknown, r: StockTransactionHistoryItem) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.mat_code}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{r.item_name}</div>
        </div>
      ),
    },
    {
      title: 'จาก → ไป', key: 'route',
      render: (_: unknown, r: StockTransactionHistoryItem) => (
        <span style={{ fontSize: 13 }}>
          {r.from_is_warehouse ? `คลัง ${r.from_location}` : `โครงการ ${r.from_location}`}
          <ArrowRightOutlined style={{ margin: '0 6px', color: '#9ca3af' }} />
          {r.to_is_warehouse ? `คลัง ${r.to_location}` : `โครงการ ${r.to_location}`}
        </span>
      ),
    },
    { title: 'จำนวน', dataIndex: 'qty', key: 'qty', align: 'right' as const },
    {
      title: 'เอกสารอ้างอิง', key: 'ref',
      render: (_: unknown, r: StockTransactionHistoryItem) => {
        const path = detailPath(r)
        if (!path || !r.ref_doc_no) return r.ref_doc_no || '—'
        return (
          <a onClick={() => navigate(path)} style={{ color: '#2563eb', fontWeight: 600 }}>
            {r.ref_doc_no}
          </a>
        )
      },
    },
    { title: 'ผู้บันทึก', dataIndex: 'created_by_name', key: 'created_by_name' },
  ]

  return (
    <div>
      <PageHeader
        title="ประวัติการเคลื่อนไหว"
        subtitle="ประวัติการเบิก/ย้ายวัสดุทั้งหมด"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'ประวัติการเคลื่อนไหว' }]}
      />

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="ค้นหารหัสวัสดุ"
            value={matCode}
            onChange={(e) => setMatCode(e.target.value)}
            onPressEnter={() => fetchData(1)}
            style={{ width: 180 }}
            allowClear
          />
          <Select
            placeholder="ประเภทการเคลื่อนไหว"
            allowClear
            value={txnType}
            onChange={setTxnType}
            style={{ width: 180 }}
            options={[
              { value: 'WH_TO_WH', label: 'ย้ายคลัง' },
              { value: 'WH_TO_PROJECT', label: 'เบิกไปโครงการ' },
              { value: 'PROJECT_TO_WH', label: 'คืนจากโครงการ' },
            ]}
          />
          <Input
            placeholder="รหัสคลัง"
            value={warehouseCode}
            onChange={(e) => setWarehouseCode(e.target.value)}
            style={{ width: 140 }}
            allowClear
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(val) => setDateRange(val as [Dayjs, Dayjs] | null)}
            format="DD/MM/YYYY"
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchData(1)}>ค้นหา</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>ล้างตัวกรอง</Button>
        </Space>

        <Table
          rowKey="txn_id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: (p) => fetchData(p),
          }}
          locale={{ emptyText: 'ไม่พบประวัติการเคลื่อนไหว' }}
        />
      </Card>
    </div>
  )
}

export default StockMovementHistoryPage
