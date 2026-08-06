import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Button, Space, message, Alert } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { grnReceivingService, GRN_RECEIVING_MOCK_MODE } from '@/services/grnReceivingService'
import POStatusBadges from '@/components/po/POStatusBadge'
import type { ReceivablePoItem } from '@/types'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

// New "รับเข้า" list — calls GET /po/receivable (backend filters to POs with
// status IN APPROVED/SENT/PARTIALLY_RECEIVED and >=1 OPEN/PARTIAL line).
// Distinct from the older /po/search-based GoodsReceiptSearchPage.tsx.
const ReceivingListPage: React.FC = () => {
  const navigate = useNavigate()

  const [data, setData] = useState<ReceivablePoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)

  const [poNoFilter, setPoNoFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')

  const fetchData = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await grnReceivingService.getReceivablePOs({
        page: nextPage,
        limit,
        po_no: poNoFilter || undefined,
        supplier_code: supplierFilter || undefined,
      })
      setData(res.data)
      setTotal(res.total)
      setPage(nextPage)
    } catch (err: any) {
      setData([])
      setTotal(0)
      message.error(err?.response?.data?.message || err?.message || 'โหลดรายการ PO ที่รอรับเข้าไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(1) }, [])

  const columns = [
    { title: 'เลข PO', dataIndex: 'po_no', key: 'po_no' },
    {
      title: 'วันที่สั่งซื้อ',
      dataIndex: 'po_date',
      key: 'po_date',
      render: (v?: string) => v?.slice(0, 10) || '—',
    },
    { title: 'Supplier', dataIndex: 'supplier_code', key: 'supplier_code' },
    {
      title: 'สถานะ',
      key: 'status',
      render: (_: unknown, r: ReceivablePoItem) => (
        <POStatusBadges status={r.status} statusReceive={r.status_receive} />
      ),
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: ReceivablePoItem) => (
        <Button size="small" onClick={() => navigate(`/stock/grn/create/${r.po_id}`)}>สร้าง GRN</Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="รับเข้า"
        subtitle="รายการ PO ที่ยังรับสินค้าไม่ครบ"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'รับเข้า' }]}
      />

      {GRN_RECEIVING_MOCK_MODE && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="กำลังแสดงข้อมูลจำลอง (mock) — รอ backend deploy GET /po/receivable"
        />
      )}

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="เลข PO"
            value={poNoFilter}
            onChange={(e) => setPoNoFilter(e.target.value)}
            allowClear
            style={{ width: 180 }}
          />
          <Input
            placeholder="Supplier code"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            allowClear
            style={{ width: 180 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchData(1)}>ค้นหา</Button>
        </Space>
        <Table
          rowKey="po_id"
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
          locale={{ emptyText: 'ไม่มี PO ที่รอรับเข้า' }}
          onRow={(record) => ({
            onClick: () => navigate(`/stock/grn/create/${record.po_id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  )
}

export default ReceivingListPage
