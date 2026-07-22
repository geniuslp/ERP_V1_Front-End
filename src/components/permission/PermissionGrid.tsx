import React from 'react'
import { Skeleton } from 'antd'
import type { PermField, PermMenu, PermRole, RoleMenuPermission } from '@/types/permission.types'
import PermissionCell from './PermissionCell'

export interface PermissionModuleGroup {
  moduleId: number
  moduleLabel: string
  menus: PermMenu[]
}

interface PermissionGridProps {
  moduleGroups: PermissionModuleGroup[]
  roles: PermRole[]
  loading: boolean
  getPerm: (roleId: number, menuId: number) => RoleMenuPermission
  isChanged: (roleId: number, menuId: number) => boolean
  hasRoleChanges: (roleId: number) => boolean
  onToggle: (roleId: number, menuId: number, field: PermField, value: boolean) => void
  getOverriddenOffFields?: (roleId: number, menuId: number) => Partial<Record<PermField, boolean>>
  globalRoleIds?: Set<number>
}

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

const legend = (
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

const PermissionGrid: React.FC<PermissionGridProps> = ({
  moduleGroups,
  roles,
  loading,
  getPerm,
  isChanged,
  hasRoleChanges,
  onToggle,
  getOverriddenOffFields,
  globalRoleIds,
}) => {
  // Show all roles (active and inactive) so admins can pre-configure permissions
  // for roles awaiting rollout — is_active only gates real permission resolution,
  // not visibility here.
  const activeRoles = roles

  const isFirstGlobalCol = (roleIdx: number): boolean => {
    if (!globalRoleIds || globalRoleIds.size === 0 || roleIdx === 0) return false
    const role = activeRoles[roleIdx]
    const prevRole = activeRoles[roleIdx - 1]
    return globalRoleIds.has(role.id) && !globalRoleIds.has(prevRole.id)
  }

  if (loading) {
    return (
      <div style={{ padding: 8 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  if (moduleGroups.length === 0 || activeRoles.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        {activeRoles.length === 0 ? 'ไม่มี Role ในระบบ' : 'ไม่มีเมนูสำหรับกำหนดสิทธิ์'}
      </div>
    )
  }

  return (
    <>
      <div style={{ overflowX: 'auto', border: '1px solid #e8e8e8', borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
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
              {activeRoles.map((role, idx) => (
                <th
                  key={role.id}
                  colSpan={4}
                  style={{
                    ...thStyle,
                    textAlign: 'center',
                    minWidth: 120,
                    background: !role.is_active
                      ? '#f5f5f5'
                      : globalRoleIds?.has(role.id) ? '#f0f5ff' : thStyle.background,
                    color: !role.is_active ? 'var(--text-muted)' : thStyle.color,
                    borderLeft: isFirstGlobalCol(idx) ? '3px solid #91a7c7' : thStyle.border,
                  }}
                >
                  <div style={{ fontSize: 13 }}>{role.role_code}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
                    {role.role_name}
                  </div>
                  {!role.is_active && (
                    <div
                      style={{
                        display: 'inline-block',
                        marginTop: 3,
                        fontSize: 9,
                        fontWeight: 500,
                        color: 'var(--text-muted)',
                        background: '#e8e8e8',
                        borderRadius: 4,
                        padding: '1px 6px',
                      }}
                    >
                      ไม่ใช้งาน
                    </div>
                  )}
                </th>
              ))}
            </tr>
            <tr>
              {activeRoles.map((role, idx) => (
                <th
                  key={role.id}
                  colSpan={4}
                  style={{
                    ...thStyle,
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 500,
                    padding: 0,
                    background: !role.is_active
                      ? '#f5f5f5'
                      : globalRoleIds?.has(role.id) ? '#f0f5ff' : thStyle.background,
                    borderLeft: isFirstGlobalCol(idx) ? '3px solid #91a7c7' : thStyle.border,
                  }}
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
                    colSpan={1 + activeRoles.length * 4}
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
                    {activeRoles.map((role, idx) => (
                      <td
                        key={role.id}
                        colSpan={4}
                        style={{
                          ...tdBaseStyle,
                          background: hasRoleChanges(role.id)
                            ? 'var(--bg-warning)'
                            : !role.is_active
                            ? '#fbfbfb'
                            : mi % 2 === 0
                            ? '#ffffff'
                            : '#fafafa',
                          padding: '2px 6px',
                          borderLeft: isFirstGlobalCol(idx) ? '3px solid #91a7c7' : tdBaseStyle.border,
                        }}
                      >
                        <PermissionCell
                          perm={getPerm(role.id, menu.id)}
                          changed={isChanged(role.id, menu.id)}
                          overriddenOffFields={getOverriddenOffFields?.(role.id, menu.id)}
                          onToggle={(field, value) => onToggle(role.id, menu.id, field, value)}
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
      {legend}
    </>
  )
}

export default React.memo(PermissionGrid)
