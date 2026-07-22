import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Space, Select, DatePicker, Input, Modal,
  Form, InputNumber, message, Tag,
} from 'antd'
import { PlusOutlined, SearchOutlined, ReloadOutlined, ArrowRightOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import QRScanInput from '@/components/stock/QRScanInput'
import { useAppSelector } from '@/store'
import type { StockTransaction, StockTransactionType } from '@/types/stock'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const txnTypeColor: Record<StockTransactionType, string> = {
  IN: 'green',
  OUT: 'red',
  TRANSFER: 'blue',
  ADJUST: 'orange',
}

const mockTxns: StockTransaction[] = [
  { id: 1, txnNo: 'TXN-2024-001', txnType: 'IN',       itemId: 1, itemCode: 'STK-001', itemName: 'Electric Drill',    toLocationId: 1, toLocationName: 'WH-A Zone 1', qty: 5,  createdBy: 'Admin', createdAt: '2024-06-01T08:00:00Z' },
  { id: 2, txnNo: 'TXN-2024-002', txnType: 'OUT',      itemId: 2, itemCode: 'STK-002', itemName: 'Safety Helmet',     fromLocationId: 1, fromLocationName: 'WH-A Zone 1', qty: 2,  createdBy: 'John',  createdAt: '2024-06-05T08:00:00Z' },
  { id: 3, txnNo: 'TXN-2024-003', txnType: 'TRANSFER', itemId: 1, itemCode: 'STK-001', itemName: 'Electric Drill',    fromLocationId: 1, fromLocationName: 'WH-A Zone 1', toLocationId: 2, toLocationName: 'WH-B Zone 1', qty: 2, createdBy: 'Admin', createdAt: '2024-06-10T08:00:00Z' },
]

const StockTransactionPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<StockTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [txnType, setTxnType] = useState<StockTransactionType | undefined>()
  const [range, setRange] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const selectedType: StockTransactionType | undefined = Form.useWatch('txnType', form)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/stock/transactions`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { txn_type: txnType, search: search || undefined },
      })
      const raw = Array.isArray(res.data) ? res.data : res.data?.data
      setData(Array.isArray(raw) ? raw : [])
    } catch {
      setData(mockTxns)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [txnType, search])

  const handleQRScan = async (val: string) => {
    form.setFieldValue('itemCode', val)
    message.info(`Scanned: ${val}`)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await axios.post(`${BASE_URL}/stock/transactions`, values, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('Transaction created')
      setModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.response?.data?.message || err?.message || 'Failed to create transaction')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { title: 'Txn No', dataIndex: 'txnNo', key: 'txnNo' },
    {
      title: 'Type',
      dataIndex: 'txnType',
      key: 'txnType',
      render: (val: StockTransactionType) => <Tag color={txnTypeColor[val]}>{val}</Tag>,
    },
    { title: 'Item', dataIndex: 'itemName', key: 'itemName', ellipsis: true },
    {
      title: 'From → To',
      key: 'locations',
      render: (_: any, r: StockTransaction) => (
        <span style={{ fontSize: 12 }}>
          {r.fromLocationName || '—'}
          {r.fromLocationName && r.toLocationName && <ArrowRightOutlined style={{ margin: '0 4px', color: '#9ca3af' }} />}
          {r.toLocationName || (r.fromLocationName ? '' : '—')}
        </span>
      ),
    },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', align: 'right' as const },
    { title: 'Created By', dataIndex: 'createdBy', key: 'createdBy' },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '—',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Stock Transactions"
        subtitle="View and record stock movements"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'Transactions' }]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { form.resetFields(); setModalOpen(true) }}
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
          >
            New Transaction
          </Button>
        }
      />

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Select
            placeholder="Transaction Type"
            value={txnType}
            onChange={setTxnType}
            allowClear
            style={{ width: 160 }}
            options={['IN', 'OUT', 'TRANSFER', 'ADJUST'].map((v) => ({ value: v, label: v }))}
          />
          <DatePicker.RangePicker value={range} onChange={setRange} format="DD/MM/YYYY" />
          <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} allowClear />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>Search</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setTxnType(undefined); setSearch(''); setRange(null) }}>Reset</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 20, showTotal: (t) => `Total ${t} items` }}
          locale={{ emptyText: 'No transactions' }}
        />
      </Card>

      <Modal
        title="New Stock Transaction"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="Create"
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Transaction Type" name="txnType" rules={[{ required: true }]}>
            <Select options={['IN', 'OUT', 'TRANSFER', 'ADJUST'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item label="Scan QR / Item Code">
            <QRScanInput onScan={handleQRScan} />
          </Form.Item>
          <Form.Item label="Item Code" name="itemCode" rules={[{ required: true }]}>
            <Input placeholder="Item code" />
          </Form.Item>
          {(selectedType === 'OUT' || selectedType === 'TRANSFER') && (
            <Form.Item label="From Location" name="fromLocationId" rules={[{ required: true }]}>
              <Select placeholder="Select from location" options={[{ value: 1, label: 'WH-A Zone 1' }, { value: 2, label: 'WH-B Zone 1' }]} />
            </Form.Item>
          )}
          {(selectedType === 'IN' || selectedType === 'TRANSFER') && (
            <Form.Item label="To Location" name="toLocationId" rules={[{ required: true }]}>
              <Select placeholder="Select to location" options={[{ value: 1, label: 'WH-A Zone 1' }, { value: 2, label: 'WH-B Zone 1' }]} />
            </Form.Item>
          )}
          <Form.Item label="Quantity" name="qty" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Remarks" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default StockTransactionPage
