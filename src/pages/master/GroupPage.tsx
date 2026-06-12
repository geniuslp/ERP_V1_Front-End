import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, Tag, Divider, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import axios from 'axios'
import type { Group } from '@/types'
import { useAppSelector } from '@/store'

type GroupRecord = Group & { key: string }

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const GroupPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<GroupRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GroupRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [form] = Form.useForm()

  const fetchGroups = async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/groups`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const list: Group[] = res.data?.data ?? []
      setData(list.map((g: any) => ({ ...g, key: g.group_code })))
    } catch {
      message.error('โหลดข้อมูลกลุ่มไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGroups() }, [accessToken])

  useEffect(() => {
    if (open && editing) {
      form.setFieldsValue(editing)
    } else if (open && !editing) {
      form.resetFields()
    }
  }, [open, editing])

  const openCreate = () => { setEditing(null); setOpen(true) }
  const openEdit = (r: GroupRecord) => { setEditing(r); setOpen(true) }

  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const handleDelete = async (key: string) => {
    setDeletingKey(key)
    try {
      await axios.delete(`${BASE_URL}/groups/${key}`, { headers: authHeader })
      message.success('ลบกลุ่มเรียบร้อย')
      await fetchGroups()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'ลบกลุ่มไม่สำเร็จ กรุณาลองใหม่'
      message.error(msg)
    } finally {
      setDeletingKey(null)
    }
  }

  const handleOk = () => {
    form.validateFields().then(async (values) => {
      setSaving(true)
      try {
        if (editing) {
          await axios.put(`${BASE_URL}/groups/${editing.key}`, values, { headers: authHeader })
          message.success('แก้ไขกลุ่มเรียบร้อย')
        } else {
          await axios.post(`${BASE_URL}/groups`, values, { headers: authHeader })
          message.success('เพิ่มกลุ่มเรียบร้อย')
        }
        setOpen(false)
        await fetchGroups()
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่'
        message.error(msg)
      } finally {
        setSaving(false)
      }
    })
  }

  const columns = [
    { title: 'รหัสกลุ่ม', dataIndex: 'group_code', width: 150 },
    { title: 'ชื่อกลุ่ม', dataIndex: 'group_name' },
    {
      title: 'สถานะ', dataIndex: 'is_active', width: 110,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'ใช้งาน' : 'ปิดใช้งาน'}</Tag>
    },
    {
      title: 'จัดการ', key: 'action', width: 160,
      render: (_: unknown, r: GroupRecord) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>แก้ไข</Button>
          <Popconfirm
            title="ยืนยันการลบ"
            description={`ต้องการลบกลุ่ม "${r.group_name}" ใช่หรือไม่?`}
            onConfirm={() => handleDelete(r.key)}
            okText="ลบ"
            okButtonProps={{ danger: true }}
            cancelText="ยกเลิก"
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={deletingKey === r.key}>ลบ</Button>
          </Popconfirm>
        </Space>
      )
    },
  ]

  return (
    <div>
      <PageHeader
        title="จัดการกลุ่ม"
        subtitle="เพิ่ม ลบ แก้ไขรหัสกลุ่ม"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'กลุ่ม' }]}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>เพิ่มกลุ่ม</Button>}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Table dataSource={data} columns={columns} size="small" pagination={{ pageSize: 10 }} rowKey="key" loading={loading} />
      </Card>

      <Modal
        title={editing ? 'แก้ไขกลุ่ม' : 'เพิ่มกลุ่ม'}
        open={open}
        onOk={handleOk}
        onCancel={() => setOpen(false)}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={saving}
        width={420}
      >
        <Divider style={{ margin: '12px 0' }} />
        <Form form={form} layout="vertical">
          <Form.Item label="รหัสกลุ่ม" name="group_code" rules={[{ required: true, message: 'กรุณากรอกรหัสกลุ่ม' }]}>
            <Input placeholder="เช่น GRP001" maxLength={20} disabled={!!editing} />
          </Form.Item>
          <Form.Item label="ชื่อกลุ่ม" name="group_name" rules={[{ required: true, message: 'กรุณากรอกชื่อกลุ่ม' }]}>
            <Input placeholder="เช่น วัตถุดิบ" maxLength={100} />
          </Form.Item>
          <Form.Item label="สถานะ" name="is_active" initialValue={true} rules={[{ required: true }]}>
            <Select options={[{ value: true, label: 'ใช้งาน' }, { value: false, label: 'ปิดใช้งาน' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default GroupPage