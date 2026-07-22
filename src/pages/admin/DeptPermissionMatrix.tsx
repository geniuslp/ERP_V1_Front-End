import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Button, Space, Modal, message, Badge, Skeleton } from 'antd'
import { ReloadOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons'
import { useAppSelector } from '@/store'
import PageHeader from '@/components/common/PageHeader'
import PermissionCell from '@/components/permission/PermissionCell'
import { permissionMatrixService } from '@/services/permissionMatrix.service'
import type { PermField, PermMenu, DeptMenuPermission, DeptBatchPayload, Department } from '@/types/permission.types'

const makeKey = (dept_code: string, menuId: number) => `${dept_code}|${menuId}`

const emptyPerm = (dept_code: string, menuId: number): DeptMenuPermission => ({
  dept_code,
  menu_id: menuId,
  can_read: false,
  can_write: false,
  can_update: false,
  can_delete: false,
})

const FIELD_KEY: Record<PermField, keyof DeptMenuPermission> = {
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

const DeptPermissionMatrix: React.FC = () => {
  const accessToken =
    useAppSelector((s) => s.auth.tokens?.accessToken) ??
    sessionStorage.getItem('accessToken') ??
    ''

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [menus, setMenus] = useState<PermMenu[]>([])
  const [serverPerms, setServerPerms] = useState<DeptMenuPermission[]>([])
  const [draftPerms, setDraftPerms] = useState<DeptMenuPermission[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const moduleGroups: ModuleGroup[] = useMemo(() => {
    const topLevel = menus.filter((m) => m.parent_id === null).sort((a, b) => a.order - b.order)
    return topLevel.map((top) => ({
      moduleId: top.id,
      moduleLabel: top.menu_name,
      menus: menus.filter((m) => m.parent_id === top.id).sort((a, b) => a.order - b.order),
    }))
  }, [menus])

  const getPerm = (dept_code: string, menuId: number): DeptMenuPermission =>
    draftPerms.find((p) => p.dept_code === dept_code && p.menu_id === menuId) ??
    emptyPerm(dept_code, menuId)

  const serverPerm = (dept_code: string, menuId: number): DeptMenuPermission | undefined =>
    serverPerms.find((p) => p.dept_code === dept_code && p.menu_id === menuId)

  const isChanged = (dept_code: string, menuId: number): boolean => {
    const d = getPerm(dept_code, menuId)
    const s = serverPerm(dept_code, menuId) ?? emptyPerm(dept_code, menuId)
    return (
      d.can_read !== s.can_read ||
      d.can_write !== s.can_write ||
      d.can_update !== s.can_update ||
      d.can_delete !== s.can_delete
    )
  }

  const diffItems = useMemo(() => {
    const results: { dept: string; menuId: number }[] = []
    for (const d of departments) {
      for (const menu of menus.filter((m) => m.parent_id !== null)) {
        if (isChanged(d.dept_code, menu.id)) results.push({ dept: d.dept_code, menuId: menu.id })
      }
    }
    return results
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPerms, serverPerms, departments, menus])

  const hasDiff = diffItems.length > 0

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [depts, mn, perms] = await Promise.all([
        permissionMatrixService.getDepartments(accessToken),
        permissionMatrixService.getMenus(accessToken),
        permissionMatrixService.getDeptPermissions(accessToken),
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
  }, [accessToken])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleToggle = (dept_code: string, menuId: number, field: PermField, value: boolean) => {
    setDraftPerms((prev) => {
      const idx = prev.findIndex((p) => p.dept_code === dept_code && p.menu_id === menuId)
      const current = idx !== -1 ? prev[idx] : emptyPerm(dept_code, menuId)
      const autoEnablesRead = field !== 'read' && value && !current.can_read
      let next: DeptMenuPermission

      if (field === 'read' && !value) {
        next = { ...current, can_read: false, can_write: false, can_update: false, can_delete: false }
      } else if (autoEnablesRead) {
        next = { ...current, can_read: true, [FIELD_KEY[field]]: true }
      } else {
        next = { ...current, [FIELD_KEY[field]]: value }
      }

      if (autoEnablesRead) message.info('เปิดใช้งาน Read อัตโนมัติ')

      if (idx !== -1) {
        const updated = [...prev]
        updated[idx] = next
        return updated
      }
      return [...prev, next]
    })
  }

  const handleCancelDraft = () => {
    setDraftPerms(serverPerms.map((p) => ({ ...p })))
  }

  const handleSubmitBatch = async () => {
    setSubmitting(true)
    try {
      const payload: DeptBatchPayload = {
        permissions: diffItems.map(({ dept, menuId }) => getPerm(dept, menuId)),
      }
      await permissionMatrixService.batchUpdateDept(accessToken, payload)
      const fresh = await permissionMatrixService.getDeptPermissions(accessToken)
      setServerPerms(fresh)
      setDraftPerms(fresh.map((p) => ({ ...p })))
      setConfirmOpen(false)
      message.success(`บันทึกสำเร็จ — อัปเดต ${payload.permissions.length} รายการ`)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Department Permission Matrix"
        subtitle="ตั้งค่าสิทธิ์ default ระดับแผนก"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Admin' }, { title: 'Department Permission Matrix' }]}
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
            <Badge count={hasDiff ? diffItems.length : 0} size="small" offset={[-4, 4]}>
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
          ภาพรวม Department Permission Matrix
        </div>

        {loading ? (
          <div style={{ padding: 8 }}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </div>
        ) : moduleGroups.length === 0 || departments.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 13 }}>
            {departments.length === 0 ? 'ไม่มีแผนกในระบบ' : 'ไม่มีเมนูสำหรับกำหนดสิทธิ์'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 600, width: '100%' }}>
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    style={{
                      ...thStyle,
                      textAlign: 'left',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      minWidth: 200,
                    }}
                  >
                    เมนู
                  </th>
                  {departments.map((d) => (
                    <th key={d.dept_code} colSpan={4} style={{ ...thStyle, textAlign: 'center', minWidth: 120 }}>
                      <div style={{ fontSize: 13 }}>{d.dept_name}</div>
                    </th>
                  ))}
                </tr>
                <tr>
                  {departments.map((d) => (
                    <React.Fragment key={d.dept_code}>
                      {(['R', 'W', 'U', 'D'] as const).map((letter) => (
                        <th
                          key={letter}
                          style={{
                            ...thStyle,
                            textAlign: 'center',
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '4px 6px',
                          }}
                        >
                          {letter}
                        </th>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moduleGroups.map((group) => (
                  <React.Fragment key={group.moduleId}>
                    <tr>
                      <td
                        colSpan={1 + departments.length * 4}
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
                    {group.menus.map((menu, mi) => (
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
                        {departments.map((d) => (
                          <td
                            key={d.dept_code}
                            colSpan={4}
                            style={{ ...tdBaseStyle, background: mi % 2 === 0 ? '#fff' : '#fafafa', padding: '2px 6px' }}
                          >
                            <PermissionCell
                              perm={getPerm(d.dept_code, menu.id)}
                              changed={isChanged(d.dept_code, menu.id)}
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
        )}
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
          {diffItems.length} รายการสิทธิ์จะถูกอัปเดต
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {diffItems.map(({ dept, menuId }) => {
            const menu = menus.find((m) => m.id === menuId)
            return (
              <div
                key={makeKey(dept, menuId)}
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
    </div>
  )
}

export default DeptPermissionMatrix
