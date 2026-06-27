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
  onToggle: (roleId: number, menuId: number, field: PermField, value: boolean) => void
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

const PermissionGrid: React.FC<PermissionGridProps> = ({
  moduleGroups,
  roles,
  loading,
  getPerm,
  isChanged,
  onToggle,
}) => {
  const activeRoles = roles.filter((r) => r.is_active).sort((a, b) => a.level - b.level)

  if (loading) {
    return (
      <div style={{ padding: 8 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  if (moduleGroups.length === 0 || activeRoles.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 13 }}>
        {activeRoles.length === 0 ? 'ไม่มี Role ที่เปิดใช้งาน' : 'ไม่มีเมนูสำหรับกำหนดสิทธิ์'}
      </div>
    )
  }

  return (
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
            {activeRoles.map((role) => (
              <th key={role.id} colSpan={4} style={{ ...thStyle, textAlign: 'center', minWidth: 120 }}>
                <div style={{ fontSize: 13 }}>{role.role_code}</div>
                <div style={{ fontSize: 10, color: '#6b82b5', fontWeight: 400, marginTop: 2 }}>
                  {role.role_name}
                </div>
              </th>
            ))}
          </tr>
          <tr>
            {activeRoles.map((role) => (
              <React.Fragment key={role.id}>
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
                  colSpan={1 + activeRoles.length * 4}
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
                  {activeRoles.map((role) => (
                    <td
                      key={role.id}
                      colSpan={4}
                      style={{ ...tdBaseStyle, background: mi % 2 === 0 ? '#fff' : '#fafafa', padding: '2px 6px' }}
                    >
                      <PermissionCell
                        perm={getPerm(role.id, menu.id)}
                        changed={isChanged(role.id, menu.id)}
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
  )
}

export default PermissionGrid
