import React from 'react'
import { usePermissionContext } from '@/contexts/PermissionContext'
import type { PermissionAction } from '@/types'

interface PermissionGateProps {
  menuCode: string
  action: PermissionAction
  children: React.ReactNode
  mode?: 'hide' | 'disable'
}

const PermissionGate: React.FC<PermissionGateProps> = ({ menuCode, action, children, mode = 'hide' }) => {
  const { can } = usePermissionContext()
  const allowed = can(menuCode, action)

  if (allowed) return <>{children}</>
  if (mode === 'disable' && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, { disabled: true } as any)
  }
  return null
}

export default PermissionGate
