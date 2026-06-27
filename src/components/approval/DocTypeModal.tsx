import React, { useState } from 'react'
import { Modal, Table, Switch, Button, Form, Input, Space, Divider, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ApprovalDocType } from '@/types/approval.types'

interface DocTypeModalProps {
  open: boolean
  onClose: () => void
  docTypes: ApprovalDocType[]
  onToggle: (id: number, is_active: boolean) => Promise<void>
  onAdd: (body: Omit<ApprovalDocType, 'id'>) => Promise<void>
}

interface AddFormValues {
  doc_type: string
  doc_label: string
}

const DocTypeModal: React.FC<DocTypeModalProps> = ({
  open,
  onClose,
  docTypes,
  onToggle,
  onAdd,
}) => {
  const [form] = Form.useForm<AddFormValues>()
  const [toggling, setToggling] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

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

  const handleAdd = async () => {
    const values = await form.validateFields()
    const code = values.doc_type.toUpperCase().trim()
    if (docTypes.some((d) => d.doc_type === code)) {
      message.error(`รหัส "${code}" มีอยู่แล้ว`)
      return
    }
    setAdding(true)
    try {
      await onAdd({ doc_type: code, doc_label: values.doc_label.trim(), is_active: true })
      form.resetFields()
    } catch {
      // handled by parent
    } finally {
      setAdding(false)
    }
  }

  const columns: ColumnsType<ApprovalDocType> = [
    {
      title: 'รหัส',
      dataIndex: 'doc_type',
      key: 'doc_type',
      width: 100,
      render: (v: string) => <code style={{ fontWeight: 600 }}>{v}</code>,
    },
    {
      title: 'ชื่อประเภทเอกสาร',
      dataIndex: 'doc_label',
      key: 'doc_label',
    },
    {
      title: 'สถานะ',
      key: 'is_active',
      width: 90,
      align: 'center',
      render: (_: unknown, record: ApprovalDocType) => (
        <Switch
          checked={record.is_active}
          loading={toggling === record.id}
          onChange={(checked) => handleToggle(record.id, checked)}
          size="small"
        />
      ),
    },
  ]

  return (
    <Modal
      title="จัดการประเภทเอกสาร"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      <Table
        rowKey="id"
        dataSource={docTypes}
        columns={columns}
        pagination={false}
        size="small"
        style={{ marginBottom: 16 }}
      />

      <Divider orientation="left" plain style={{ fontSize: 13, color: '#666' }}>
        เพิ่มประเภทเอกสารใหม่
      </Divider>

      <Form form={form} layout="inline" style={{ alignItems: 'flex-start' }}>
        <Form.Item
          name="doc_type"
          rules={[
            { required: true, message: 'กรอกรหัส' },
            { pattern: /^[A-Za-z_]+$/, message: 'ตัวอักษรภาษาอังกฤษเท่านั้น' },
          ]}
          style={{ marginBottom: 8 }}
        >
          <Input placeholder="รหัส เช่น GR" style={{ width: 120, textTransform: 'uppercase' }} />
        </Form.Item>
        <Form.Item
          name="doc_label"
          rules={[{ required: true, message: 'กรอกชื่อ' }]}
          style={{ marginBottom: 8, flex: 1 }}
        >
          <Input placeholder="ชื่อ เช่น ใบรับสินค้า" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 8 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            loading={adding}
          >
            เพิ่ม
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default DocTypeModal
