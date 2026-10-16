import React, { useEffect, useState } from 'react'
import {
  Card, Form, Input, InputNumber, DatePicker, Select, Button, Row, Col, message, Spin,
} from 'antd'
import { SaveOutlined, SendOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
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
import { WO_WORK_SYSTEM_LABEL } from '@/types/workOrder'
import type { WorkOrderPayload, WorkOrderLine } from '@/types/workOrder'
import { numberToThaiText } from '@/utils/thaiBahtText'

// เงินล่วงหน้า/เงินประกันผลงาน/ค่าปรับ ย้ายไปเป็นรายการแบบตารางที่ทำซ้ำได้ใน
// WOPaymentConditionsSection แล้ว (งวดงาน/เงินประกัน/ค่าปรับ) — ตัด advance_pct,
// advance_amount, retention_pct, penalty_pct_per_day, progress_payment_note
// ออกจากฟอร์มนี้ (ยังไม่แตะ column เดิมใน DB/backend). ADVANCE_PCT_OPTIONS ยังใช้
// กับ advance_deduct_pct ("หักคืนเงินล่วงหน้า") อยู่ จึงคงไว้ — RETENTION_PCT_OPTIONS
// เคยใช้กับ retention_pct เพียงจุดเดียว ตัดออกไปพร้อมกัน.
const ADVANCE_PCT_OPTIONS = [5, 10, 15, 20, 30, 50].map((v) => ({ value: v, label: `${v}%` }))

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
  // Owner display = customer_name, fall back to legacy owner_name, else ''.
  owner: string
}

const WorkOrderCreatePage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)

  // Live Thai baht-text readout under มูลค่าสัญญา — purely derived, never sent to backend.
  const [contractAmountText, setContractAmountText] = useState('')
  const updateContractAmountText = (v: number | null) => {
    setContractAmountText(v ? numberToThaiText(v) : '')
  }

  // Stored work_system values outside P/E/S (legacy data) — kept as selectable
  // options so the multi-select shows them as tags and a save doesn't wipe them.
  const [legacyWorkSystem, setLegacyWorkSystem] = useState<string[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)

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
    const fetchProjects = async () => {
      setProjectsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/projects`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setProjects(list.filter((p: any) => p.project_code).map((p: any) => ({
          value: p.project_code,
          label: `${p.project_code} ${p.project_name ?? p.name ?? ''}`.trim(),
          owner: p.customer_name || p.owner_name || '',
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลโครงการไม่สำเร็จ')
      } finally {
        setProjectsLoading(false)
      }
    }
    fetchProjects()
  }, [accessToken])

  // Project picked → owner name goes into employer_name. No owner data → cleared
  // to '' (the field stays editable either way).
  const handleProjectChange = (code?: string) => {
    if (!code) return
    const p = projects.find((o) => o.value === code)
    form.setFieldValue('employer_name', p?.owner ?? '')
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
      form.setFieldsValue({
        supplier_name: raw?.supplier_name ?? picked?.supplier_name ?? null,
        contact_person: raw?.sales_person ?? null,
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
        const storedSystems: string[] = Array.isArray(wo.work_system) ? wo.work_system : (wo.work_system ? [wo.work_system as unknown as string] : [])
        setLegacyWorkSystem(storedSystems.filter((v) => !(v in WO_WORK_SYSTEM_LABEL)))
        form.setFieldsValue({
          ...wo,
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
  const buildPayload = (submitForApproval: boolean): WorkOrderPayload & { status: string } => {
    // advance_pct/advance_amount/retention_pct/penalty_pct_per_day/progress_payment_note
    // no longer have Form.Items (replaced by WOPaymentConditionsSection's repeatable
    // tables), but edit-mode's initial form.setFieldsValue({ ...wo }) still seeds them
    // into the antd form store from the loaded record — getFieldsValue() would silently
    // resurrect and resubmit those stale values without this explicit strip.
    // supplier_code / project_name are response-only: work_order has no supplier_code
    // (send supplier_id only), and edit-mode's ...wo seed puts both into the store.
    const {
      advance_pct, advance_amount, retention_pct, penalty_pct_per_day, progress_payment_note,
      supplier_code, project_name,
      ...v
    } = form.getFieldsValue()
    return {
      ...v,
      wo_date: v.wo_date ? dayjs(v.wo_date).format('YYYY-MM-DD') : undefined,
      start_date: v.start_date ? dayjs(v.start_date).format('YYYY-MM-DD') : undefined,
      end_date: v.end_date ? dayjs(v.end_date).format('YYYY-MM-DD') : undefined,
      status: submitForApproval ? 'PENDING_APPROVAL' : 'DRAFT',

      // ── Tax (flat — mirrors POCreatePage's buildPayload exactly) ──
      use_discount: useDisc,
      discount_type: discType,
      use_vat: useVat,
      use_wht: useWht,

      // ── Lines ── explicit override (not just relying on the `...v` spread)
      // since edit-mode's initial form.setFieldsValue({ ...wo }) call put the
      // fetched record's raw `lines` straight into the antd form store too —
      // this is the source of truth instead.
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
        wht_rate: useWht ? (item.wht_rate ?? 3) : null,
      })),
    }
  }

  const handleSave = async (submitForApproval: boolean) => {
    try {
      await form.validateFields()
    } catch {
      message.warning('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }
    // items is plain React state, not a Form field, so its own "at least 1
    // line" requirement (same as the old cost_codes multi-select's rule)
    // needs a manual check here rather than a Form.Item validator.
    if (items.length === 0) {
      message.warning('กรุณาเพิ่มรายการ Cost Code อย่างน้อย 1 รายการ')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload(submitForApproval)
      const wo = isEdit
        ? await workOrderService.update(accessToken, id!, payload)
        : await workOrderService.create(accessToken, payload)

      // Bundled follow-up save — payment conditions reference wo_id and can't be
      // created before the WO itself has one, so this can only happen right here,
      // after the create/update call above has succeeded and a real id is known
      // (newly-created id in create mode, the existing id in edit mode). This is
      // a second sequential API call under the hood, but reads as one save to the
      // user: same success message, same navigate-away, unless it fails on its
      // own — see the catch below for why that's reported separately rather than
      // treated as one atomic failure (the WO itself did save).
      try {
        await workOrderService.updatePaymentConditions(
          accessToken,
          wo.id,
          buildPaymentConditionsPayload(installments, retentions, penalties),
        )
        message.success(isEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'บันทึกร่างสำเร็จ')
      } catch (conditionsErr: any) {
        message.error('บันทึกหนังสือสั่งจ้างสำเร็จ แต่บันทึกเงื่อนไขการจ่ายเงินไม่สำเร็จ กรุณาลองบันทึกเงื่อนไขการจ่ายเงินอีกครั้ง')
      }

      navigate(`/work-order/${wo.id}`)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'บันทึกไม่สำเร็จ')
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

  return (
    <div>
      <PageHeader
        title={isEdit ? 'แก้ไขหนังสือสั่งจ้าง (WO)' : 'สร้างหนังสือสั่งจ้าง (WO)'}
        subtitle="กรอกข้อมูลหนังสือสั่งจ้างเพื่อบันทึกหรือส่งอนุมัติ"
        breadcrumbs={[{ title: 'Home' }, { title: 'Work Order' }, { title: isEdit ? 'แก้ไข' : 'สร้าง' }]}
        extra={
          <div style={{ display: 'flex', gap: 8 }}>
            {/* TODO: this button is temporarily shown unconditionally (on both
                blank new forms and existing records) purely to unblock visual
                review of the print button + template picker + both print
                templates. Restore the real gate — only show once an existing
                record is loaded, i.e. `isEdit && id` — in a follow-up once the
                visual design is confirmed. When there's no saved `id` yet, it
                prints/previews straight from the current in-memory form state
                (formData) instead of fetching — no save-first requirement for
                now (see WorkOrderPrintTrigger's handleConfirm). */}
            <WorkOrderPrintTrigger
              id={id}
              getFormData={() => ({
                ...form.getFieldsValue(true),
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
                  wht_rate: useWht ? (item.wht_rate ?? 3) : null,
                })),
              })}
            />
            <PermissionButton
              menuCode={MENU_CODE}
              action="write"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => handleSave(false)}
            >
              บันทึกร่าง
            </PermissionButton>
            <PermissionButton
              menuCode={MENU_CODE}
              action="write"
              type="primary"
              icon={<SendOutlined />}
              loading={saving}
              onClick={() => handleSave(true)}
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
            >
              ส่งอนุมัติ
            </PermissionButton>
          </div>
        }
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          contract_type: 'LABOR_MATERIAL',
          work_system: ['P'],
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
              <Form.Item label={<span style={labelStyle}>โครงการ</span>} name="project_code">
                <Select
                  style={fieldStyle}
                  popupMatchSelectWidth={false}
                  showSearch
                  allowClear
                  loading={projectsLoading}
                  placeholder="เลือกโครงการ"
                  optionFilterProp="label"
                  options={projects}
                  onChange={handleProjectChange}
                />
              </Form.Item>
            </Col>
            <Col {...FIELD_SPAN_WIDE}>
              <Form.Item label={<span style={labelStyle}>ชื่อเจ้าของโครงการ</span>} name="employer_name" rules={[{ required: true, message: 'กรุณาระบุเจ้าของโครงการ' }]}>
                <Input style={fieldStyle} placeholder="แสดงจากโครงการที่เลือก — แก้ไขได้" />
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
                  options={[
                    { value: 'LABOR_MATERIAL', label: 'ทั้งค่าแรง และค่าของ' },
                    { value: 'LABOR_ONLY', label: 'ค่าแรงอย่างเดียว' },
                  ]}
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
                    ...Object.entries(WO_WORK_SYSTEM_LABEL).map(([value, label]) => ({ value, label })),
                    ...legacyWorkSystem.map((v) => ({ value: v, label: `${v} (ค่าเดิม)` })),
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
                <Input style={fieldStyle} placeholder="เช่น RENOVATION FAC-S 1 & 2" />
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
                rules={[{ required: true, message: 'กรุณาระบุมูลค่าสัญญา' }]}
                extra={contractAmountText && <span style={{ fontSize: 12, color: '#2563eb' }}>({contractAmountText})</span>}
              >
                <InputNumber
                  style={fieldStyle}
                  min={0}
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
        />

        {/* advance_deduct_pct: 6, other_deduction_note: 24 */}
        <Card title="เงื่อนไขการจ่ายเงิน (อื่นๆ)" style={cardStyle}>
          <Row gutter={[16, 0]}>
            <Col {...FIELD_SPAN}>
              <Form.Item label={<span style={labelStyle}>หักคืนเงินล่วงหน้า (%)</span>} name="advance_deduct_pct">
                <Select allowClear style={fieldStyle} options={ADVANCE_PCT_OPTIONS} />
              </Form.Item>
            </Col>
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
        </Card>
      </Form>

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
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={() => navigate('/work-order/list')}>ยกเลิก</Button>
      </div>
    </div>
  )
}

export default WorkOrderCreatePage
