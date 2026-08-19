import React, { useEffect, useState } from 'react'
import { Modal, Input, Alert } from 'antd'

interface RenameMasterValueModalProps {
  open: boolean
  title: string
  currentValue: string
  loading: boolean
  onCancel: () => void
  onSave: (newValue: string) => void
}

// Small compact rename Modal, reused by all six master-lookup rename actions
// on the material detail page — mirrors this app's existing edit-Modal
// pattern (Form/Input inside antd Modal, e.g. GroupPage.tsx's edit flow),
// but deliberately kept single-field/lightweight since it edits one string.
const RenameMasterValueModal: React.FC<RenameMasterValueModalProps> = ({
  open, title, currentValue, loading, onCancel, onSave,
}) => {
  const [value, setValue] = useState(currentValue)

  useEffect(() => {
    if (open) setValue(currentValue)
  }, [open, currentValue])

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={() => onSave(value.trim())}
      okText="บันทึก"
      cancelText="ยกเลิก"
      confirmLoading={loading}
      okButtonProps={{ disabled: !value.trim() }}
      width={420}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12, fontSize: 12.5 }}
        message="แก้ไขนี้จะมีผลกับวัสดุอื่นที่ใช้ค่านี้ร่วมกันด้วย"
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPressEnter={() => value.trim() && onSave(value.trim())}
        autoFocus
        maxLength={255}
      />
    </Modal>
  )
}

export default RenameMasterValueModal
