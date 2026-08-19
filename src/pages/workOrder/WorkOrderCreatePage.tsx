import React, { useEffect, useState } from 'react'
import {
  Card, Form, Input, InputNumber, DatePicker, Select, Radio, Button, Row, Col, message, Spin,
} from 'antd'
import { SaveOutlined, SendOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { workOrderService } from '@/services/workOrderService'
import { WO_WORK_SYSTEM_LABEL, WO_CONTRACT_DESCRIPTION_LABEL } from '@/types/workOrder'
import type { WorkOrderPayload } from '@/types/workOrder'
import { numberToThaiText } from '@/utils/thaiBahtText'

// Fixed option list per the paper form — 7.1 เงินล่วงหน้า and 7.4 หักคืนเงินล่วงหน้า
// use the same list ("ใช้เหมือนเงินล่วงหน้า" per the form).
const ADVANCE_PCT_OPTIONS = [5, 10, 15, 20, 30, 50].map((v) => ({ value: v, label: `${v}%` }))
const RETENTION_PCT_OPTIONS = [5, 10].map((v) => ({ value: v, label: `${v}%` }))
const CONTRACT_DESCRIPTION_OPTIONS = Object.entries(WO_CONTRACT_DESCRIPTION_LABEL).map(([value, label]) => ({ value, label }))

const MENU_CODE = 'MENU_WO_CREATE'
const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const labelStyle: React.CSSProperties = { color: '#374151', fontSize: 13 }

interface SupplierOption {
  supplier_code: string
  supplier_name: string
  contact_person?: string
  address?: string
  phone?: string
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

  useEffect(() => {
    const fetchSuppliers = async () => {
      setSuppliersLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/suppliers`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setSuppliers(list.map((s: any) => ({
          supplier_code: s.supplier_code,
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

  // Auto-fills contact_person / supplier_address / supplier_phone from the supplier
  // master when picked — same pattern as POCreatePage's handleSupplierChange. Fields
  // stay plain <Input> afterward so the user can override.
  const handleSupplierChange = async (code: string) => {
    if (!code) return
    try {
      const res = await axios.get(`${BASE_URL}/master/suppliers/${code}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const raw = res.data?.data ?? res.data
      form.setFieldsValue({
        contact_person: raw.contact_person ?? raw.sales_person ?? undefined,
        supplier_address: raw.address ?? undefined,
        supplier_phone: raw.phone ?? raw.office_phone ?? undefined,
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
        form.setFieldsValue({
          ...wo,
          wo_date: wo.wo_date ? dayjs(wo.wo_date) : undefined,
          start_date: wo.start_date ? dayjs(wo.start_date) : undefined,
          end_date: wo.end_date ? dayjs(wo.end_date) : undefined,
        })
        updateContractAmountText(wo.contract_amount ?? null)
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
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

  // contract_amount * advance_pct / 100 -> advance_amount, same "recompute only when
  // a source field changes, stay user-editable afterward" pattern as recalcEndDate.
  const recalcAdvanceAmount = () => {
    const amount = form.getFieldValue('contract_amount')
    const pct = form.getFieldValue('advance_pct')
    if (amount != null && pct != null) {
      form.setFieldValue('advance_amount', Math.round((Number(amount) * Number(pct)) / 100 * 100) / 100)
    }
  }

  // PO's create page sends `status` inline as part of the create/update payload to
  // switch between draft-save and submit-for-approval (no separate submit endpoint) —
  // mirrored here since the WO backend contract only lists POST / and PUT /:id, no
  // dedicated submit route. Flag for backend confirmation that `status` in the WO
  // create/update body is the intended trigger, same as PO.
  const buildPayload = (submitForApproval: boolean): WorkOrderPayload & { status: string } => {
    const v = form.getFieldsValue()
    return {
      ...v,
      wo_date: v.wo_date ? dayjs(v.wo_date).format('YYYY-MM-DD') : undefined,
      start_date: v.start_date ? dayjs(v.start_date).format('YYYY-MM-DD') : undefined,
      end_date: v.end_date ? dayjs(v.end_date).format('YYYY-MM-DD') : undefined,
      status: submitForApproval ? 'PENDING_APPROVAL' : 'DRAFT',
    }
  }

  const handleSave = async (submitForApproval: boolean) => {
    try {
      await form.validateFields()
    } catch {
      message.warning('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload(submitForApproval)
      const wo = isEdit
        ? await workOrderService.update(accessToken, id!, payload)
        : await workOrderService.create(accessToken, payload)
      message.success(isEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'บันทึกร่างสำเร็จ')
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
          contract_type: 'LABOR_AND_MATERIAL',
          work_system: 'P',
          vat_rate: 7,
          wht_rate: 3,
        }}
      >
        <Card title="เอกสาร" style={cardStyle}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label={<span style={labelStyle}>เลขที่ WO</span>} name="wo_no">
                <Input disabled placeholder="ระบบสร้างอัตโนมัติ" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={<span style={labelStyle}>วันที่</span>} name="wo_date" rules={[{ required: true, message: 'กรุณาระบุวันที่' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={<span style={labelStyle}>เลขที่อ้างอิง</span>} name="ref_no">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="ผู้ว่าจ้าง / ผู้รับจ้าง" style={cardStyle}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label={<span style={labelStyle}>ผู้ว่าจ้าง</span>} name="employer_name" rules={[{ required: true, message: 'กรุณาระบุผู้ว่าจ้าง' }]}>
                <Input placeholder="ชื่อบริษัท/หน่วยงานผู้ว่าจ้าง" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={<span style={labelStyle}>ขอบเขตงาน / โครงการ</span>}
                name="project_scope_text"
                extra={
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    ยังเป็นช่องกรอกอิสระ — จะเปลี่ยนเป็น dropdown ที่กรองตามผู้ว่าจ้างที่เลือก
                    เมื่อ "ผู้ว่าจ้าง" ผูกกับ master บริษัทในเครือแล้ว
                  </span>
                }
              >
                <Input placeholder="ชื่อโครงการ / ขอบเขตงาน" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={<span style={labelStyle}>ผู้รับจ้าง</span>} name="supplier_code" rules={[{ required: true, message: 'กรุณาเลือกผู้รับจ้าง' }]}>
                <Select
                  showSearch
                  loading={suppliersLoading}
                  placeholder="เลือกผู้รับจ้าง"
                  filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  options={suppliers.map((s) => ({ value: s.supplier_code, label: s.supplier_name }))}
                  onChange={handleSupplierChange}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={<span style={labelStyle}>ผู้ควบคุมงาน (Contact person)</span>} name="contact_person">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item label={<span style={labelStyle}>ที่อยู่ผู้รับจ้าง</span>} name="supplier_address">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={<span style={labelStyle}>โทรศัพท์</span>} name="supplier_phone">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="ประเภทสัญญา" style={cardStyle}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label={<span style={labelStyle}>ลักษณะสัญญา</span>} name="contract_type">
                <Radio.Group>
                  <Radio value="LABOR_AND_MATERIAL">ทั้งค่าแรงและค่าของ</Radio>
                  <Radio value="LABOR_ONLY">ค่าแรงอย่างเดียว</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={<span style={labelStyle}>งานระบบ</span>} name="work_system">
                <Select options={Object.entries(WO_WORK_SYSTEM_LABEL).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                label={<span style={labelStyle}>ลักษณะของสัญญา</span>}
                name="contract_description"
                extra={<span style={{ fontSize: 11, color: '#94a3b8' }}>รายการเริ่มต้น — ยังไม่ยืนยันกับการใช้งานจริง แจ้งกลับหากต้องปรับ/เพิ่มรายการ</span>}
              >
                <Select allowClear options={CONTRACT_DESCRIPTION_OPTIONS} placeholder="เลือกลักษณะของสัญญา" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="มูลค่าสัญญา" style={cardStyle}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label={<span style={labelStyle}>มูลค่าสัญญา (บาท)</span>}
                name="contract_amount"
                rules={[{ required: true, message: 'กรุณาระบุมูลค่าสัญญา' }]}
                extra={contractAmountText && <span style={{ fontSize: 12, color: '#2563eb' }}>({contractAmountText})</span>}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => Number(v?.replace(/,/g, '') ?? 0) as 0}
                  onChange={(v) => { updateContractAmountText(v as number | null); recalcAdvanceAmount() }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={<span style={labelStyle}>อัตรา VAT (%)</span>} name="vat_rate">
                <InputNumber style={{ width: '100%' }} min={0} max={100} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={<span style={labelStyle}>อัตราหัก ณ ที่จ่าย (%)</span>} name="wht_rate">
                <InputNumber style={{ width: '100%' }} min={0} max={100} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="เงื่อนไขการจ่ายเงิน" style={cardStyle}>
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label={<span style={labelStyle}>เงินล่วงหน้า (%)</span>} name="advance_pct">
                <Select
                  allowClear
                  style={{ width: '100%' }}
                  options={ADVANCE_PCT_OPTIONS}
                  onChange={recalcAdvanceAmount}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label={<span style={labelStyle}>จำนวนเงินงวดสัญญา</span>}
                name="advance_amount"
                extra={<span style={{ fontSize: 11, color: '#94a3b8' }}>คำนวณอัตโนมัติจากมูลค่าสัญญา × % — แก้ไขเองได้</span>}
              >
                <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => Number(v?.replace(/,/g, '') ?? 0) as 0} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label={<span style={labelStyle}>เงินประกันผลงาน (%)</span>} name="retention_pct">
                <Select allowClear style={{ width: '100%' }} options={RETENTION_PCT_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label={<span style={labelStyle}>หักคืนเงินล่วงหน้า (%)</span>} name="advance_deduct_pct">
                <Select allowClear style={{ width: '100%' }} options={ADVANCE_PCT_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={<span style={labelStyle}>หมายเหตุการจ่ายตามความคืบหน้างาน</span>} name="progress_payment_note">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={<span style={labelStyle}>รายการหักอื่นๆ</span>} name="other_deduction_note">
                <Input.TextArea rows={2} placeholder="ไม่มี" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="ระยะเวลาสัญญา" style={cardStyle}>
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label={<span style={labelStyle}>วันที่เริ่มงาน</span>} name="start_date">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" onChange={recalcEndDate} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label={<span style={labelStyle}>ระยะเวลา (วัน)</span>} name="duration_days">
                <InputNumber style={{ width: '100%' }} min={0} onChange={recalcEndDate} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label={<span style={labelStyle}>วันที่สิ้นสุด</span>} name="end_date">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label={<span style={labelStyle}>ค่าปรับ (%/วัน)</span>} name="penalty_pct_per_day">
                <InputNumber style={{ width: '100%' }} min={0} max={100} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label={<span style={labelStyle}>ระยะเวลารับประกัน (ปี)</span>} name="warranty_years">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="อื่นๆ" style={cardStyle}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label={<span style={labelStyle}>Cost Code</span>} name="cost_code">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label={<span style={labelStyle}>เงื่อนไขอื่นๆ</span>} name="other_terms">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Form>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={() => navigate('/work-order/list')}>ยกเลิก</Button>
      </div>
    </div>
  )
}

export default WorkOrderCreatePage
