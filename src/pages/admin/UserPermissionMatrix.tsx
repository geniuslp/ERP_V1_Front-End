import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Button, Space, Modal, message, Badge, Select, Skeleton } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useAppSelector } from '@/store'
import PageHeader from '@/components/common/PageHeader'
import PermissionCell from '@/components/permission/PermissionCell'
import { permissionMatrixService } from '@/services/permissionMatrix.service'
import type { PermField, PermMenu, EffectivePermission, UserPermBatchPayload, RoleMenuPermission } from '@/types/permission.types'

type AnyPerm = { can_read: boolean | null; can_write: boolean | null; can_update: boolean | null; can_delete: boolean | null }

const FIELD_KEY: Record<PermField, keyof RoleMenuPermission> = {
  read: 'can_read',
  write: 'can_write',
  update: 'can_update',
  delete: 'can_delete',
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  background: '#f0f5ff',
  border: '1px solid #e8eaf0',
  fontWeight: 600,
  color: '#0f2d5e',
  whiteSpace: 'nowrap',
}

const tdBaseStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid #e8eaf0',
}

interface ModuleGroup {
  moduleId: number
  moduleLabel: string
  menus: PermMenu[]
}

const UserPermissionMatrix: React.FC = () => {
  const accessToken =
    useAppSelector((s) => s.auth.tokens?.accessToken) ??
    sessionStorage.getItem('accessToken') ??
    ''

  const [users, setUsers] = useState<{ id: number; username: string; full_name: string; department: string }[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [effectivePerms, setEffectivePerms] = useState<EffectivePermission[]>([])
  const [draftCustom, setDraftCustom] = useState<Record<number, Partial<AnyPerm>>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const moduleGroups: ModuleGroup[] = useMemo(() => {
    const parents = new Map<number | null, string>()
    effectivePerms.forEach((ep) => {
      if (ep.parent_id === null) parents.set(ep.menu_id, ep.menu_name)
    })
    const leafRows = effectivePerms.filter((ep) => ep.parent_id !== null)
    const grouped = new Map<number, EffectivePermission[]>()
    leafRows.forEach((ep) => {
      const pid = ep.parent_id!
      if (!grouped.has(pid)) grouped.set(pid, [])
      grouped.get(pid)!.push(ep)
    })
    return Array.from(grouped.entries()).map(([pid, rows]) => ({
      moduleId: pid,
      moduleLabel: parents.get(pid) ?? String(pid),
      menus: rows.map((r) => ({
        id: r.menu_id,
        menu_code: r.menu_code,
        menu_name: r.menu_name,
        parent_id: r.parent_id,
        order: 0,
        is_active: true,
      })),
    }))
  }, [effectivePerms])

  const deptPerm = (row: EffectivePermission): AnyPerm => ({
    can_read: row.dept_can_read,
    can_write: row.dept_can_write,
    can_update: row.dept_can_update,
    can_delete: row.dept_can_delete,
  })

  const rolePerm = (row: EffectivePermission): AnyPerm => ({
    can_read: row.role_can_read,
    can_write: row.role_can_write,
    can_update: row.role_can_update,
    can_delete: row.role_can_delete,
  })

  const customPerm = (row: EffectivePermission): AnyPerm => {
    const draft = draftCustom[row.menu_id]
    if (draft) return draft as AnyPerm
    return {
      can_read: row.user_can_read,
      can_write: row.user_can_write,
      can_update: row.user_can_update,
      can_delete: row.user_can_delete,
    }
  }

  const isHighlighted = (row: EffectivePermission): boolean => {
    const custom = draftCustom[row.menu_id]
    if (!custom) return false
    const role = rolePerm(row)
    return (
      (custom.can_read ?? null) !== role.can_read ||
      (custom.can_write ?? null) !== role.can_write ||
      (custom.can_update ?? null) !== role.can_update ||
      (custom.can_delete ?? null) !== role.can_delete
    )
  }

  const diffMenuIds = useMemo(() => {
    const ids: number[] = []
    for (const row of effectivePerms) {
      if (row.parent_id === null) continue
      const draft = draftCustom[row.menu_id]
      if (!draft) continue
      const orig: AnyPerm = {
        can_read: row.user_can_read,
        can_write: row.user_can_write,
        can_update: row.user_can_update,
        can_delete: row.user_can_delete,
      }
      if (
        draft.can_read !== orig.can_read ||
        draft.can_write !== orig.can_write ||
        draft.can_update !== orig.can_update ||
        draft.can_delete !== orig.can_delete
      ) {
        ids.push(row.menu_id)
      }
    }
    return ids
  }, [draftCustom, effectivePerms])

  const hasDiff = diffMenuIds.length > 0

  const fetchUsers = useCallback(async () => {
    try {
      const ul = await permissionMatrixService.getUsers(accessToken)
      setUsers(ul)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดผู้ใช้ไม่สำเร็จ')
    }
  }, [accessToken])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const fetchEffective = useCallback(async (userId: number) => {
    setLoading(true)
    setDraftCustom({})
    try {
      const perms = await permissionMatrixService.getEffectivePermissions(accessToken, userId)
      setEffectivePerms(perms)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลสิทธิ์ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  const handleSelectUser = (userId: number) => {
    setSelectedUserId(userId)
    fetchEffective(userId)
  }

  const handleToggle = (menuId: number, row: EffectivePermission, field: PermField, value: boolean) => {
    setDraftCustom((prev) => {
      const current: AnyPerm = prev[menuId] as AnyPerm ?? customPerm(row)
      const autoEnablesRead = field !== 'read' && value && !current.can_read
      let next: AnyPerm

      if (field === 'read' && !value) {
        next = { can_read: false, can_write: false, can_update: false, can_delete: false }
      } else if (autoEnablesRead) {
        next = { ...current, can_read: true, [FIELD_KEY[field]]: true }
      } else {
        next = { ...current, [FIELD_KEY[field]]: value }
      }

      if (autoEnablesRead) message.info('เปิดใช้งาน Read อัตโนมัติ')
      return { ...prev, [menuId]: next }
    })
  }

  const handleReset = async () => {
    if (!selectedUserId) return
    try {
      await permissionMatrixService.resetUserPermissions(accessToken, selectedUserId)
      setDraftCustom({})
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
      const permissions = diffMenuIds.map((menuId) => {
        const draft = draftCustom[menuId] as AnyPerm
        return {
          menu_id: menuId,
          can_read: draft.can_read ?? false,
          can_write: draft.can_write ?? false,
          can_update: draft.can_update ?? false,
          can_delete: draft.can_delete ?? false,
        }
      })
      const payload: UserPermBatchPayload = { user_id: selectedUserId, permissions }
      await permissionMatrixService.batchUpdateUser(accessToken, payload)
      setDraftCustom({})
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
    <div>
      <PageHeader
        title="User Permission Matrix"
        subtitle="กำหนดสิทธิ์ Custom ระดับผู้ใช้ — แสดงสิทธิ์จากแผนก / ตำแหน่ง / Custom เทียบกันได้"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Admin' }, { title: 'User Permission Matrix' }]}
      />

      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
          padding: 24,
          marginBottom: 16,
        }}
      >
        <div style={{ marginBottom: 8, fontWeight: 600, color: '#0f2d5e', fontSize: 14 }}>เลือกผู้ใช้</div>
        <Select
          showSearch
          value={selectedUserId ?? undefined}
          onChange={handleSelectUser}
          placeholder="ค้นหาผู้ใช้..."
          style={{ width: 320 }}
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={users.map((u) => ({
            value: u.id,
            label: `${u.full_name} (${u.username}) — ${u.department}`,
          }))}
        />
      </div>

      {selectedUserId && (
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
            padding: 24,
          }}
        >
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, color: '#0f2d5e', fontSize: 15 }}>
              {selectedUser?.full_name} — สิทธิ์การเข้าถึงเมนู
            </span>
            <Space>
              {hasDiff && (
                <Button danger onClick={handleReset}>
                  รีเซ็ต Custom
                </Button>
              )}
              <Badge count={hasDiff ? diffMenuIds.length : 0} size="small" offset={[-4, 4]}>
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
          </div>

          {loading ? (
            <div style={{ padding: 8 }}>
              <Skeleton active paragraph={{ rows: 8 }} />
            </div>
          ) : effectivePerms.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 13 }}>
              ไม่มีข้อมูลสิทธิ์
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 600, width: '100%' }}>
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
                    {(['R', 'W', 'U', 'D'] as const).map((l) => (
                      <th key={`dept-${l}`} style={{ ...thStyle, textAlign: 'center', fontSize: 11, fontWeight: 500, padding: '4px 6px' }}>{l}</th>
                    ))}
                    {(['R', 'W', 'U', 'D'] as const).map((l) => (
                      <th key={`role-${l}`} style={{ ...thStyle, textAlign: 'center', fontSize: 11, fontWeight: 500, padding: '4px 6px' }}>{l}</th>
                    ))}
                    {(['R', 'W', 'U', 'D'] as const).map((l) => (
                      <th key={`custom-${l}`} style={{ ...thStyle, textAlign: 'center', fontSize: 11, fontWeight: 500, padding: '4px 6px' }}>{l}</th>
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
                            ...tdBaseStyle,
                            background: '#eef2ff',
                            fontWeight: 700,
                            color: '#1e3a8a',
                            fontSize: 12,
                            letterSpacing: 0.4,
                            position: 'sticky',
                            left: 0,
                          }}
                        >
                          {group.moduleLabel}
                        </td>
                      </tr>
                      {group.menus.map((menu, mi) => {
                        const row = effectivePerms.find((ep) => ep.menu_id === menu.id)
                        if (!row) return null
                        return (
                          <tr key={menu.id}>
                            <td
                              style={{
                                ...tdBaseStyle,
                                textAlign: 'left',
                                background: mi % 2 === 0 ? '#fff' : '#fafafa',
                                position: 'sticky',
                                left: 0,
                                zIndex: 1,
                                paddingLeft: 24,
                              }}
                            >
                              <span style={{ fontSize: 13, color: '#333' }}>{menu.menu_name}</span>
                            </td>
                            <td colSpan={4} style={{ ...tdBaseStyle, background: mi % 2 === 0 ? '#fff' : '#fafafa', padding: '2px 6px' }}>
                              <PermissionCell perm={deptPerm(row)} readonly />
                            </td>
                            <td colSpan={4} style={{ ...tdBaseStyle, background: mi % 2 === 0 ? '#fff' : '#fafafa', padding: '2px 6px' }}>
                              <PermissionCell perm={rolePerm(row)} readonly />
                            </td>
                            <td colSpan={4} style={{ ...tdBaseStyle, background: mi % 2 === 0 ? '#fff' : '#fafafa', padding: '2px 6px' }}>
                              <PermissionCell
                                perm={customPerm(row)}
                                highlight={isHighlighted(row)}
                                onToggle={(field, value) => handleToggle(menu.id, row, field, value)}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
    </div>
  )
}

export default UserPermissionMatrix
