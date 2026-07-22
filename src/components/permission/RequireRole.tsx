import React from 'react'
import { Skeleton } from 'antd'
import { usePermissionContext } from '@/contexts/PermissionContext'
import ForbiddenPage from './ForbiddenPage'

interface RequireRoleProps {
  roleCode: string | string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

const RequireRole: React.FC<RequireRoleProps> = ({ roleCode, children, fallback }) => {
  const { hasRole, loading } = usePermissionContext()
  if (loading) return <Skeleton active />
  const codes = Array.isArray(roleCode) ? roleCode : [roleCode]
  const allowed = codes.some(hasRole)
  if (!allowed) return <>{fallback ?? <ForbiddenPage />}</>
  return <>{children}</>
}

export default RequireRole
