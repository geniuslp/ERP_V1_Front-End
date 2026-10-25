import React, { useMemo } from 'react'
import { Select } from 'antd'
import type { SelectProps } from 'antd'
import { useDepartments } from '@/hooks/useDepartments'
import type { Department } from '@/services/departmentService'

interface Props {
  value?: string
  /** Second argument is the selected department (undefined when cleared or for a code not in the list). */
  onChange?: (code: string | undefined, dept?: Department) => void
  allowClear?: boolean
  disabled?: boolean
  placeholder?: string
  style?: React.CSSProperties
  /** Name to show for a saved code that is not in the loaded list (deactivated / old department). */
  fallbackName?: string | null
  /** List every department (admin screens); inactive ones are marked "ปิดใช้งาน". Default: active only. */
  includeInactive?: boolean
  size?: SelectProps['size']
}

const INACTIVE_HINT = 'ปิดใช้งาน'
const deptLabel = (code: string, name?: string | null, inactive = false) =>
  `${name ? `${code} — ${name}` : code}${inactive ? ` (${INACTIVE_HINT})` : ''}`

// Department dropdown: label "{dept_code} — {dept_name}", value dept_code, searchable by code or name.
const DepartmentSelect: React.FC<Props> = ({
  value, onChange, allowClear, disabled, placeholder = 'เลือกแผนก', style, fallbackName, includeInactive = false, size,
}) => {
  const { departments, loading, usingFallback } = useDepartments(includeInactive)

  const options = useMemo(() => {
    const opts = departments.map((d) => ({
      value: d.dept_code,
      label: deptLabel(d.dept_code, d.dept_name, !d.is_active),
      search: `${d.dept_code} ${d.dept_name}`,
    }))
    // Keep a saved code that is not in the loaded list visible (never cleared silently).
    if (value && !departments.some((d) => d.dept_code === value)) {
      const known = !loading && !usingFallback
      opts.unshift({ value, label: deptLabel(value, fallbackName, known), search: `${value} ${fallbackName ?? ''}` })
    }
    return opts
  }, [departments, value, fallbackName, loading, usingFallback])

  return (
    <Select
      showSearch
      allowClear={allowClear}
      disabled={disabled}
      loading={loading}
      placeholder={placeholder}
      style={style}
      size={size}
      value={value}
      options={options}
      filterOption={(input, option) => String((option as { search?: string } | undefined)?.search ?? '').toLowerCase().includes(input.trim().toLowerCase())}
      onChange={(code?: string) => onChange?.(code, departments.find((d) => d.dept_code === code))}
    />
  )
}

export default DepartmentSelect
