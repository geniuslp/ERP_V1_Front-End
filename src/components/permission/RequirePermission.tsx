import React from 'react'
import { Skeleton } from 'antd'
import { usePermissionContext } from '@/contexts/PermissionContext'
import ForbiddenPage from './ForbiddenPage'
import type { PermissionAction } from '@/types'

interface RequirePermissionProps {
  menuCode: string
  action: PermissionAction
  children: React.ReactNode
  fallback?: React.ReactNode
}

const RequirePermission: React.FC<RequirePermissionProps> = ({ menuCode, action, children, fallback }) => {
  const { can, loading } = usePermissionContext()
  if (loading) return <Skeleton active />
  if (!can(menuCode, action)) return <>{fallback ?? <ForbiddenPage />}</>
  return <>{children}</>
}

export default RequirePermission
