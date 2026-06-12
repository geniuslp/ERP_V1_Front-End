import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, Tag, Popconfirm, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import axios from 'axios'
import { useAppSelector } from '@/store'

interface Supplier {
  id: string
  supplier_code: string
  supplier_name: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
  is_active: boolean
}

type SupplierRecord = Supplier & { key: string }

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const SupplierPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<SupplierRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetchSuppliers = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/suppliers`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const list: Supplier[] = Array.isArray(res.data) ? res.data : res.data?.data ?? []
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
    fetchSuppliers()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setOpen(true)
  }

  const openEdit = (record: SupplierRecord) => {
    setEditing(record)
    form.setFieldsValue(record)
    setOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await axios.put(`${BASE_URL}/master/suppliers/${editing.id}`, values, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('แก้ไขข้อมูลผู้ขายสำเร็จ')
      } else {
        await axios.post(`${BASE_URL}/master/suppliers`, values, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('เพิ่มผู้ขายสำเร็จ')
      }
      setOpen(false)
      fetchSuppliers()
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
      await axios.delete(`${BASE_URL}/master/suppliers/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('ลบผู้ขายสำเร็จ')
      fetchSuppliers()
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
    { title: 'รหัสผู้ขาย', dataIndex: 'supplier_code', width: 130 },
    { title: 'ชื่อผู้ขาย', dataIndex: 'supplier_name' },
    { title: 'ผู้ติดต่อ', dataIndex: 'contact_name', width: 140 },
    { title: 'เบอร์โทร', dataIndex: 'phone', width: 120 },
    { title: 'อีเมล', dataIndex: 'email', width: 180, ellipsis: true },
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
      render: (_: unknown, r: SupplierRecord) => (
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
        title="ผู้ขาย (Supplier)"
        subtitle="จัดการข้อมูลผู้ขายและซัพพลายเออร์"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'ผู้ขาย' }]}
      />

      <Card
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            เพิ่มผู้ขาย
          </Button>
        }
      >
        <Table
          rowKey="key"
          loading={loading}
          dataSource={data}
          columns={columns}
          size="small"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showTotal: (t) => `ทั้งหมด ${t} รายการ` }}
        />
      </Card>

      <Modal
        title={editing ? 'แก้ไขผู้ขาย' : 'เพิ่มผู้ขาย'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="บันทึก"
        cancelText="ยกเลิก"
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="supplier_code" label="รหัสผู้ขาย" rules={[{ required: true, message: 'กรุณากรอกรหัสผู้ขาย' }]}>
            <Input placeholder="เช่น SUP-001" />
          </Form.Item>
          <Form.Item name="supplier_name" label="ชื่อผู้ขาย" rules={[{ required: true, message: 'กรุณากรอกชื่อผู้ขาย' }]}>
            <Input placeholder="ชื่อบริษัท / ร้านค้า" />
          </Form.Item>
          <Form.Item name="contact_name" label="ชื่อผู้ติดต่อ">
            <Input placeholder="ชื่อผู้ติดต่อ" />
          </Form.Item>
          <Form.Item name="phone" label="เบอร์โทรศัพท์">
            <Input placeholder="0XX-XXX-XXXX" />
          </Form.Item>
          <Form.Item name="email" label="อีเมล">
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="address" label="ที่อยู่">
            <Input.TextArea rows={3} placeholder="ที่อยู่" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SupplierPage
