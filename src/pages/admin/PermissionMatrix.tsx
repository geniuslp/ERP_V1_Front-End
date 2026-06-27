import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Button, Space, Modal, message, Badge } from 'antd'
import { ReloadOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons'
import { useAppSelector } from '@/store'
import PageHeader from '@/components/common/PageHeader'
import PermissionGrid, { PermissionModuleGroup } from '@/components/permission/PermissionGrid'
import { permissionMatrixService } from '@/services/permissionMatrix.service'
import type { PermField, PermMenu, PermRole, RoleMenuPermission } from '@/types/permission.types'

const makeKey = (roleId: number, menuId: number) => `${roleId}|${menuId}`

const emptyPerm = (roleId: number, menuId: number): RoleMenuPermission => ({
  role_id: roleId,
  menu_id: menuId,
  can_read: false,
  can_write: false,
  can_update: false,
  can_delete: false,
})

const FIELD_KEY: Record<PermField, keyof RoleMenuPermission> = {
  read: 'can_read',
  write: 'can_write',
  update: 'can_update',
  delete: 'can_delete',
}

const buildMap = (perms: RoleMenuPermission[]): Record<string, RoleMenuPermission> => {
  const map: Record<string, RoleMenuPermission> = {}
  perms.forEach((p) => { map[makeKey(p.role_id, p.menu_id)] = p })
  return map
}

const samePerm = (a?: RoleMenuPermission, b?: RoleMenuPermission) =>
  (a?.can_read ?? false) === (b?.can_read ?? false) &&
  (a?.can_write ?? false) === (b?.can_write ?? false) &&
  (a?.can_update ?? false) === (b?.can_update ?? false) &&
  (a?.can_delete ?? false) === (b?.can_delete ?? false)

const PermissionMatrix: React.FC = () => {
  const accessToken =
    useAppSelector((s) => s.auth.tokens?.accessToken) ??
    sessionStorage.getItem('accessToken') ??
    ''

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [roles, setRoles] = useState<PermRole[]>([])
  const [menus, setMenus] = useState<PermMenu[]>([])
  const [serverMap, setServerMap] = useState<Record<string, RoleMenuPermission>>({})
  const [draftMap, setDraftMap] = useState<Record<string, RoleMenuPermission>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rl, mn, perms] = await Promise.all([
        permissionMatrixService.getRoles(accessToken),
        permissionMatrixService.getMenus(accessToken),
        permissionMatrixService.getPermissions(accessToken),
      ])
      setRoles(rl)
      setMenus(mn)
      const map = buildMap(perms)
      setServerMap(map)
      setDraftMap(map)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'โหลดข้อมูลไม่สำเร็จ',
      )
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Module groups: top-level menus as headers, children as rows ──
  const moduleGroups: PermissionModuleGroup[] = useMemo(() => {
    const topLevel = menus.filter((m) => m.parent_id === null).sort((a, b) => a.order - b.order)
    return topLevel.map((top) => ({
      moduleId: top.id,
      moduleLabel: top.menu_name,
      menus: menus.filter((m) => m.parent_id === top.id).sort((a, b) => a.order - b.order),
    }))
  }, [menus])

  // ── Diff between draft and server ─────────────────────────────
  const diffKeys = useMemo(() => {
    const allKeys = new Set([...Object.keys(serverMap), ...Object.keys(draftMap)])
    return Array.from(allKeys).filter((key) => !samePerm(draftMap[key], serverMap[key]))
  }, [draftMap, serverMap])

  const changedKeySet = useMemo(() => new Set(diffKeys), [diffKeys])
  const hasDiff = diffKeys.length > 0
  const diffCount = diffKeys.length

  const getPerm = (roleId: number, menuId: number): RoleMenuPermission =>
    draftMap[makeKey(roleId, menuId)] ?? emptyPerm(roleId, menuId)

  const isChanged = (roleId: number, menuId: number): boolean =>
    changedKeySet.has(makeKey(roleId, menuId))

  const handleToggle = (roleId: number, menuId: number, field: PermField, value: boolean) => {
    const key = makeKey(roleId, menuId)
    const current = draftMap[key] ?? emptyPerm(roleId, menuId)
    const autoEnablesRead = field !== 'read' && value && !current.can_read
    let next: RoleMenuPermission

    if (field === 'read' && !value) {
      next = { ...current, can_read: false, can_write: false, can_update: false, can_delete: false }
    } else if (autoEnablesRead) {
      next = { ...current, can_read: true, [FIELD_KEY[field]]: true }
    } else {
      next = { ...current, [FIELD_KEY[field]]: value }
    }

    setDraftMap((prev) => ({ ...prev, [key]: next }))
    if (autoEnablesRead) message.info('เปิดใช้งาน Read อัตโนมัติ')
  }

  const handleCancelDraft = () => {
    setDraftMap({ ...serverMap })
  }

  // ── Diff summary for confirm modal ────────────────────────────
  const diffSummary = useMemo(() => {
    return diffKeys.map((key) => {
      const [roleIdStr, menuIdStr] = key.split('|')
      const roleId = Number(roleIdStr)
      const menuId = Number(menuIdStr)
      const role = roles.find((r) => r.id === roleId)
      const menu = menus.find((m) => m.id === menuId)
      return {
        key,
        roleLabel: role?.role_code ?? String(roleId),
        menuLabel: menu?.menu_name ?? String(menuId),
      }
    })
  }, [diffKeys, roles, menus])

  // ── Batch submit ──────────────────────────────────────────────
  const handleSubmitBatch = async () => {
    setSubmitting(true)
    try {
      const payload = diffKeys.map((key) => {
        const [roleIdStr, menuIdStr] = key.split('|')
        const roleId = Number(roleIdStr)
        const menuId = Number(menuIdStr)
        const draft = draftMap[key] ?? emptyPerm(roleId, menuId)
        const server = serverMap[key]
        return { ...draft, id: server?.id ?? draft.id, role_id: roleId, menu_id: menuId }
      })

      await permissionMatrixService.batchUpdate(accessToken, { permissions: payload })

      const fresh = await permissionMatrixService.getPermissions(accessToken)
      const map = buildMap(fresh)
      setServerMap(map)
      setDraftMap(map)
      setConfirmOpen(false)
      message.success(`บันทึกสำเร็จ — อัปเดต ${payload.length} รายการ`)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'บันทึกไม่สำเร็จ กรุณาลองใหม่',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Permission Matrix"
        subtitle="กำหนดสิทธิ์ Read / Write / Update / Delete ต่อ Role ต่อเมนู — แก้ไขใน draft แล้วกด บันทึก เพื่อ submit ทั้งหมดพร้อมกัน"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Admin' }, { title: 'Permission Matrix' }]}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>
              โหลดใหม่
            </Button>
            {hasDiff && (
              <Button icon={<UndoOutlined />} onClick={handleCancelDraft}>
                ยกเลิก
              </Button>
            )}
            <Badge count={hasDiff ? diffCount : 0} size="small" offset={[-4, 4]}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                disabled={!hasDiff}
                onClick={() => setConfirmOpen(true)}
                style={hasDiff ? { background: '#1d4ed8', border: 'none' } : {}}
              >
                บันทึก
              </Button>
            </Badge>
          </Space>
        }
      />

      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
          padding: 24,
        }}
      >
        <div style={{ marginBottom: 16, fontWeight: 600, color: '#0f2d5e', fontSize: 15 }}>
          ภาพรวม Permission Matrix
        </div>

        <PermissionGrid
          moduleGroups={moduleGroups}
          roles={roles}
          loading={loading}
          getPerm={getPerm}
          isChanged={isChanged}
          onToggle={handleToggle}
        />
      </div>

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
    </div>
  )
}

export default PermissionMatrix
