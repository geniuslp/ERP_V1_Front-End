import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Button, Modal, message, Select, Tabs, Popconfirm, Skeleton } from 'antd'
import { ReloadOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons'
import { useAppSelector } from '@/store'
import PermissionGrid, { PermissionModuleGroup } from '@/components/permission/PermissionGrid'
import PermissionCell from '@/components/permission/PermissionCell'
import { permissionMatrixService } from '@/services/permissionMatrix.service'
import type {
  PermField,
  PermMenu,
  PermRole,
  RoleMenuPermission,
  DeptMenuPermission,
  EffectivePermission,
  UserPermBatchPayload,
  Department,
} from '@/types/permission.types'

// ─────────────────────────────────────────────────────────────
// Shared helpers & style constants
// ─────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '6px',
  background: '#fafafa',
  border: '1px solid #e8e8e8',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
}

const tdBaseStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #e8e8e8',
}

const FIELD_KEY_DEPT: Record<PermField, keyof DeptMenuPermission> = {
  read: 'can_read',
  write: 'can_write',
  update: 'can_update',
  delete: 'can_delete',
}

const FIELD_KEY_ROLE: Record<PermField, keyof RoleMenuPermission> = {
  read: 'can_read',
  write: 'can_write',
  update: 'can_update',
  delete: 'can_delete',
}

function buildModuleGroups(menus: PermMenu[]): PermissionModuleGroup[] {
  const topLevel = menus.filter((m) => m.parent_id === null).sort((a, b) => a.order - b.order)
  return topLevel.map((top) => {
    const children = menus.filter((m) => m.parent_id === top.id).sort((a, b) => a.order - b.order)
    // Top-level items with no children are themselves leaf/actionable rows
    return {
      moduleId: top.id,
      moduleLabel: top.menu_name,
      menus: children.length > 0 ? children : [top],
    }
  })
}

const MatrixLegend: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginTop: '1rem',
      paddingTop: '1rem',
      borderTop: '0.5px solid var(--border)',
      flexWrap: 'wrap',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
      <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--bg-warning)' }} />
      คอลัมน์ที่แก้ไข (ยังไม่บันทึก)
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
      <span style={{ opacity: 0.35 }}>☐</span>
      จาง = ต้องเปิด Read ก่อนถึงจะติ๊กได้
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────
// DeptTab
// ─────────────────────────────────────────────────────────────

const emptyDeptPerm = (dept_code: string, menu_id: number): DeptMenuPermission => ({
  dept_code,
  menu_id,
  can_read: false,
  can_write: false,
  can_update: false,
  can_delete: false,
})

const DeptTab: React.FC<{ token: string }> = ({ token }) => {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [menus, setMenus] = useState<PermMenu[]>([])
  const [serverPerms, setServerPerms] = useState<DeptMenuPermission[]>([])
  const [draftPerms, setDraftPerms] = useState<DeptMenuPermission[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [filterDept, setFilterDept] = useState<string>('')

  const visibleDepts = filterDept
    ? departments.filter((d) => d.dept_code === filterDept)
    : departments

  const moduleGroups = useMemo(() => buildModuleGroups(menus), [menus])

  const draftDeptMap = useMemo(() => {
    const map = new Map<string, DeptMenuPermission>()
    for (const p of draftPerms) map.set(`${p.dept_code}:${p.menu_id}`, p)
    return map
  }, [draftPerms])

  const serverDeptMap = useMemo(() => {
    const map = new Map<string, DeptMenuPermission>()
    for (const p of serverPerms) map.set(`${p.dept_code}:${p.menu_id}`, p)
    return map
  }, [serverPerms])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [depts, mn, perms] = await Promise.all([
        permissionMatrixService.getDepartments(token),
        permissionMatrixService.getMenus(token),
        permissionMatrixService.getDeptPermissions(token),
      ])
      setDepartments(depts)
      setMenus(mn)
      setServerPerms(perms)
      setDraftPerms(perms.map((p) => ({ ...p })))
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  const getDraftPerm = useCallback((dept: string, menuId: number): DeptMenuPermission =>
    draftDeptMap.get(`${dept}:${menuId}`) ?? emptyDeptPerm(dept, menuId),
  [draftDeptMap])

  const getServerPerm = useCallback((dept: string, menuId: number): DeptMenuPermission =>
    serverDeptMap.get(`${dept}:${menuId}`) ?? emptyDeptPerm(dept, menuId),
  [serverDeptMap])

  const isCellChanged = useCallback((dept: string, menuId: number): boolean => {
    const d = getDraftPerm(dept, menuId)
    const s = getServerPerm(dept, menuId)
    return d.can_read !== s.can_read || d.can_write !== s.can_write || d.can_update !== s.can_update || d.can_delete !== s.can_delete
  }, [getDraftPerm, getServerPerm])

  const hasDeptChanges = useCallback((deptCode: string): boolean =>
    moduleGroups.flatMap((g) => g.menus).some((menu) => isCellChanged(deptCode, menu.id)),
  [moduleGroups, isCellChanged])

  const diffItems = useMemo(() => {
    const leafMenus = moduleGroups.flatMap((g) => g.menus)
    const results: { dept: string; menuId: number }[] = []
    for (const d of departments) {
      for (const menu of leafMenus) {
        if (isCellChanged(d.dept_code, menu.id)) results.push({ dept: d.dept_code, menuId: menu.id })
      }
    }
    return results
  }, [departments, moduleGroups, isCellChanged])

  const hasDiff = diffItems.length > 0

  const handleToggle = useCallback((dept: string, menuId: number, field: PermField, value: boolean) => {
    setDraftPerms((prev) => {
      const idx = prev.findIndex((p) => p.dept_code === dept && p.menu_id === menuId)
      const current = idx !== -1 ? prev[idx] : emptyDeptPerm(dept, menuId)
      const autoEnablesRead = field !== 'read' && value && !current.can_read
      let next: DeptMenuPermission

      if (field === 'read' && !value) {
        next = { ...current, can_read: false, can_write: false, can_update: false, can_delete: false }
      } else if (autoEnablesRead) {
        next = { ...current, can_read: true, [FIELD_KEY_DEPT[field]]: true }
      } else {
        next = { ...current, [FIELD_KEY_DEPT[field]]: value }
      }

      if (autoEnablesRead) message.info('เปิดใช้งาน Read อัตโนมัติ')

      if (idx !== -1) {
        const updated = [...prev]
        updated[idx] = next
        return updated
      }
      return [...prev, next]
    })
  }, [])

  const handleCancelDraft = useCallback(() => setDraftPerms(serverPerms.map((p) => ({ ...p }))), [serverPerms])

  const handleSubmitBatch = async () => {
    setSubmitting(true)
    try {
      await permissionMatrixService.batchUpdateDept(token, { permissions: draftPerms })
      const fresh = await permissionMatrixService.getDeptPermissions(token)
      setServerPerms(fresh)
      setDraftPerms(fresh.map((p) => ({ ...p })))
      setConfirmOpen(false)
      message.success(`บันทึกสำเร็จ — อัปเดต ${diffItems.length} รายการ`)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>
          โหลดใหม่
        </Button>
        <Select
          value={filterDept || undefined}
          onChange={(v) => setFilterDept(v ?? '')}
          placeholder="กรองตามแผนก"
          allowClear
          style={{ width: 190 }}
          options={departments.map((d) => ({ value: d.dept_code, label: d.dept_name }))}
        />
        <div style={{ flex: 1 }} />
        <Button icon={<UndoOutlined />} onClick={handleCancelDraft} disabled={!hasDiff}>
          ยกเลิก
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          disabled={!hasDiff}
          onClick={() => setConfirmOpen(true)}
        >
          บันทึก{hasDiff ? ` (${diffItems.length})` : ''}
        </Button>
      </div>

      {/* Matrix */}
      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : moduleGroups.length === 0 || visibleDepts.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {visibleDepts.length === 0 ? 'ไม่มีแผนกในระบบ' : 'ไม่มีเมนูสำหรับกำหนดสิทธิ์'}
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid #e8e8e8', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    style={{ ...thStyle, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, minWidth: 200 }}
                  >
                    เมนู
                  </th>
                  {visibleDepts.map((d) => (
                    <th key={d.dept_code} colSpan={4} style={{ ...thStyle, textAlign: 'center', minWidth: 120 }}>
                      {d.dept_name}
                    </th>
                  ))}
                </tr>
                <tr>
                  {visibleDepts.map((d) => (
                    <th
                      key={d.dept_code}
                      colSpan={4}
                      style={{ ...thStyle, textAlign: 'center', fontSize: 11, fontWeight: 500, padding: 0 }}
                    >
                      {/* Mirrors PermissionCell's checkbox row layout exactly so the R/W/U/D
                          labels line up with the checkboxes rendered below them. */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, padding: '4px 2px' }}>
                        {(['R', 'W', 'U', 'D'] as const).map((letter) => (
                          <span key={letter} style={{ width: 24, textAlign: 'center' }}>{letter}</span>
                        ))}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moduleGroups.map((group) => (
                  <React.Fragment key={group.moduleId}>
                    <tr>
                      <td
                        colSpan={1 + visibleDepts.length * 4}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--text-accent)',
                          background: 'var(--bg-accent)',
                          border: '1px solid #e8e8e8',
                          position: 'sticky',
                          left: 0,
                        }}
                      >
                        {group.moduleLabel}
                      </td>
                    </tr>
                    {group.menus.map((menu, mi) => (
                      <tr key={menu.id}>
                        <td
                          style={{
                            ...tdBaseStyle,
                            textAlign: 'left',
                            background: '#ffffff',
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            paddingLeft: 24,
                          }}
                        >
                          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{menu.menu_name}</span>
                        </td>
                        {visibleDepts.map((d) => (
                          <td
                            key={d.dept_code}
                            colSpan={4}
                            style={{
                              ...tdBaseStyle,
                              background: hasDeptChanges(d.dept_code)
                                ? 'var(--bg-warning)'
                                : mi % 2 === 0
                                ? '#ffffff'
                                : '#fafafa',
                              padding: '2px 6px',
                            }}
                          >
                            <PermissionCell
                              perm={getDraftPerm(d.dept_code, menu.id)}
                              changed={isCellChanged(d.dept_code, menu.id)}
                              onToggle={(field, value) => handleToggle(d.dept_code, menu.id, field, value)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <MatrixLegend />
        </>
      )}

      <Modal
        title="ยืนยันการบันทึก"
        open={confirmOpen}
        onCancel={() => !submitting && setConfirmOpen(false)}
        onOk={handleSubmitBatch}
        okText="ยืนยัน"
        cancelText="ยกเลิก"
        okButtonProps={{ loading: submitting, style: { background: '#1d4ed8', border: 'none' } }}
        closable={!submitting}
        width={480}
      >
        <div style={{ marginBottom: 12, fontSize: 13, color: '#555' }}>
          {diffItems.length} รายการสิทธิ์จะถูกอัปเดต
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {diffItems.map(({ dept, menuId }) => {
            const menu = menus.find((m) => m.id === menuId)
            return (
              <div
                key={`${dept}|${menuId}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1e3a8a', marginBottom: 4, fontSize: 13 }}
              >
                <span style={{ fontWeight: 600 }}>{dept}</span>
                <span style={{ color: '#9ca3af' }}>→</span>
                <span>{menu?.menu_name ?? String(menuId)}</span>
              </div>
            )
          })}
        </div>
      </Modal>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// RoleTab
// ─────────────────────────────────────────────────────────────

const makeRoleKey = (roleId: number, menuId: number) => `${roleId}|${menuId}`

const emptyRolePerm = (roleId: number, menuId: number): RoleMenuPermission => ({
  role_id: roleId,
  menu_id: menuId,
  can_read: false,
  can_write: false,
  can_update: false,
  can_delete: false,
})

const buildMap = (perms: RoleMenuPermission[]): Record<string, RoleMenuPermission> => {
  const map: Record<string, RoleMenuPermission> = {}
  perms.forEach((p) => { map[makeRoleKey(p.role_id, p.menu_id)] = p })
  return map
}

const buildMapWithDeptDefaults = (
  perms: RoleMenuPermission[],
  roles: PermRole[],
  menus: PermMenu[],
  deptPerms: DeptMenuPermission[],
): Record<string, RoleMenuPermission> => {
  const map = buildMap(perms)
  roles.forEach((role) => {
    menus.forEach((menu) => {
      const key = makeRoleKey(role.id, menu.id)
      if (map[key]) return
      if (!role.dept_code) return
      const dp = deptPerms.find((d) => d.dept_code === role.dept_code && d.menu_id === menu.id)
      if (!dp) return
      map[key] = {
        role_id: role.id,
        menu_id: menu.id,
        can_read: dp.can_read,
        can_write: dp.can_write,
        can_update: dp.can_update,
        can_delete: dp.can_delete,
      }
    })
  })
  return map
}

const samePerm = (a?: RoleMenuPermission, b?: RoleMenuPermission) =>
  (a?.can_read ?? false) === (b?.can_read ?? false) &&
  (a?.can_write ?? false) === (b?.can_write ?? false) &&
  (a?.can_update ?? false) === (b?.can_update ?? false) &&
  (a?.can_delete ?? false) === (b?.can_delete ?? false)

const RoleTab: React.FC<{ token: string }> = ({ token }) => {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [roles, setRoles] = useState<PermRole[]>([])
  const [menus, setMenus] = useState<PermMenu[]>([])
  const [serverMap, setServerMap] = useState<Record<string, RoleMenuPermission>>({})
  const [draftMap, setDraftMap] = useState<Record<string, RoleMenuPermission>>({})
  const [deptPerms, setDeptPerms] = useState<DeptMenuPermission[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)

  useEffect(() => { setSelectedRoleId(null) }, [selectedDept])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rl, mn, perms, dp, depts] = await Promise.all([
        permissionMatrixService.getRoles(token),
        permissionMatrixService.getMenus(token),
        permissionMatrixService.getPermissions(token),
        permissionMatrixService.getDeptPermissions(token),
        permissionMatrixService.getDepartments(token),
      ])
      setRoles(rl)
      setMenus(mn)
      const map = buildMapWithDeptDefaults(perms, rl, mn, dp)
      setServerMap(map)
      setDraftMap(map)
      setDeptPerms(dp)
      setDepartments(depts)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  const visibleRoles = useMemo(() => {
    if (!selectedDept) return []
    const deptRoles = roles.filter((r) => r.dept_code === selectedDept)
    const globalRoles = roles.filter((r) => r.dept_code === null)
    const combined = [...deptRoles.sort((a, b) => a.level - b.level), ...globalRoles.sort((a, b) => a.level - b.level)]
    if (selectedRoleId) {
      return combined.filter((r) => r.id === selectedRoleId)
    }
    return combined
  }, [roles, selectedDept, selectedRoleId])

  const roleOptionsForDept = useMemo(() => {
    if (!selectedDept) return []
    return roles
      .filter((r) => r.dept_code === selectedDept || r.dept_code === null)
      .sort((a, b) => a.level - b.level)
  }, [roles, selectedDept])

  const moduleGroups: PermissionModuleGroup[] = useMemo(() => buildModuleGroups(menus), [menus])

  const diffKeys = useMemo(() => {
    const allKeys = new Set([...Object.keys(serverMap), ...Object.keys(draftMap)])
    return Array.from(allKeys).filter((key) => !samePerm(draftMap[key], serverMap[key]))
  }, [draftMap, serverMap])

  const changedKeySet = useMemo(() => new Set(diffKeys), [diffKeys])
  const hasDiff = diffKeys.length > 0
  const diffCount = diffKeys.length

  const getPerm = useCallback((roleId: number, menuId: number): RoleMenuPermission =>
    draftMap[makeRoleKey(roleId, menuId)] ?? emptyRolePerm(roleId, menuId),
  [draftMap])

  const isOverriddenOff = useCallback((roleId: number, menuId: number, field: PermField): boolean => {
    const role = roles.find((r) => r.id === roleId)
    if (!role?.dept_code) return false
    const dp = deptPerms.find((d) => d.dept_code === role.dept_code && d.menu_id === menuId)
    if (!dp || !dp[FIELD_KEY_DEPT[field]]) return false
    const draft = getPerm(roleId, menuId)
    return !draft[FIELD_KEY_ROLE[field]]
  }, [roles, deptPerms, getPerm])

  const getOverriddenOffFields = useCallback((roleId: number, menuId: number): Partial<Record<PermField, boolean>> => ({
    read: isOverriddenOff(roleId, menuId, 'read'),
    write: isOverriddenOff(roleId, menuId, 'write'),
    update: isOverriddenOff(roleId, menuId, 'update'),
    delete: isOverriddenOff(roleId, menuId, 'delete'),
  }), [isOverriddenOff])

  const isChanged = useCallback((roleId: number, menuId: number): boolean =>
    changedKeySet.has(makeRoleKey(roleId, menuId)),
  [changedKeySet])

  const hasRoleChanges = useCallback(
    (roleId: number): boolean =>
      Array.from(changedKeySet).some((key) => key.startsWith(`${roleId}|`)),
    [changedKeySet],
  )

  const handleToggle = useCallback((roleId: number, menuId: number, field: PermField, value: boolean) => {
    setDraftMap((prev) => {
      const key = makeRoleKey(roleId, menuId)
      const current = prev[key] ?? emptyRolePerm(roleId, menuId)
      const autoEnablesRead = field !== 'read' && value && !current.can_read
      let next: RoleMenuPermission

      if (field === 'read' && !value) {
        next = { ...current, can_read: false, can_write: false, can_update: false, can_delete: false }
      } else if (autoEnablesRead) {
        next = { ...current, can_read: true, [FIELD_KEY_ROLE[field]]: true }
      } else {
        next = { ...current, [FIELD_KEY_ROLE[field]]: value }
      }

      if (autoEnablesRead) message.info('เปิดใช้งาน Read อัตโนมัติ')
      return { ...prev, [key]: next }
    })
  }, [])

  const handleCancelDraft = useCallback(() => setDraftMap({ ...serverMap }), [serverMap])

  const diffSummary = useMemo(() => {
    return diffKeys.map((key) => {
      const [roleIdStr, menuIdStr] = key.split('|')
      const role = roles.find((r) => r.id === Number(roleIdStr))
      const menu = menus.find((m) => m.id === Number(menuIdStr))
      return { key, roleLabel: role?.role_code ?? roleIdStr, menuLabel: menu?.menu_name ?? menuIdStr }
    })
  }, [diffKeys, roles, menus])

  const handleSubmitBatch = async () => {
    setSubmitting(true)
    try {
      const payload = diffKeys.map((key) => {
        const [roleIdStr, menuIdStr] = key.split('|')
        const roleId = Number(roleIdStr)
        const menuId = Number(menuIdStr)
        const draft = draftMap[key] ?? emptyRolePerm(roleId, menuId)
        const server = serverMap[key]
        return { ...draft, id: server?.id ?? draft.id, role_id: roleId, menu_id: menuId }
      })
      await permissionMatrixService.batchUpdate(token, { permissions: payload })
      const fresh = await permissionMatrixService.getPermissions(token)
      const map = buildMapWithDeptDefaults(fresh, roles, menus, deptPerms)
      setServerMap(map)
      setDraftMap(map)
      setConfirmOpen(false)
      message.success(`บันทึกสำเร็จ — อัปเดต ${payload.length} รายการ`)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>
          โหลดใหม่
        </Button>
        <Select
          value={selectedDept ?? undefined}
          onChange={(v) => setSelectedDept(v ?? null)}
          placeholder="เลือกแผนกเพื่อจัดการสิทธิ์ตำแหน่ง"
          style={{ width: 260 }}
          showSearch
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={departments.map((d) => ({ value: d.dept_code, label: d.dept_name }))}
        />
        {selectedDept && (
          <Select
            value={selectedRoleId ?? undefined}
            onChange={(v) => setSelectedRoleId(v ?? null)}
            placeholder="เลือกตำแหน่ง (ไม่บังคับ)"
            allowClear
            style={{ width: 240 }}
            showSearch
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={roleOptionsForDept.map((r) => ({ value: r.id, label: `${r.role_code} — ${r.role_name}` }))}
          />
        )}
        <div style={{ flex: 1 }} />
        <Button icon={<UndoOutlined />} onClick={handleCancelDraft} disabled={!hasDiff}>
          ยกเลิก
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          disabled={!hasDiff}
          onClick={() => setConfirmOpen(true)}
        >
          บันทึก{hasDiff ? ` (${diffCount})` : ''}
        </Button>
      </div>

      {!selectedDept ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          เลือกแผนกด้านบนเพื่อเริ่มจัดการสิทธิ์ตำแหน่ง
        </div>
      ) : (
        <PermissionGrid
          moduleGroups={moduleGroups}
          roles={visibleRoles}
          loading={loading}
          getPerm={getPerm}
          isChanged={isChanged}
          hasRoleChanges={hasRoleChanges}
          onToggle={handleToggle}
          getOverriddenOffFields={getOverriddenOffFields}
          globalRoleIds={new Set(roles.filter((r) => r.dept_code === null).map((r) => r.id))}
        />
      )}

      <Modal
        title="ยืนยันการบันทึก"
        open={confirmOpen}
        onCancel={() => !submitting && setConfirmOpen(false)}
        onOk={handleSubmitBatch}
        okText="ยืนยัน"
        cancelText="ยกเลิก"
        okButtonProps={{ loading: submitting, style: { background: '#1d4ed8', border: 'none' } }}
        closable={!submitting}
        width={480}
      >
        <div style={{ marginBottom: 12, fontSize: 13, color: '#555' }}>
          {diffSummary.length} รายการสิทธิ์จะถูกอัปเดต
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {diffSummary.map((item) => (
            <div
              key={item.key}
              style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1e3a8a', marginBottom: 4, fontSize: 13 }}
            >
              <span style={{ fontWeight: 600 }}>{item.roleLabel}</span>
              <span style={{ color: '#9ca3af' }}>→</span>
              <span>{item.menuLabel}</span>
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// UserTab
// ─────────────────────────────────────────────────────────────

type UserRecord = { id: number; username: string; full_name: string; department: string }

type CustomPerm = { can_read: boolean; can_write: boolean; can_update: boolean; can_delete: boolean }


const UserTab: React.FC<{ token: string }> = ({ token }) => {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [menus, setMenus] = useState<PermMenu[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [effectivePerms, setEffectivePerms] = useState<EffectivePermission[]>([])
  const [draftCustom, setDraftCustom] = useState<Record<number, CustomPerm>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const fetchInit = useCallback(async () => {
    try {
      const [ul, mn] = await Promise.all([
        permissionMatrixService.getUsers(token),
        permissionMatrixService.getMenus(token),
      ])
      setUsers(ul)
      setMenus(mn)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดผู้ใช้ไม่สำเร็จ')
    }
  }, [token])

  useEffect(() => { fetchInit() }, [fetchInit])

  const fetchEffective = useCallback(async (userId: number) => {
    setLoading(true)
    setDraftCustom({})
    try {
      const perms = await permissionMatrixService.getEffectivePermissions(token, userId)
      setEffectivePerms(perms)
      const seed: Record<number, CustomPerm> = {}
      perms.forEach((row) => {
        if (row.user_can_read !== null || row.user_can_write !== null || row.user_can_update !== null || row.user_can_delete !== null) {
          seed[row.menu_id] = {
            can_read: row.user_can_read ?? false,
            can_write: row.user_can_write ?? false,
            can_update: row.user_can_update ?? false,
            can_delete: row.user_can_delete ?? false,
          }
        }
      })
      setDraftCustom(seed)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดสิทธิ์ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [token])

  const handleSelectUser = (userId: number) => {
    setSelectedUserId(userId)
    fetchEffective(userId)
  }

  const moduleGroups = useMemo(() => {
    const leafRows = effectivePerms.filter((ep) => ep.parent_id !== null)
    const parentNames = new Map<number, string>()
    effectivePerms.forEach((ep) => {
      if (ep.parent_id === null) parentNames.set(ep.menu_id, ep.menu_name)
    })
    const grouped = new Map<number, EffectivePermission[]>()
    leafRows.forEach((ep) => {
      const pid = ep.parent_id!
      if (!grouped.has(pid)) grouped.set(pid, [])
      grouped.get(pid)!.push(ep)
    })
    const topMenus = menus.filter((m) => m.parent_id === null).sort((a, b) => a.order - b.order)
    return topMenus
      .filter((top) => grouped.has(top.id))
      .map((top) => ({
        moduleId: top.id,
        moduleLabel: top.menu_name,
        rows: grouped.get(top.id)!,
      }))
  }, [effectivePerms, menus])

  const effectivePermsMap = useMemo(() => {
    const map = new Map<number, EffectivePermission>()
    for (const ep of effectivePerms) map.set(ep.menu_id, ep)
    return map
  }, [effectivePerms])

  const getCustomPerm = useCallback((row: EffectivePermission): CustomPerm =>
    draftCustom[row.menu_id] ?? {
      can_read: row.user_can_read ?? false,
      can_write: row.user_can_write ?? false,
      can_update: row.user_can_update ?? false,
      can_delete: row.user_can_delete ?? false,
    },
  [draftCustom])

  const isInherited = useCallback((row: EffectivePermission, field: PermField): boolean => {
    const deptVal = row[`dept_can_${field}` as keyof EffectivePermission] ?? false
    const roleVal = row[`role_can_${field}` as keyof EffectivePermission] ?? false
    return Boolean(deptVal) || Boolean(roleVal)
  }, [])

  const getLockedFields = useCallback((row: EffectivePermission): Partial<Record<PermField, boolean>> => ({
    read: isInherited(row, 'read'),
    write: isInherited(row, 'write'),
    update: isInherited(row, 'update'),
    delete: isInherited(row, 'delete'),
  }), [isInherited])

  const isDeptInheritedForRole = useCallback((row: EffectivePermission, field: PermField): boolean =>
    Boolean(row[`dept_can_${field}` as keyof EffectivePermission] ?? false),
  [])

  const getRoleLockedFields = useCallback((row: EffectivePermission): Partial<Record<PermField, boolean>> => ({
    read: isDeptInheritedForRole(row, 'read'),
    write: isDeptInheritedForRole(row, 'write'),
    update: isDeptInheritedForRole(row, 'update'),
    delete: isDeptInheritedForRole(row, 'delete'),
  }), [isDeptInheritedForRole])

  const isHighlighted = useCallback((menuId: number, row: EffectivePermission): boolean => {
    const c = draftCustom[menuId]
    if (!c) return false
    return (
      (!isInherited(row, 'read')   && c.can_read   !== (row.role_can_read   ?? false)) ||
      (!isInherited(row, 'write')  && c.can_write  !== (row.role_can_write  ?? false)) ||
      (!isInherited(row, 'update') && c.can_update !== (row.role_can_update ?? false)) ||
      (!isInherited(row, 'delete') && c.can_delete !== (row.role_can_delete ?? false))
    )
  }, [draftCustom, isInherited])

  const diffMenuIds = useMemo(() => {
    return Object.keys(draftCustom).map(Number).filter((menuId) => {
      const row = effectivePermsMap.get(menuId)
      const draft = draftCustom[menuId]
      const baseline = {
        can_read: row?.user_can_read ?? false,
        can_write: row?.user_can_write ?? false,
        can_update: row?.user_can_update ?? false,
        can_delete: row?.user_can_delete ?? false,
      }
      return (
        (!row || !isInherited(row, 'read'))   && draft.can_read   !== baseline.can_read ||
        (!row || !isInherited(row, 'write'))  && draft.can_write  !== baseline.can_write ||
        (!row || !isInherited(row, 'update')) && draft.can_update !== baseline.can_update ||
        (!row || !isInherited(row, 'delete')) && draft.can_delete !== baseline.can_delete
      )
    })
  }, [draftCustom, effectivePermsMap, isInherited])

  const hasDiff = diffMenuIds.length > 0

  const handleToggle = useCallback((menuId: number, row: EffectivePermission, field: PermField, value: boolean) => {
    setDraftCustom((prev) => {
      const current: CustomPerm = prev[menuId] ?? {
        can_read: row.user_can_read ?? false,
        can_write: row.user_can_write ?? false,
        can_update: row.user_can_update ?? false,
        can_delete: row.user_can_delete ?? false,
      }
      const autoEnablesRead = field !== 'read' && value && !current.can_read
      let next: CustomPerm

      if (field === 'read' && !value) {
        next = { can_read: false, can_write: false, can_update: false, can_delete: false }
      } else if (autoEnablesRead) {
        next = { ...current, can_read: true, [FIELD_KEY_ROLE[field]]: true }
      } else {
        next = { ...current, [FIELD_KEY_ROLE[field]]: value }
      }

      if (autoEnablesRead) message.info('เปิดใช้งาน Read อัตโนมัติ')
      return { ...prev, [menuId]: next }
    })
  }, [])

  const handleCancelDraft = useCallback(() => {
    const seed: Record<number, CustomPerm> = {}
    effectivePerms.forEach((row) => {
      if (row.user_can_read !== null || row.user_can_write !== null || row.user_can_update !== null || row.user_can_delete !== null) {
        seed[row.menu_id] = {
          can_read: row.user_can_read ?? false,
          can_write: row.user_can_write ?? false,
          can_update: row.user_can_update ?? false,
          can_delete: row.user_can_delete ?? false,
        }
      }
    })
    setDraftCustom(seed)
  }, [effectivePerms])

  const handleReset = async () => {
    if (!selectedUserId) return
    try {
      await permissionMatrixService.resetUserPermissions(token, selectedUserId)
      await fetchEffective(selectedUserId)
      message.success('รีเซ็ต Custom สำเร็จ')
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'รีเซ็ตไม่สำเร็จ')
    }
  }

  const handleSubmitBatch = async () => {
    if (!selectedUserId) return
    setSubmitting(true)
    try {
      const permissions = Object.entries(draftCustom).map(([menuIdStr, perm]) => ({
        menu_id: Number(menuIdStr),
        can_read: perm.can_read,
        can_write: perm.can_write,
        can_update: perm.can_update,
        can_delete: perm.can_delete,
      }))
      const payload: UserPermBatchPayload = { user_id: selectedUserId, permissions }
      await permissionMatrixService.batchUpdateUser(token, payload)
      await fetchEffective(selectedUserId)
      setConfirmOpen(false)
      message.success(`บันทึกสำเร็จ — อัปเดต ${permissions.length} รายการ`)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedUser = users.find((u) => u.id === selectedUserId)

  return (
    <>
      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <Button icon={<ReloadOutlined />} onClick={fetchInit} loading={loading}>
          โหลดใหม่
        </Button>
        <Select
          showSearch
          value={selectedUserId ?? undefined}
          onChange={handleSelectUser}
          placeholder="เลือกผู้ใช้"
          style={{ width: 240 }}
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={users.map((u) => ({
            value: u.id,
            label: `${u.full_name} (${u.username}) — ${u.department}`,
          }))}
        />
        <div style={{ flex: 1 }} />
        <Popconfirm
          title="รีเซ็ต Custom permissions ทั้งหมดของผู้ใช้นี้?"
          onConfirm={handleReset}
          okText="ยืนยัน"
          cancelText="ยกเลิก"
          okButtonProps={{ danger: true }}
        >
          <Button danger ghost disabled={!selectedUserId}>
            รีเซ็ต custom
          </Button>
        </Popconfirm>
        <Button icon={<UndoOutlined />} onClick={handleCancelDraft} disabled={!hasDiff}>
          ยกเลิก
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          disabled={!hasDiff}
          onClick={() => setConfirmOpen(true)}
        >
          บันทึก{hasDiff ? ` (${diffMenuIds.length})` : ''}
        </Button>
      </div>

      {/* Matrix (shown only when user selected) */}
      {selectedUserId && (
        <>
          {loading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : effectivePerms.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>ไม่มีข้อมูลสิทธิ์</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', border: '1px solid #e8e8e8', borderRadius: 8 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th
                        rowSpan={2}
                        style={{ ...thStyle, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, minWidth: 200 }}
                      >
                        เมนู
                      </th>
                      <th colSpan={4} style={{ ...thStyle, textAlign: 'center', minWidth: 120 }}>แผนก</th>
                      <th colSpan={4} style={{ ...thStyle, textAlign: 'center', minWidth: 120 }}>ตำแหน่ง</th>
                      <th colSpan={4} style={{ ...thStyle, textAlign: 'center', minWidth: 120 }}>Custom</th>
                    </tr>
                    <tr>
                      {[0, 1, 2].map((groupIdx) => (
                        <th
                          key={groupIdx}
                          colSpan={4}
                          style={{ ...thStyle, textAlign: 'center', fontSize: 11, fontWeight: 500, padding: 0 }}
                        >
                          {/* Mirrors PermissionCell's checkbox row layout exactly so the R/W/U/D
                              labels line up with the checkboxes rendered below them. */}
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, padding: '4px 2px' }}>
                            {(['R', 'W', 'U', 'D'] as const).map((letter) => (
                              <span key={letter} style={{ width: 24, textAlign: 'center' }}>{letter}</span>
                            ))}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {moduleGroups.map((group) => (
                      <React.Fragment key={group.moduleId}>
                        <tr>
                          <td
                            colSpan={13}
                            style={{
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 500,
                              color: 'var(--text-accent)',
                              background: 'var(--bg-accent)',
                              border: '1px solid #e8e8e8',
                              position: 'sticky',
                              left: 0,
                            }}
                          >
                            {group.moduleLabel}
                          </td>
                        </tr>
                        {group.rows.map((row, mi) => (
                          <tr key={row.menu_id}>
                            <td
                              style={{
                                ...tdBaseStyle,
                                textAlign: 'left',
                                background: '#ffffff',
                                position: 'sticky',
                                left: 0,
                                zIndex: 1,
                                paddingLeft: 24,
                              }}
                            >
                              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{row.menu_name}</span>
                            </td>
                            {/* แผนก (readonly) */}
                            <td
                              colSpan={4}
                              style={{
                                ...tdBaseStyle,
                                background: mi % 2 === 0 ? '#ffffff' : '#fafafa',
                                padding: '2px 6px',
                              }}
                            >
                              <PermissionCell
                                perm={{
                                  can_read: row.dept_can_read,
                                  can_write: row.dept_can_write,
                                  can_update: row.dept_can_update,
                                  can_delete: row.dept_can_delete,
                                }}
                                readonly
                              />
                            </td>
                            {/* ตำแหน่ง (readonly) */}
                            <td
                              colSpan={4}
                              style={{
                                ...tdBaseStyle,
                                background: mi % 2 === 0 ? '#ffffff' : '#fafafa',
                                padding: '2px 6px',
                              }}
                            >
                              <PermissionCell
                                perm={{
                                  can_read: isDeptInheritedForRole(row, 'read') ? true : row.role_can_read,
                                  can_write: isDeptInheritedForRole(row, 'write') ? true : row.role_can_write,
                                  can_update: isDeptInheritedForRole(row, 'update') ? true : row.role_can_update,
                                  can_delete: isDeptInheritedForRole(row, 'delete') ? true : row.role_can_delete,
                                }}
                                lockedFields={getRoleLockedFields(row)}
                                readonly
                              />
                            </td>
                            {/* Custom (editable) */}
                            <td
                              colSpan={4}
                              style={{
                                ...tdBaseStyle,
                                background: hasDiff
                                  ? 'var(--bg-warning)'
                                  : mi % 2 === 0
                                  ? '#ffffff'
                                  : '#fafafa',
                                padding: '2px 6px',
                              }}
                            >
                              <PermissionCell
                                perm={{
                                  can_read: getCustomPerm(row).can_read,
                                  can_write: getCustomPerm(row).can_write,
                                  can_update: getCustomPerm(row).can_update,
                                  can_delete: getCustomPerm(row).can_delete,
                                }}
                                lockedFields={getLockedFields(row)}
                                highlight={isHighlighted(row.menu_id, row)}
                                enforceReadDependency={false}
                                onToggle={(field, value) => {
                                  if (isInherited(row, field)) return
                                  handleToggle(row.menu_id, row, field, value)
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <MatrixLegend />
            </>
          )}

          <Modal
            title="ยืนยันการบันทึก"
            open={confirmOpen}
            onCancel={() => !submitting && setConfirmOpen(false)}
            onOk={handleSubmitBatch}
            okText="ยืนยัน"
            cancelText="ยกเลิก"
            okButtonProps={{ loading: submitting, style: { background: '#1d4ed8', border: 'none' } }}
            closable={!submitting}
            width={480}
          >
            <div style={{ marginBottom: 12, fontSize: 13, color: '#555' }}>
              {diffMenuIds.length} เมนูจะมีการกำหนด Custom override
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {diffMenuIds.map((menuId) => {
                const row = effectivePerms.find((ep) => ep.menu_id === menuId)
                return (
                  <div
                    key={menuId}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1e3a8a', marginBottom: 4, fontSize: 13 }}
                  >
                    <span style={{ fontWeight: 600 }}>{selectedUser?.full_name}</span>
                    <span style={{ color: '#9ca3af' }}>→</span>
                    <span>{row?.menu_name ?? String(menuId)}</span>
                  </div>
                )
              })}
            </div>
          </Modal>
        </>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// PermissionMatrix — 3-tab shell
// ─────────────────────────────────────────────────────────────

const PermissionMatrix: React.FC = () => {
  const token =
    useAppSelector((s) => s.auth.tokens?.accessToken) ??
    sessionStorage.getItem('accessToken') ??
    ''

  return (
    <div style={{ background: '#fafafa', minHeight: '100%', padding: '0 0 2rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 500 }}>Permission matrix</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          จัดการสิทธิ์เข้าถึงเมนูระดับแผนก ตำแหน่ง และรายบุคคล
        </p>
      </div>
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e8e8e8',
          borderRadius: 12,
          padding: '1.25rem',
        }}
      >
        <Tabs
          defaultActiveKey="role"
          tabBarStyle={{ borderBottom: '0.5px solid var(--border)', marginBottom: '1rem' }}
          items={[
            { key: 'dept', label: 'แผนก (Department)', children: <DeptTab token={token} /> },
            { key: 'role', label: 'ตำแหน่ง (Role)',    children: <RoleTab token={token} /> },
            { key: 'user', label: 'รายบุคคล (User)',   children: <UserTab token={token} /> },
          ]}
        />
      </div>
    </div>
  )
}

export default PermissionMatrix
