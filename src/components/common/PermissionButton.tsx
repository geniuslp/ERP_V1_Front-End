import React from 'react'
import { Button } from 'antd'
import type { ButtonProps } from 'antd'
import PermissionGate from '@/components/permission/PermissionGate'
import { useApprovalPermission } from '@/hooks/useApprovalPermission'
import type { ApprovalDocType } from '@/hooks/useApprovalPermission'
import type { PermissionAction } from '@/types'

interface MenuPermissionButtonProps extends ButtonProps {
  action: PermissionAction
  menuCode: string
  mode?: 'hide' | 'disable'
}

interface ApprovalPermissionButtonProps extends ButtonProps {
  action: 'approval'
  docType: ApprovalDocType
  docId: string | number | undefined
  approvalAction: 'approve' | 'reject'
  mode?: 'hide' | 'disable'
}

type PermissionButtonProps = MenuPermissionButtonProps | ApprovalPermissionButtonProps

const ApprovalGatedButton: React.FC<ApprovalPermissionButtonProps> = ({
  docType, docId, approvalAction, mode = 'hide', ...buttonProps
}) => {
  const { canApprove, canReject, loading } = useApprovalPermission(docType, docId)
  const allowed = approvalAction === 'approve' ? canApprove : canReject

  if (loading) return null
  if (allowed) return <Button {...buttonProps} />
  if (mode === 'disable') return <Button {...buttonProps} disabled />
  return null
}

const PermissionButton: React.FC<PermissionButtonProps> = (props) => {
  if (props.action === 'approval') {
    return <ApprovalGatedButton {...props} />
  }
  const { menuCode, action, mode = 'hide', ...buttonProps } = props
  return (
    <PermissionGate menuCode={menuCode} action={action} mode={mode}>
      <Button {...buttonProps} />
    </PermissionGate>
  )
}

export default PermissionButton
