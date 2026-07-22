import React from 'react'
import { Checkbox, Tooltip } from 'antd'
import type { PermField } from '@/types/permission.types'

type AnyPerm = {
  can_read: boolean | null
  can_write: boolean | null
  can_update: boolean | null
  can_delete: boolean | null
}

interface PermissionCellProps {
  perm: AnyPerm
  changed?: boolean   // kept for backward compat — no longer drives background
  readonly?: boolean
  highlight?: boolean
  lockedFields?: Partial<Record<PermField, boolean>>
  overriddenOffFields?: Partial<Record<PermField, boolean>>
  onToggle?: (field: PermField, value: boolean) => void
  // Dept/Role columns keep the "W/U/D require R" rule; the Custom/User tab
  // sets this to false so admins can grant an override independently of
  // read, relying on handleToggle's auto-enable-read cascade instead.
  enforceReadDependency?: boolean
}

const FIELD_META: { field: PermField; key: keyof AnyPerm; tooltip: string }[] = [
  { field: 'read',   key: 'can_read',   tooltip: 'Read (อ่าน)' },
  { field: 'write',  key: 'can_write',  tooltip: 'Write (สร้าง)' },
  { field: 'update', key: 'can_update', tooltip: 'Update (แก้ไข)' },
  { field: 'delete', key: 'can_delete', tooltip: 'Delete (ลบ)' },
]

const PermissionCell: React.FC<PermissionCellProps> = ({ perm, readonly, highlight, lockedFields, overriddenOffFields, onToggle, enforceReadDependency = true }) => {
  const inner = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 5,
        padding: '4px 2px',
        borderRadius: 6,
        border: highlight ? '1.5px solid #f59e0b' : undefined,
        transition: 'background 0.15s',
      }}
    >
      {FIELD_META.map(({ field, key, tooltip }) => {
        const raw = perm[key]
        const checked = Boolean(raw)
        const isNull = raw === null
        const locked = Boolean(lockedFields?.[field])
        const dimmed = isNull || (enforceReadDependency && field !== 'read' && !perm.can_read)

        if (locked) {
          return (
            <Tooltip
              key={field}
              title={
                checked
                  ? 'มี Custom override เป็น true ที่ระดับผู้ใช้ และได้รับสิทธิ์นี้จากแผนก/ตำแหน่งอยู่แล้วด้วย'
                  : 'ยังไม่มี Custom override ที่ระดับผู้ใช้ — ได้รับสิทธิ์นี้จากแผนก/ตำแหน่งอยู่แล้ว (ค่าจริงในระดับผู้ใช้ยังเป็น false)'
              }
            >
              <Checkbox
                checked={checked}
                disabled
                style={{
                  opacity: checked ? 1 : 0.5,
                  cursor: 'not-allowed',
                }}
                className={`perm-checkbox-${field} perm-checkbox-locked`}
              />
            </Tooltip>
          )
        }

        const overriddenOff = Boolean(overriddenOffFields?.[field])

        return (
          <Tooltip key={field} title={overriddenOff ? 'ปิดใช้งานเพิ่มเติมจากค่าเริ่มต้นของแผนก' : tooltip}>
            <Checkbox
              checked={checked}
              disabled={!readonly && dimmed}
              onChange={(e) => onToggle?.(field, e.target.checked)}
              style={{
                opacity: dimmed ? 0.35 : 1,
                border: overriddenOff ? '1.5px solid #f59e0b' : undefined,
                borderRadius: overriddenOff ? 4 : undefined,
              }}
              className={`perm-checkbox-${field}`}
            />
          </Tooltip>
        )
      })}
    </div>
  )

  if (readonly) {
    return (
      <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
        {inner}
      </div>
    )
  }

  return inner
}

export default React.memo(PermissionCell)
