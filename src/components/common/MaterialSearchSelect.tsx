import React, { useRef, useState } from 'react'
import { Select, Spin } from 'antd'
import axios from 'axios'
import { useAppSelector } from '@/store'
import type { MaterialSearchResult } from '@/types/po'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

interface Props {
  /** mat_codes already in the items table — used to flag duplicates in the list */
  existingCodes: string[]
  /** fired only when a real option is committed from the list */
  onSelect: (material: MaterialSearchResult) => void
  style?: React.CSSProperties
}

/**
 * Searchable, type-ahead combobox bound to material master data.
 * - Server-side search (GET /materials/search), debounced ~300ms.
 * - Selection-only: free text cannot be committed (no creatable mode).
 * - Ant Design <Select> provides role="combobox", aria-expanded,
 *   aria-activedescendant and arrow/Enter/Esc keyboard handling natively.
 */
const MaterialSearchSelect: React.FC<Props> = ({ existingCodes, onSelect, style }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [options, setOptions] = useState<MaterialSearchResult[]>([])
  const [fetching, setFetching] = useState(false)
  const [touched, setTouched] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // guards against out-of-order responses overwriting newer results
  const reqIdRef = useRef(0)

  const reset = () => {
    setOptions([])
    setTouched(false)
    setFetching(false)
  }

  const fetchMaterials = (term: string) => {
    const q = term.trim()
    if (!q) {
      reset()
      return
    }
    const reqId = ++reqIdRef.current
    const run = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/materials/search`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { q, limit: 20 },
        })
        if (reqId !== reqIdRef.current) return // stale response — ignore
        const list: MaterialSearchResult[] = Array.isArray(res.data)
          ? res.data
          : res.data?.data ?? []
        setOptions(list)
      } catch {
        if (reqId !== reqIdRef.current) return
        setOptions([])
      } finally {
        if (reqId === reqIdRef.current) setFetching(false)
      }
    }
    run()
  }

  const handleSearch = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      reset()
      return
    }
    // show the spinner immediately while the debounce window elapses
    setFetching(true)
    setTouched(true)
    debounceRef.current = setTimeout(() => fetchMaterials(value), 300)
  }

  const handleChange = (value: string) => {
    const picked = options.find((o) => o.mat_code === value)
    if (picked) onSelect(picked)
    reset() // clear the combobox so the user can search the next item
  }

  return (
    <Select
      showSearch
      value={null}
      style={{ width: 380, ...style }}
      placeholder="ค้นหาวัสดุด้วยรหัสหรือชื่อ เพื่อเพิ่มรายการ"
      filterOption={false}
      onSearch={handleSearch}
      onChange={handleChange}
      notFoundContent={
        fetching ? (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <Spin size="small" />
          </div>
        ) : touched ? (
          'No material found'
        ) : null
      }
      options={options.map((m) => ({
        value: m.mat_code,
        label: `${m.mat_code} — ${m.mat_name}`,
      }))}
      optionRender={(option) => {
        const m = options.find((x) => x.mat_code === option.value)
        if (!m) return option.label
        const dup = existingCodes.includes(m.mat_code)
        return (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{m.mat_code}</span>
              <span style={{ color: '#6b7280' }}> — {m.mat_name}</span>
            </span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
              {m.unit && <span style={{ fontSize: 11, color: '#9ca3af' }}>{m.unit}</span>}
              {dup && <span style={{ fontSize: 11, color: '#d97706' }}>already added</span>}
            </span>
          </div>
        )
      }}
    />
  )
}

export default MaterialSearchSelect
