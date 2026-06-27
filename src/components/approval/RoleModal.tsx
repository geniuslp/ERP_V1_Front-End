import React, { useState } from 'react'
import { Modal, Table, Switch, Button, Form, Input, Tooltip, Popconfirm, Divider, message } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ApprovalRole, ApprovalConfig, CreateRolePayload } from '@/types/approval.types'

interface RoleModalProps {
  open: boolean
  onClose: () => void
  roles: ApprovalRole[]
  configs: ApprovalConfig[]
  onToggle: (id: number, is_active: boolean) => Promise<void>
  onAdd: (payload: CreateRolePayload) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

const RoleModal: React.FC<RoleModalProps> = ({
  open,
  onClose,
  roles,
  configs,
  onToggle,
  onAdd,
  onDelete,
}) => {
  const [form] = Form.useForm<CreateRolePayload>()
  const [toggling, setToggling] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  const ruleCountByRole = (roleId: number) =>
    configs.filter((c) => c.approver_role_id === roleId).length

  const handleToggle = async (id: number, checked: boolean) => {
    setToggling(id)
    try {
      await onToggle(id, checked)
    } catch {
      // handled by parent
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      await onDelete(id)
    } catch {
      // handled by parent
    } finally {
      setDeleting(null)
    }
  }

  const handleAdd = async () => {
    const values = await form.validateFields()
    if (roles.some((r) => r.role_name.toLowerCase() === values.role_name.toLowerCase().trim())) {
      message.error(`Role "${values.role_name.trim()}" มีอยู่แล้ว`)
      return
    }
    setAdding(true)
    try {
      await onAdd({ role_name: values.role_name.trim(), description: values.description?.trim() })
      form.resetFields()
    } catch {
      // handled by parent
    } finally {
      setAdding(false)
    }
  }

  const columns: ColumnsType<ApprovalRole> = [
    {
      title: 'Role Code',
      dataIndex: 'role_code',
      key: 'role_code',
      width: 160,
      render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code>,
    },
    {
      title: 'ชื่อ Role',
      dataIndex: 'role_name',
      key: 'role_name',
    },
    {
      title: 'Rules',
      key: 'rules',
      width: 60,
      align: 'center',
      render: (_: unknown, record: ApprovalRole) => {
        const count = ruleCountByRole(record.id)
        return (
          <span style={{ fontSize: 12, color: count > 0 ? '#1890ff' : '#aaa' }}>
            {count}
          </span>
        )
      },
    },
    {
      title: 'สถานะ',
      key: 'is_active',
      width: 80,
      align: 'center',
      render: (_: unknown, record: ApprovalRole) => (
        <Switch
          checked={record.is_active}
          loading={toggling === record.id}
          onChange={(checked) => handleToggle(record.id, checked)}
          size="small"
        />
      ),
    },
    {
      title: '',
      key: 'delete',
      width: 48,
      align: 'center',
      render: (_: unknown, record: ApprovalRole) => {
        const count = ruleCountByRole(record.id)
        const disabled = count > 0

        return disabled ? (
          <Tooltip title={`มี ${count} Rule ผูกอยู่ — ลบ Rule ก่อน`}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled
            />
          </Tooltip>
        ) : (
          <Popconfirm
            title="ยืนยันการลบ Role"
            description="ลบ Role นี้ออกจากระบบหรือไม่?"
            okText="ลบ"
            cancelText="ยกเลิก"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleting === record.id}
            />
          </Popconfirm>
        )
      },
    },
  ]

  return (
    <Modal
      title="จัดการ Role"
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnClose
    >
      <Table
        rowKey="id"
        dataSource={roles}
        columns={columns}
        pagination={false}
        size="small"
        style={{ marginBottom: 16 }}
      />

      <Divider orientation="left" plain style={{ fontSize: 13, color: '#666' }}>
        เพิ่ม Role ใหม่
      </Divider>

      <Form form={form} layout="vertical">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Form.Item
            name="role_name"
            rules={[{ required: true, message: 'กรอกชื่อ Role' }]}
            style={{ flex: 1, marginBottom: 0 }}
          >
            <Input placeholder="ชื่อ Role เช่น Supervisor" />
          </Form.Item>
          <Form.Item name="description" style={{ flex: 1, marginBottom: 0 }}>
            <Input placeholder="คำอธิบาย (optional)" />
          </Form.Item>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            loading={adding}
          >
            เพิ่ม
          </Button>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: '#aaa' }}>
          Role Code จะถูก auto-generate จากชื่อ เช่น "Supervisor" → ROLE_SUPERVISOR
        </div>
      </Form>
    </Modal>
  )
}

export default RoleModal
