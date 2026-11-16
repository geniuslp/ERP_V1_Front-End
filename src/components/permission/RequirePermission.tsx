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
  /** Extra menu codes that also open this route (same action); any one of them is enough. */
  alsoMenuCodes?: string[]
}

const RequirePermission: React.FC<RequirePermissionProps> = ({ menuCode, action, children, fallback, alsoMenuCodes }) => {
  const { can, loading } = usePermissionContext()
  if (loading) return <Skeleton active />
  const allowed = can(menuCode, action) || (alsoMenuCodes ?? []).some((m) => can(m, action))
  if (!allowed) return <>{fallback ?? <ForbiddenPage />}</>
  return <>{children}</>
}

export default RequirePermission
