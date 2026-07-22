import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { useAppSelector } from '@/store'
import { approvalConfigService } from '@/services/approvalConfig.service'
import { permissionMatrixService } from '@/services/permissionMatrix.service'
import type { ApprovalConfig } from '@/types/approval.types'
import type { PermMenu, EffectivePermission } from '@/types/permission.types'
import type { PermissionAction } from '@/types'

interface PermissionContextValue {
  can: (menuCode: string, action: PermissionAction) => boolean
  canPath: (menuCode: string) => boolean
  loading: boolean
  refresh: () => void
  canApprove: (docType: string) => boolean
  approvalStepFor: (docType: string) => { step_no: number; step_name: string } | null
  hasRole: (roleCode: string) => boolean
  menus: PermMenu[]
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined)

const EFFECTIVE_FIELD: Record<PermissionAction, keyof EffectivePermission & `${string}_can_${string}`> = {
  read: 'user_can_read',
  write: 'user_can_write',
  edit: 'user_can_update',
  delete: 'user_can_delete',
}
const EFFECTIVE_ROLE_FIELD: Record<PermissionAction, keyof EffectivePermission & `${string}_can_${string}`> = {
  read: 'role_can_read',
  write: 'role_can_write',
  edit: 'role_can_update',
  delete: 'role_can_delete',
}
const EFFECTIVE_DEPT_FIELD: Record<PermissionAction, keyof EffectivePermission & `${string}_can_${string}`> = {
  read: 'dept_can_read',
  write: 'dept_can_write',
  edit: 'dept_can_update',
  delete: 'dept_can_delete',
}

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAppSelector((state) => state.auth)
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? sessionStorage.getItem('accessToken') ?? ''

  // Starts true, not false — the fetch only kicks off inside the useEffect
  // below, which runs after the first render/paint. A false initial value
  // left a window on every hard refresh where menus/effectivePermissions were
  // still empty but loading falsely read as "done", so RequirePermission's
  // can() check evaluated against empty data and flashed a 403 before the
  // real fetch even started. Same class of bug as the SidebarMenu.tsx fix.
  const [loading, setLoading] = useState(true)
  const [approvalRules, setApprovalRules] = useState<ApprovalConfig[]>([])
  const [menus, setMenus] = useState<PermMenu[]>([])
  const [effectivePermissions, setEffectivePermissions] = useState<EffectivePermission[]>([])

  // TODO(backend gap): there is still no endpoint returning the current
  // user's numeric role_id(s) (GET /permissions/effective takes user_id and
  // returns per-menu dept/role/user permission flags, not role_id itself;
  // /auth/me only returns role codes via user.roles now). approvalRules match
  // on numeric approver_role_id, so canApprove()/approvalStepFor() stay
  // stubbed to false/null until GET /api/v1/users/:id/roles (or role_id on
  // /auth/me) exists. hasRole() below does NOT have this gap — it uses
  // user.roles (string codes) directly from the JWT-backed /auth/me response.
  const [currentUserRoleIds] = useState<number[]>([])

  const fetchApprovalRules = useCallback(async () => {
    if (!accessToken) return
    const rules = await approvalConfigService.getConfigs(accessToken)
    setApprovalRules(rules.filter((r) => r.is_active))
  }, [accessToken])

  const fetchMenusAndPermissions = useCallback(async () => {
  if (!accessToken || !user?.id) {
    setMenus([])
    setEffectivePermissions([])
    return
  }
  const userId = Number(user.id)
  if (Number.isNaN(userId)) return
  const [mn, eff] = await Promise.all([
    permissionMatrixService.getMenus(accessToken),
    permissionMatrixService.getEffectivePermissions(accessToken, userId),
  ])

  // ⬇️ แทรก debug ตรงนี้ ก่อน setMenus/setEffectivePermissions ⬇️
  const debugRow = eff.find((e) => e.menu_code === 'MENU_MEMO_CREATE')
  console.log('[perm-debug] MENU_MEMO_CREATE row:', debugRow)


  setMenus(mn)
  setEffectivePermissions(eff)
}, [accessToken, user?.id])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([fetchApprovalRules(), fetchMenusAndPermissions()])
    } finally {
      setLoading(false)
    }
  }, [fetchApprovalRules, fetchMenusAndPermissions])

  useEffect(() => { fetchAll() }, [fetchAll])

  const can = useCallback((menuCode: string, action: PermissionAction): boolean => {
    const menu = menus.find((m) => m.menu_code === menuCode)
    if (!menu) {
      if (import.meta.env.DEV && menus.length > 0) {
        console.warn(`[permission] menuCode "${menuCode}" not found in GET /menus response — check menu_code matches DB exactly.`)
      }
      return false
    }
    const eff = effectivePermissions.find((e) => e.menu_id === menu.id)
    if (!eff) {
      if (import.meta.env.DEV) {
        console.warn(`[permission] no effective-permission row for menu_id ${menu.id} (${menuCode}) — GET /permissions/effective?user_id=${user?.id} did not return this menu.`)
      }
      return false
    }
    return eff[EFFECTIVE_FIELD[action]] ?? eff[EFFECTIVE_ROLE_FIELD[action]] ?? eff[EFFECTIVE_DEPT_FIELD[action]] ?? false
  }, [menus, effectivePermissions, user?.id])

  const canPath = useCallback((menuCode: string): boolean => can(menuCode, 'read'), [can])

  const canApprove = useCallback((docType: string): boolean => {
    return approvalRules.some(
      (r) => r.doc_type === docType && currentUserRoleIds.includes(r.approver_role_id),
    )
  }, [approvalRules, currentUserRoleIds])

  const approvalStepFor = useCallback((docType: string) => {
    const match = approvalRules.find(
      (r) => r.doc_type === docType && currentUserRoleIds.includes(r.approver_role_id),
    )
    return match ? { step_no: match.step_no, step_name: match.step_name } : null
  }, [approvalRules, currentUserRoleIds])

  const hasRole = useCallback((roleCode: string): boolean =>
    user?.roles?.includes(roleCode) ?? false,
  [user])

  const refresh = useCallback(() => { fetchAll() }, [fetchAll])

  return (
    <PermissionContext.Provider value={{ can, canPath, loading, refresh, canApprove, approvalStepFor, hasRole, menus }}>
      {children}
    </PermissionContext.Provider>
  )
}

export const usePermissionContext = (): PermissionContextValue => {
  const ctx = useContext(PermissionContext)
  if (!ctx) throw new Error('usePermissionContext must be used within a PermissionProvider')
  return ctx
}
