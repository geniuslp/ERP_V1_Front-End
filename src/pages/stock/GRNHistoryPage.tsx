import React, { useEffect, useState } from 'react'
import { Card, Table, Input, DatePicker, Button, Space, Rate, message } from 'antd'
import axios from 'axios'
import dayjs, { Dayjs } from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import type { GRNHistoryItem } from '@/types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const GRNHistoryPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [data, setData] = useState<GRNHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)

  const [supplierFilter, setSupplierFilter] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)

  const fetchHistory = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/grn/history`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          page: nextPage,
          limit,
          supplier_code: supplierFilter || undefined,
          date_from: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
          date_to: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
        },
      })
      const rows: GRNHistoryItem[] = res.data?.data ?? []
      setData(rows)
      setTotal(res.data?.meta?.total ?? 0)
      setPage(nextPage)
    } catch (err: any) {
      setData([])
      setTotal(0)
      message.error(err?.response?.data?.message || err?.message || 'โหลดประวัติการรับเข้าไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHistory(1) }, [])

  const renderScore = (val?: number) =>
    val ? <Rate disabled value={val} style={{ fontSize: 12 }} /> : <span style={{ color: '#9ca3af' }}>—</span>

  const columns = [
    { title: 'เลข GRN', dataIndex: 'grn_no', key: 'grn_no' },
    {
      title: 'วันที่รับ',
      dataIndex: 'grn_date',
      key: 'grn_date',
      render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    { title: 'เลข PO', dataIndex: 'po_no', key: 'po_no' },
    { title: 'Supplier', dataIndex: 'supplier_code', key: 'supplier_code' },
    { title: 'คลัง', dataIndex: 'warehouse_code', key: 'warehouse_code', render: (v?: string) => v || '—' },
    { title: 'จำนวนรายการ', dataIndex: 'line_count', key: 'line_count', align: 'right' as const },
    {
      title: 'จำนวนรับรวม',
      dataIndex: 'total_qty_received',
      key: 'total_qty_received',
      align: 'right' as const,
      render: (v: number) => (v ?? 0).toLocaleString(),
    },
    { title: 'ตรงเวลา', dataIndex: 'score_ontime', key: 'score_ontime', render: renderScore },
    { title: 'ครบถ้วน', dataIndex: 'score_quantity', key: 'score_quantity', render: renderScore },
    { title: 'คุณภาพ', dataIndex: 'score_quality', key: 'score_quality', render: renderScore },
    { title: 'ผู้รับของ', dataIndex: 'received_by_name', key: 'received_by_name', render: (v?: string) => v || '—' },
  ]

  return (
    <div>
      <PageHeader
        title="ประวัติการรับเข้า"
        subtitle="รายการรับเข้าสินค้าทั้งหมด"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'ประวัติการรับเข้า' }]}
      />
      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(val) => setDateRange(val as [Dayjs, Dayjs] | null)}
            format="DD/MM/YYYY"
          />
          <Input
            placeholder="Supplier code"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            allowClear
            style={{ width: 180 }}
          />
          <Button type="primary" onClick={() => fetchHistory(1)}>ค้นหา</Button>
        </Space>
        <Table
          rowKey="grn_id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: false,
            onChange: (p) => fetchHistory(p),
          }}
          locale={{ emptyText: 'ไม่พบประวัติการรับเข้า' }}
        />
      </Card>
    </div>
  )
}

export default GRNHistoryPage
