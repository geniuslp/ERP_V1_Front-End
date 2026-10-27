import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space, Tag,
  Row, Col, Typography, Statistic, Divider, Upload, message,
} from 'antd'
import type { UploadProps } from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined,
  CloseOutlined, AppstoreOutlined, CheckCircleOutlined,
  UploadOutlined, DownloadOutlined, InboxOutlined, CheckOutlined, WarningOutlined,
  FileExcelOutlined, RightOutlined, SearchOutlined, ReloadOutlined,
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import type { Material } from '@/types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const { Text, Title } = Typography

type MaterialRecord = Material & { key: string }

interface PendingRow {
  rowKey: string
  isTemplate?: boolean
  groupId: string
  subGroupId: string
  subGroupCode: string
  subGroupName: string
  // true once the user has copied a Sub Group value in via the "ดูข้อมูล"
  // pill — switches that field from <Select> to free-text <Input> for this row only
  subGroupIsText?: boolean
  matNameId: string
  materialCode: string
  materialName: string
  matNameIsText?: boolean
  specCode: string
  specDescription: string
  // true once the user has copied a Spec value in via the "ดูข้อมูล" pill —
  // switches that field from <Select> to free-text <Input> for this row only
  specIsText?: boolean
  brandCode: string
  brandName: string
  brandIsText?: boolean
  unitCode: string
  unitName: string
  // true once "เพิ่มใหม่" was picked in the Unit dropdown — code auto-numbered, name typed by hand
  unitIsText?: boolean
}


const newRow = (isTemplate = false): PendingRow => ({
  rowKey: `${Date.now()}${Math.random()}`,
  isTemplate,
  groupId: '',
  subGroupId: '', subGroupCode: '', subGroupName: '', subGroupIsText: false,
  matNameId: '', materialCode: '', materialName: '', matNameIsText: false,
  specCode: '', specDescription: '', specIsText: false,
  brandCode: '', brandName: '', brandIsText: false,
  unitCode: '', unitName: '', unitIsText: false,
})

// the required fields also validated in handleSubmitAll — a template row only
// counts as a real row once these are actually filled in
const isRowComplete = (r: PendingRow): boolean =>
  !!(r.groupId && r.subGroupCode && r.subGroupName && r.materialCode && r.materialName && r.unitCode && r.unitName)

// template row is excluded from the count/submit unless the user has filled it in
const isRealRow = (r: PendingRow): boolean => !r.isTemplate || isRowComplete(r)

// ── helpers ──────────────────────────────────────────────────────
// Static section label pill. The optional onClick/hover feedback is currently unused
// (the old "copy this column down" lookup row was removed); styled inline like the rest
// of this file.
const SectionPill: React.FC<{ color: string; bg: string; label: string; onClick?: () => void; title?: string }> =
  ({ color, bg, label, onClick, title }) => {
    const [hover, setHover] = useState(false)
    return (
      <span
        onClick={onClick}
        onMouseEnter={() => onClick && setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={title}
        style={{
          display: 'inline-block', background: bg, color, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4,
          marginBottom: 6,
          cursor: onClick ? 'pointer' : 'default',
          boxShadow: hover ? '0 0 0 1px currentColor' : 'none',
          opacity: hover ? 0.85 : 1,
          transition: 'box-shadow 0.15s, opacity 0.15s',
        }}
      >
        {label}
      </span>
    )
  }

const FL: React.FC<{ text: string; required?: boolean }> = ({ text, required }) => (
  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
    {text}{required && <span style={{ color: '#f87171', marginLeft: 2 }}>*</span>}
  </div>
)

// ── cascade breadcrumb ──────────────────────────────────────────────
interface BreadcrumbStep { value: string; placeholderLabel: string }

const CascadeBreadcrumb: React.FC<{ steps: BreadcrumbStep[] }> = ({ steps }) => (
  <div style={{
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, boxSizing: 'border-box', maxWidth: '100%', minWidth: 0,
    overflowWrap: 'anywhere',
    background: '#eff6ff', borderRadius: 8, padding: '6px 12px', marginBottom: 10, fontSize: 12,
  }}>
    {steps.map((s, i) => (
      <React.Fragment key={i}>
        {i > 0 && <RightOutlined style={{ fontSize: 10, color: '#93c5fd' }} />}
        <span style={{ color: s.value ? '#2563eb' : '#60a5fa', fontWeight: s.value ? 600 : 400 }}>
          {s.value || `ยังไม่เลือก${s.placeholderLabel}`}
        </span>
      </React.Fragment>
    ))}
  </div>
)

// ── insert row (new entry) ────────────────────────────────────────
interface GroupOption { value: string; label: string; id: string; name: string }
interface IdOption { id: number; code: string; name: string; label: string; parentId?: number }

// mirrors the fetch-on-parent-change pattern used in MaterialPickerModal.tsx
function useCascadeOptions(parentId: string, path: string, paramName: string,
  map: (raw: any) => IdOption, accessToken?: string) {
  const [options, setOptions] = useState<IdOption[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!parentId || !accessToken) { setOptions([]); return }
    setLoading(true)
    axios.get(`${BASE_URL}${path}`, {
      params: { [paramName]: parentId },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => setOptions((res.data?.data ?? []).map(map)))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false))
  }, [parentId, accessToken])
  return { options, loading }
}

const mapSubGroup = (s: any): IdOption => ({ id: s.id, code: s.subgroup_code, name: s.subgroup_name, label: `${s.subgroup_code} — ${s.subgroup_name}` })
const mapMatName = (m: any): IdOption => ({ id: m.id, code: m.mat_name_code, name: m.mat_name, label: `${m.mat_name_code} — ${m.mat_name}` })
const mapSpec = (s: any): IdOption => ({ id: s.id, parentId: s.mat_name_id, code: s.spec_code, name: s.spec_description, label: `${s.spec_code} — ${s.spec_description}` })
const mapBrand = (b: any): IdOption => ({ id: b.id, parentId: b.spec_id, code: b.brand_code, name: b.brand_name, label: `${b.brand_code} — ${b.brand_name}` })

// Next auto code for a value added from a dropdown: highest numeric suffix among
// the existing codes + 1, keeping that code's prefix and zero-padding (3 digits
// when there is nothing to copy from). Codes without a numeric tail are ignored.
const nextCode = (codes: string[]): string => {
  let max = 0
  let prefix = ''
  let width = 3
  codes.forEach((raw) => {
    const m = /^(.*?)(\d+)$/.exec((raw ?? '').trim())
    if (!m) return
    const n = parseInt(m[2], 10)
    if (n >= max) { max = n; prefix = m[1]; width = m[2].length }
  })
  return `${prefix}${String(max + 1).padStart(width, '0')}`
}

// Footer of every dropdown: switches that field of the row to "new value" mode.
const withAddNew = (onAdd: () => void) => (menu: React.ReactElement) => (
  <>
    {menu}
    <Divider style={{ margin: '4px 0' }} />
    <Button type="link" size="small" icon={<PlusOutlined />} style={{ width: '100%', textAlign: 'left' }}
      onMouseDown={(e) => e.preventDefault()} onClick={onAdd}>
      เพิ่มใหม่
    </Button>
  </>
)

interface InsertRowProps {
  row: PendingRow; displayNumber?: number
  groupOptions: GroupOption[]
  unitOptions: IdOption[]
  // every pending row, so two rows adding a new value at once never get the same auto code
  allRows: PendingRow[]
  // Full unfiltered spec/brand lists — the same ones MaterialPage already
  // fetches once for the list-page filter row (filterSpecOptions/
  // filterBrandOptions), reused here to populate the default <Select>
  // dropdown so this component doesn't need its own API call.
  specOptions: IdOption[]
  brandOptions: IdOption[]
  accessToken?: string
  onChange: (key: string, patch: Partial<PendingRow>) => void
  onRemove: (key: string) => void; canRemove: boolean
}

const InsertRow: React.FC<InsertRowProps> = ({ row, displayNumber, groupOptions, specOptions: allSpecs, brandOptions: allBrands, unitOptions, allRows, accessToken, onChange, onRemove, canRemove }) => {
  const isExample = !!row.isTemplate && !isRowComplete(row)
  const groupNumericId = groupOptions.find((o) => o.value === row.groupId)?.id
  const { options: subGroupOptions, loading: subGroupLoading } =
    useCascadeOptions(groupNumericId ? String(groupNumericId) : '', '/master/subgroups', 'group_id', mapSubGroup, accessToken)
  const { options: matNameOptions, loading: matNameLoading } =
    useCascadeOptions(row.subGroupId, '/master/mat-names', 'subgroup_id', mapMatName, accessToken)

  // Unit dropdown: only units already used by materials matching what this row has
  // picked so far (same endpoint/params as the list page's Unit filter). The full unit
  // list (`unitOptions`) is still used for the auto code so it never collides.
  const [usedUnits, setUsedUnits] = useState<IdOption[]>([])
  const [usedUnitsLoading, setUsedUnitsLoading] = useState(false)
  // Spec follows the chosen Material, Brand follows the chosen Spec (nothing to pick until the parent is set)
  const specOptions = row.matNameId ? allSpecs.filter((o) => o.parentId === Number(row.matNameId)) : []
  const rowSpecId = specOptions.find((o) => o.code === row.specCode)?.id
  const brandOptions = rowSpecId ? allBrands.filter((o) => o.parentId === rowSpecId) : []
  const rowBrandId = brandOptions.find((o) => o.code === row.brandCode)?.id
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setUsedUnitsLoading(true)
    const levels: Record<string, number | string | undefined>[] = [
      { brand_id: rowBrandId, spec_id: rowSpecId, mat_name_id: row.matNameId, subgroup_id: row.subGroupId, group_id: groupNumericId },
      { spec_id: rowSpecId, mat_name_id: row.matNameId, subgroup_id: row.subGroupId, group_id: groupNumericId },
      { mat_name_id: row.matNameId, subgroup_id: row.subGroupId, group_id: groupNumericId },
      { subgroup_id: row.subGroupId, group_id: groupNumericId },
      { group_id: groupNumericId },
    ]
    // follow the item: try the most specific level it has (brand, else spec, else material...) and
    // step up one level at a time until some unit is found
    const tried = new Set<string>()
    const toUnits = (d: any[]): IdOption[] => d.map(
      (u: any): IdOption => ({ id: u.id, code: u.unit_code, name: u.unit_name, label: `${u.unit_code} — ${u.unit_name}` }))
    ;(async () => {
      let found: IdOption[] = []
      try {
        for (const lv of levels) {
          const params = Object.fromEntries(Object.entries(lv).filter(([, v]) => v)) as Record<string, string | number>
          const key = JSON.stringify(params)
          if (!Object.keys(params).length || tried.has(key)) continue
          tried.add(key)
          const res = await axios.get(`${BASE_URL}/master/units/used`, { headers: { Authorization: `Bearer ${accessToken}` }, params })
          found = toUnits(res.data?.data ?? [])
          if (found.length) break
        }
      } catch { found = [] }
      if (!cancelled) { setUsedUnits(found); setUsedUnitsLoading(false) }
    })()
    return () => { cancelled = true }
  }, [accessToken, groupNumericId, row.subGroupId, row.matNameId, rowSpecId, rowBrandId])
  const selectedUnit = unitOptions.find((o) => o.code === row.unitCode)
  // matching units first, every other unit after them — so the list is never empty
  const otherUnits = unitOptions.filter((o) => !usedUnits.some((u) => u.id === o.id))
  const unitSelectOptions = [...usedUnits, ...otherUnits]
  const unitGroupedOptions = [
    ...(usedUnits.length ? [{ label: 'ใช้กับวัสดุที่ตรงกัน', options: usedUnits.map((o) => ({ value: o.id, label: o.label })) }] : []),
    { label: usedUnits.length ? 'หน่วยอื่นทั้งหมด' : 'หน่วยทั้งหมด', options: otherUnits.map((o) => ({ value: o.id, label: o.label })) },
  ]

  // "เพิ่มใหม่" in a dropdown: the row's field becomes code + name inputs, with the code
  // pre-filled as latest + 1 (existing options plus codes other rows already claimed).
  const others = allRows.filter((r) => r.rowKey !== row.rowKey)
  const resetBelowMatName = { specCode: '', specDescription: '', specIsText: false, brandCode: '', brandName: '', brandIsText: false }
  const resetBelowSubGroup = { matNameId: '', materialCode: '', materialName: '', matNameIsText: false, ...resetBelowMatName }
  const addSubGroup = () => onChange(row.rowKey, {
    subGroupIsText: true, subGroupId: '', subGroupName: '',
    subGroupCode: nextCode([
      ...subGroupOptions.map((o) => o.code),
      ...others.filter((r) => r.groupId === row.groupId && r.subGroupIsText).map((r) => r.subGroupCode),
    ]),
    ...resetBelowSubGroup,
  })
  const addMatName = () => onChange(row.rowKey, {
    matNameIsText: true, matNameId: '', materialName: '',
    materialCode: nextCode([
      ...matNameOptions.map((o) => o.code),
      ...others.filter((r) => r.groupId === row.groupId && r.subGroupCode === row.subGroupCode && r.matNameIsText).map((r) => r.materialCode),
    ]),
    ...resetBelowMatName,
  })
  const addSpec = () => onChange(row.rowKey, {
    specIsText: true, specDescription: '',
    specCode: nextCode([...specOptions.map((o) => o.code), ...others.filter((r) => r.specIsText).map((r) => r.specCode)]),
  })
  const addBrand = () => onChange(row.rowKey, {
    brandIsText: true, brandName: '',
    brandCode: nextCode([...brandOptions.map((o) => o.code), ...others.filter((r) => r.brandIsText).map((r) => r.brandCode)]),
  })
  const addUnit = () => onChange(row.rowKey, {
    unitIsText: true, unitName: '',
    unitCode: nextCode([...unitOptions.map((o) => o.code), ...others.filter((r) => r.unitIsText).map((r) => r.unitCode)]),
  })

  const groupLabel = groupOptions.find((o) => o.value === row.groupId)?.name ?? ''
  const breadcrumbSteps: BreadcrumbStep[] = [
    { value: groupLabel, placeholderLabel: 'กลุ่ม' },
    { value: row.subGroupName, placeholderLabel: 'กลุ่มย่อย' },
    { value: row.materialName, placeholderLabel: 'ชื่อวัสดุ' },
    { value: row.specDescription, placeholderLabel: 'สเปค' },
    { value: row.brandName, placeholderLabel: 'ยี่ห้อ' },
  ]

  return (
  <div>
  <CascadeBreadcrumb steps={breadcrumbSteps} />
  <div className="mm-entry" style={{ background: '#fff', border: isExample ? '1px dashed #d1d5db' : '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', boxSizing: 'border-box', maxWidth: '100%' }}>

    {/* number */}
    <div className="mm-entry-badge">
      {isExample ? (
        <>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e5e7eb', color: '#9ca3af', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            –
          </div>
          <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 3, lineHeight: 1.2 }}>ตัวอย่าง</div>
        </>
      ) : (
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
          {displayNumber}
        </div>
      )}
    </div>

    <div className="mm-entry-fields">
    {/* ROW 1: Group | Subgroup | Material */}
    <div className="mm-entry-row1">

    {/* GROUP */}
    <div style={{ minWidth: 0 }}>
      <SectionPill color="#2563eb" bg="#dbeafe" label="Group" />
      <FL text="กลุ่ม" required />
      <Select size="small" style={{ width: '100%' }} placeholder="เลือกกลุ่ม"
        options={groupOptions} value={row.groupId || undefined}
        onChange={(v) => onChange(row.rowKey, {
          groupId: v,
          subGroupId: '', subGroupCode: '', subGroupName: '', subGroupIsText: false,
          matNameId: '', materialCode: '', materialName: '', matNameIsText: false,
          specCode: '', specDescription: '', specIsText: false,
          brandCode: '', brandName: '', brandIsText: false,
        })} />
    </div>

    {/* SUBGROUP — locked <Select> (cascaded off row.groupId) until the
        "ดูข้อมูล" pill copies a value in (row.subGroupIsText), at which point
        this row's Sub Group switches to two free-text <Input>s, same
        Select↔Input toggle pattern as Spec/Brand below. Reload button
        switches back to <Select> mode, clearing downstream fields too (same
        as picking a new Sub Group from the dropdown already does). */}
    <div style={{ minWidth: 0 }}>
      <SectionPill color="#0284c7" bg="#e0f2fe" label="Sub Group" />
      {!row.subGroupIsText ? (
        <>
          <FL text="กลุ่มย่อย" required />
          <Select size="small" style={{ width: '100%' }} placeholder="เลือกกลุ่มย่อย"
            showSearch allowClear loading={subGroupLoading} disabled={!row.groupId}
            dropdownRender={withAddNew(addSubGroup)}
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            options={subGroupOptions.map((o) => ({ value: o.id, label: o.label }))}
            value={row.subGroupId ? Number(row.subGroupId) : undefined}
            onChange={(v) => {
              const opt = subGroupOptions.find((o) => o.id === v)
              onChange(row.rowKey, {
                subGroupId: opt ? String(opt.id) : '', subGroupCode: opt?.code ?? '', subGroupName: opt?.name ?? '',
                matNameId: '', materialCode: '', materialName: '', matNameIsText: false,
                specCode: '', specDescription: '', specIsText: false,
                brandCode: '', brandName: '', brandIsText: false,
              })
            }} />
        </>
      ) : (
        <Row gutter={0} className="mm-pair">
          <Col span={9}>
            <FL text="รหัสกลุ่มย่อย" required />
            <Input size="small" placeholder="กรอกรหัสกลุ่มย่อย" value={row.subGroupCode}
              onChange={(e) => onChange(row.rowKey, { subGroupCode: e.target.value })} />
          </Col>
          <Col span={13}>
            <FL text="ชื่อกลุ่มย่อย" required />
            <Input size="small" placeholder="ชื่อกลุ่มย่อย" autoFocus value={row.subGroupName}
              onChange={(e) => onChange(row.rowKey, { subGroupName: e.target.value })} />
          </Col>
          <Col span={2} style={{ paddingTop: 18 }}>
            <Button type="text" size="small" icon={<ReloadOutlined style={{ fontSize: 12 }} />}
              title="เปลี่ยนกลับเป็นเลือกจากรายการ"
              onClick={() => onChange(row.rowKey, {
                subGroupIsText: false, subGroupId: '', subGroupCode: '', subGroupName: '',
                matNameId: '', materialCode: '', materialName: '', matNameIsText: false,
                specCode: '', specDescription: '', specIsText: false,
                brandCode: '', brandName: '', brandIsText: false,
              })} />
          </Col>
        </Row>
      )}
    </div>

    {/* MATERIAL — same Select↔Input toggle as Sub Group above, cascaded off
        row.subGroupId when in <Select> mode. */}
    <div style={{ minWidth: 0 }}>
      <SectionPill color="#4f46e5" bg="#e0e7ff" label="Material" />
      {!row.matNameIsText ? (
        <>
          <FL text="ชื่อวัสดุ" required />
          <Select size="small" style={{ width: '100%' }} placeholder="เลือกชื่อวัสดุ"
            showSearch allowClear loading={matNameLoading} disabled={!row.subGroupId && !row.subGroupIsText}
            dropdownRender={withAddNew(addMatName)}
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            options={matNameOptions.map((o) => ({ value: o.id, label: o.label }))}
            value={row.matNameId ? Number(row.matNameId) : undefined}
            onChange={(v) => {
              const opt = matNameOptions.find((o) => o.id === v)
              onChange(row.rowKey, {
                matNameId: opt ? String(opt.id) : '', materialCode: opt?.code ?? '', materialName: opt?.name ?? '',
                specCode: '', specDescription: '', specIsText: false,
                brandCode: '', brandName: '', brandIsText: false,
              })
            }} />
        </>
      ) : (
        <Row gutter={0} className="mm-pair">
          <Col span={9}>
            <FL text="รหัสวัสดุ" required />
            <Input size="small" placeholder="กรอกรหัสวัสดุ" value={row.materialCode}
              onChange={(e) => onChange(row.rowKey, { materialCode: e.target.value })} />
          </Col>
          <Col span={13}>
            <FL text="ชื่อวัสดุ" required />
            <Input size="small" placeholder="ชื่อวัสดุ" autoFocus value={row.materialName}
              onChange={(e) => onChange(row.rowKey, { materialName: e.target.value })} />
          </Col>
          <Col span={2} style={{ paddingTop: 18 }}>
            <Button type="text" size="small" icon={<ReloadOutlined style={{ fontSize: 12 }} />}
              title="เปลี่ยนกลับเป็นเลือกจากรายการ"
              onClick={() => onChange(row.rowKey, {
                matNameIsText: false, matNameId: '', materialCode: '', materialName: '',
                specCode: '', specDescription: '', specIsText: false,
                brandCode: '', brandName: '', brandIsText: false,
              })} />
          </Col>
        </Row>
      )}
    </div>

    </div>

    {/* ROW 2: Spec (widest, ~50%) | Brand | Unit | remove */}
    <div className="mm-entry-row2">

    {/* SPEC — locked <Select> (same pattern as Group/Sub Group/Material) until
        the "ดูข้อมูล" pill copies a value in (row.specIsText), at which point
        this row's Spec switches to two free-text <Input>s. The small reload
        button switches it back to <Select> mode (clearing the value) if the
        user wants to pick fresh from the list instead. */}
    <div className="mm-entry-spec" style={{ minWidth: 0 }}>
      <SectionPill color="#7c3aed" bg="#ede9fe" label="Spec" />
      {!row.specIsText ? (
        <>
          <FL text="สเปค" />
          <Select size="small" style={{ width: '100%' }} placeholder="เลือกสเปค (ไม่บังคับ)"
            showSearch allowClear dropdownRender={withAddNew(addSpec)}
            filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
            options={specOptions.map((o) => ({ value: o.id, label: o.label }))}
            value={(() => {
              const opt = specOptions.find((o) => o.code === row.specCode)
              return opt ? opt.id : undefined
            })()}
            onChange={(v) => {
              const opt = specOptions.find((o) => o.id === v)
              onChange(row.rowKey, { specCode: opt?.code ?? '', specDescription: opt?.name ?? '' })
            }} />
        </>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 120px', minWidth: 0 }}>
            <FL text="รหัสสเปค" />
            <Input size="small" placeholder="กรอกรหัสสเปค" value={row.specCode}
              onChange={(e) => onChange(row.rowKey, { specCode: e.target.value })} />
          </div>
          <div style={{ flex: '1 1 120px', minWidth: 0 }}>
            <FL text="รายละเอียดสเปค" />
            <Input size="small" placeholder="รายละเอียดสเปค (ถ้ามี)" autoFocus value={row.specDescription}
              onChange={(e) => onChange(row.rowKey, { specDescription: e.target.value })} />
          </div>
          <div style={{ flex: '0 0 auto', paddingTop: 18 }}>
            <Button type="text" size="small" icon={<ReloadOutlined style={{ fontSize: 12 }} />}
              title="เปลี่ยนกลับเป็นเลือกจากรายการ"
              onClick={() => onChange(row.rowKey, { specIsText: false, specCode: '', specDescription: '' })} />
          </div>
        </div>
      )}
    </div>

    {/* BRAND — same Select↔Input toggle pattern as Spec above */}
    <div style={{ minWidth: 0 }}>
      <SectionPill color="#b45309" bg="#fef3c7" label="Brand" />
      {!row.brandIsText ? (
        <>
          <FL text="ยี่ห้อ" />
          <Select size="small" style={{ width: '100%' }} placeholder="เลือกยี่ห้อ (ไม่บังคับ)"
            showSearch allowClear dropdownRender={withAddNew(addBrand)}
            filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
            options={brandOptions.map((o) => ({ value: o.id, label: o.label }))}
            value={(() => {
              const opt = brandOptions.find((o) => o.code === row.brandCode)
              return opt ? opt.id : undefined
            })()}
            onChange={(v) => {
              const opt = brandOptions.find((o) => o.id === v)
              onChange(row.rowKey, { brandCode: opt?.code ?? '', brandName: opt?.name ?? '' })
            }} />
        </>
      ) : (
        <Row gutter={0} className="mm-pair">
          <Col span={9}>
            <FL text="รหัสยี่ห้อ" />
            <Input size="small" placeholder="กรอกรหัสยี่ห้อ" value={row.brandCode}
              onChange={(e) => onChange(row.rowKey, { brandCode: e.target.value })} />
          </Col>
          <Col span={13}>
            <FL text="ยี่ห้อ" />
            <Input size="small" placeholder="ชื่อยี่ห้อ (ถ้ามี)" autoFocus value={row.brandName}
              onChange={(e) => onChange(row.rowKey, { brandName: e.target.value })} />
          </Col>
          <Col span={2} style={{ paddingTop: 18 }}>
            <Button type="text" size="small" icon={<ReloadOutlined style={{ fontSize: 12 }} />}
              title="เปลี่ยนกลับเป็นเลือกจากรายการ"
              onClick={() => onChange(row.rowKey, { brandIsText: false, brandCode: '', brandName: '' })} />
          </Col>
        </Row>
      )}
    </div>

    {/* UNIT */}
    <div style={{ minWidth: 0 }}>
      <SectionPill color="#059669" bg="#d1fae5" label="Unit" />
      {!row.unitIsText ? (
        <>
          <FL text="หน่วย" required />
          <Select size="small" style={{ width: '100%' }} placeholder="เลือกหน่วย"
            showSearch allowClear dropdownRender={withAddNew(addUnit)}
            filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
            loading={usedUnitsLoading}
            options={unitGroupedOptions}
            value={selectedUnit?.id}
            onChange={(v) => {
              const opt = unitSelectOptions.find((o) => o.id === v)
              onChange(row.rowKey, { unitCode: opt?.code ?? '', unitName: opt?.name ?? '' })
            }} />
        </>
      ) : (
        <Row gutter={0} className="mm-pair">
          <Col span={9}>
            <FL text="รหัสหน่วย" required />
            <Input size="small" placeholder="รหัสหน่วย" value={row.unitCode}
              onChange={(e) => onChange(row.rowKey, { unitCode: e.target.value })} />
          </Col>
          <Col span={13}>
            <FL text="ชื่อหน่วย" required />
            <Input size="small" placeholder="เช่น ชิ้น, กก." value={row.unitName} autoFocus
              onChange={(e) => onChange(row.rowKey, { unitName: e.target.value })} />
          </Col>
          <Col span={2} style={{ paddingTop: 18 }}>
            <Button type="text" size="small" icon={<ReloadOutlined style={{ fontSize: 12 }} />}
              title="เปลี่ยนกลับเป็นเลือกจากรายการ"
              onClick={() => onChange(row.rowKey, { unitIsText: false, unitCode: '', unitName: '' })} />
          </Col>
        </Row>
      )}
    </div>

    {/* delete */}
    <div className="mm-entry-remove">
      {canRemove && (
        <Button type="text" size="small" danger icon={<CloseOutlined style={{ fontSize: 12 }} />}
          onClick={() => onRemove(row.rowKey)} style={{ padding: '0 4px' }} />
      )}
    </div>
    </div>
    </div>
  </div>
  </div>
  )
}

// "{code} - {name}" for the list table's hierarchy columns (plain hyphen, not
// an em dash). Falls back to whichever part exists, or "—" when both are empty.
const formatCodeName = (code?: string | null, name?: string | null): string => {
  const c = (code ?? '').trim()
  const n = (name ?? '').trim()
  return c && n ? `${c} - ${n}` : c || n || '—'
}

// Group/Sub Group cell shows one code-only tag: "{group_code}-{subgroup_code}"
// (no spaces); whichever code exists if the other is missing, "—" if neither.
const formatGroupSubgroupCode = (groupCode?: string | null, subgroupCode?: string | null): string => {
  const g = (groupCode ?? '').trim()
  const sg = (subgroupCode ?? '').trim()
  return g && sg ? `${g}-${sg}` : g || sg || '—'
}

// ── file import helpers ──────────────────────────────────────────
const FILE_COLS = ['groupCode', 'subGroupCode', 'subGroupName', 'materialCode', 'materialName', 'specCode', 'specDescription', 'brandCode', 'brandName', 'unitCode', 'unitName']

const downloadTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    FILE_COLS,
    ['GRP001', 'SUB001', 'วัตถุดิบเหล็ก', 'MAT001', 'เหล็กแผ่น SS400', 'SP001', '3x1200x2400 mm', 'BR001', 'TATA Steel', 'UN001', 'แผ่น'],
    ['GRP002', 'SUB003', 'สินค้าอุปโภค', 'MAT004', 'ถุงพลาสติก', '', '', 'BR004', 'Thai Poly', 'UN004', 'ถุง'],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Material')
  XLSX.writeFile(wb, 'material_template.xlsx')
}

interface ParsedRow { row: number; groupCode: string; groupId: string; valid: boolean; error?: string; data: Omit<MaterialRecord, 'key' | 'id' | 'isActive'> }

const isBlank = (v: string) => v.trim() === ''

const REQUIRED_FIELDS = ['groupCode', 'subGroupCode', 'subGroupName', 'materialCode', 'materialName', 'unitCode', 'unitName'] as const

type GroupRaw = { id: string; group_code: string; group_name: string }

const parseRows = (rows: Record<string, string>[], groups: GroupRaw[]): ParsedRow[] =>
  rows.map((cols, i) => {
    const get = (f: string) => String(cols[f] ?? '').trim()
    const groupCode       = get('groupCode')
    const subGroupCode    = get('subGroupCode')
    const subGroupName    = get('subGroupName')
    const materialCode    = get('materialCode')
    const materialName    = get('materialName')
    const specCode        = get('specCode')
    const specDescription = get('specDescription')
    const brandCode       = get('brandCode')
    const brandName       = get('brandName')
    const unitCode        = get('unitCode')
    const unitName        = get('unitName')

    const grp = groups.find((g) => g.group_code === groupCode)

    const data = {
      groupId: grp?.id ?? '',
      subGroupCode, subGroupName,
      materialCode, materialName,
      specCode, specDescription,
      brandCode, brandName,
      unitCode, unitName,
    }

    const missing = REQUIRED_FIELDS.filter((f) => isBlank(get(f)))
    if (missing.length > 0)
      return { row: i + 2, groupCode, groupId: grp?.id ?? '', valid: false, error: `ข้อมูลไม่ครบในฟิลด์: ${missing.join(', ')}`, data }

    if (!grp)
      return { row: i + 2, groupCode, groupId: '', valid: false, error: `ไม่พบกลุ่ม "${groupCode}"`, data }

    return { row: i + 2, groupCode, groupId: grp.id, valid: true, data }
  })

const MISSING_COLS_ERROR = 'MISSING_COLUMNS'

const readFileAsRows = (file: File, groups: GroupRaw[]): Promise<ParsedRow[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const ab = e.target?.result as ArrayBuffer
        const wb = XLSX.read(ab, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (json.length === 0) { resolve([]); return }
        const presentCols = Object.keys(json[0])
        const missing = FILE_COLS.filter((col) => !presentCols.includes(col))
        if (missing.length > 0) {
          const err = new Error(missing.join(','))
          err.name = MISSING_COLS_ERROR
          reject(err)
          return
        }
        resolve(parseRows(json, groups))
      } catch (err) {
        reject(err instanceof Error && err.name === MISSING_COLS_ERROR ? err : new Error('อ่านไฟล์ไม่ได้'))
      }
    }
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'))
    reader.readAsArrayBuffer(file)
  })

// ── main page ────────────────────────────────────────────────────
const MaterialPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<MaterialRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [groups, setGroups] = useState<GroupRaw[]>([])
  // `search` is the debounced value actually sent to the API; `searchInput`
  // tracks the raw keystrokes so the box stays responsive while typing.
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lookup-field filter row — all 6 are sent server-side as *_id params to
  // GET /master/allMaterial (it already supports group_id/subgroup_id/
  // mat_name_id/spec_id/brand_id/unit_id, confirmed in master.go — no backend
  // change needed). Subgroup cascades off Group (same group_id param the
  // GET /master/subgroups endpoint already accepts, mirroring the cascade
  // pattern InsertRow/useCascadeOptions below uses for the insert-row form);
  // Mat Name/Spec/Brand/Unit are kept independent per-field lists since the
  // task only asked for the Group→Subgroup relationship to cascade.
  const [filterGroupId, setFilterGroupId] = useState<number | undefined>()
  const [filterSubgroupId, setFilterSubgroupId] = useState<number | undefined>()
  const [filterMatNameId, setFilterMatNameId] = useState<number | undefined>()
  const [filterSpecId, setFilterSpecId] = useState<number | undefined>()
  const [filterBrandId, setFilterBrandId] = useState<number | undefined>()
  const [filterUnitId, setFilterUnitId] = useState<number | undefined>()

  const [filterSubgroupOptions, setFilterSubgroupOptions] = useState<IdOption[]>([])
  const [filterSubgroupLoading, setFilterSubgroupLoading] = useState(false)
  const [filterMatNameOptions, setFilterMatNameOptions] = useState<IdOption[]>([])
  const [filterMatNameLoading, setFilterMatNameLoading] = useState(false)
  const [filterSpecLoading, setFilterSpecLoading] = useState(false)
  const [filterBrandLoading, setFilterBrandLoading] = useState(false)
  const [filterSpecOptions, setFilterSpecOptions] = useState<IdOption[]>([])
  const [filterBrandOptions, setFilterBrandOptions] = useState<IdOption[]>([])
  const [filterUnitOptions, setFilterUnitOptions] = useState<IdOption[]>([])
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([newRow(true)])
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<MaterialRecord | null>(null)
  const [editForm] = Form.useForm()
  const editGroupId = Form.useWatch('groupId', editForm)
  const editSubGroupName = Form.useWatch('subGroupName', editForm)
  const editMaterialName = Form.useWatch('materialName', editForm)
  const editSpecDescription = Form.useWatch('specDescription', editForm)
  const editBrandName = Form.useWatch('brandName', editForm)

  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [duplicateCount, setDuplicateCount] = useState(0)

  // Full (unfiltered) spec / brand / unit lists for the insert rows' dropdowns and for
  // computing the next auto code — the filter-bar lists above only fill in once a
  // parent filter is picked, so they can't serve here.
  const [allSpecOptions, setAllSpecOptions] = useState<IdOption[]>([])
  const [allBrandOptions, setAllBrandOptions] = useState<IdOption[]>([])
  const [allUnitOptions, setAllUnitOptions] = useState<IdOption[]>([])
  const loadAllLookups = useCallback(() => {
    if (!accessToken) return
    const get = (path: string) => axios.get(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => (res.data?.data ?? []) as any[]).catch(() => [] as any[])
    get('/master/specs').then((d) => setAllSpecOptions(d.map(mapSpec)))
    get('/master/brands').then((d) => setAllBrandOptions(d.map(mapBrand)))
    get('/master/units').then((d) => setAllUnitOptions(d.map(
      (u: any): IdOption => ({ id: u.id, code: u.unit_code, name: u.unit_name, label: `${u.unit_code} — ${u.unit_name}` }),
    )))
  }, [accessToken])
  useEffect(() => { loadAllLookups() }, [loadAllLookups])

  // load groups once
  useEffect(() => {
    if (!accessToken) return
    axios.get(`${BASE_URL}/groups`, { headers: authHeader })
      .then((res) => setGroups(res.data?.data ?? []))
      .catch(() => {})
  }, [accessToken])

  // Filter dependency chain: Group → Subgroup → Mat Name → Spec → Brand. Each
  // level's options are fetched only once its parent is selected (and are empty
  // otherwise); the change handlers below clear descendants. Unit is independent.
  const loadFilterOptions = (
    parentId: number | undefined, path: string, param: string,
    map: (raw: any) => IdOption, setOptions: (o: IdOption[]) => void,
    setLoading?: (b: boolean) => void,
  ) => {
    if (!accessToken || !parentId) { setOptions([]); return }
    setLoading?.(true)
    axios.get(`${BASE_URL}${path}`, { headers: authHeader, params: { [param]: parentId } })
      .then((res) => setOptions((res.data?.data ?? []).map(map)))
      .catch(() => setOptions([]))
      .finally(() => setLoading?.(false))
  }
  useEffect(() => {
    loadFilterOptions(filterGroupId, '/master/subgroups', 'group_id', mapSubGroup, setFilterSubgroupOptions, setFilterSubgroupLoading)
  }, [accessToken, filterGroupId])
  useEffect(() => {
    loadFilterOptions(filterSubgroupId, '/master/mat-names', 'subgroup_id', mapMatName, setFilterMatNameOptions, setFilterMatNameLoading)
  }, [accessToken, filterSubgroupId])
  useEffect(() => {
    loadFilterOptions(filterMatNameId, '/master/specs', 'mat_name_id', mapSpec, setFilterSpecOptions, setFilterSpecLoading)
  }, [accessToken, filterMatNameId])
  useEffect(() => {
    loadFilterOptions(filterSpecId, '/master/brands', 'spec_id', mapBrand, setFilterBrandOptions, setFilterBrandLoading)
  }, [accessToken, filterSpecId])

  // Unit filter: optional, not part of the dependency chain, but narrowed by
  // whichever of group/subgroup/mat-name/spec/brand are currently selected
  // (unselected ones are omitted). Reloads whenever any of them changes, and
  // clears a selected Unit that is no longer among the reloaded options.
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    axios.get(`${BASE_URL}/master/units/used`, {
      headers: authHeader,
      params: {
        group_id: filterGroupId, subgroup_id: filterSubgroupId,
        mat_name_id: filterMatNameId, spec_id: filterSpecId, brand_id: filterBrandId,
      },
    })
      .then((res) => {
        if (cancelled) return
        const opts = (res.data?.data ?? []).map(
          (u: any): IdOption => ({ id: u.id, code: u.unit_code, name: u.unit_name, label: `${u.unit_code} — ${u.unit_name}` }),
        )
        setFilterUnitOptions(opts)
        setFilterUnitId((cur) => (cur !== undefined && !opts.some((o: IdOption) => o.id === cur) ? undefined : cur))
      })
      .catch(() => { if (!cancelled) setFilterUnitOptions([]) })
    return () => { cancelled = true }
  }, [accessToken, filterGroupId, filterSubgroupId, filterMatNameId, filterSpecId, filterBrandId])

  // load material stats once
  useEffect(() => {
    if (!accessToken) return
    axios.get(`${BASE_URL}/master/materials/stats`, { headers: authHeader })
      .then((res) => {
        const stats = res.data?.data ?? res.data ?? {}
        setDuplicateCount(stats.duplicates ?? 0)
      })
      .catch(() => {})
  }, [accessToken])

  const fetchMaterials = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/allMaterial`, {
        params: {
          page, limit: 10, search: search || undefined,
          group_id: filterGroupId, subgroup_id: filterSubgroupId,
          mat_name_id: filterMatNameId, spec_id: filterSpecId,
          brand_id: filterBrandId, unit_id: filterUnitId,
        },
        headers: authHeader,
      })
      const rawList = Array.isArray(res.data) ? res.data : res.data?.data
      const list = Array.isArray(rawList) ? rawList : []
      setTotal(res.data?.total ?? 0)
      setData(list.map((m: any) => ({
        key:             m.mat_code,
        id:              m.mat_code,
        groupId:         m.group_code,
        subGroupCode:    m.subgroup_code    ?? '',
        subGroupName:    m.subgroup_name    ?? '',
        materialCode:    m.mat_code,
        materialName:    m.mat_name_th      ?? '',
        matCodeName:     m.mat_code_name    ?? '',
        matNameCode:     m.mat_name_code    ?? '',
        specCode:        m.spec_code        ?? '',
        specDescription: m.spec_description ?? '',
        brandCode:       m.brand_code       ?? '',
        brandName:       m.brand_name       ?? '',
        unitCode:        m.unit_code        ?? '',
        unitName:        m.unit_name        ?? '',
        isActive:        m.is_active,
      })))
    } catch {
      message.error('โหลดข้อมูลวัสดุไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [accessToken, page, search, filterGroupId, filterSubgroupId, filterMatNameId, filterSpecId, filterBrandId, filterUnitId])

  // load materials — re-runs when page, (debounced) search, or any filter changes
  useEffect(() => { fetchMaterials() }, [fetchMaterials])

  // debounce the search box: wait 400ms after typing stops before hitting the
  // API, and jump back to page 1 since the result set changes.
  const handleSearchInputChange = (value: string) => {
    setSearchInput(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setPage(1)
      setSearch(value)
    }, 400)
  }

  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
  }, [])

  // Selecting a new Group clears any stale Subgroup selection (its options
  // are about to be refetched for the new group) and resets to page 1, same
  // as every other filter change below.
  const handleFilterGroupChange = (v?: number) => {
    setFilterGroupId(v)
    setFilterSubgroupId(undefined)
    setFilterMatNameId(undefined)
    setFilterSpecId(undefined)
    setFilterBrandId(undefined)
    setPage(1)
  }
  const makeFilterChangeHandler = (setter: (v?: number) => void) => (v?: number) => {
    setter(v)
    setPage(1)
  }
  const handleFilterSubgroupChange = (v?: number) => {
    setFilterSubgroupId(v)
    setFilterMatNameId(undefined)
    setFilterSpecId(undefined)
    setFilterBrandId(undefined)
    setPage(1)
  }
  const handleFilterMatNameChange = (v?: number) => {
    setFilterMatNameId(v)
    setFilterSpecId(undefined)
    setFilterBrandId(undefined)
    setPage(1)
  }
  const handleFilterSpecChange = (v?: number) => {
    setFilterSpecId(v)
    setFilterBrandId(undefined)
    setPage(1)
  }
  const handleFilterBrandChange = makeFilterChangeHandler(setFilterBrandId)
  const handleFilterUnitChange = makeFilterChangeHandler(setFilterUnitId)

  const handleResetFilters = () => {
    setSearchInput('')
    setSearch('')
    setFilterGroupId(undefined)
    setFilterSubgroupId(undefined)
    setFilterMatNameId(undefined)
    setFilterSpecId(undefined)
    setFilterBrandId(undefined)
    setFilterUnitId(undefined)
    setPage(1)
  }

  const groupOptions = groups.map((g) => ({ value: g.group_code, label: `${g.group_code} — ${g.group_name}`, id: g.id, name: g.group_name }))

  const [uploadFileName, setUploadFileName] = useState<string>('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const IMPORT_PAGE_SIZE = 10
  const [importPage, setImportPage] = useState(1)
  const [flashRowKey, setFlashRowKey] = useState<number | null>(null)
  const importRowRefs = useRef<Record<number, HTMLElement | null>>({})

  // ✅ แก้ไข: รอ render page ก่อนแล้วค่อย scroll
  const jumpToFirstError = () => {
    const firstErrorIndex = parsedRows.findIndex((r) => !r.valid)
    if (firstErrorIndex === -1) return
    const targetPage = Math.floor(firstErrorIndex / IMPORT_PAGE_SIZE) + 1
    setImportPage(targetPage)
    setTimeout(() => {
      setFlashRowKey(firstErrorIndex)
      const el = importRowRefs.current[firstErrorIndex]
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  // ✅ แก้ไข: เอา scroll ออก เหลือแค่ clear flash
  useEffect(() => {
    if (flashRowKey === null) return
    const timer = setTimeout(() => setFlashRowKey(null), 1300)
    return () => clearTimeout(timer)
  }, [flashRowKey])

  const columns = [
    {
      title: 'MateCode', dataIndex: 'materialCode', key: 'mateCode', width: 180,
      render: (v: string) => <Text code style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Group / Sub Group', key: 'grp', width: 150,
      render: (_: unknown, r: MaterialRecord) => (
        <Tag color="geekblue" style={{ margin: 0, fontSize: 13, whiteSpace: 'normal', height: 'auto' }}>
          {formatGroupSubgroupCode(r.groupId, r.subGroupCode)}
        </Tag>
      ),
    },
    {
      title: 'Material Name', key: 'mat', width: 280,
      render: (_: unknown, r: MaterialRecord) => (
        <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
          {formatCodeName((r as any).matNameCode, r.materialName)}
        </div>
      ),
    },
    {
      title: 'Spec', key: 'spec', width: 340, align: 'left' as const,
      render: (_: unknown, r: MaterialRecord) => (r.specCode || r.specDescription)
        ? <div style={{ fontSize: 13 }}>{formatCodeName(r.specCode, r.specDescription)}</div>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Brand', key: 'brand', width: 210,
      render: (_: unknown, r: MaterialRecord) => (r.brandCode || r.brandName)
        ? <div style={{ fontSize: 13 }}>{formatCodeName(r.brandCode, r.brandName)}</div>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Unit', key: 'unit', width: 170,
      render: (_: unknown, r: MaterialRecord) => (
        <div style={{ fontSize: 13 }}>{formatCodeName(r.unitCode, r.unitName)}</div>
      ),
    },
    {
      title: '', key: 'action', width: 140, fixed: 'right' as const,
      onCell: () => ({ style: { paddingRight: 24 } }),
      render: (_: unknown, r: MaterialRecord) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          disabled={!r.materialCode}
          onClick={(e) => { e.stopPropagation(); navigate(`/master/materials/${encodeURIComponent(r.materialCode)}/edit`) }}
        >
          รายละเอียด
        </Button>
      ),
    },
  ]

  const openEdit = (r: MaterialRecord) => { setEditing(r); editForm.setFieldsValue(r); setEditOpen(true) }
  const handleDelete = (key: string) => { setData(data.filter((d) => d.key !== key)); message.success('ลบรายการเรียบร้อย') }
  const handleEditOk = () => {
    editForm.validateFields().then((values) => {
      setData(data.map((d) => d.key === editing!.key ? { ...d, ...values } : d))
      message.success('แก้ไขเรียบร้อย')
      setEditOpen(false)
    })
  }

  const updateRow = (rowKey: string, patch: Partial<PendingRow>) =>
    setPendingRows((p) => p.map((r) => r.rowKey === rowKey ? { ...r, ...patch } : r))
  const removeRow = (rowKey: string) => setPendingRows((p) => p.filter((r) => r.rowKey !== rowKey))

  const [submitting, setSubmitting] = useState(false)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/materials/export`, {
        headers: authHeader,
        responseType: 'blob',
      })
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `materials_${dateStr}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Export ไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  // mat_code composition — mirrors project_handler.go's CreateMaterial exactly:
  // group_code + subgroup_code + mat_name_code + spec_code + brand_code + unit_code,
  // literal concatenation, no separators. spec_code/brand_code fall back to the same
  // '000' placeholder handleSubmitAll's own POST payload already uses when the user
  // left Spec/Brand unselected (those fields aren't required on this form, but the
  // backend's mat_code still needs *something* in that position).
  const buildMatCode = (r: PendingRow) =>
    [r.groupId, r.subGroupCode, r.materialCode, r.specCode.trim() || '000', r.brandCode.trim() || '000', r.unitCode].map((x) => x.trim()).join('')

  // Pre-submit duplicate check — calls the same GET /master/materials/{code} the
  // material detail/edit page already uses to look up one material by mat_code.
  // 200 = exists (duplicate), 404 = free to use. This is a courtesy check only;
  // the backend remains the authoritative guard (COUNT check + a real 23505 handler
  // on the INSERT itself for the race window between this check and the actual save).
  const checkDuplicateMatCodes = async (rows: PendingRow[]): Promise<string[]> => {
    const codes = rows.map(buildMatCode)
    const results = await Promise.all(codes.map(async (code) => {
      try {
        await axios.get(`${BASE_URL}/master/materials/${encodeURIComponent(code)}`, { headers: authHeader })
        return code // 200 → already exists
      } catch {
        return null // 404 (or any other error) → treat as not-a-known-duplicate here; backend still guards it
      }
    }))
    return results.filter((c): c is string => c !== null)
  }

  const handleSubmitAll = async () => {
    const rowsToSubmit = pendingRows.filter(isRealRow)
    if (rowsToSubmit.length === 0) { message.warning('กรุณาเพิ่มอย่างน้อย 1 รายการ'); return }

    const invalid = rowsToSubmit.some((r) =>
      !r.groupId || !r.subGroupCode || !r.subGroupName ||
      !r.materialCode || !r.materialName || !r.unitCode || !r.unitName
    )
    if (invalid) { message.warning('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบทุกรายการ'); return }

    setSubmitting(true)
    try {
      const duplicates = await checkDuplicateMatCodes(rowsToSubmit)
      if (duplicates.length > 0) {
        message.error(`รหัสวัสดุซ้ำกับที่มีอยู่แล้ว: ${duplicates.join(', ')}`)
        setSubmitting(false)
        return
      }

      // POST /master/materials takes ONE material object (CreateMaterial), so a
      // multi-row submit goes to the array-accepting POST /master/materials/bulk
      // (single transaction). Every field is a trimmed string — the backend
      // resolves/creates group/subgroup/name/spec/brand/unit by code, so no ids are
      // sent — and spec/brand fall back to the same '000' / '-' placeholders as
      // before because the backend rejects empty values for them.
      const t = (v?: string) => (v ?? '').trim()
      await axios.post(`${BASE_URL}/master/materials/bulk`,
        rowsToSubmit.map((r) => ({
          group_code:       t(r.groupId),
          subgroup_code:    t(r.subGroupCode),
          subgroup_name:    t(r.subGroupName),
          mat_name_code:    t(r.materialCode),
          mat_name_th:      t(r.materialName),
          spec_code:        t(r.specCode)        || '000',
          spec_description: t(r.specDescription) || '-',
          brand_code:       t(r.brandCode)       || '000',
          brand_name:       t(r.brandName)       || '-',
          unit_code:        t(r.unitCode),
          unit_name:        t(r.unitName),
        })),
        { headers: authHeader }
      )
      setPendingRows([newRow(true)])
      loadAllLookups() // newly created spec / brand / unit codes feed the next auto number
      message.success(`บันทึก ${rowsToSubmit.length} รายการเรียบร้อย`)
      setPage(1)
    } catch (err: any) {
      const data = err?.response?.data
      message.error(data?.message || data?.error || 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpload: UploadProps['beforeUpload'] = (file) => {
    const allowed = ['.csv', '.xlsx', '.xls']
    if (!allowed.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      message.error('รองรับเฉพาะไฟล์ .csv, .xlsx, .xls เท่านั้น')
      return false
    }
    readFileAsRows(file, groups)
      .then((rows) => {
        if (rows.length === 0) { message.error('ไม่พบข้อมูลในไฟล์ หรือไฟล์ไม่ถูกต้อง'); return }
        setParsedRows(rows)
        setUploadFileName(file.name)
        setImportPage(1)
        setFlashRowKey(null)
      })
      .catch((err: Error) => {
        if (err.name === MISSING_COLS_ERROR) {
          Modal.warning({
            title: 'ข้อมูลไม่ครบ โปรดตรวจสอบ',
            content: `คอลัมน์ที่ขาด: ${err.message}`,
            okText: 'ตกลง',
          })
        } else {
          message.error('เกิดข้อผิดพลาดในการอ่านไฟล์')
        }
      })
    return false
  }

  const handleConfirmImport = async () => {
    const valid = parsedRows.filter((r) => r.valid)
    if (valid.length === 0) { message.warning('ไม่มีรายการที่ถูกต้องสำหรับนำเข้า'); return }
    setImportSubmitting(true)
    try {
      const res = await axios.post(
        `${BASE_URL}/master/materials/bulk`,
        valid.map((r) => ({
          group_code:       r.groupCode,
          subgroup_code:    r.data.subGroupCode,
          subgroup_name:    r.data.subGroupName,
          mat_name_code:    r.data.materialCode,
          mat_name_th:      r.data.materialName,
          spec_code:        r.data.specCode,
          spec_description: r.data.specDescription,
          brand_code:       r.data.brandCode,
          brand_name:       r.data.brandName,
          unit_code:        r.data.unitCode,
          unit_name:        r.data.unitName,
        })),
        { headers: authHeader }
      )
      setParsedRows([])
      setUploadFileName('')
      message.success(`นำเข้าสำเร็จ ${res.data.count} รายการ`)
      await fetchMaterials()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'นำเข้าข้อมูลไม่สำเร็จ'
      message.error(msg)
    } finally {
      setImportSubmitting(false)
    }
  }

  const panelStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 14,
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0', overflow: 'hidden',
  }
  const panelHead: React.CSSProperties = {
    padding: '16px 20px', borderBottom: '1px solid #f3f4f6',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <PageHeader
        title="จัดการวัสดุ (Material)"
        subtitle="กำหนดรหัสและชื่อวัสดุ สเปค ยี่ห้อ และหน่วยตามกลุ่ม"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'วัสดุ' }]}
      />

      <div style={{ padding: '0 0 32px', overflowX: 'hidden' }}>

        {/* stats */}
        <Row gutter={[16, 12]} style={{ marginBottom: 20 }}>
          {[
            { label: 'รายการทั้งหมด', value: total, icon: <AppstoreOutlined />, color: '#3b82f6', bg: '#eff6ff' },
            { label: 'ใช้งานอยู่', value: total, icon: <CheckCircleOutlined />, color: '#10b981', bg: '#f0fdf4' },
            { label: 'Matcode ซ้ำ', value: duplicateCount, icon: <WarningOutlined />, color: '#ef4444', bg: '#fef2f2' },
          ].map((s) => (
            <Col xs={24} sm={8} key={s.label}>
              <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: s.color }}>{s.icon}</div>
                <Statistic title={<span style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</span>} value={s.value} valueStyle={{ fontSize: 22, fontWeight: 700, color: '#111827' }} />
              </div>
            </Col>
          ))}
        </Row>

        {/* records — block layout */}
        <div style={{ ...panelStyle, marginBottom: 20 }}>
          <div style={{ ...panelHead, flexWrap: 'wrap', gap: 10 }}>
            <Title level={5} style={{ margin: 0 }}>รายการวัสดุทั้งหมด</Title>
            <Space wrap>
              <Input
                allowClear
                prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                placeholder="ค้นหา Mat Code / ชื่อวัสดุ / สเปค"
                style={{ width: 260 }}
                value={searchInput}
                onChange={(e) => handleSearchInputChange(e.target.value)}
              />
              <Button icon={<FileExcelOutlined />} loading={exporting} onClick={handleExport}>
                Export Excel
              </Button>
            </Space>
          </div>
          {/* Lookup-field filter row — each Select's value is the master row's numeric
              id (not its code), matching what GET /master/allMaterial's *_id params expect. */}
          <div style={{ padding: '12px 20px 4px', borderBottom: '1px solid #f3f4f6' }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Select
                  allowClear placeholder="กลุ่ม (Group)" style={{ width: '100%' }}
                  options={groupOptions.map((g) => ({ value: Number(g.id), label: g.label }))}
                  value={filterGroupId} onChange={handleFilterGroupChange}
                  showSearch filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Select
                  allowClear placeholder="กลุ่มย่อย (Subgroup)" style={{ width: '100%' }}
                  loading={filterSubgroupLoading}
                  disabled={!filterGroupId}
                  options={filterSubgroupOptions.map((o) => ({ value: o.id, label: o.label }))}
                  value={filterSubgroupId} onChange={handleFilterSubgroupChange}
                  showSearch filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Select
                  allowClear placeholder="ชื่อวัสดุ (Mat Name)" style={{ width: '100%' }}
                  loading={filterMatNameLoading}
                  disabled={!filterSubgroupId}
                  options={filterMatNameOptions.map((o) => ({ value: o.id, label: o.label }))}
                  value={filterMatNameId} onChange={handleFilterMatNameChange}
                  showSearch filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Select
                  allowClear placeholder="สเปค (Spec)" style={{ width: '100%' }}
                  loading={filterSpecLoading}
                  disabled={!filterMatNameId}
                  options={filterSpecOptions.map((o) => ({ value: o.id, label: o.label }))}
                  value={filterSpecId} onChange={handleFilterSpecChange}
                  showSearch filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Select
                  allowClear placeholder="ยี่ห้อ (Brand)" style={{ width: '100%' }}
                  loading={filterBrandLoading}
                  disabled={!filterSpecId}
                  options={filterBrandOptions.map((o) => ({ value: o.id, label: o.label }))}
                  value={filterBrandId} onChange={handleFilterBrandChange}
                  showSearch filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Select
                  allowClear placeholder="หน่วย (Unit)" style={{ width: '100%' }}
                  options={filterUnitOptions.map((o) => ({ value: o.id, label: o.label }))}
                  value={filterUnitId} onChange={handleFilterUnitChange}
                  showSearch filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Col>
            </Row>
            <Row justify="end" style={{ marginTop: 8 }}>
              <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>ล้างตัวกรอง</Button>
            </Row>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table
              dataSource={data} columns={columns} size="middle"
              loading={loading}
              pagination={{
                current: page,
                pageSize: 10,
                total,
                showSizeChanger: false,
                showTotal: (t) => `ทั้งหมด ${t} รายการ`,
                onChange: (p) => setPage(p),
                responsive: true,
              }}
              rowKey="key" scroll={{ x: 1150 }}
              onRow={(r: MaterialRecord) => ({
                onClick: () => { if (r.materialCode) navigate(`/master/materials/${encodeURIComponent(r.materialCode)}/edit`) },
                style: { cursor: r.materialCode ? 'pointer' : undefined },
              })}
            />
          </div>
        </div>

        {/* insert rows */}
        <div style={panelStyle}>
          <div style={panelHead}>
            <div>
              <Title level={5} style={{ margin: 0 }}>เพิ่มรายการใหม่</Title>
              <Text style={{ fontSize: 12, color: '#9ca3af' }}>กรอกได้หลายรายการ แล้วกด "บันทึกทั้งหมด"</Text>
            </div>
            <Space>
              <Button icon={<PlusOutlined />} onClick={() => setPendingRows((p) => [...p, newRow()])}>เพิ่มแถว</Button>
            </Space>
          </div>

          <div style={{ padding: '16px 20px', boxSizing: 'border-box', minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              {(() => {
                let counter = 0
                return pendingRows.map((row) => {
                  const isExample = !!row.isTemplate && !isRowComplete(row)
                  if (!isExample) counter += 1
                  return (
                    <InsertRow key={row.rowKey} row={row} displayNumber={isExample ? undefined : counter}
                      groupOptions={groupOptions} specOptions={allSpecOptions} brandOptions={allBrandOptions}
                      unitOptions={allUnitOptions} allRows={pendingRows}
                      accessToken={accessToken}
                      onChange={updateRow} onRemove={removeRow} canRemove={pendingRows.length > 1} />
                  )
                })
              })()}
            </div>
            <Button block type="dashed" icon={<PlusOutlined />} style={{ marginTop: 4 }}
              onClick={() => setPendingRows((p) => [...p, newRow()])}>
              + เพิ่มแถวใหม่
            </Button>
            <Divider style={{ margin: '16px 0' }} />
            <div className="mm-actions">
              <>
                <Button onClick={() => setPendingRows([newRow(true)])}>ล้างทั้งหมด</Button>
                <Button type="primary" size="large" icon={<SaveOutlined />} onClick={handleSubmitAll} loading={submitting}
                  disabled={pendingRows.filter(isRealRow).length === 0}
                  style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', border: 'none', paddingLeft: 28, paddingRight: 28 }}>
                  บันทึกทั้งหมด ({pendingRows.filter(isRealRow).length} รายการ)
                </Button>
              </>
            </div>
          </div>
        </div>

        {/* upload panel */}
        <div style={{ ...panelStyle, marginTop: 20 }}>
          <div style={panelHead}>
            <div>
              <Title level={5} style={{ margin: 0 }}>อัปโหลดไฟล์เพื่ออัปเดตข้อมูล</Title>
              <Text style={{ fontSize: 12, color: '#9ca3af' }}>นำเข้าข้อมูลวัสดุจากไฟล์ Excel หรือ CSV ได้ครั้งละหลายรายการ</Text>
            </div>
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>ดาวน์โหลด Template (.xlsx)</Button>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <Upload.Dragger
              name="file" accept=".csv,.xlsx,.xls" showUploadList={false}
              beforeUpload={handleUpload}
              style={{ borderRadius: 10, borderColor: parsedRows.length ? '#3b82f6' : '#d1d5db', background: parsedRows.length ? '#eff6ff' : undefined }}
            >
              <div style={{ padding: parsedRows.length ? '10px 0' : '16px 0' }}>
                <p style={{ fontSize: parsedRows.length ? 24 : 36, color: parsedRows.length ? '#3b82f6' : '#9ca3af', margin: 0 }}>
                  <InboxOutlined />
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: parsedRows.length ? '#1d4ed8' : '#374151', margin: '6px 0 2px' }}>
                  {parsedRows.length ? `${uploadFileName} — คลิกเพื่อเลือกไฟล์ใหม่` : 'คลิกหรือลากไฟล์มาวางที่นี่'}
                </p>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                  รองรับไฟล์ <Text code>.xlsx</Text> <Text code>.xls</Text> <Text code>.csv</Text>
                </p>
              </div>
            </Upload.Dragger>

            {parsedRows.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 10px' }}>
                  <Space>
                    <Text strong style={{ fontSize: 13 }}>ตรวจสอบข้อมูล</Text>
                    <Tag color="blue" style={{ fontSize: 11 }}>{uploadFileName}</Tag>
                    <Tag color="success" style={{ fontSize: 11 }}>
                      <CheckOutlined /> ถูกต้อง {parsedRows.filter((r) => r.valid).length} รายการ
                    </Tag>
                    {parsedRows.some((r) => !r.valid) && (
                      <Tag
                        color="error"
                        style={{ fontSize: 11, cursor: 'pointer' }}
                        onClick={jumpToFirstError}
                      >
                        <WarningOutlined /> มีข้อผิดพลาด {parsedRows.filter((r) => !r.valid).length} รายการ
                      </Tag>
                    )}
                  </Space>
                </div>

                <Table
                  size="small"
                  dataSource={parsedRows.map((r, i) => ({ ...r, key: i }))}
                  pagination={parsedRows.length > IMPORT_PAGE_SIZE ? {
                    pageSize: IMPORT_PAGE_SIZE,
                    showSizeChanger: false,
                    current: importPage,
                    onChange: (page) => setImportPage(page),
                  } : false}
                  scroll={{ x: 800 }}
                  onRow={(r: ParsedRow & { key: number }) => ({
                    ref: (el: HTMLElement | null) => { importRowRefs.current[r.key] = el },
                  } as React.HTMLAttributes<HTMLElement>)}
                  rowClassName={(r: ParsedRow & { key: number }) =>
                    r.key === flashRowKey ? 'import-row-flash' : (r.valid ? '' : 'import-row-error')
                  }
                  columns={[
                    {
                      title: '#', key: 'no', width: 48, align: 'center' as const,
                      render: (_: unknown, r: ParsedRow) => (
                        <Text style={{ fontSize: 11, color: r.valid ? '#6b7280' : '#ef4444' }}>{r.row}</Text>
                      ),
                    },
                    { title: 'GroupCode', dataIndex: 'groupCode', width: 100 },
                    {
                      title: 'SubGroup', key: 'sub', width: 170,
                      render: (_: unknown, r: ParsedRow) => (
                        <div>
                          <Text code style={{ fontSize: 11 }}>{r.data.subGroupCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{r.data.subGroupName || <span style={{ color: '#f87171' }}>—</span>}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Material', key: 'mat', width: 200,
                      render: (_: unknown, r: ParsedRow) => (
                        <div>
                          <Text code style={{ fontSize: 11 }}>{r.data.materialCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 12 }}>{r.data.materialName || <span style={{ color: '#f87171' }}>—</span>}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Spec', key: 'spec', width: 300, align: 'left' as const,
                      render: (_: unknown, r: ParsedRow) => (
                        <div style={{ textAlign: 'left' }}>
                          <Text code style={{ fontSize: 13 }}>{r.data.specCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 13, color: '#6b7280' }}>{r.data.specDescription || ''}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Brand', key: 'brand', width: 130,
                      render: (_: unknown, r: ParsedRow) => (
                        <div>
                          <Text code style={{ fontSize: 11 }}>{r.data.brandCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{r.data.brandName || <span style={{ color: '#f87171' }}>—</span>}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Unit', key: 'unit', width: 110,
                      render: (_: unknown, r: MaterialRecord) => (
                        <div style={{ fontSize: 12 }}>{r.unitName}</div>
                      ),
                    },
                    {
                      title: 'Status', key: 'status', width: 220,
                      render: (_: unknown, r: ParsedRow) => r.valid
                        ? <Tag color="success" style={{ fontSize: 11 }}><CheckOutlined /> ถูกต้อง</Tag>
                        : <Tag color="error" icon={<WarningOutlined />} style={{ fontSize: 11, whiteSpace: 'normal', height: 'auto', lineHeight: '1.4' }}>{r.error}</Tag>,
                    },
                  ]}
                />

                <Row justify="end" style={{ marginTop: 12 }}>
                  <Space>
                    <Button onClick={() => { setParsedRows([]); setUploadFileName(''); setImportPage(1); setFlashRowKey(null) }}>ล้างข้อมูล</Button>
                    <Button
                      type="primary" icon={<CheckOutlined />}
                      loading={importSubmitting}
                      disabled={parsedRows.filter((r) => r.valid).length === 0}
                      onClick={handleConfirmImport}
                      style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', border: 'none' }}
                    >
                      ยืนยันนำเข้า ({parsedRows.filter((r) => r.valid).length} รายการ)
                    </Button>
                  </Space>
                </Row>
              </>
            )}
          </div>
        </div>
      </div>

      {/* edit modal */}
      <Modal title="แก้ไขรายการวัสดุ" open={editOpen} onOk={handleEditOk} onCancel={() => setEditOpen(false)}
        okText="บันทึก" cancelText="ยกเลิก" width={580}>
        <Divider style={{ margin: '12px 0' }} />
        <CascadeBreadcrumb steps={[
          { value: groupOptions.find((o) => o.value === editGroupId)?.name ?? '', placeholderLabel: 'กลุ่ม' },
          { value: editSubGroupName ?? '', placeholderLabel: 'กลุ่มย่อย' },
          { value: editMaterialName ?? '', placeholderLabel: 'ชื่อวัสดุ' },
          { value: editSpecDescription ?? '', placeholderLabel: 'สเปค' },
          { value: editBrandName ?? '', placeholderLabel: 'ยี่ห้อ' },
        ]} />
        <Form autoComplete="off" form={editForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="กลุ่ม" name="groupId" rules={[{ required: true, message: 'กรุณาเลือก' }]}>
                <Select options={groupOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, color: '#0284c7', margin: '0 0 12px' }}>กลุ่มย่อย</Divider>
          <Row gutter={12}>
            <Col span={10}><Form.Item label="รหัสกลุ่มย่อย" name="subGroupCode" rules={[{ required: true }]}><Input placeholder="SUB001" /></Form.Item></Col>
            <Col span={14}><Form.Item label="ชื่อกลุ่มย่อย" name="subGroupName" rules={[{ required: true }]}><Input placeholder="ชื่อกลุ่มย่อย" /></Form.Item></Col>
          </Row>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, color: '#4f46e5', margin: '0 0 12px' }}>วัสดุ</Divider>
          <Row gutter={12}>
            <Col span={10}><Form.Item label="รหัสวัสดุ" name="materialCode" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={14}><Form.Item label="ชื่อวัสดุ" name="materialName" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, color: '#7c3aed', margin: '0 0 12px' }}>สเปค</Divider>
          <Row gutter={12}>
            <Col span={10}><Form.Item label="รหัสสเปค" name="specCode"><Input /></Form.Item></Col>
            <Col span={14}><Form.Item label="คำอธิบายสเปค" name="specDescription"><Input /></Form.Item></Col>
          </Row>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, color: '#b45309', margin: '0 0 12px' }}>ยี่ห้อ</Divider>
          <Row gutter={12}>
            <Col span={10}><Form.Item label="รหัสยี่ห้อ" name="brandCode"><Input /></Form.Item></Col>
            <Col span={14}><Form.Item label="ชื่อยี่ห้อ" name="brandName"><Input /></Form.Item></Col>
          </Row>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, color: '#059669', margin: '0 0 12px' }}>หน่วย</Divider>
          <Row gutter={12}>
            <Col span={10}><Form.Item label="รหัสหน่วย" name="unitCode" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={14}><Form.Item label="ชื่อหน่วย" name="unitName" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Divider style={{ margin: '0 0 12px' }} />
          <Form.Item label="สถานะ" name="isActive">
            <Select options={[{ value: true, label: 'ใช้งาน' }, { value: false, label: 'ปิดใช้งาน' }]} style={{ width: 160 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default MaterialPage