import React, { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Switch, Space, Tag, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'

interface RoleRecord { key: string; id: string; name: string; description: string; isActive: boolean; userCount: number }

const initialRoles: RoleRecord[] = [
  { key: '1', id: '1', name: 'Admin', description: 'ผู้ดูแลระบบ มีสิทธิ์ทุกอย่าง', isActive: true, userCount: 2 },
  { key: '2', id: '2', name: 'Manager', description: 'ผู้จัดการ อนุมัติใบขอซื้อ', isActive: true, userCount: 5 },
  { key: '3', id: '3', name: 'User', description: 'พนักงานทั่วไป', isActive: true, userCount: 20 },
  { key: '4', id: '4', name: 'Viewer', description: 'ดูข้อมูลได้อย่างเดียว', isActive: false, userCount: 3 },
]

const RolesPage: React.FC = () => {
  const [data, setData] = useState(initialRoles)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RoleRecord | null>(null)
  const [form] = Form.useForm()

  const columns = [
    { title: 'บทบาท', dataIndex: 'name', render: (v: string) => <Tag color="blue" style={{ fontWeight: 600 }}>{v}</Tag> },
    { title: 'คำอธิบาย', dataIndex: 'description' },
    { title: 'จำนวนผู้ใช้', dataIndex: 'userCount', align: 'center' as const },
    { title: 'สถานะ', dataIndex: 'isActive', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'ใช้งาน' : 'ปิด'}</Tag> },
    { title: 'จัดการ', render: (_: unknown, r: RoleRecord) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }}>แก้ไข</Button>
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => { setData(data.filter((d) => d.key !== r.key)); message.success('ลบบทบาทเรียบร้อย') }}>ลบ</Button>
      </Space>
    )},
  ]

  return (
    <div>
      <PageHeader title="จัดการบทบาท" subtitle="กำหนดบทบาทสำหรับผู้ใช้งาน"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'System' }, { title: 'บทบาท' }]}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>เพิ่มบทบาท</Button>}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Table dataSource={data} columns={columns} size="small" />
      </Card>
      <Modal title={editing ? 'แก้ไขบทบาท' : 'เพิ่มบทบาท'} open={open} onOk={() => form.validateFields().then((v) => { editing ? setData(data.map((d) => d.key === editing.key ? { ...d, ...v } : d)) : setData([...data, { key: Date.now().toString(), id: Date.now().toString(), userCount: 0, ...v }]); message.success('บันทึกเรียบร้อย'); setOpen(false) })} onCancel={() => setOpen(false)} okText="บันทึก" cancelText="ยกเลิก">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="ชื่อบทบาท" name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="คำอธิบาย" name="description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="ใช้งาน" name="isActive" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RolesPage
