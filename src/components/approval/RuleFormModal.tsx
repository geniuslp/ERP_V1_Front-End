import React, { useEffect } from 'react'
import { Modal, Form, Select, Input, Switch } from 'antd'
import type { ApprovalDocType, ApprovalConfig, ApprovalRole } from '@/types/approval.types'

interface RuleFormValues {
  doc_type: string
  approver_role_id: number
  step_name: string
  is_active: boolean
}

interface RuleFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: RuleFormValues) => Promise<void>
  docTypes: ApprovalDocType[]
  roles: ApprovalRole[]
  editingConfig?: ApprovalConfig | null
  prefilledDocType?: string
  prefilledRoleId?: number
  loading?: boolean
}

const RuleFormModal: React.FC<RuleFormModalProps> = ({
  open,
  onClose,
  onSubmit,
  docTypes,
  roles,
  editingConfig,
  prefilledDocType,
  prefilledRoleId,
  loading = false,
}) => {
  const [form] = Form.useForm<RuleFormValues>()
  const isEdit = !!editingConfig

  useEffect(() => {
    if (!open) return
    if (isEdit && editingConfig) {
      form.setFieldsValue({
        doc_type: editingConfig.doc_type,
        approver_role_id: editingConfig.approver_role_id,
        step_name: editingConfig.step_name,
        is_active: editingConfig.is_active,
      })
    } else {
      form.setFieldsValue({
        doc_type: prefilledDocType ?? undefined,
        approver_role_id: prefilledRoleId ?? undefined,
        step_name: '',
        is_active: true,
      })
    }
  }, [open, editingConfig, prefilledDocType, prefilledRoleId])

  const handleOk = async () => {
    const values = await form.validateFields()
    await onSubmit(values)
    form.resetFields()
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  const activeDocTypes = docTypes.filter((d) => d.is_active)

  return (
    <Modal
      title={isEdit ? 'แก้ไข Rule' : 'เพิ่ม Rule ใหม่'}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={isEdit ? 'บันทึก' : 'เพิ่ม'}
      cancelText="ยกเลิก"
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="doc_type"
          label="ประเภทเอกสาร"
          rules={[{ required: true, message: 'กรุณาเลือกประเภทเอกสาร' }]}
        >
          <Select
            placeholder="เลือกประเภทเอกสาร"
            disabled={isEdit || !!prefilledDocType}
            options={activeDocTypes.map((d) => ({ value: d.doc_type, label: d.doc_label }))}
          />
        </Form.Item>

        <Form.Item
          name="approver_role_id"
          label="Role ที่ Approve"
          rules={[{ required: true, message: 'กรุณาเลือก Role' }]}
        >
          <Select
            placeholder="เลือก Role"
            disabled={isEdit || !!prefilledRoleId}
            options={roles.map((r) => ({ value: r.id, label: r.role_name }))}
          />
        </Form.Item>

        <Form.Item
          name="step_name"
          label="ชื่อ Step"
          rules={[{ required: true, message: 'กรุณากรอกชื่อ Step' }]}
        >
          <Input placeholder="เช่น Senior Engineer approve" />
        </Form.Item>

        <Form.Item name="is_active" label="สถานะ" valuePropName="checked">
          <Switch checkedChildren="เปิด" unCheckedChildren="ปิด" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default RuleFormModal
