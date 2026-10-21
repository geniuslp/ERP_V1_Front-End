import React, { useEffect, useRef, useState } from 'react'
import { useProjectOptions } from '@/hooks/useProjectOptions'
import {
  Card, Form, Input, InputNumber, DatePicker, Select, Button, Row, Col, Tabs, Modal, message, Spin,
} from 'antd'
import { SaveOutlined, SendOutlined, CloseOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import WorkOrderPrintTrigger from '@/components/workOrder/WorkOrderPrintTrigger'
import WOItemsTable, { type WOLineItem } from '@/components/workOrder/WOItemsTable'
import WOPaymentConditionsSection, {
  toInstallmentRow, toRetentionRow, toPenaltyRow, buildPaymentConditionsPayload,
  type InstallmentRow, type RetentionRow, type PenaltyRow,
} from '@/components/workOrder/WOPaymentConditionsSection'
import TaxSidebarPanel from '@/pages/po/components/TaxSidebarPanel'
import { useAppSelector } from '@/store'
import { workOrderService } from '@/services/workOrderService'
import { WO_WORK_SYSTEM_LABEL, WO_CONTRACT_TYPE_OPTIONS, WO_CONTRACT_DESCRIPTION_LABEL } from '@/types/workOrder'
import type { WorkOrderPayload, WorkOrderLine } from '@/types/workOrder'
import { numberToThaiText } from '@/utils/thaiBahtText'
import { WAREHOUSE_PROJECT_CODES } from '@/constants/warehouseProjects'
import { useJobTypes } from '@/hooks/useJobTypeNames'
import { formatApproverOption } from '@/utils/formatApproverOption'

// "เจ้าของโครงการ (ผู้ว่าจ้าง)" — only the head-office option is offered; sent as employer_name.
const EMPLOYER_HEAD_OFFICE = 'บริษัท จีเนียส เอนจิเนียริ่ง (สำนักงานใหญ่) จำกัด'

// project_choice (form-only field) holds either an existing project_code or, for typed free
// text, PROJECT_TEXT_PREFIX + the text. buildPayload turns it into project_code XOR project_name_text.
const PROJECT_TEXT_PREFIX = '__text__:'

// เงินล่วงหน้า/เงินประกันผลงาน/ค่าปรับ ย้ายไปเป็นรายการแบบตารางที่ทำซ้ำได้ใน
// WOPaymentConditionsSection แล้ว (งวดงาน/เงินประกัน/ค่าปรับ) — ตัด advance_pct,
// advance_amount, retention_pct, penalty_pct_per_day, progress_payment_note
// ออกจากฟอร์มนี้ (ยังไม่แตะ column เดิมใน DB/backend). ADVANCE_PCT_OPTIONS ยังใช้
// กับ advance_deduct_pct ("หักคืนเงินล่วงหน้า") อยู่ จึงคงไว้ — RETENTION_PCT_OPTIONS
// เคยใช้กับ retention_pct เพียงจุดเดียว ตัดออกไปพร้อมกัน.
const ADVANCE_PCT_VALUES = [5, 10, 15, 20, 30]
const ADVANCE_PCT_OPTIONS = ADVANCE_PCT_VALUES.map((v) => ({ value: v, label: `${v}%` }))

const MENU_CODE = 'MENU_WO_CREATE'
const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const labelStyle: React.CSSProperties = { color: '#374151', fontSize: 13 }

// Grid-based field sizing (antd 24-col grid): every normal field sits in
// <Col {...FIELD_SPAN}> (4 per row on md+, 2 on sm, 1 on xs); wide fields use a
// multiple of the same unit (12 on md+), full-row items use span 24.
const FIELD_SPAN = { xs: 24, sm: 12, md: 6 }
const FIELD_SPAN_WIDE = { xs: 24, sm: 24, md: 12 }
// Fields fill their column exactly; the column decides the width.
const fieldStyle: React.CSSProperties = { width: '100%', borderRadius: 8 }

interface SupplierOption {
  id: number
  supplier_name: string
}

interface ProjectOption {
  value: string
  label: string
  name: string
}

const WorkOrderCreatePage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  // Edit-after-approval: WOEditApprovedButton passes the mandatory reason via router state.
  const editApprovedReason = (useLocation().state as { editApprovedReason?: string } | null)?.editApprovedReason
  const isEdit = !!id
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  // Status of the loaded document (edit mode). PENDING_APPROVAL keeps its status on save.
  const [loadedStatus, setLoadedStatus] = useState<string | undefined>()
  // contract_amount as loaded from the API: outside edit-approved mode it is a floor (cannot be lowered).
  const [loadedContractAmount, setLoadedContractAmount] = useState<number | undefined>()

  // Eligible approvers — same endpoint/shape as POCreatePage, doc_type 'WO'.
  const [approvers, setApprovers] = useState<{ value: number; label: string; dept?: string; username?: string; name?: string }[]>([])
  const [approversLoading, setApproversLoading] = useState(false)
  useEffect(() => {
    if (!accessToken) return
    const fetchApprovers = async () => {
      setApproversLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/eligible-approvers`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { doc_type: 'WO' },
        })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        // Coerce to Number: the form value is a Number and Select matches option values with ===.
        setApprovers(list.map((u: any) => ({
          value: Number(u.value ?? u.id),
          label: formatApproverOption(u.username, u.value ?? u.id),
          dept: u.dept ?? u.department,
          username: u.username,
          name: u.full_name ?? u.label ?? u.fullName,
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.response?.data?.error || 'โหลดรายชื่อผู้อนุมัติไม่สำเร็จ')
      } finally {
        setApproversLoading(false)
      }
    }
    fetchApprovers()
  }, [accessToken])

  // Two tabs share this one Form instance (tab panes stay mounted via forceRender). In create
  // mode the WO id only exists after the first Tab 1 save; it is kept here instead of navigating
  // away, and Tab 2 stays disabled until then.
  const [activeTab, setActiveTab] = useState<'header' | 'items'>('header')
  const [createdId, setCreatedId] = useState<number | string | undefined>(undefined)
  const woId: number | string | undefined = id ?? createdId
  const isEditApproved = !!editApprovedReason && (loadedStatus === 'APPROVED' || loadedStatus === 'PENDING_REAPPROVAL')
  // Editing an existing, not-yet-approved WO: the contract amount may not go below the loaded value.
  // Edit-approved mode (and create) has no floor.
  const contractFloor: number | undefined = isEdit && !isEditApproved ? loadedContractAmount : undefined
  const CONTRACT_LOWER_MSG = 'การลดมูลค่าสัญญาทำได้เฉพาะการแก้ไขหลังอนุมัติ'

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)

  // Live Thai baht-text readout under มูลค่าสัญญา — purely derived, never sent to backend.
  const [contractAmountText, setContractAmountText] = useState('')
  const updateContractAmountText = (v: number | null) => {
    setContractAmountText(v ? numberToThaiText(v) : '')
  }

  // Stored work_system values that aren't M-codes (legacy P/E/S) — kept as selectable
  // options so the multi-select still shows them as tags for old documents.
  const [legacyWorkSystem, setLegacyWorkSystem] = useState<string[]>([])
  const jobTypes = useJobTypes()
  const [projectSearch, setProjectSearch] = useState('')
  const projectChoice: string | undefined = Form.useWatch('project_choice', form)
  // Project dropdown: GET /master/projects/options (all ACTIVE projects); the WO's own project is merged in when it is CLOSED/INACTIVE.
  const { options: projects, loading: projectsLoading } = useProjectOptions(
    {}, projectChoice && !projectChoice.startsWith(PROJECT_TEXT_PREFIX) ? projectChoice : undefined)
  const employerName: string | undefined = Form.useWatch('employer_name', form)

  // Project-change guard. Select.onChange only fires on user interaction (not on edit-mode
  // setFieldsValue or on the revert below), so the initial load and a revert never re-trigger
  // it. prevProjectRef still holds the OLD value while onChange runs (it is synced in the
  // effect after the render), and confirmOpenRef stops a second modal stacking up.
  const prevProjectRef = useRef<string | undefined>(undefined)
  const confirmOpenRef = useRef(false)
  useEffect(() => { prevProjectRef.current = projectChoice }, [projectChoice])
  const handleProjectChange = (next?: string) => {
    const prev = prevProjectRef.current
    if (next === prev || !items.some((it) => it.cost_code)) return
    if (confirmOpenRef.current) return
    confirmOpenRef.current = true
    Modal.confirm({
      title: 'เปลี่ยนโปรเจกต์?',
      content: 'รายการ Cost Code ที่เลือกไว้จะถูกล้างทั้งหมด',
      okText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      onOk: () => { confirmOpenRef.current = false; setItems([]) },
      onCancel: () => { confirmOpenRef.current = false; form.setFieldValue('project_choice', prev) },
    })
  }
  // Contract value (ไม่รวม VAT) is the base for the 7.1 / 7.3 percentage amounts.
  const watchedContractAmount: number | undefined = Form.useWatch('contract_amount', form)
  const watchedAdvancePct: number | undefined = Form.useWatch('advance_deduct_pct', form)
  // 7.1: the amount (advance_deduct_amount) is the stored value. Create / user-picked %: amount =
  // contract * % / 100. Edit mode keeps a loaded amount fixed when the contract value changes, and the
  // displayed % is derived from it (amount / contract * 100).
  const watchedAdvanceAmount: number | undefined = Form.useWatch('advance_deduct_amount', form)
  const advanceAmount = Number(watchedAdvanceAmount) || 0
  const contractBase = Number(watchedContractAmount) || 0
  const displayedAdvancePct = contractBase > 0 ? Math.round((advanceAmount / contractBase * 100 + Number.EPSILON) * 100) / 100 : 0
  const advancePctOption = ADVANCE_PCT_VALUES.find((v) => Math.abs(v - displayedAdvancePct) < 0.01)
  const advanceExceeds = advanceAmount > contractBase
  const calcAdvanceAmount = (contract: number, pct: number) => Math.round((contract * pct / 100 + Number.EPSILON) * 100) / 100
  // Create mode: the amount follows the selected % when the contract value changes.
  useEffect(() => {
    if (isEdit) return
    form.setFieldValue('advance_deduct_amount', calcAdvanceAmount(contractBase, Number(form.getFieldValue('advance_deduct_pct')) || 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractBase, isEdit])

  // Default wht_rate by contract_type, from GET /work-order/wht-defaults (backend is the
  // source of truth). Until it loads / if it fails, 3 is used — the pre-existing line default.
  const [whtDefaults, setWhtDefaults] = useState<Record<string, number>>({})
  const contractType: string | undefined = Form.useWatch('contract_type', form)
  const defaultWhtRate = (contractType && whtDefaults[contractType]) || 3

  // Last signer value this page filled in from sales_person — lets a later supplier change
  // replace its own auto-fill but never anything the user typed or a saved value.
  const lastAutoSigner = useRef<string | null>(null)

  // Cost-code line items — full editable table (WOItemsTable), mirroring PO's
  // POItemsTable + TaxSidebarPanel exactly (per explicit instruction to reuse
  // rather than rebuild): items are frontend-only row state, stripped down to
  // WorkOrderLine's submit shape in buildPayload; discount/VAT/WHT are the
  // same header-level toggle flags + per-line values PO uses, not new fields
  // invented independently.
  const [items, setItems] = useState<WOLineItem[]>([])
  const [taxOpen, setTaxOpen] = useState(false)
  const [useDisc, setUseDisc] = useState(false)
  const [discType, setDiscType] = useState<'pct' | 'amt'>('pct')
  const [useVat, setUseVat] = useState(false)
  const [useWht, setUseWht] = useState(false)

  // Payment-conditions rows (งวดงาน/เงินประกัน/ค่าปรับ) — same "plain React state,
  // stripped to submit shape only inside handleSave" pattern as `items` above.
  // Editable from page load even with no WO id yet; the follow-up
  // POST /work-order/:woId/payment-conditions only happens once handleSave has a
  // real id (see handleSave below) — see WOPaymentConditionsSection's own comment.
  const [installments, setInstallments] = useState<InstallmentRow[]>([])
  const [retentions, setRetentions] = useState<RetentionRow[]>([])
  const [penalties, setPenalties] = useState<PenaltyRow[]>([])

  useEffect(() => {
    const fetchSuppliers = async () => {
      setSuppliersLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/suppliers`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setSuppliers(list.map((s: any) => ({
          id: s.id,
          supplier_name: s.supplier_name,
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลผู้รับจ้างไม่สำเร็จ')
      } finally {
        setSuppliersLoading(false)
      }
    }
    fetchSuppliers()
  }, [accessToken])


  useEffect(() => {
    if (!accessToken) return
    axios.get(`${BASE_URL}/work-order/wht-defaults`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        const body = res.data?.data ?? res.data
        const list: { contract_type: string; default_wht_rate: number }[] = Array.isArray(body?.contract_types) ? body.contract_types : []
        setWhtDefaults(Object.fromEntries(list.map((c) => [c.contract_type, Number(c.default_wht_rate)])))
      })
      .catch(() => { /* keep the line-level fallback */ })
  }, [accessToken])

  // Header "อัตราหัก ณ ที่จ่าย": follows the contract_type default only while the user has not
  // edited it. Line rates need no rewrite — untouched lines read defaultWhtRate directly and
  // lines with an explicit rate (user-picked or saved) are never changed.
  const applyHeaderWhtDefault = (type: string | undefined, defaults: Record<string, number>) => {
    if (!type || defaults[type] === undefined || form.isFieldTouched('wht_rate')) return
    form.setFieldValue('wht_rate', defaults[type])
  }
  useEffect(() => {
    if (!isEdit) applyHeaderWhtDefault(form.getFieldValue('contract_type'), whtDefaults)
  }, [whtDefaults])

  // Project options: warehouse projects are excluded (except one already selected on an old
  // document); the typed text / current free-text value is offered as its own option.
  const currentProjectCode = projectChoice && !projectChoice.startsWith(PROJECT_TEXT_PREFIX) ? projectChoice : undefined
  const projectOptions: { value: string; label: string }[] = projects.filter(
    (p) => !WAREHOUSE_PROJECT_CODES.includes(p.value) || p.value === currentProjectCode,
  )
  const typedText = projectSearch.trim()
  const textOptions: { value: string; label: string }[] = []
  if (projectChoice?.startsWith(PROJECT_TEXT_PREFIX)) {
    textOptions.push({ value: projectChoice, label: projectChoice.slice(PROJECT_TEXT_PREFIX.length) })
  }
  if (typedText && !projects.some((p) => p.label === typedText) && !textOptions.some((o) => o.value === PROJECT_TEXT_PREFIX + typedText)) {
    textOptions.push({ value: PROJECT_TEXT_PREFIX + typedText, label: typedText })
  }

  // Picking a supplier auto-fills supplier_name + signatory/address/phone from the
  // supplier master (fields stay editable afterward). Mapping: contact_person ←
  // sales_person, supplier_address ← address, supplier_phone ← sales_person_phone
  // (falls back to office_phone). `?? null`, not undefined: setFieldsValue ignores
  // undefined, which would leave the previous supplier's values on screen.
  const handleSupplierChange = async (supplierId: number) => {
    const picked = suppliers.find((s) => s.id === supplierId)
    form.setFieldValue('supplier_name', picked?.supplier_name ?? null)
    if (!supplierId) return
    try {
      const res = await axios.get(`${BASE_URL}/master/suppliers/${supplierId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const raw = res.data?.data ?? res.data
      // Signer: prefill from sales_person only when empty or still holding our own previous
      // auto-fill — never over typed or saved text.
      const salesPerson: string | null = raw?.sales_person ?? null
      const currentSigner: string | undefined = form.getFieldValue('contact_person')
      if (!currentSigner || currentSigner === lastAutoSigner.current) {
        form.setFieldValue('contact_person', salesPerson)
        lastAutoSigner.current = salesPerson
      }
      form.setFieldsValue({
        supplier_name: raw?.supplier_name ?? picked?.supplier_name ?? null,
        supplier_address: raw?.address ?? null,
        supplier_phone: raw?.sales_person_phone ?? raw?.office_phone ?? null,
      })
    } catch {
      // Non-fatal — contact fields just stay whatever they were / blank.
    }
  }

  useEffect(() => {
    if (!isEdit || !id) return
    const fetchDetail = async () => {
      setLoading(true)
      try {
        const wo = await workOrderService.get(accessToken, id)
        const afterApproval = wo.status === 'APPROVED' || wo.status === 'PENDING_REAPPROVAL'
        if (wo.status === 'CANCELLED' || (afterApproval && !editApprovedReason)) {
          message.warning('ไม่สามารถแก้ไขหนังสือสั่งจ้างที่อนุมัติแล้วหรือยกเลิกแล้ว')
          navigate(`/work-order/${id}`, { replace: true })
          return
        }
        setLoadedStatus(wo.status)
        setLoadedContractAmount(wo.contract_amount != null ? Number(wo.contract_amount) : undefined)
        const storedSystems: string[] = Array.isArray(wo.work_system) ? wo.work_system : (wo.work_system ? [wo.work_system as unknown as string] : [])
        setLegacyWorkSystem(storedSystems.filter((v) => !v.startsWith('M')))
        form.setFieldsValue({
          ...wo,
          approver_id: wo.approver_id != null ? Number(wo.approver_id) : undefined,
          // Legacy rows without a stored amount: derive it once from the saved %.
          advance_deduct_amount: wo.advance_deduct_amount
            ?? Math.round(((Number(wo.contract_amount) || 0) * (Number(wo.advance_deduct_pct) || 0) / 100 + Number.EPSILON) * 100) / 100,
          project_choice: wo.project_code
            ? wo.project_code
            : wo.project_name_text ? PROJECT_TEXT_PREFIX + wo.project_name_text : undefined,
          // Old rows may hold a dropdown code (e.g. RENOVATION): shown as its Thai text.
          contract_description: wo.contract_description
            ? (WO_CONTRACT_DESCRIPTION_LABEL[wo.contract_description as keyof typeof WO_CONTRACT_DESCRIPTION_LABEL] ?? wo.contract_description)
            : wo.contract_description,
          work_system: Array.isArray(wo.work_system) ? wo.work_system : (wo.work_system ? [wo.work_system as unknown as string] : []),
          wo_date: wo.wo_date ? dayjs(wo.wo_date) : undefined,
          start_date: wo.start_date ? dayjs(wo.start_date) : undefined,
          end_date: wo.end_date ? dayjs(wo.end_date) : undefined,
        })
        // Backend only returns the raw cost_code per line, not subgroup names —
        // display falls back to the code itself (cost_code_label stays null).
        setItems((wo.lines ?? []).map((l, i) => ({
          key: `existing-${i}-${l.cost_code}`,
          no: i + 1,
          cost_code: l.cost_code,
          cost_code_label: l.cost_code,
          description: l.description ?? '',
          qty: l.qty,
          unit_price: l.unit_price,
          disc: l.disc ?? 0,
          disc_type: l.disc_type ?? 'pct',
          wht_rate: (l.wht_rate as 1 | 3 | 5 | null) ?? null,
        })))
        setUseDisc(Boolean(wo.use_discount))
        setDiscType(wo.discount_type === 'amt' ? 'amt' : 'pct')
        setUseVat(Boolean(wo.use_vat))
        setUseWht(Boolean(wo.use_wht))
        updateContractAmountText(wo.contract_amount ?? null)
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()

    // Payment conditions are a separate resource (GET /work-order/:woId/payment-conditions)
    // fetched alongside the WO itself in edit mode only — a brand-new WO has no id to fetch
    // against yet, so its 3 tables just start empty (see the state declarations above).
    const fetchPaymentConditions = async () => {
      try {
        const data = await workOrderService.getPaymentConditions(accessToken, id)
        setInstallments(data.installments.map(toInstallmentRow))
        setRetentions(data.retentions.map(toRetentionRow))
        setPenalties(data.penalties.map(toPenaltyRow))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดเงื่อนไขการจ่ายเงินไม่สำเร็จ')
      }
    }
    fetchPaymentConditions()
  }, [isEdit, id, accessToken])

  // start_date + duration_days -> end_date, auto-calculated but user-overridable
  // (re-running this only on start_date/duration_days change, never clobbering a
  // manual end_date edit unless one of those two changes again).
  const recalcEndDate = () => {
    const start = form.getFieldValue('start_date')
    const duration = form.getFieldValue('duration_days')
    if (start && duration) {
      form.setFieldValue('end_date', dayjs(start).add(Number(duration), 'day'))
    }
  }

  // PO's create page sends `status` inline as part of the create/update payload to
  // switch between draft-save and submit-for-approval (no separate submit endpoint) —
  // mirrored here since the WO backend contract only lists POST / and PUT /:id, no
  // dedicated submit route. Flag for backend confirmation that `status` in the WO
  // create/update body is the intended trigger, same as PO.
  // Exactly one of project_code / project_name_text (the other is explicitly cleared so an
  // edit-mode seed from the loaded record can't send both).
  const resolveProject = (choice?: string) => {
    if (!choice) return { project_code: undefined, project_name_text: undefined, project_name: undefined }
    if (choice.startsWith(PROJECT_TEXT_PREFIX)) {
      return { project_code: undefined, project_name_text: choice.slice(PROJECT_TEXT_PREFIX.length).trim(), project_name: undefined }
    }
    return { project_code: choice, project_name_text: undefined, project_name: projects.find((p) => p.value === choice)?.name }
  }

  // includeLines=false omits the `lines` key entirely (never `[]`: an empty array deletes all lines).
  const buildPayload = (submitForApproval: boolean, includeLines: boolean): WorkOrderPayload & { status: string } => {
    // advance_pct/advance_amount/retention_pct/penalty_pct_per_day/progress_payment_note
    // no longer have Form.Items (replaced by WOPaymentConditionsSection's repeatable
    // tables), but edit-mode's initial form.setFieldsValue({ ...wo }) still seeds them
    // into the antd form store from the loaded record — getFieldsValue() would silently
    // resurrect and resubmit those stale values without this explicit strip.
    // supplier_code / project_name are response-only: work_order has no supplier_code
    // (send supplier_id only), and edit-mode's ...wo seed puts both into the store.
    const {
      advance_pct, advance_amount, retention_pct, penalty_pct_per_day, progress_payment_note,
      supplier_code, project_name, project_choice,
      // Edit-mode's ...wo seed also put the raw loaded `lines` into the form store; always strip
      // it here and re-add from `items` only when includeLines is set.
      lines: _seededLines,
      ...v
    } = form.getFieldsValue()
    const header = {
      ...v,
      // Persist the % that 7.1 actually displays (derived from the fixed amount).
      advance_deduct_pct: displayedAdvancePct,
      advance_deduct_amount: advanceAmount,
      ...resolveProject(project_choice),
      wo_date: v.wo_date ? dayjs(v.wo_date).format('YYYY-MM-DD') : undefined,
      start_date: v.start_date ? dayjs(v.start_date).format('YYYY-MM-DD') : undefined,
      end_date: v.end_date ? dayjs(v.end_date).format('YYYY-MM-DD') : undefined,
      // PENDING_APPROVAL stays PENDING_APPROVAL on save (approver kept unless the user changed it).
      status: loadedStatus === 'PENDING_APPROVAL' || submitForApproval ? 'PENDING_APPROVAL' : 'DRAFT',

      // ── Tax (flat — mirrors POCreatePage's buildPayload exactly) ──
      use_discount: useDisc,
      discount_type: discType,
      use_vat: useVat,
      use_wht: useWht,
    }
    if (!includeLines) return header
    return {
      ...header,
      // ── Lines ── `items` is the source of truth (see the strip above).
      lines: items.map((item, i): WorkOrderLine => ({
        line_no: i + 1,
        cost_code: item.cost_code,
        description: item.description || undefined,
        qty: item.qty,
        unit_price: item.unit_price,
        // erp-api's WorkOrderLineInput json key is `disc`, not `discount` (PO's
        // shape) — see WorkOrderLine's doc comment in types/workOrder.ts.
        disc: item.disc ?? 0,
        disc_type: item.disc_type ?? discType,
        wht_rate: useWht ? (item.wht_rate ?? defaultWhtRate) : null,
      })),
    }
  }

  // Sequential follow-up save of the 3 payment-condition tables (needs a real WO id).
  // Returns false (after showing the distinct error) when only this second call fails.
  const savePaymentConditions = async (savedId: number | string): Promise<boolean> => {
    try {
      await workOrderService.updatePaymentConditions(
        accessToken,
        savedId,
        buildPaymentConditionsPayload(installments, retentions, penalties),
      )
      return true
    } catch {
      message.error('บันทึกหนังสือสั่งจ้างสำเร็จ แต่บันทึกเงื่อนไขการจ่ายเงินไม่สำเร็จ กรุณาลองบันทึกเงื่อนไขการจ่ายเงินอีกครั้ง')
      return false
    }
  }

  // Normal PUT /work-order/:id, or PUT /work-order/:id/edit-approved (reason required) when editing
  // an approved WO — the backend sets the status there, so `status` is not sent.
  const persistWO = (savedWoId: number | string, payload: ReturnType<typeof buildPayload>) => {
    if (!isEditApproved) return workOrderService.update(accessToken, savedWoId, payload)
    const { status: _status, ...rest } = payload
    return workOrderService.editApproved(accessToken, savedWoId, rest, editApprovedReason as string)
  }

  const saveErrorMessage = (err: any) =>
    err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึกไม่สำเร็จ'

  const validateHeader = async (): Promise<boolean> => {
    try {
      await form.validateFields()
      return true
    } catch {
      message.warning('กรุณากรอกข้อมูลให้ครบถ้วน')
      return false
    }
  }

  // Tab 1 — "บันทึกและไปต่อ": full header, `lines` omitted. Create on first save, PUT afterwards;
  // stays on the page and moves to Tab 2.
  const handleSaveHeader = async () => {
    if (advanceExceeds) return
    if (!(await validateHeader())) return
    setSaving(true)
    try {
      const payload = buildPayload(false, false)
      const wo = woId !== undefined
        ? await persistWO(woId, payload)
        : await workOrderService.create(accessToken, payload)
      const savedId = (wo?.id ?? woId) as number | string
      if (woId === undefined) {
        setCreatedId(savedId)
        // Keep the generated number in the form so later full-header saves don't blank it.
        if (wo?.wo_no) form.setFieldValue('wo_no', wo.wo_no)
      }
      if (await savePaymentConditions(savedId)) message.success('บันทึกข้อมูลหนังสือสั่งจ้างสำเร็จ')
      setActiveTab('items')
    } catch (err: any) {
      message.error(saveErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Tab 2 — "บันทึกร่าง" / "ส่งอนุมัติ": PUT the full payload including `lines` from the table.
  const handleSaveWithLines = async (submitForApproval: boolean) => {
    if (woId === undefined || advanceExceeds) return
    if (items.length === 0) {
      message.warning(submitForApproval
        ? 'กรุณาเพิ่มรายการอย่างน้อย 1 รายการก่อนส่งขออนุมัติ'
        : 'กรุณาเพิ่มรายการอย่างน้อย 1 รายการก่อนบันทึก')
      return
    }
    if (!(await validateHeader())) {
      setActiveTab('header')
      return
    }
    // ผู้อนุมัติ is required only when submitting for approval (not for a draft save).
    if (submitForApproval && !isEditApproved && !form.getFieldValue('approver_id')) {
      form.setFields([{ name: 'approver_id', errors: ['กรุณาเลือกผู้อนุมัติ'] }])
      message.warning('กรุณาเลือกผู้อนุมัติ')
      return
    }
    setSaving(true)
    try {
      const wo = await persistWO(woId, buildPayload(submitForApproval, true))
      const savedId = (wo?.id ?? woId) as number | string
      if (await savePaymentConditions(savedId)) {
        message.success(submitForApproval ? 'ส่งอนุมัติสำเร็จ' : 'บันทึกร่างสำเร็จ')
      }
      navigate(`/work-order/${savedId}`)
    } catch (err: any) {
      message.error(saveErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card style={cardStyle}>
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      </Card>
    )
  }

  const barStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
    marginTop: 16, paddingTop: 16, borderTop: '0.5px solid #dbeafe',
  }
  const groupStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 12 }
  const primaryStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
  }
  // TODO: this button is temporarily shown unconditionally (on both
  // blank new forms and existing records) purely to unblock visual
  // review of the print button + template picker + both print
  // templates. Restore the real gate — only show once an existing
  // record is loaded, i.e. `isEdit && id` — in a follow-up once the
  // visual design is confirmed. When there's no saved `id` yet, it
  // prints/previews straight from the current in-memory form state
  // (formData) instead of fetching — no save-first requirement for
  // now (see WorkOrderPrintTrigger's handleConfirm).
  const printTrigger = (
        <WorkOrderPrintTrigger
          id={id}
          getFormData={() => ({
            ...form.getFieldsValue(true),
            ...resolveProject(form.getFieldValue('project_choice')),
            // items/tax flags are plain React state now (not Form fields,
            // see buildPayload), so the unsaved-preview path needs them
            // merged in explicitly — form.getFieldsValue() alone won't see them.
            use_discount: useDisc,
            discount_type: discType,
            use_vat: useVat,
            use_wht: useWht,
            lines: items.map((item, i): WorkOrderLine => ({
              line_no: i + 1,
              cost_code: item.cost_code,
              description: item.description || undefined,
              qty: item.qty,
              unit_price: item.unit_price,
              disc: item.disc ?? 0,
              disc_type: item.disc_type ?? discType,
              wht_rate: useWht ? (item.wht_rate ?? defaultWhtRate) : null,
            })),
          })}
        />
  )
  // Existing cancel/back action of this page (previously a bare "ยกเลิก" row at the bottom).
  const cancelButton = (
    <Button icon={<CloseOutlined />} style={{ borderRadius: 8 }} onClick={() => navigate('/work-order/list')}>
      ยกเลิก
    </Button>
  )

  return (
    <div>
      <PageHeader
        title={isEdit ? 'แก้ไขหนังสือสั่งจ้าง (WO)' : 'สร้างหนังสือสั่งจ้าง (WO)'}
        subtitle="กรอกข้อมูลหนังสือสั่งจ้างเพื่อบันทึกหรือส่งอนุมัติ"
        breadcrumbs={[{ title: 'Home' }, { title: 'Work Order' }, { title: isEdit ? 'แก้ไข' : 'สร้าง' }]}
      />

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'header' | 'items')}
        items={[
          {
            key: 'header',
            label: 'สร้างหนังสือสั่งจ้าง (WO)',
            forceRender: true,
            children: (
              <>
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  employer_name: EMPLOYER_HEAD_OFFICE,
                  contract_type: 'LABOR_MATERIAL',
                  vat_rate: 7,
                  wht_rate: 3,
                }}
              >
                <Form.Item name="supplier_name" hidden><Input /></Form.Item>

                <Card title="เอกสาร" style={cardStyle}>
                  <Row gutter={[16, 0]}>
                    <Col {...FIELD_SPAN}>
                      <Form.Item label={<span style={labelStyle}>เลขที่ WO</span>} name="wo_no">
                        <Input style={fieldStyle} disabled placeholder="ระบบสร้างอัตโนมัติ" />
                      </Form.Item>
                    </Col>
                    <Col {...FIELD_SPAN}>
                      <Form.Item label={<span style={labelStyle}>วันที่</span>} name="wo_date" rules={[{ required: true, message: 'กรุณาระบุวันที่' }]}>
                        <DatePicker style={fieldStyle} format="DD/MM/YYYY" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 1. เจ้าของโครงการ — 12 + 12 */}
                <Card title="1. เจ้าของโครงการ (ผู้ว่าจ้าง)" style={cardStyle}>
                  <Row gutter={[16, 0]}>
                    <Col {...FIELD_SPAN_WIDE}>
                      <Form.Item label={<span style={labelStyle}>เจ้าของโครงการ (ผู้ว่าจ้าง)</span>} name="employer_name" rules={[{ required: true, message: 'กรุณาระบุเจ้าของโครงการ' }]}>
                        <Select
                          style={fieldStyle}
                          popupMatchSelectWidth={false}
                          placeholder="เลือกเจ้าของโครงการ"
                          options={[
                            { value: EMPLOYER_HEAD_OFFICE, label: EMPLOYER_HEAD_OFFICE },
                            // An old document's stored employer stays visible instead of a blank Select.
                            ...(employerName && employerName !== EMPLOYER_HEAD_OFFICE ? [{ value: employerName, label: employerName }] : []),
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col {...FIELD_SPAN_WIDE}>
                      <Form.Item
                        label={<span style={labelStyle}>โครงการ</span>}
                        name="project_choice"
                        rules={[{ required: true, message: 'กรุณาเลือกโครงการหรือพิมพ์ชื่อโครงการ' }]}
                      >
                        <Select
                          style={fieldStyle}
                          popupMatchSelectWidth={false}
                          showSearch
                          allowClear
                          loading={projectsLoading}
                          placeholder="เลือกโครงการ หรือพิมพ์ชื่อโครงการเอง"
                          options={[...projectOptions, ...textOptions]}
                          filterOption={(input, option) =>
                            String(option?.value ?? '').startsWith(PROJECT_TEXT_PREFIX) ||
                            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                          onSearch={setProjectSearch}
                          onChange={handleProjectChange}
                          onSelect={() => setProjectSearch('')}
                          onBlur={() => setProjectSearch('')}
                          notFoundContent={projectsLoading ? 'กำลังโหลด...' : 'พิมพ์ชื่อโครงการเพื่อใช้เป็นข้อความ'}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 2. ผู้รับจ้าง / ผู้ให้เช่า — row 1: 12 + 6 + 6, row 2: 12 */}
                <Card title="2. ผู้รับจ้าง / ผู้ให้เช่า" style={cardStyle}>
                  <Row gutter={[16, 0]}>
                    <Col {...FIELD_SPAN_WIDE}>
                      <Form.Item label={<span style={labelStyle}>บริษัท</span>} name="supplier_id" rules={[{ required: true, message: 'กรุณาเลือกบริษัทผู้รับจ้าง / ผู้ให้เช่า' }]}>
                        <Select
                          style={fieldStyle}
                          popupMatchSelectWidth={false}
                          showSearch
                          loading={suppliersLoading}
                          placeholder="เลือกบริษัท"
                          optionFilterProp="label"
                          options={suppliers.map((s) => ({ value: s.id, label: s.supplier_name }))}
                          onChange={handleSupplierChange}
                        />
                      </Form.Item>
                    </Col>
                    <Col {...FIELD_SPAN}>
                      <Form.Item label={<span style={labelStyle}>ผู้ลงนาม</span>} name="contact_person">
                        <Input style={fieldStyle} />
                      </Form.Item>
                    </Col>
                    <Col {...FIELD_SPAN}>
                      <Form.Item label={<span style={labelStyle}>โทรศัพท์</span>} name="supplier_phone">
                        <Input style={fieldStyle} />
                      </Form.Item>
                    </Col>
                    <Col {...FIELD_SPAN_WIDE}>
                      <Form.Item label={<span style={labelStyle}>ที่อยู่ตามหนังสือรับรอง</span>} name="supplier_address">
                        <Input style={fieldStyle} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 3. ประเภทสัญญา — 6 */}
                <Card title="3. สัญญานี้เป็นสัญญาประเภท" style={cardStyle}>
                  <Row gutter={[16, 0]}>
                    <Col {...FIELD_SPAN}>
                      <Form.Item label={<span style={labelStyle}>ประเภทสัญญา</span>} name="contract_type" style={{ marginBottom: 0 }}>
                        <Select
                          style={fieldStyle}
                          popupMatchSelectWidth={false}
                          options={WO_CONTRACT_TYPE_OPTIONS}
                          onChange={(v: string) => applyHeaderWhtDefault(v, whtDefaults)}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 4. งานระบบ — 12 (multi-select tags need the room) */}
                <Card title="4. งานระบบ" style={cardStyle}>
                  <Row gutter={[16, 0]}>
                    <Col {...FIELD_SPAN_WIDE}>
                      <Form.Item
                        label={<span style={labelStyle}>งานระบบ</span>}
                        name="work_system"
                        rules={[{ required: true, type: 'array', min: 1, message: 'กรุณาเลือกงานระบบอย่างน้อย 1 รายการ' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          style={fieldStyle}
                          popupMatchSelectWidth={false}
                          mode="multiple"
                          placeholder="เลือกงานระบบ"
                          options={[
                            ...jobTypes
                              .filter((j) => j.job_code.startsWith('M'))
                              .map((j) => ({ value: j.job_code, label: `${j.job_code} - ${j.job_name}` })),
                            ...legacyWorkSystem.map((v) => ({ value: v, label: `${WO_WORK_SYSTEM_LABEL[v] ?? v} (ค่าเดิม)` })),
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 5. ลักษณะของสัญญา — 12 */}
                <Card title="5. ลักษณะของสัญญา" style={cardStyle}>
                  <Row gutter={[16, 0]}>
                    <Col {...FIELD_SPAN_WIDE}>
                      <Form.Item label={<span style={labelStyle}>ลักษณะของสัญญา</span>} name="contract_description" style={{ marginBottom: 0 }}>
                        <Input.TextArea style={fieldStyle} autoSize={{ minRows: 3 }} maxLength={2000} showCount placeholder="เช่น RENOVATION FAC-S 1 & 2" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 6. มูลค่าสัญญา (ไม่รวม VAT) — 6 + 6 + 6 */}
                <Card title="6. มูลค่าสัญญา (ไม่รวม VAT)" style={cardStyle}>
                  <Row gutter={[16, 0]}>
                    <Col {...FIELD_SPAN}>
                      <Form.Item
                        label={<span style={labelStyle}>มูลค่าสัญญาไม่รวม VAT (บาท)</span>}
                        name="contract_amount"
                        rules={[
                          { required: true, message: 'กรุณาระบุมูลค่าสัญญา' },
                          {
                            validator: (_, v) =>
                              contractFloor !== undefined && v != null && Number(v) < contractFloor
                                ? Promise.reject(new Error(CONTRACT_LOWER_MSG))
                                : Promise.resolve(),
                          },
                        ]}
                        validateStatus={contractFloor !== undefined && watchedContractAmount != null && Number(watchedContractAmount) < contractFloor ? 'error' : undefined}
                        help={contractFloor !== undefined && watchedContractAmount != null && Number(watchedContractAmount) < contractFloor ? CONTRACT_LOWER_MSG : undefined}
                        extra={contractAmountText && <span style={{ fontSize: 12, color: '#2563eb' }}>({contractAmountText})</span>}
                      >
                        <InputNumber
                          style={fieldStyle}
                          min={contractFloor ?? 0}
                          precision={2}
                          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(v) => Number(v?.replace(/,/g, '') ?? 0) as 0}
                          onChange={(v) => updateContractAmountText(v as number | null)}
                        />
                      </Form.Item>
                    </Col>
                    <Col {...FIELD_SPAN}>
                      <Form.Item label={<span style={labelStyle}>อัตรา VAT (%)</span>} name="vat_rate">
                        <InputNumber style={fieldStyle} min={0} max={100} />
                      </Form.Item>
                    </Col>
                    <Col {...FIELD_SPAN}>
                      <Form.Item label={<span style={labelStyle}>อัตราหัก ณ ที่จ่าย (%)</span>} name="wht_rate">
                        <InputNumber style={fieldStyle} min={0} max={100} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 7. เงื่อนไขการจ่ายเงิน — WOPaymentConditionsSection is plain React state,
                    so it can sit between Form cards without being a Form field itself.
                    handleSave bundles the follow-up POST /work-order/:woId/payment-conditions
                    after the main create/update succeeds. Its internal tables are untouched. */}
                <WOPaymentConditionsSection
                  installments={installments}
                  onInstallmentsChange={setInstallments}
                  retentions={retentions}
                  onRetentionsChange={setRetentions}
                  penalties={penalties}
                  onPenaltiesChange={setPenalties}
                  contractAmount={watchedContractAmount}
                  advanceAmount={advanceAmount}
                  advancePct={displayedAdvancePct}
                  // 7.1 เงินล่วงหน้า — rendered by the section above 7.2; the Form.Items stay bound to this page's form.
                  advanceSlot={
                    <Row gutter={[16, 0]}>
                      {/* Both values live in the form store; the Select below only edits them. */}
                      <Form.Item name="advance_deduct_pct" hidden><InputNumber /></Form.Item>
                      <Form.Item name="advance_deduct_amount" hidden><InputNumber /></Form.Item>
                      <Col {...FIELD_SPAN}>
                        <Form.Item
                          label={<span style={labelStyle}>หักคืนเงินล่วงหน้า (%)</span>}
                          style={{ marginBottom: 0 }}
                          extra={advancePctOption === undefined && advanceAmount > 0
                            ? `สัดส่วนปัจจุบัน ${displayedAdvancePct.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% (คำนวณจากจำนวนเงินที่หัก)`
                            : undefined}
                        >
                          <Select
                            allowClear
                            style={fieldStyle}
                            value={advancePctOption}
                            options={ADVANCE_PCT_OPTIONS}
                            onChange={(v?: number) => {
                              const pct = Number(v) || 0
                              form.setFieldsValue({
                                advance_deduct_pct: pct,
                                advance_deduct_amount: calcAdvanceAmount(contractBase, pct),
                              })
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col {...FIELD_SPAN}>
                        <Form.Item
                          label={<span style={labelStyle}>จำนวนเงิน (บาท)</span>}
                          style={{ marginBottom: 0 }}
                          validateStatus={advanceExceeds ? 'error' : undefined}
                          help={advanceExceeds ? 'จำนวนเงินที่หักคืนเกินมูลค่าสัญญา' : undefined}
                        >
                          <Input
                            style={fieldStyle}
                            readOnly
                            value={advanceAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  }
                />

                {/* other_deduction_note: 24 (advance_deduct_pct moved into card 7 as 7.1) */}
                <Card title="เงื่อนไขการจ่ายเงิน (อื่นๆ)" style={cardStyle}>
                  <Row gutter={[16, 0]}>
                    <Col xs={24}>
                      <Form.Item label={<span style={labelStyle}>รายการหักอื่นๆ</span>} name="other_deduction_note">
                        <Input.TextArea style={fieldStyle} autoSize={{ minRows: 2 }} placeholder="ไม่มี" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 8. ระยะเวลาสัญญา — 6 + 6 + 6 + 6 */}
                <Card title="8. ระยะเวลาสัญญา" style={cardStyle}>
                  <Row gutter={[16, 0]}>
                    <Col {...FIELD_SPAN}>
                      <Form.Item label={<span style={labelStyle}>วันที่เริ่มงาน</span>} name="start_date">
                        <DatePicker style={fieldStyle} format="DD/MM/YYYY" onChange={recalcEndDate} />
                      </Form.Item>
                    </Col>
                    <Col {...FIELD_SPAN}>
                      <Form.Item label={<span style={labelStyle}>ระยะเวลา (วัน)</span>} name="duration_days">
                        <InputNumber style={fieldStyle} min={0} onChange={recalcEndDate} />
                      </Form.Item>
                    </Col>
                    <Col {...FIELD_SPAN}>
                      <Form.Item label={<span style={labelStyle}>วันที่สิ้นสุด</span>} name="end_date">
                        <DatePicker style={fieldStyle} format="DD/MM/YYYY" />
                      </Form.Item>
                    </Col>
                    <Col {...FIELD_SPAN}>
                      <Form.Item label={<span style={labelStyle}>ระยะเวลารับประกัน (ปี)</span>} name="warranty_years">
                        <InputNumber style={fieldStyle} min={0} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 9. อ้างอิงสัญญา — 12 */}
                <Card title="9. อ้างอิงสัญญา" style={cardStyle}>
                  <Row gutter={[16, 0]}>
                    <Col {...FIELD_SPAN_WIDE}>
                      <Form.Item label={<span style={labelStyle}>เลขที่อ้างอิง</span>} name="ref_no" style={{ marginBottom: 0 }}>
                        <Input style={fieldStyle} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 10. เงื่อนไขอื่นๆ — 24 */}
                <Card title="10. เงื่อนไขอื่นๆ" style={cardStyle}>
                  <Row gutter={[16, 0]}>
                    <Col xs={24}>
                      <Form.Item label={<span style={labelStyle}>เงื่อนไขอื่นๆ</span>} name="other_terms" style={{ marginBottom: 0 }}>
                        <Input.TextArea style={fieldStyle} autoSize={{ minRows: 2 }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  {/* Action bar — footer of this card: print on the left; cancel / continue on the right. */}
                  <div style={barStyle}>
                    <div style={groupStyle}>{printTrigger}</div>
                    <div style={{ ...groupStyle, justifyContent: 'flex-end' }}>
                      {cancelButton}
                      <PermissionButton
                        menuCode={MENU_CODE}
                        action="write"
                        type="primary"
                        icon={<ArrowRightOutlined />}
                        loading={saving}
                        disabled={advanceExceeds}
                        onClick={handleSaveHeader}
                        style={primaryStyle}
                      >
                        บันทึกและไปต่อ
                      </PermissionButton>
                    </div>
                  </div>
                </Card>
              </Form>
              </>
            ),
          },
          {
            key: 'items',
            label: 'รายละเอียดหนังสือสั่งจ้าง',
            disabled: !isEdit && createdId === undefined,
            forceRender: true,
            children: (
              <>
              {/* Cost Code line items — same POItemsTable + TaxSidebarPanel layout PO's
                  create page uses (table + collapsible tax sidebar side by side),
                  reused exactly rather than rebuilt. Lives outside the antd <Form>
                  since `items` is plain React state, same pattern as POCreatePage. */}
              <Card
                title={<span style={{ fontSize: 14, fontWeight: 600, color: '#1e3a8a' }}>รายการ Cost Code</span>}
                style={cardStyle}
                styles={{ body: { padding: 0 } }}
              >
                <div style={{ display: 'flex', overflow: 'hidden' }}>
                  <div style={{ flex: 1, minWidth: 0, padding: 24 }}>
                    <WOItemsTable
                      items={items}
                      onChange={setItems}
                      taxOpen={taxOpen}
                      onTaxToggle={() => setTaxOpen((v) => !v)}
                      useDisc={useDisc}
                      discType={discType}
                      useVat={useVat}
                      useWht={useWht}
                      defaultWhtRate={defaultWhtRate}
                    />
                  </div>
                  <TaxSidebarPanel
                    open={taxOpen}
                    onClose={() => setTaxOpen(false)}
                    useDisc={useDisc}
                    onUseDiscChange={setUseDisc}
                    discType={discType}
                    onDiscTypeChange={setDiscType}
                    useVat={useVat}
                    onUseVatChange={setUseVat}
                    useWht={useWht}
                    onUseWhtChange={setUseWht}
                  />
                </div>
                {/* ผู้อนุมัติ — bottom of page 2 (below line items / totals, above the action bar); required only
                    on submit for approval. Page 2 sits outside the page-1 <Form>, so this wraps the item in a
                    non-rendering <Form component={false}> bound to the same form instance. */}
                <Form form={form} component={false}>
                  <div style={{ margin: '16px 24px 0' }}>
                        <Row gutter={[16, 0]}>
                          <Col xs={24}>
                            <Form.Item label={<span style={labelStyle}>ผู้อนุมัติ</span>} name="approver_id" style={{ marginBottom: 0 }}>
                              <Select
                                allowClear
                                style={fieldStyle}
                                placeholder="- เลือกรายการ -"
                                loading={approversLoading}
                                showSearch
                                filterOption={(input, option) => {
                                  const q = input.toLowerCase()
                                  const o = option as { label?: unknown; username?: string; name?: string } | undefined
                                  return [o?.label, o?.username, o?.name].some((t) => String(t ?? '').toLowerCase().includes(q))
                                }}
                                optionRender={(option) => (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                    <span>{option.data.label}</span>
                                    {option.data.dept && (
                                      <span style={{ color: '#9ca3af', fontSize: 12, flexShrink: 0 }}>{option.data.dept}</span>
                                    )}
                                  </div>
                                )}
                                options={approvers}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                  </div>
                </Form>
                {/* Action bar — footer of this card: print on the left; back / save draft / submit on the right. */}
                <div style={{ ...barStyle, margin: '16px 24px 0', paddingBottom: 24 }}>
                  <div style={groupStyle}>{printTrigger}</div>
                  <div style={{ ...groupStyle, justifyContent: 'flex-end' }}>
                    <Button icon={<ArrowLeftOutlined />} style={{ borderRadius: 8 }} onClick={() => setActiveTab('header')}>
                      ย้อนกลับ
                    </Button>
                    {!isEditApproved && (
                      <PermissionButton
                        menuCode={MENU_CODE}
                        action="write"
                        icon={<SaveOutlined />}
                        loading={saving}
                        disabled={advanceExceeds}
                        onClick={() => handleSaveWithLines(false)}
                      >
                        บันทึกร่าง
                      </PermissionButton>
                    )}
                    <PermissionButton
                      menuCode={MENU_CODE}
                      action="write"
                      type="primary"
                      icon={<SendOutlined />}
                      loading={saving}
                      disabled={advanceExceeds}
                      onClick={() => handleSaveWithLines(true)}
                      style={primaryStyle}
                    >
                      ส่งอนุมัติ
                    </PermissionButton>
                  </div>
                </div>
              </Card>
              </>
            ),
          },
        ]}
      />
    </div>
  )
}

export default WorkOrderCreatePage
