import { useAppSelector } from '@/store'
import { PermissionAction } from '@/types'

export const usePermission = (menuId: string) => {
  const { permissions } = useAppSelector((state) => state.menu)
  const { user } = useAppSelector((state) => state.auth)

  const userPermission = permissions.find(
    (p) => p.userId === user?.id && p.menuId === menuId
  )

  const can = (action: PermissionAction): boolean => {
    if (!userPermission) return false
    return userPermission.actions.includes(action)
  }

  return {
    canRead: can('read'),
    canWrite: can('write'),
    canEdit: can('edit'),
    canDelete: can('delete'),
    can,
  }
}
