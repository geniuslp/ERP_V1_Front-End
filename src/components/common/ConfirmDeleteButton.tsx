import React from 'react'
import { Button, Popconfirm } from 'antd'
import type { ButtonProps } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import PermissionButton from '@/components/common/PermissionButton'

export const DEFAULT_CONFIRM_DELETE_TEXT = 'ยืนยันการลบรายการนี้? การลบไม่สามารถย้อนกลับได้'

interface Props extends Omit<ButtonProps, 'onClick'> {
  onConfirm: () => void | Promise<void>
  /** Popconfirm title. */
  text?: React.ReactNode
  /** When set, the trigger is a PermissionButton gated by action="delete" on this menu code. */
  menuCode?: string
}

// Popconfirm wrapper for every delete trigger: danger "ลบ" confirm button + "ยกเลิก".
// The trigger defaults to a danger delete-icon button; pass children for a text button.
const ConfirmDeleteButton: React.FC<Props> = ({ onConfirm, text = DEFAULT_CONFIRM_DELETE_TEXT, menuCode, children, ...buttonProps }) => {
  const trigger = menuCode ? (
    <PermissionButton action="delete" menuCode={menuCode} danger icon={<DeleteOutlined />} {...buttonProps}>
      {children}
    </PermissionButton>
  ) : (
    <Button danger icon={<DeleteOutlined />} {...buttonProps}>
      {children}
    </Button>
  )
  return (
    <Popconfirm
      title={text}
      okText="ลบ"
      okButtonProps={{ danger: true }}
      cancelText="ยกเลิก"
      disabled={buttonProps.disabled}
      onConfirm={onConfirm}
    >
      {trigger}
    </Popconfirm>
  )
}

export default ConfirmDeleteButton
