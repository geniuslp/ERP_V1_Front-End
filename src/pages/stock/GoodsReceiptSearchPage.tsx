import React, { useState } from 'react'
import { Card, Input, Button, Table, Space, message, Alert, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import type { GRNPoListItem } from '@/types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const statusColor: Record<string, string> = {
  APPROVED: 'green',
  PARTIALLY_RECEIVED: 'orange',
}

const GoodsReceiptSearchPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const navigate = useNavigate()

  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [results, setResults] = useState<GRNPoListItem[]>([])

  const handleSearch = async () => {
    const kw = keyword.trim()
    if (!kw) return
    setSearching(true)
    setNotFound(false)
    setResults([])
    try {
      const res = await axios.get(`${BASE_URL}/po/search`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { po_no: kw },
      })
      const data = res.data?.data
      const list: GRNPoListItem[] = Array.isArray(data) ? data : data ? [data] : []
      if (list.length === 0) {
        setNotFound(true)
      } else {
        setResults(list)
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true)
      } else {
        message.error(err?.response?.data?.message || err?.message || 'ค้นหา PO ไม่สำเร็จ')
      }
    } finally {
      setSearching(false)
    }
  }

  const columns = [
    { title: 'เลข PO', dataIndex: 'po_no', key: 'po_no' },
    {
      title: 'วันที่สั่งซื้อ',
      dataIndex: 'po_date',
      key: 'po_date',
      render: (v?: string) => v || '—',
    },
    {
      title: 'วันที่ส่งของ',
      dataIndex: 'expected_date',
      key: 'expected_date',
      render: (v?: string | null) => v || '—',
    },
    { title: 'Supplier', dataIndex: 'supplier_code', key: 'supplier_code' },
    { title: 'คลัง', dataIndex: 'warehouse_code', key: 'warehouse_code', render: (v?: string) => v || '—' },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    {
      title: 'มูลค่าสุทธิ',
      dataIndex: 'net_amount',
      key: 'net_amount',
      align: 'right' as const,
      render: (v?: number) => (v ?? 0).toLocaleString(),
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, record: GRNPoListItem) => (
        <Button size="small" onClick={() => navigate(`/stock/receiving/${record.po_id}`)}>เลือก</Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="รับเข้า"
        subtitle="ค้นหา PO เพื่อบันทึกรับเข้าสินค้า"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'รับเข้า' }]}
      />

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="พิมพ์เลข PO หรือ keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            style={{ width: 280 }}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={handleSearch}>
            ค้นหา
          </Button>
        </Space>

        {notFound && (
          <Alert
            type="warning"
            showIcon
            message="ไม่พบ PO หรือ PO ยังไม่ได้รับการอนุมัติ"
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          rowKey="po_id"
          columns={columns}
          dataSource={results}
          pagination={false}
          locale={{ emptyText: 'ค้นหา PO เพื่อแสดงรายการ' }}
          onRow={(record) => ({
            onClick: () => navigate(`/stock/receiving/${record.po_id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  )
}

export default GoodsReceiptSearchPage
