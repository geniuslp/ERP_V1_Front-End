import React, { useState } from 'react'
import {
  Card, Form, Input, DatePicker, Button, Space, Table, Select,
  InputNumber, message, Divider,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import QRScanInput from '@/components/stock/QRScanInput'
import { useAppSelector } from '@/store'
import { mockStockItems } from '@/utils/mockStockData'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

interface LineRow {
  key: string
  itemId?: number
  itemCode?: string
  itemName?: string
  locationId?: number
  qtyRequested: number
  unit?: string
  remarks?: string
}

const locations = [
  { value: 1, label: 'WH-A Zone 1' },
  { value: 2, label: 'WH-B Zone 1' },
]

const BorrowCreatePage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [form] = Form.useForm()
  const [lines, setLines] = useState<LineRow[]>([])
  const [saving, setSaving] = useState(false)
  let keyCounter = 0

  const newKey = () => `line-${Date.now()}-${keyCounter++}`

  const handleQRScan = (val: string) => {
    const item = mockStockItems.find((s) => s.itemCode === val || s.itemCode === val.trim())
    if (!item) { message.warning(`Item not found: ${val}`); return }
    const existing = lines.find((l) => l.itemCode === item.itemCode)
    if (existing) {
      setLines((prev) => prev.map((l) => l.key === existing.key ? { ...l, qtyRequested: l.qtyRequested + 1 } : l))
      message.success(`${item.itemName} qty +1`)
    } else {
      setLines((prev) => [...prev, {
        key: newKey(),
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        unit: item.unit,
        qtyRequested: 1,
      }])
      message.success(`Added: ${item.itemName}`)
    }
  }

  const addLine = () => {
    setLines((prev) => [...prev, { key: newKey(), qtyRequested: 1 }])
  }

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  const updateLine = (key: string, field: keyof LineRow, value: any) => {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, [field]: value } : l))
  }

  const handleSubmit = async (isDraft: boolean) => {
    try {
      const values = await form.validateFields()
      if (lines.length === 0) { message.warning('Please add at least one item'); return }
      setSaving(true)
      const payload = {
        ...values,
        status: isDraft ? 'DRAFT' : 'PENDING_APPROVAL',
        lines: lines.map((l, i) => ({ lineNo: i + 1, ...l })),
        borrowDate: values.borrowDate?.format('YYYY-MM-DD'),
        expectedReturnDate: values.expectedReturnDate?.format('YYYY-MM-DD'),
      }
      await axios.post(`${BASE_URL}/stock/borrow`, payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success(isDraft ? 'Saved as draft' : 'Submitted for approval')
      navigate('/stock/borrow')
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.response?.data?.message || err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const lineColumns = [
    {
      title: '#',
      key: 'no',
      width: 40,
      render: (_: any, __: any, idx: number) => idx + 1,
    },
    {
      title: 'Item',
      key: 'item',
      render: (_: any, record: LineRow) => (
        <Select
          showSearch
          value={record.itemId}
          placeholder="Select item"
          style={{ width: 200 }}
          onChange={(val) => {
            const item = mockStockItems.find((s) => s.id === val)
            updateLine(record.key, 'itemId', val)
            if (item) {
              updateLine(record.key, 'itemCode', item.itemCode)
              updateLine(record.key, 'itemName', item.itemName)
              updateLine(record.key, 'unit', item.unit)
            }
          }}
          options={mockStockItems.map((s) => ({ value: s.id, label: `${s.itemCode} — ${s.itemName}` }))}
          filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      ),
    },
    {
      title: 'Location',
      key: 'location',
      render: (_: any, record: LineRow) => (
        <Select
          value={record.locationId}
          placeholder="Location"
          style={{ width: 160 }}
          options={locations}
          onChange={(val) => updateLine(record.key, 'locationId', val)}
        />
      ),
    },
    {
      title: 'Qty',
      key: 'qty',
      render: (_: any, record: LineRow) => (
        <InputNumber min={1} value={record.qtyRequested} onChange={(val) => updateLine(record.key, 'qtyRequested', val ?? 1)} style={{ width: 80 }} />
      ),
    },
    {
      title: 'Unit',
      key: 'unit',
      render: (_: any, record: LineRow) => record.unit || '—',
    },
    {
      title: 'Remarks',
      key: 'remarks',
      render: (_: any, record: LineRow) => (
        <Input value={record.remarks} onChange={(e) => updateLine(record.key, 'remarks', e.target.value)} style={{ width: 140 }} />
      ),
    },
    {
      title: '',
      key: 'del',
      width: 40,
      render: (_: any, record: LineRow) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeLine(record.key)} />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="New Borrow Request"
        subtitle="Submit a request to borrow items from stock"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'Borrow & Return', href: '/stock/borrow' }, { title: 'Create' }]}
      />

      <Card title="General Information" style={cardStyle}>
        <Form form={form} layout="vertical">
          <Form.Item label="Purpose" name="purpose" rules={[{ required: true }]}>
            <Input placeholder="Enter purpose" />
          </Form.Item>
          <Space>
            <Form.Item label="Expected Return Date" name="expectedReturnDate">
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
          <Form.Item label="Remarks" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="Items"
        style={cardStyle}
        extra={
          <Space>
            <QRScanInput onScan={handleQRScan} placeholder="Scan QR to add item" />
            <Button icon={<PlusOutlined />} onClick={addLine}>Add Row</Button>
          </Space>
        }
      >
        <Table
          rowKey="key"
          dataSource={lines}
          columns={lineColumns}
          pagination={false}
          locale={{ emptyText: 'No items added. Scan QR or click Add Row.' }}
          size="small"
        />
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={() => navigate('/stock/borrow')}>Cancel</Button>
        <Button onClick={() => handleSubmit(true)} loading={saving}>Save Draft</Button>
        <Button
          type="primary"
          onClick={() => handleSubmit(false)}
          loading={saving}
          style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none' }}
        >
          Submit
        </Button>
      </div>
    </div>
  )
}

export default BorrowCreatePage
