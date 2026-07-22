import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Space, Select, DatePicker, Input, Modal,
  Form, InputNumber, Tag, message, Tooltip,
} from 'antd'
import { PlusOutlined, SearchOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { mockReservations, mockStockItems } from '@/utils/mockStockData'
import type { Reservation, ReservationStatus } from '@/types/stock'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const statusColor: Record<ReservationStatus, string> = {
  PENDING: 'orange',
  CONFIRMED: 'blue',
  CANCELLED: 'default',
  FULFILLED: 'green',
}

const locations = [{ value: 1, label: 'WH-A Zone 1' }, { value: 2, label: 'WH-B Zone 1' }]

const ReservationPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<ReservationStatus | undefined>()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/stock/reservations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { status: status || undefined, search: search || undefined },
      })
      const raw = Array.isArray(res.data) ? res.data : res.data?.data
      setData(Array.isArray(raw) ? raw : [])
    } catch {
      let filtered = mockReservations
      if (status) filtered = filtered.filter((r) => r.status === status)
      setData(filtered)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [status, search])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await axios.post(`${BASE_URL}/stock/reservations`, {
        ...values,
        neededBy: values.neededBy?.format('YYYY-MM-DD'),
      }, { headers: { Authorization: `Bearer ${accessToken}` } })
      message.success('Reservation created')
      setModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.response?.data?.message || err?.message || 'Failed to create reservation')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (id: number) => {
    try {
      await axios.put(`${BASE_URL}/stock/reservations/${id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('Reservation cancelled')
      fetchData()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Failed to cancel')
    }
  }

  const columns = [
    { title: 'Reservation No', dataIndex: 'reservationNo', key: 'reservationNo' },
    { title: 'Item', dataIndex: 'itemName', key: 'itemName', ellipsis: true },
    { title: 'Location', dataIndex: 'locationName', key: 'locationName' },
    { title: 'Qty Reserved', dataIndex: 'qtyReserved', key: 'qtyReserved', align: 'right' as const },
    {
      title: 'Needed By',
      dataIndex: 'neededBy',
      key: 'neededBy',
      render: (val?: string) => val ? dayjs(val).format('DD/MM/YYYY') : <span style={{ color: '#9ca3af' }}>—</span>,
    },
    { title: 'Requested By', dataIndex: 'requestedBy', key: 'requestedBy' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: ReservationStatus) => <Tag color={statusColor[s]}>{s}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_: any, record: Reservation) => (
        record.status !== 'CANCELLED' && record.status !== 'FULFILLED' ? (
          <Tooltip title="Cancel">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleCancel(record.id)} />
          </Tooltip>
        ) : null
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Reservations"
        subtitle="Reserve stock to prevent over-commitment"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'Reservations' }]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { form.resetFields(); setModalOpen(true) }}
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
          >
            New Reservation
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
            style={{ width: 160 }}
            options={(['PENDING', 'CONFIRMED', 'CANCELLED', 'FULFILLED'] as ReservationStatus[]).map((v) => ({ value: v, label: v }))}
          />
          <Input placeholder="Search item" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} allowClear />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>Search</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setStatus(undefined); setSearch('') }}>Reset</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 20, showTotal: (t) => `Total ${t} items` }}
          locale={{ emptyText: 'No reservations' }}
        />
      </Card>

      <Modal
        title="New Reservation"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="Submit"
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Item" name="itemId" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Select item"
              options={mockStockItems.map((s) => ({ value: s.id, label: `${s.itemCode} — ${s.itemName}` }))}
              filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item label="Location" name="locationId" rules={[{ required: true }]}>
            <Select options={locations} />
          </Form.Item>
          <Form.Item label="Qty to Reserve" name="qtyReserved" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Needed By" name="neededBy">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Purpose" name="purpose">
            <Input placeholder="Optional purpose" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ReservationPage
