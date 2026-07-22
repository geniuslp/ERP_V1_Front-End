import React from 'react'
import { usePermissionContext } from '@/contexts/PermissionContext'

interface ApprovalGateProps {
  docType: string
  children: React.ReactNode
  mode?: 'hide' | 'disable'
}

const ApprovalGate: React.FC<ApprovalGateProps> = ({ docType, children, mode = 'hide' }) => {
  const { canApprove } = usePermissionContext()
  const allowed = canApprove(docType)

  if (allowed) return <>{children}</>
  if (mode === 'disable' && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, { disabled: true } as any)
  }
  return null
}

export default ApprovalGate
