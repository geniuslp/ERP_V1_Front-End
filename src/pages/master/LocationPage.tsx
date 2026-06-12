import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, Tag, Popconfirm, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import axios from 'axios'
import { useAppSelector } from '@/store'

interface Location {
  id: string
  location_code: string
  location_name: string
  is_active: boolean
}

type LocationRecord = Location & { key: string }

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const LocationPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<LocationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LocationRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetchLocations = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/locations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const list: Location[] = Array.isArray(res.data) ? res.data : res.data?.data ?? []
      setData(list.map((r) => ({ ...r, key: String(r.id) })))
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'โหลดข้อมูลไม่สำเร็จ'
      message.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocations()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setOpen(true)
  }

  const openEdit = (record: LocationRecord) => {
    setEditing(record)
    form.setFieldsValue(record)
    setOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await axios.put(`${BASE_URL}/master/locations/${editing.id}`, values, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('แก้ไขสถานที่สำเร็จ')
      } else {
        await axios.post(`${BASE_URL}/master/locations`, values, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('เพิ่มสถานที่สำเร็จ')
      }
      setOpen(false)
      fetchLocations()
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'บันทึกไม่สำเร็จ'
      message.error(errMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${BASE_URL}/master/locations/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('ลบสถานที่สำเร็จ')
      fetchLocations()
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'ลบไม่สำเร็จ'
      message.error(errMsg)
    }
  }

  const columns = [
    { title: 'รหัสสถานที่', dataIndex: 'location_code', width: 150 },
    { title: 'ชื่อสถานที่', dataIndex: 'location_name' },
    {
      title: 'สถานะ',
      dataIndex: 'is_active',
      width: 100,
      align: 'center' as const,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? 'ใช้งาน' : 'ปิดใช้งาน'}</Tag>
      ),
    },
    {
      title: '',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, r: LocationRecord) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="ยืนยันการลบ?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="สถานที่ (Location)"
        subtitle="จัดการข้อมูลสถานที่ส่งสินค้า"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'สถานที่' }]}
      />

      <Card
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            เพิ่มสถานที่
          </Button>
        }
      >
        <Table
          rowKey="key"
          loading={loading}
          dataSource={data}
          columns={columns}
          size="small"
          pagination={{ pageSize: 20, showTotal: (t) => `ทั้งหมด ${t} รายการ` }}
        />
      </Card>

      <Modal
        title={editing ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="บันทึก"
        cancelText="ยกเลิก"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="location_code" label="รหัสสถานที่" rules={[{ required: true, message: 'กรุณากรอกรหัสสถานที่' }]}>
            <Input placeholder="เช่น WH-001" />
          </Form.Item>
          <Form.Item name="location_name" label="ชื่อสถานที่" rules={[{ required: true, message: 'กรุณากรอกชื่อสถานที่' }]}>
            <Input placeholder="เช่น คลังสินค้า A" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default LocationPage
