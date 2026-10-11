import React, { useEffect, useRef, useState } from 'react'
import { Select, Button, Space, Spin } from 'antd'
import { SearchOutlined, CloseOutlined } from '@ant-design/icons'

// Type-ahead picker for the petty cash line form (MatCode / CostCode): a searchable <Select>
// (filterOption=false + onSearch, same pattern as MaterialSearchSelect) followed by the magnifier
// (opens the full picker modal) and clear (X) buttons. Selection-only: typed text is never
// committed; blur / Esc drops it and the previous valid value stays shown.

export interface LinePickerOption {
  /** unique key / Select value */
  value: string
  /** plain text shown in the input once selected */
  label: string
  /** the source row handed back to onPick */
  raw: any
  /** rich rendering inside the dropdown */
  render: React.ReactNode
}

interface Props {
  /** current valid value (already in display format); '' = nothing selected */
  displayValue: string
  placeholder: string
  disabled?: boolean
  /** returns the matches for a non-empty term */
  search: (term: string) => Promise<LinePickerOption[]>
  /** 0 = run immediately (local list); 300 for server-side search */
  debounceMs: number
  onPick: (raw: any) => void
  onOpenModal: () => void
  onClear: () => void
}

const LineSearchPicker: React.FC<Props> = ({
  displayValue, placeholder, disabled, search, debounceMs, onPick, onOpenModal, onClear,
}) => {
  const [options, setOptions] = useState<LinePickerOption[]>([])
  const [fetching, setFetching] = useState(false)
  const [touched, setTouched] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqId = useRef(0) // drops out-of-order responses

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const reset = () => {
    if (timer.current) clearTimeout(timer.current)
    reqId.current += 1
    setOptions([])
    setTouched(false)
    setFetching(false)
  }

  const handleSearch = (value: string) => {
    if (timer.current) clearTimeout(timer.current)
    const term = value.trim()
    if (!term) {
      reset()
      return
    }
    setFetching(true)
    setTouched(true)
    const id = ++reqId.current
    timer.current = setTimeout(async () => {
      try {
        const list = await search(term)
        if (id !== reqId.current) return
        setOptions(list)
      } catch {
        if (id !== reqId.current) return
        setOptions([])
      } finally {
        if (id === reqId.current) setFetching(false)
      }
    }, debounceMs)
  }

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Select
        showSearch
        style={{ width: '100%' }}
        value={displayValue || undefined}
        placeholder={placeholder}
        disabled={disabled}
        filterOption={false}
        suffixIcon={null}
        onSearch={handleSearch}
        onSelect={(_v, opt: any) => {
          onPick(opt.raw)
          reset()
        }}
        onDropdownVisibleChange={(open) => { if (!open) reset() }}
        notFoundContent={
          fetching ? (
            <div style={{ textAlign: 'center', padding: 8 }}><Spin size="small" /></div>
          ) : touched ? 'ไม่พบข้อมูล' : null
        }
        options={options.map((o) => ({ value: o.value, label: o.label, raw: o.raw, render: o.render }))}
        optionRender={(opt) => (opt.data as any).render ?? opt.label}
      />
      <Button icon={<SearchOutlined />} onClick={onOpenModal} disabled={disabled} />
      <Button icon={<CloseOutlined />} onClick={onClear} disabled={disabled || !displayValue} />
    </Space.Compact>
  )
}

export default LineSearchPicker
