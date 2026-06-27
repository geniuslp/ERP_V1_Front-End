import React from 'react'
import { Checkbox, Tooltip } from 'antd'
import type { PermField, RoleMenuPermission } from '@/types/permission.types'

interface PermissionCellProps {
  perm: RoleMenuPermission
  changed?: boolean
  onToggle: (field: PermField, value: boolean) => void
}

const FIELD_META: { field: PermField; key: keyof RoleMenuPermission; tooltip: string }[] = [
  { field: 'read',   key: 'can_read',   tooltip: 'Read (อ่าน)' },
  { field: 'write',  key: 'can_write',  tooltip: 'Write (สร้าง)' },
  { field: 'update', key: 'can_update', tooltip: 'Update (แก้ไข)' },
  { field: 'delete', key: 'can_delete', tooltip: 'Delete (ลบ)' },
]

const PermissionCell: React.FC<PermissionCellProps> = ({ perm, changed, onToggle }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 5,
        padding: '4px 2px',
        borderRadius: 6,
        background: changed ? '#fffbe6' : undefined,
        transition: 'background 0.15s',
      }}
    >
      {FIELD_META.map(({ field, key, tooltip }) => {
        const checked = Boolean(perm[key])
        const dimmed = field !== 'read' && !perm.can_read
        return (
          <Tooltip key={field} title={tooltip}>
            <Checkbox
              checked={checked}
              onChange={(e) => onToggle(field, e.target.checked)}
              style={{ opacity: dimmed ? 0.35 : 1, transform: 'scale(0.9)' }}
              className={`perm-checkbox-${field}`}
            />
          </Tooltip>
        )
      })}
    </div>
  )
}

export default PermissionCell
