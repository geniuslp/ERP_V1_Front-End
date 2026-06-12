import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, Tag, Avatar, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import axios from 'axios'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'
interface UserRecord { key: string; id: string; username: string; fullName: string; email: string; role: string; department: string; isActive: boolean }
const user = JSON.parse(sessionStorage.getItem('user') ?? '{}')
const UsersPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UserRecord | null>(null)
  const [form] = Form.useForm()
  

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        console.log('check res',res)
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setData(list.map((u: any) => ({
        key: String(u.id),
        id: String(u.id),
        username: u.username,
        fullName: u.full_name,
        email: u.email,
        role: u.role ?? '-',
        department: u.department ?? '-',
        isActive: u.is_active,
      })))
      } catch {
        message.error('โหลดข้อมูลผู้ใช้ไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [accessToken])

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true) }
  const openEdit = (r: UserRecord) => { setEditing(r); form.setFieldsValue(r); setOpen(true) }
  const handleDelete = (key: string) => { setData(data.filter((d) => d.key !== key)); message.success('ลบผู้ใช้เรียบร้อย') }
  const handleOk = () => {
    form.validateFields().then(async (values) => {
      if (editing) {
        try {
          await axios.put(`/users/${editing.id}`, values, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          setData(data.map((d) => d.key === editing.key ? { ...d, ...values } : d))
          message.success('แก้ไขข้อมูลเรียบร้อย')
          setOpen(false)
        } catch {
          message.error('แก้ไขข้อมูลไม่สำเร็จ')
        }
      } else {
        const newUser = { key: Date.now().toString(), id: Date.now().toString(), ...values, isActive: true }
        setData([...data, newUser])
        message.success('เพิ่มผู้ใช้เรียบร้อย')
        setOpen(false)
      }
    })
  }

  const columns = [
    { title: 'ผู้ใช้', key: 'user', render: (_: unknown, r: UserRecord) => (
      <Space>
        <Avatar style={{ background: '#2563eb' }} size={32}>{r.fullName.charAt(0)}</Avatar>
        <div><div style={{ fontWeight: 600, fontSize: 13 }}>{r.fullName}</div><div style={{ fontSize: 11, color: '#60a5fa' }}>{r.username}</div></div>
      </Space>
    )},
    { title: 'อีเมล', dataIndex: 'email' },
    { title: 'บทบาท', dataIndex: 'role', render: (v: string) => <Tag color={v === 'Admin' ? 'blue' : v === 'Manager' ? 'purple' : 'default'}>{v}</Tag> },
    { title: 'แผนก', dataIndex: 'department' },
    { title: 'สถานะ', dataIndex: 'isActive', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'ใช้งาน' : 'ปิดใช้งาน'}</Tag> },
    { title: 'จัดการ', key: 'action', render: (_: unknown, r: UserRecord) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>แก้ไข</Button>
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.key)}>ลบ</Button>
      </Space>
    )},
  ]

  return (
    <div>
      <PageHeader title="จัดการผู้ใช้" subtitle="เพิ่ม ลบ แก้ไขข้อมูลผู้ใช้งาน"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'System' }, { title: 'ผู้ใช้' }]}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>เพิ่มผู้ใช้</Button>}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Table dataSource={data} columns={columns} loading={loading} size="small" pagination={{ pageSize: 10 }} />
      </Card>
      <Modal title={editing ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้'} open={open} onOk={handleOk} onCancel={() => setOpen(false)} okText="บันทึก" cancelText="ยกเลิก">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="ชื่อผู้ใช้" name="username" rules={[{ required: true }]}><Input prefix={<UserOutlined />} /></Form.Item>
          <Form.Item label="ชื่อ-นามสกุล" name="fullName" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="อีเมล" name="email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          {!editing && <Form.Item label="รหัสผ่าน" name="password" rules={[{ required: true }]}><Input.Password /></Form.Item>}
          <Form.Item label="บทบาท" name="role" rules={[{ required: true }]}><Select options={[{ value: 'Admin', label: 'Admin' }, { value: 'Manager', label: 'Manager' }, { value: 'User', label: 'User' }]} /></Form.Item>
          <Form.Item label="แผนก" name="department"><Select options={[{ value: 'IT' }, { value: 'HR' }, { value: 'FIN' }, { value: 'OPS' }]} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UsersPage
