import React, { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Switch, Space, Tag, message, InputNumber } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@/store'
import { addMenu, updateMenu, deleteMenu } from '@/store/slices/menuSlice'
import { MenuConfig } from '@/types'
import PageHeader from '@/components/common/PageHeader'

const MenusPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { menus } = useAppSelector((state) => state.menu)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MenuConfig | null>(null)
  const [form] = Form.useForm()

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true) }
  const openEdit = (r: MenuConfig) => { setEditing(r); form.setFieldsValue(r); setOpen(true) }
  const handleDelete = (id: string) => { dispatch(deleteMenu(id)); message.success('ลบเมนูเรียบร้อย') }
  const handleOk = () => {
    form.validateFields().then((values) => {
      if (editing) {
        dispatch(updateMenu({ ...editing, ...values }))
        message.success('แก้ไขเมนูเรียบร้อย')
      } else {
        dispatch(addMenu({ id: Date.now().toString(), ...values, parentId: values.parentId || null, isActive: true }))
        message.success('เพิ่มเมนูเรียบร้อย')
      }
      setOpen(false)
    })
  }

  const allMenus = menus.filter((m) => !m.parentId)
  const tableData = menus.map((m) => ({ ...m, key: m.id }))

  const columns = [
    { title: 'ชื่อเมนู', dataIndex: 'label', render: (v: string, r: MenuConfig) => (
      <span style={{ paddingLeft: r.parentId ? 24 : 0 }}>{r.parentId ? '└ ' : ''}{v}</span>
    )},
    { title: 'Key', dataIndex: 'key', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Path', dataIndex: 'path', render: (v: string) => v ? <code style={{ fontSize: 12, color: '#2563eb' }}>{v}</code> : '-' },
    { title: 'ลำดับ', dataIndex: 'order', width: 60 },
    { title: 'สถานะ', dataIndex: 'isActive', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'ใช้งาน' : 'ปิด'}</Tag> },
    { title: 'จัดการ', key: 'action', render: (_: unknown, r: MenuConfig) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>แก้ไข</Button>
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>ลบ</Button>
      </Space>
    )},
  ]

  return (
    <div>
      <PageHeader title="จัดการเมนู" subtitle="เพิ่ม ลบ แก้ไขเมนูในระบบ"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'System' }, { title: 'เมนู' }]}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>เพิ่มเมนู</Button>}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Table dataSource={tableData} columns={columns} size="small" pagination={{ pageSize: 20 }} />
      </Card>
      <Modal title={editing ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่'} open={open} onOk={handleOk} onCancel={() => setOpen(false)} okText="บันทึก" cancelText="ยกเลิก">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="ชื่อเมนู" name="label" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Key" name="key" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Path" name="path"><Input placeholder="/example/path" /></Form.Item>
          <Form.Item label="เมนูหลัก" name="parentId"><Select allowClear placeholder="ไม่มี (เมนูหลัก)" options={allMenus.map((m) => ({ value: m.id, label: m.label }))} /></Form.Item>
          <Form.Item label="Icon" name="icon"><Select allowClear placeholder="เลือก Icon" options={['DashboardOutlined', 'FileTextOutlined', 'ShoppingCartOutlined', 'SettingOutlined', 'TeamOutlined'].map((v) => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item label="ลำดับ" name="order" initialValue={0}><InputNumber min={0} /></Form.Item>
          <Form.Item label="ใช้งาน" name="isActive" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default MenusPage
