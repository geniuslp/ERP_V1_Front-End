import React, { useState } from 'react'
import { Modal, Form, Input, Typography, message } from 'antd'
import api from '@/services/api'

const { Text } = Typography

interface Props {
  open: boolean
  onClose: () => void
}

interface FormValues {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

const OLD_PASSWORD_WRONG = 'รหัสผ่านเดิมไม่ถูกต้อง'

const ChangePasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const [form] = Form.useForm<FormValues>()
  const [saving, setSaving] = useState(false)

  const handleClose = () => {
    form.resetFields()
    onClose()
  }

  const handleSave = async () => {
    let values: FormValues
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setSaving(true)
    try {
      // Confirmation field is deliberately never sent.
      await api.post('/auth/change-password', {
        old_password: values.oldPassword,
        new_password: values.newPassword,
      })
      message.success('เปลี่ยนรหัสผ่านสำเร็จ')
      handleClose()
    } catch (err: unknown) {
      const res = (err as { response?: { status?: number; data?: { error?: unknown; message?: unknown } } })?.response
      const text = [res?.data?.error, res?.data?.message].find((v): v is string => typeof v === 'string' && !!v)
      if (res?.status === 400 && text === OLD_PASSWORD_WRONG) {
        form.setFields([{ name: 'oldPassword', errors: [OLD_PASSWORD_WRONG] }])
      } else {
        message.error(text || 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="เปลี่ยนรหัสผ่าน"
      open={open}
      onCancel={handleClose}
      onOk={handleSave}
      okText="บันทึก"
      cancelText="ยกเลิก"
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      maskClosable={false}
      destroyOnClose
      width="min(440px, calc(100vw - 32px))"
    >
      <Form form={form} layout="vertical" autoComplete="off" style={{ marginTop: 16 }}>
        <Form.Item
          name="oldPassword"
          label="รหัสผ่านเดิม"
          rules={[{ required: true, message: 'กรุณากรอกรหัสผ่านเดิม' }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="รหัสผ่านใหม่"
          dependencies={['oldPassword']}
          rules={[
            { required: true, message: 'กรุณากรอกรหัสผ่านใหม่' },
            { min: 8, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' },
            ({ getFieldValue }) => ({
              validator: (_, v) =>
                !v || v !== getFieldValue('oldPassword')
                  ? Promise.resolve()
                  : Promise.reject(new Error('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม')),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="ยืนยันรหัสผ่านใหม่"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'กรุณายืนยันรหัสผ่านใหม่' },
            ({ getFieldValue }) => ({
              validator: (_, v) =>
                !v || v === getFieldValue('newPassword')
                  ? Promise.resolve()
                  : Promise.reject(new Error('รหัสผ่านไม่ตรงกัน')),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Text type="secondary" style={{ fontSize: 12 }}>
          ลืมรหัสผ่านเดิม? กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อรีเซ็ตรหัสผ่าน
        </Text>
      </Form>
    </Modal>
  )
}

export default ChangePasswordModal
