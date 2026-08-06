import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Button, Space, message, Alert } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { grnReceivingService, GRN_RECEIVING_MOCK_MODE } from '@/services/grnReceivingService'
import GRNQualityBadge from '@/components/stock/GRNQualityBadge'
import type { GRNv2ListItem } from '@/types'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

// GRN history for the new draft/confirm flow — filterable by PO since one PO
// can have multiple GRNs from receiving in several batches.
const GRNv2ListPage: React.FC = () => {
  const navigate = useNavigate()

  const [data, setData] = useState<GRNv2ListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)
  const [poNoFilter, setPoNoFilter] = useState('')

  const fetchData = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await grnReceivingService.getGrnList({ page: nextPage, limit, po_no: poNoFilter || undefined })
      setData(res.data)
      setTotal(res.total)
      setPage(nextPage)
    } catch (err: any) {
      setData([])
      setTotal(0)
      message.error(err?.response?.data?.message || err?.message || 'โหลดรายการ GRN ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(1) }, [])

  const columns = [
    { title: 'เลข GRN', dataIndex: 'grn_no', key: 'grn_no' },
    { title: 'วันที่รับ', dataIndex: 'grn_date', key: 'grn_date', render: (v?: string) => v?.slice(0, 10) || '—' },
    { title: 'เลข PO', dataIndex: 'po_no', key: 'po_no' },
    { title: 'Supplier', dataIndex: 'supplier_code', key: 'supplier_code' },
    { title: 'คลัง', dataIndex: 'warehouse_code', key: 'warehouse_code', render: (v?: string) => v || '—' },
    { title: 'สถานะ', dataIndex: 'status', key: 'status' },
    {
      title: 'คุณภาพ',
      dataIndex: 'quality_status',
      key: 'quality_status',
      render: (v: GRNv2ListItem['quality_status']) => <GRNQualityBadge status={v} />,
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: GRNv2ListItem) => (
        <Button size="small" onClick={() => navigate(`/stock/grn/${r.grn_id}`)}>ดูรายละเอียด</Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ประวัติ GRN"
        subtitle="รายการรับเข้าสินค้าทั้งหมด (draft/confirm flow)"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'ประวัติ GRN' }]}
      />

      {GRN_RECEIVING_MOCK_MODE && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="กำลังแสดงข้อมูลจำลอง (mock) — รอ backend deploy" />
      )}

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="เลข PO"
            value={poNoFilter}
            onChange={(e) => setPoNoFilter(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchData(1)}>ค้นหา</Button>
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
            onChange: (p) => fetchData(p),
          }}
          locale={{ emptyText: 'ไม่พบข้อมูล GRN' }}
          onRow={(record) => ({ onClick: () => navigate(`/stock/grn/${record.grn_id}`), style: { cursor: 'pointer' } })}
        />
      </Card>
    </div>
  )
}

export default GRNv2ListPage
