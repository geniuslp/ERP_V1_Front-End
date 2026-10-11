import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal, Form, Input, InputNumber, Select, Switch, DatePicker, AutoComplete, Button, Row, Col, Space, Tooltip, Spin, message,
} from 'antd'
import { SearchOutlined, CloseOutlined } from '@ant-design/icons'
import axios from 'axios'
import './PettyCashLineModal.css'
import dayjs, { type Dayjs } from 'dayjs'
import { useAppSelector } from '@/store'
import MaterialPickerModal from '@/components/common/MaterialPickerModal'
import CostCodeSelectionModal, { type CostCodeItem } from '@/components/common/CostCodeSelectionModal'
import { formatItemLabel } from '@/utils/itemLabel'
import { isOhOrderType, OH_JOB_CODE } from '@/constants/orderTypes'
import type { Material } from '@/types'
import type { PettyCashLineForm, PettyCashLineOptions } from '@/types/pettyCash'
import { formatCostCodeDisplay } from '@/utils/costCode'
import LineSearchPicker, { type LinePickerOption } from './LineSearchPicker'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

export type PettyCashLineModalMode = 'add' | 'edit' | 'view'

interface Props {
  open: boolean
  mode: PettyCashLineModalMode
  initial: PettyCashLineForm | null
  headerProjectCode?: string
  /** Header order_type — drives the cost-code picker scope exactly like PR/PO (OH types → OH list, job 'G'). */
  headerOrderType?: string
  lineOptions: PettyCashLineOptions | null
  onOk: (line: PettyCashLineForm) => void
  onCancel: () => void
}

const TITLES: Record<PettyCashLineModalMode, string> = { add: 'เพิ่มรายการ', edit: 'แก้ไขรายการ', view: 'ดูรายการ' }

const panelStyle: React.CSSProperties = {
  border: '1px solid #dbeafe', borderRadius: 12, background: '#f8fbff', padding: 14, marginBottom: 12,
  width: '100%', boxSizing: 'border-box', minWidth: 0,
}
const panelTitleStyle: React.CSSProperties = { fontFamily: 'Sarabun', fontWeight: 700, color: '#1e3a8a', fontSize: 15 }
const NO_ID_NUMBER = 'ยังไม่มีข้อมูลในทะเบียนผู้ขาย'

const money = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const runes = (s: unknown) => [...String(s ?? '')].length
const maxRunes = (max: number, label: string) => ({
  validator: (_: unknown, v: unknown) =>
    runes(v) > max ? Promise.reject(new Error(`${label}ยาวเกินกำหนด (สูงสุด ${max} ตัวอักษร)`)) : Promise.resolve(),
})
const toDayjs = (s?: string | null): Dayjs | null => (s ? dayjs(s) : null)
const fromDayjs = (d?: Dayjs | null): string => (d ? d.format('YYYY-MM-DD') : '')

interface SupplierRow { id: number; supplier_name: string; tax_id?: string | null; address?: string | null }

// Same source as POCreatePage: GET /master/suppliers once, no params (the endpoint returns active rows only).
// Cached at module level so reopening the modal (or another line) does not refetch.
let costCodeCache: any[] | null = null
const loadCostCodes = async (token: string): Promise<any[]> => {
  if (costCodeCache) return costCodeCache
  const res = await axios.get(`${BASE_URL}/master/cost-code/full`, { headers: { Authorization: `Bearer ${token}` } })
  const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
  costCodeCache = Array.isArray(list) ? list : []
  return costCodeCache
}

// Same list the Cost Code picker modal shows: GET /master/cost-code/full, scope=oh for OH order types.
// The endpoint has no search term, so the type-ahead filters this cached list locally (as the modal does).
let costCodeOhCache: any[] | null = null
const loadCostCodesScoped = async (token: string, oh: boolean): Promise<any[]> => {
  if (!oh) return loadCostCodes(token)
  if (costCodeOhCache) return costCodeOhCache
  const res = await axios.get(`${BASE_URL}/master/cost-code/full`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { scope: 'oh' },
  })
  const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
  costCodeOhCache = Array.isArray(list) ? list : []
  return costCodeOhCache
}

// Called when a subgroup's Head flag changes (CostCodeJobTypeModal) so the next
// picker open refetches instead of serving a list from before the change.
export const clearPettyCashCostCodeCache = () => {
  costCodeCache = null
  costCodeOhCache = null
}

let supplierCache: SupplierRow[] | null = null
let supplierInflight: Promise<SupplierRow[]> | null = null

const PettyCashLineModal: React.FC<Props> = ({
  open, mode, initial, headerProjectCode, headerOrderType, lineOptions, onOk, onCancel,
}) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [form] = Form.useForm()
  const isView = mode === 'view'
  const vatRate = lineOptions?.vat_rate ?? 7

  const [materialOpen, setMaterialOpen] = useState(false)
  const [costOpen, setCostOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierRow[]>(supplierCache ?? [])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierOpen, setSupplierOpen] = useState(false)
  // Name of the registry supplier currently linked (to tell a real edit from the select echo).
  const selectedSupplierName = useRef('')
  // Scroll area + fade hints (top / bottom) toggled from scroll position.
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null)
  const [fade, setFade] = useState({ top: false, bottom: false })
  // WHT base follows `amount` until the user edits it.
  const baseTouched = useRef(false)

  const initialValues = useMemo(() => {
    const l = initial
    selectedSupplierName.current = l?.supplier_id != null ? l.supplier_name : ''
    baseTouched.current = !!l && l.has_wht && l.wht_base_amount != null && l.wht_base_amount !== l.amount
    return {
      mat_code: l?.mat_code ?? '',
      description: l?.description ?? '',
      cost_subgroup_id: l?.cost_subgroup_id ?? null,
      cost_code: l?.cost_code ?? '',
      cost_group_name: l?.cost_group_name ?? '',
      cost_subgroup_name: l?.cost_subgroup_name ?? '',
      supplier_id: l?.supplier_id ?? null,
      supplier_name: l?.supplier_name ?? '',
      supplier_address: l?.supplier_address ?? '',
      supplier_tax_id: l?.supplier_tax_id ?? '',
      remarks: l?.remarks ?? '',
      amount: l?.amount && l.amount > 0 ? l.amount : null,
      has_tax_invoice: l?.has_tax_invoice ?? false,
      tax_invoice_no: l?.tax_invoice_no ?? '',
      tax_invoice_date: toDayjs(l?.tax_invoice_date),
      has_wht: l?.has_wht ?? false,
      tax_form_code: l?.tax_form_code || undefined,
      wht_base_amount: l?.wht_base_amount ?? null,
      wht_income_type_id: l?.wht_income_type_id ?? undefined,
      wht_pay_date: toDayjs(l?.wht_pay_date),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, open])

  useEffect(() => {
    if (!bodyEl) return
    const update = () => {
      const top = bodyEl.scrollTop > 1
      const bottom = bodyEl.scrollTop + bodyEl.clientHeight < bodyEl.scrollHeight - 1
      setFade((f) => (f.top === top && f.bottom === bottom ? f : { top, bottom }))
    }
    update()
    bodyEl.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(bodyEl)
    if (bodyEl.firstElementChild) ro.observe(bodyEl.firstElementChild)
    return () => { bodyEl.removeEventListener('scroll', update); ro.disconnect() }
  }, [bodyEl])

  // Load the supplier master the first time the modal opens.
  useEffect(() => {
    if (!open || supplierCache) {
      if (open && supplierCache) setSuppliers(supplierCache)
      return
    }
    let cancelled = false
    setSuppliersLoading(true)
    supplierInflight ??= axios
      .get(`${BASE_URL}/master/suppliers`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        supplierCache = list as SupplierRow[]
        return supplierCache
      })
      .finally(() => { supplierInflight = null })
    supplierInflight
      .then((list) => { if (!cancelled) setSuppliers(list) })
      .catch(() => { if (!cancelled) message.error('โหลดรายชื่อผู้ขายไม่สำเร็จ') }) // free-text entry still works
      .finally(() => { if (!cancelled) setSuppliersLoading(false) })
    return () => { cancelled = true }
  }, [open, accessToken])

  const matCode: string = Form.useWatch('mat_code', { form, preserve: true }) ?? ''
  const costCode: string = Form.useWatch('cost_code', { form, preserve: true }) ?? ''
  const costGroupName: string = Form.useWatch('cost_group_name', { form, preserve: true }) ?? ''
  const costSubgroupName: string = Form.useWatch('cost_subgroup_name', { form, preserve: true }) ?? ''
  // Same name PR shows next to the code (subgroup name), group name as fallback.
  const costDisplayName = costSubgroupName || costGroupName
  const supplierId: number | null = Form.useWatch('supplier_id', { form, preserve: true }) ?? null
  const supplierTaxId: string = Form.useWatch('supplier_tax_id', { form, preserve: true }) ?? ''
  const amount: number = Form.useWatch('amount', { form, preserve: true }) ?? 0
  const hasInvoice: boolean = Form.useWatch('has_tax_invoice', { form, preserve: true }) ?? false
  const hasWht: boolean = Form.useWatch('has_wht', { form, preserve: true }) ?? false
  const whtBase: number = Form.useWatch('wht_base_amount', { form, preserve: true }) ?? 0
  const incomeTypeId: number | undefined = Form.useWatch('wht_income_type_id', { form, preserve: true })

  const incomeType = lineOptions?.wht_income_types.find((t) => t.id === incomeTypeId)
  const rate = incomeType?.rate ?? 0
  // Same formulas as the server (display rounding only).
  const vat = hasInvoice ? (amount * vatRate) / 100 : 0
  const wht = hasWht ? (whtBase * rate) / 100 : 0
  const net = amount + vat - wht

  const isOh = isOhOrderType(headerOrderType)
  const supplierLocked = supplierId != null

  // Fill cost_code / names from the cost-code list by subgroup id (used when a material payload or a
  // loaded line carries the id but no name).
  const fillCostNames = async (subgroupId: number) => {
    try {
      const list = await loadCostCodes(accessToken)
      const row = list.find((c: any) => (c.subgroup_id ?? c.id) === subgroupId)
      if (!row) return
      form.setFieldsValue({
        cost_code: form.getFieldValue('cost_code') || row.cost_code || '',
        cost_group_name: row.group_name ?? '',
        cost_subgroup_name: row.subgroup_name ?? '',
      })
    } catch { /* name stays blank */ }
  }

  useEffect(() => {
    if (open && initial?.cost_subgroup_id && !initial.cost_subgroup_name && !initial.cost_group_name) {
      fillCostNames(initial.cost_subgroup_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  // ── material ────────────────────────────────────────────────
  const handleMaterialConfirm = (materials: Material[]) => {
    setMaterialOpen(false)
    if (materials.length === 0) return
    if (materials.length > 1) message.warning('หนึ่งแถวเลือกวัสดุได้เพียงหนึ่งรายการ — ใช้รายการแรกที่เลือก')
    const m: any = materials[0]
    form.setFieldsValue({
      mat_code: m.mat_code,
      description: formatItemLabel(m.mat_name_th, m.spec_description),
    })
    // Same prefill as the old petty-cash row editor / PR: only when no cost code chosen yet.
    if (m.cost_subgroup_id && !form.getFieldValue('cost_subgroup_id')) {
      form.setFieldsValue({
        cost_subgroup_id: m.cost_subgroup_id,
        cost_code: m.cost_code ?? '',
        // The material payload may carry no cost-code name; then the name stays blank.
        cost_group_name: m.cost_group_name ?? '',
        cost_subgroup_name: m.cost_subgroup_name ?? '',
      })
      if (!m.cost_subgroup_name && !m.cost_group_name) fillCostNames(m.cost_subgroup_id)
    }
    form.validateFields(['description']).catch(() => undefined)
  }

  const handleCostSelect = (item: CostCodeItem) => {
    setCostOpen(false)
    form.setFieldsValue({
      cost_subgroup_id: item.subgroupId,
      cost_code: item.costCode,
      cost_group_name: item.groupName ?? '',
      cost_subgroup_name: item.subgroupName ?? '',
    })
  }

  // ── type-ahead search ──────────────────────────────────────
  // Material: same endpoint and params as MaterialPickerModal (GET /master/allMaterial, server-side
  // `q` over code / name / spec / brand), first 20 hits.
  const searchMaterials = async (term: string): Promise<LinePickerOption[]> => {
    const res = await axios.get(`${BASE_URL}/master/allMaterial`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page: 1, limit: 20, q: term, project_code: headerProjectCode || undefined },
    })
    const list: Material[] = Array.isArray(res.data) ? res.data : res.data?.data ?? []
    return list.map((m: any) => ({
      value: m.mat_code,
      label: m.mat_code,
      raw: m,
      render: (
        <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, flexShrink: 0 }}>{m.mat_code}</span>
          <span style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatItemLabel(m.mat_name_th, m.spec_description)}
          </span>
        </div>
      ),
    }))
  }

  // Cost code: contains-match on code / names over the (cached) cost-code list, first 30 hits.
  const searchCostCodes = async (term: string): Promise<LinePickerOption[]> => {
    const list = await loadCostCodesScoped(accessToken, isOh)
    const q = term.toLowerCase()
    return list
      .filter((c: any) =>
        [c.cost_code, formatCostCodeDisplay(c.cost_code), c.subgroup_code, c.subgroup_name, c.group_name]
          .some((f) => String(f ?? '').toLowerCase().includes(q)))
      .slice(0, 30)
      .map((c: any) => ({
        value: String(c.subgroup_id ?? c.id),
        label: formatCostCodeDisplay(c.cost_code),
        raw: c,
        render: (
          <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, flexShrink: 0 }}>{formatCostCodeDisplay(c.cost_code)}</span>
            <span style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.subgroup_name ?? c.group_name ?? ''}
            </span>
          </div>
        ),
      }))
  }

  // Picking a suggestion behaves exactly like confirming the corresponding picker modal.
  const pickMaterial = (m: Material) => handleMaterialConfirm([m])
  const pickCostCode = (c: any) =>
    handleCostSelect({
      subgroupId: c.subgroup_id ?? c.id,
      costCode: c.cost_code,
      subjectCode: c.subject_code,
      subjectName: c.subject_name,
      jobCode: c.job_code,
      jobName: c.job_name,
      groupCode: c.group_code,
      groupName: c.group_name,
      subgroupCode: c.subgroup_code,
      subgroupName: c.subgroup_name,
    })

  // ── supplier ────────────────────────────────────────────────
  const supplierOptions = useMemo(() => {
    if (suppliersLoading) {
      return [{ value: '__loading', disabled: true, label: <div style={{ textAlign: 'center' }}><Spin size="small" /></div> }]
    }
    const q = supplierQuery.trim().toLowerCase()
    const matches = suppliers.filter(
      (r) => !q || r.supplier_name.toLowerCase().includes(q) || String(r.tax_id ?? '').toLowerCase().includes(q),
    )
    const opts: any[] = matches.map((r) => ({
      key: String(r.id),
      value: r.supplier_name,
      row: r,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: 'Sarabun' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.supplier_name}</span>
          {r.tax_id && <span style={{ color: '#94a3b8', fontSize: 12, flexShrink: 0 }}>{r.tax_id}</span>}
        </div>
      ),
    }))
    const typed = supplierQuery.trim()
    if (typed && !suppliers.some((r) => r.supplier_name.toLowerCase() === typed.toLowerCase())) {
      opts.push({
        key: '__free',
        value: typed,
        freeText: true,
        label: <span style={{ color: '#1d4ed8', fontFamily: 'Sarabun' }}>ใช้ชื่อที่พิมพ์: {typed} (ผู้ขายนอกทะเบียน)</span>,
      })
    }
    return opts
  }, [suppliers, suppliersLoading, supplierQuery])

  const handleSupplierSelect = async (_v: string, option: any) => {
    setSupplierOpen(false)
    if (option.freeText || !option.row) {
      // Free-text vendor picked from the footer option: keep the typed name, no registry link.
      selectedSupplierName.current = ''
      form.setFieldsValue({ supplier_id: null })
      return
    }
    let row = option.row
    selectedSupplierName.current = row.supplier_name
    form.setFieldsValue({ supplier_id: row.id, supplier_name: row.supplier_name, supplier_address: row.address ?? '', supplier_tax_id: row.tax_id ?? '' })
    // List rows normally carry address / tax_id; fall back to the detail endpoint if they do not (like PO).
    if (row.address === undefined && row.tax_id === undefined) {
      try {
        const res = await axios.get(`${BASE_URL}/master/suppliers/${row.id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
        row = res.data?.data ?? res.data ?? row
        form.setFieldsValue({ supplier_address: row.address ?? '', supplier_tax_id: row.tax_id ?? '' })
      } catch { /* keep what the list row gave */ }
    }
  }

  const handleSupplierTyped = (text?: string) => {
    const t = text ?? ''
    setSupplierQuery(t)
    // A real edit (text differs from the selected supplier's name) drops the registry link and
    // unlocks address / tax id; the echo of a selection (same text) must not.
    if (form.getFieldValue('supplier_id') != null && t !== selectedSupplierName.current) {
      form.setFieldsValue({ supplier_id: null })
      selectedSupplierName.current = ''
    }
  }

  const handleSupplierClear = () => {
    selectedSupplierName.current = ''
    setSupplierQuery('')
    form.setFieldsValue({ supplier_id: null, supplier_name: '', supplier_address: '', supplier_tax_id: '' })
  }

  // ── form behaviour ──────────────────────────────────────────
  const handleValuesChange = (changed: Record<string, any>) => {
    if ('amount' in changed && !baseTouched.current) {
      form.setFieldValue('wht_base_amount', changed.amount ?? null)
    }
    if ('wht_base_amount' in changed) baseTouched.current = true
    if ('has_wht' in changed && changed.has_wht && !baseTouched.current) {
      form.setFieldValue('wht_base_amount', form.getFieldValue('amount') ?? null)
    }
  }

  const handleOk = async () => {
    try {
      await form.validateFields()
    } catch (err: any) {
      const first = err?.errorFields?.[0]
      if (first) {
        form.scrollToField(first.name, { behavior: 'smooth', block: 'center' })
        form.getFieldInstance?.(first.name)?.focus?.()
      }
      return
    }
    const v = form.getFieldsValue(true)
    const hasInv = !!v.has_tax_invoice
    const hasW = !!v.has_wht
    const amt = Number(v.amount ?? 0)
    const base = hasW ? Number(v.wht_base_amount ?? 0) : null
    const type = hasW ? lineOptions?.wht_income_types.find((t) => t.id === v.wht_income_type_id) : undefined
    const lineVat = hasInv ? (amt * vatRate) / 100 : 0
    const lineWht = hasW && base != null ? (base * (type?.rate ?? 0)) / 100 : 0
    const line: PettyCashLineForm = {
      key: initial?.key ?? `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      id: initial?.id,
      project_code: mode === 'edit' && initial ? initial.project_code : (headerProjectCode ?? ''),
      mat_code: v.mat_code ?? '',
      mat_name_th: v.mat_code ? (initial && initial.mat_code === v.mat_code ? initial.mat_name_th : v.description ?? '') : '',
      description: String(v.description ?? '').trim(),
      cost_subgroup_id: v.cost_subgroup_id ?? null,
      cost_code: v.cost_subgroup_id ? (v.cost_code ?? '') : '',
      cost_group_name: v.cost_subgroup_id ? (v.cost_group_name ?? '') : '',
      cost_subgroup_name: v.cost_subgroup_id ? (v.cost_subgroup_name ?? '') : '',
      remarks: v.remarks ?? '',
      amount: amt,
      supplier_id: v.supplier_id ?? null,
      supplier_name: v.supplier_name ?? '',
      supplier_address: v.supplier_address ?? '',
      supplier_tax_id: v.supplier_tax_id ?? '',
      // Switched-off sections are cleared so no stale data is kept.
      has_tax_invoice: hasInv,
      tax_invoice_no: hasInv ? String(v.tax_invoice_no ?? '').trim() : '',
      tax_invoice_date: hasInv ? fromDayjs(v.tax_invoice_date) : '',
      has_wht: hasW,
      wht_base_amount: hasW ? base : null,
      tax_form_code: hasW ? (v.tax_form_code ?? '') : '',
      wht_income_type_id: hasW ? (v.wht_income_type_id ?? null) : null,
      wht_income_label: hasW && type ? `${type.label_th} (${type.rate}%)` : '',
      wht_rate: hasW && type ? type.rate : null,
      wht_pay_date: hasW ? fromDayjs(v.wht_pay_date) : '',
      line_vat: lineVat,
      line_wht: lineWht,
      line_net: amt + lineVat - lineWht,
    }
    onOk(line)
  }

  return (
    <Modal
      open={open}
      title={<span style={{ fontFamily: 'Sarabun', color: '#1e3a8a' }}>{TITLES[mode]}</span>}
      width={1120}
      style={{ maxWidth: 'calc(100vw - 48px)' }}
      centered
      destroyOnClose
      onCancel={onCancel}
      styles={{
        content: { borderRadius: 12, boxShadow: '0 8px 30px rgba(15,45,94,0.18)' },
        body: { paddingTop: 8 },
      }}
      footer={
        <div>
          {/* Always-visible summary just above the buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', padding: '8px 4px 12px', textAlign: 'right' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              จำนวนเงิน {money(amount)} · VAT {money(vat)} · หัก ณ ที่จ่าย {money(wht)}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>ยอดเงินรวมทั้งหมด</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>฿ {money(net)}</span>
          </div>
          {isView ? (
            <Button onClick={onCancel}>ปิด</Button>
          ) : (
            <Space>
              <Button onClick={onCancel}>ยกเลิก</Button>
              <Button type="primary" onClick={handleOk}>ตกลง</Button>
            </Space>
          )}
        </div>
      }
    >
      <div style={{ position: 'relative' }}>
      <div
        ref={setBodyEl}
        className="pc-line-modal-body"
        tabIndex={0}
        style={{ maxHeight: 'calc(100vh - 220px)' }}
      >
      <Form
        form={form}
        layout="vertical"
        disabled={isView}
        initialValues={initialValues}
        onValuesChange={handleValuesChange}
      >
        {/* Row gutter uses -8px side margins; this padding keeps them inside the scroll box
            (that overflow was what produced the horizontal scrollbar). */}
        <div style={{ paddingInline: 8, boxSizing: 'border-box', minWidth: 0 }}>
        {/* Section 1 */}
        <Row gutter={16}>
          <Col xs={24} lg={6} style={{ minWidth: 0 }}>
            <Form.Item label="MatCode">
              <LineSearchPicker
                displayValue={matCode}
                placeholder="เลือกรหัสวัสดุ"
                disabled={isView}
                search={searchMaterials}
                debounceMs={300}
                onPick={pickMaterial}
                onOpenModal={() => setMaterialOpen(true)}
                onClear={() => form.setFieldValue('mat_code', '')}
              />
            </Form.Item>
          </Col>
          <Col xs={24} lg={18} style={{ minWidth: 0 }}>
            <Form.Item
              name="description"
              label="MatName"
              dependencies={['mat_code']}
              rules={[
                ({ getFieldValue }) => ({
                  validator: (_, v) =>
                    !getFieldValue('mat_code') && !String(v ?? '').trim()
                      ? Promise.reject(new Error('กรุณาระบุรหัสวัสดุหรือรายละเอียดรายการ'))
                      : Promise.resolve(),
                }),
                maxRunes(200, 'ชื่อรายการ'),
              ]}
            >
              <Input style={{ width: '100%', maxWidth: 560 }} placeholder="ชื่อรายการ (พิมพ์เองได้ถ้าไม่มีรหัสวัสดุ)" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} lg={6} style={{ minWidth: 0 }}>
            <Form.Item label="CostCode">
              <div style={{ width: '100%', maxWidth: 260 }}>
                <LineSearchPicker
                  displayValue={formatCostCodeDisplay(costCode)}
                  placeholder="เลือก Cost Code"
                  disabled={isView}
                  search={searchCostCodes}
                  debounceMs={0}
                  onPick={pickCostCode}
                  onOpenModal={() => setCostOpen(true)}
                  onClear={() => form.setFieldsValue({ cost_subgroup_id: null, cost_code: '', cost_group_name: '', cost_subgroup_name: '' })}
                />
              </div>
            </Form.Item>
          </Col>
          <Col xs={24} lg={8} style={{ minWidth: 0 }}>
            <Form.Item label="CostCodeName">
              <Tooltip title={costDisplayName || undefined}>
                <Input readOnly disabled value={costDisplayName} style={{ width: '100%', maxWidth: 340, textOverflow: 'ellipsis' }} />
              </Tooltip>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24} style={{ minWidth: 0 }}>
            <Form.Item
              name="supplier_name"
              label="ชื่อผู้ขาย"
              extra="พิมพ์ชื่อเองได้ถ้าไม่มีในทะเบียน"
              rules={[maxRunes(200, 'ชื่อผู้ขาย')]}
            >
              <AutoComplete
                style={{ width: '100%', maxWidth: 560 }}
                options={supplierOptions}
                open={supplierOpen}
                onFocus={() => { setSupplierQuery(''); setSupplierOpen(true) }}
                onDropdownVisibleChange={setSupplierOpen}
                onBlur={() => setSupplierOpen(false)}
                onSelect={handleSupplierSelect as any}
                onChange={handleSupplierTyped}
                onClear={handleSupplierClear}
                listHeight={280}
                popupMatchSelectWidth
                placeholder="เลือกหรือพิมพ์ชื่อผู้ขาย"
                allowClear
                disabled={isView}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24} style={{ minWidth: 0 }}>
            <Form.Item name="supplier_address" label="ที่อยู่">
              <Input.TextArea rows={2} style={{ width: '100%', maxWidth: 560 }} disabled={isView || supplierLocked} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24} style={{ minWidth: 0 }}>
            <Form.Item name="remarks" label="รายละเอียดเพิ่มเติม">
              <Input.TextArea rows={2} style={{ width: '100%', maxWidth: 560 }} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} lg={6} style={{ minWidth: 0 }}>
            <Form.Item
              name="amount"
              label="จำนวนเงิน"
              rules={[{
                validator: (_, v) => (Number(v ?? 0) > 0 ? Promise.resolve() : Promise.reject(new Error('จำนวนเงินต้องมากกว่า 0'))),
              }]}
            >
              <InputNumber
                min={0}
                precision={2}
                style={{ width: '100%' }}
                formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => Number((v ?? '').replace(/,/g, '')) as any}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Section 2 — tax invoice */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasInvoice ? 12 : 0 }}>
            <span style={panelTitleStyle}>ใบกำกับภาษี</span>
            <Form.Item name="has_tax_invoice" valuePropName="checked" noStyle><Switch /></Form.Item>
          </div>
          {hasInvoice && (
            <>
              <Row gutter={16}>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  <Form.Item
                    name="tax_invoice_no"
                    label="เลขที่ INV"
                    rules={[
                      { required: true, whitespace: true, message: 'กรุณาระบุเลขที่ใบกำกับภาษี' },
                      maxRunes(50, 'เลขที่ INV'),
                    ]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  <Form.Item name="tax_invoice_date" label="วันที่ใบ INV" rules={[{ required: true, message: 'กรุณาระบุวันที่ใบกำกับภาษี' }]}>
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  <Form.Item name="supplier_tax_id" label="เลขประจำตัวผู้เสียภาษี" rules={[maxRunes(50, 'เลขประจำตัวผู้เสียภาษี')]}>
                    <Input disabled={isView || supplierLocked} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  <Form.Item label="เลขประจำตัวประชาชน">
                    <Input disabled placeholder={NO_ID_NUMBER} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  <Form.Item label="ภาษีมูลค่าเพิ่ม"><Input disabled value={`${vatRate}%`} /></Form.Item>
                </Col>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  <Form.Item label="ยอดภาษีมูลค่าเพิ่ม"><Input readOnly value={money(vat)} style={{ textAlign: 'right' }} /></Form.Item>
                </Col>
              </Row>
            </>
          )}
        </div>

        {/* Section 3 — withholding tax */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasWht ? 12 : 0 }}>
            <span style={panelTitleStyle}>หัก ณ ที่จ่าย</span>
            <Form.Item name="has_wht" valuePropName="checked" noStyle><Switch /></Form.Item>
          </div>
          {hasWht && (
            <>
              <Row gutter={16}>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  <Form.Item name="tax_form_code" label="ประเภทภาษี" rules={[{ required: true, message: 'กรุณาเลือกประเภทภาษี (ภ.ง.ด.)' }]}>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="เลือกประเภทภาษี"
                      options={(lineOptions?.tax_forms ?? []).map((t) => ({ value: t.code, label: t.label_th }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  <Form.Item
                    name="wht_base_amount"
                    label="ยอดเงิน (หัก ณ ที่จ่าย)"
                    dependencies={['amount']}
                    rules={[({ getFieldValue }) => ({
                      validator: (_, v) => {
                        const n = Number(v ?? 0)
                        if (!(n > 0)) return Promise.reject(new Error('ยอดเงินหัก ณ ที่จ่ายต้องมากกว่า 0'))
                        if (n > Number(getFieldValue('amount') ?? 0)) return Promise.reject(new Error('ยอดเงินหัก ณ ที่จ่ายต้องไม่เกินจำนวนเงิน'))
                        return Promise.resolve()
                      },
                    })]}
                  >
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(v) => Number((v ?? '').replace(/,/g, '')) as any}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  {/* Shared with section 2: one value. Editable here only for a free-text vendor
                      when the invoice section (where it is normally entered) is off. */}
                  {!hasInvoice && !supplierLocked && !isView ? (
                    <Form.Item name="supplier_tax_id" label="เลขประจำตัวผู้เสียภาษี" rules={[maxRunes(50, 'เลขประจำตัวผู้เสียภาษี')]}>
                      <Input />
                    </Form.Item>
                  ) : (
                    <Form.Item label="เลขประจำตัวผู้เสียภาษี"><Input readOnly value={supplierTaxId} /></Form.Item>
                  )}
                </Col>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  <Form.Item label="เลขประจำตัวประชาชน"><Input disabled placeholder={NO_ID_NUMBER} /></Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} lg={8} style={{ minWidth: 0 }}>
                  <Form.Item name="wht_income_type_id" label="ประเภทหัก ณ ที่จ่าย" rules={[{ required: true, message: 'กรุณาเลือกประเภทหัก ณ ที่จ่าย' }]}>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="เลือกประเภทหัก ณ ที่จ่าย"
                      options={(lineOptions?.wht_income_types ?? []).map((t) => ({ value: t.id, label: `${t.label_th} (${t.rate}%)` }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4} style={{ minWidth: 0 }}>
                  <Form.Item label="ภาษีหัก ณ ที่จ่าย %"><Input readOnly value={incomeType ? `${rate}%` : ''} /></Form.Item>
                </Col>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  <Form.Item label="ยอดหัก ณ ที่จ่ายรวม"><Input readOnly value={money(wht)} style={{ textAlign: 'right' }} /></Form.Item>
                </Col>
                <Col xs={24} lg={6} style={{ minWidth: 0 }}>
                  <Form.Item name="wht_pay_date" label="วันที่ทำจ่าย">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </div>
        </div>
      </Form>
      </div>
      <div className="pc-line-modal-fade pc-line-modal-fade-top" style={{ opacity: fade.top ? 1 : 0 }} />
      <div className="pc-line-modal-fade pc-line-modal-fade-bottom" style={{ opacity: fade.bottom ? 1 : 0 }} />
      </div>

      <MaterialPickerModal
        open={materialOpen}
        onClose={() => setMaterialOpen(false)}
        onConfirm={handleMaterialConfirm}
        projectCode={headerProjectCode || undefined}
      />
      <CostCodeSelectionModal
        open={costOpen}
        onClose={() => setCostOpen(false)}
        onSelect={handleCostSelect}
        ohOnly={isOh}
        jobTypeCode={isOh ? OH_JOB_CODE : undefined}
      />
    </Modal>
  )
}

export default PettyCashLineModal
