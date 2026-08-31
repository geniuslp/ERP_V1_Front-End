import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Space, Select, DatePicker, Input, Modal,
  Form, InputNumber, message, Tag,
} from 'antd'
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons'
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

const txnTypeColor: Record<string, string> = {
  IN: 'green',
  OUT: 'red',
  TRANSFER: 'blue',
  ADJUST: 'orange',
  ADJUST_PLUS: 'green',
  ADJUST_MINUS: 'red',
}

// No Thai-label mapping exists yet for txn_type elsewhere in the codebase
// (unlike StatusBadge for PR/PO/etc.) — display the raw enum until one exists.

const mockTxns: StockTransaction[] = [
  { id: 1, txnNo: 'TXN-2024-001', txnType: 'IN',       itemId: 1, matCode: 'STK-001', itemName: 'Electric Drill', toLocation: 'WH-A Zone 1', qty: 5, refDocNo: null, createdByName: 'Admin', txnDate: '2024-06-01T08:00:00Z' },
  { id: 2, txnNo: 'TXN-2024-002', txnType: 'OUT',      itemId: 2, matCode: 'STK-002', itemName: 'Safety Helmet',  fromLocation: 'WH-A Zone 1', qty: 2, refDocNo: null, createdByName: 'John',  txnDate: '2024-06-05T08:00:00Z' },
  { id: 3, txnNo: 'TXN-2024-003', txnType: 'TRANSFER', itemId: 1, matCode: 'STK-001', itemName: 'Electric Drill', fromLocation: 'WH-A Zone 1', toLocation: 'WH-B Zone 1', qty: 2, refDocNo: null, createdByName: 'Admin', txnDate: '2024-06-10T08:00:00Z' },
]

const mapTransaction = (t: any): StockTransaction => ({
  id:            t.id,
  txnNo:         t.txn_no ?? '',
  txnType:       t.txn_type ?? '',
  itemId:        t.item_id,
  matCode:       t.mat_code ?? '',
  itemName:      t.item_name ?? '',
  fromLocation:  t.from_location ?? null,
  toLocation:    t.to_location ?? null,
  qty:           t.qty ?? 0,
  qtyBefore:     t.qty_before ?? null,
  qtyAfter:      t.qty_after ?? null,
  refDocNo:      t.ref_doc_no ?? null,
  remarks:       t.remarks ?? null,
  createdByName: t.created_by_name ?? '',
  txnDate:       t.txn_date ?? t.created_at ?? '',
})

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
      const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
      setData(Array.isArray(raw) ? raw.map(mapTransaction) : [])
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
    {
      title: 'Doc No',
      dataIndex: 'refDocNo',
      key: 'refDocNo',
      render: (val: string | null) => val || '-',
    },
    {
      title: 'Material',
      key: 'material',
      ellipsis: true,
      render: (_: any, r: StockTransaction) => (r.matCode ? `${r.matCode} — ${r.itemName}` : r.itemName || '—'),
    },
    {
      title: 'Qty Before',
      dataIndex: 'qtyBefore',
      key: 'qtyBefore',
      align: 'right' as const,
      render: (val: number | null) => (val ?? null) === null ? '-' : val,
    },
    {
      title: 'Qty Change',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
      render: (val: number, r: StockTransaction) => {
        const color = txnTypeColor[r.txnType] === 'green' ? '#16a34a' : txnTypeColor[r.txnType] === 'red' ? '#dc2626' : undefined
        const sign = val > 0 ? '+' : ''
        return <span style={{ color, fontWeight: 500 }}>{sign}{val}</span>
      },
    },
    {
      title: 'Qty After',
      dataIndex: 'qtyAfter',
      key: 'qtyAfter',
      align: 'right' as const,
      render: (val: number | null) => (val ?? null) === null ? '-' : val,
    },
    {
      title: 'Type',
      dataIndex: 'txnType',
      key: 'txnType',
      render: (val: string) => <Tag color={txnTypeColor[val] ?? 'default'}>{val}</Tag>,
    },
    {
      title: 'Date',
      dataIndex: 'txnDate',
      key: 'txnDate',
      render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '—',
    },
    { title: 'Remarks', dataIndex: 'remarks', key: 'remarks', render: (val: string | null) => val || '-' },
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
