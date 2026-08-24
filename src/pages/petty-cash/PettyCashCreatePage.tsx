import React, { useEffect, useState } from 'react'
import { Card, Form, Select, Button, Space, message, Input, Row, Col } from 'antd'
import { SaveOutlined, SendOutlined, ArrowLeftOutlined, CalculatorOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { pettyCashService } from '@/services/pettyCashService'
import PettyCashLineItemsTable, { type PettyCashLineRow } from '@/components/pettyCash/PettyCashLineItemsTable'
import TaxSidebarPanel from '@/pages/po/components/TaxSidebarPanel'
import { calcDisc } from '@/utils/poCalc'
import type { CreatePettyCashRequest } from '@/types/pettyCash'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'
const MENU_CODE = 'MENU_PETTY_CASH_CREATE'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#1e40af',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PettyCashCreatePage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [docStatus, setDocStatus] = useState<string>('DRAFT')

  const [approvers, setApprovers] = useState<{ value: number; label: string; dept?: string }[]>([])
  const [approversLoading, setApproversLoading] = useState(false)

  const [items, setItems] = useState<PettyCashLineRow[]>([])

  const [taxOpen, setTaxOpen] = useState(false)
  const [useDisc, setUseDisc] = useState(false)
  const [discType, setDiscType] = useState<'pct' | 'amt'>('pct')
  const [useVat, setUseVat] = useState(false)
  const [useWht, setUseWht] = useState(false)

  useEffect(() => {
    const fetchApprovers = async () => {
      setApproversLoading(true)
      try {
        // Same eligible-approvers pattern as PO/Memo create forms, just doc_type: 'PETTY_CASH'.
        const res = await axios.get(`${BASE_URL}/master/eligible-approvers`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { doc_type: 'PETTY_CASH' },
        })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setApprovers(list.map((u: any) => ({
          value: Number(u.value ?? u.id),
          label: u.label ?? u.full_name ?? u.fullName ?? u.username,
          dept: u.dept ?? u.department,
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดรายชื่อผู้อนุมัติไม่สำเร็จ')
      } finally {
        setApproversLoading(false)
      }
    }
    fetchApprovers()
  }, [accessToken])

  useEffect(() => {
    if (!isEdit || !id) return
    const fetchPc = async () => {
      setLoading(true)
      try {
        const pc = await pettyCashService.get(accessToken, id)
        if (pc.status !== 'DRAFT' && pc.status !== 'REJECTED') {
          message.warning('แก้ไขได้เฉพาะเอกสารสถานะ ร่าง หรือ ถูกปฏิเสธ เท่านั้น')
        }
        setDocStatus(pc.status)
        form.setFieldsValue({
          purpose: pc.purpose ?? '',
          currency: pc.currency ?? 'THB',
          remarks: pc.remarks ?? '',
          approver_id: pc.approver_id ?? undefined,
        })
        setUseDisc(pc.use_discount)
        setDiscType(pc.discount_type === 'amt' ? 'amt' : 'pct')
        setUseVat(pc.use_vat)
        setUseWht(pc.use_wht)
        setItems((pc.lines ?? []).map((l) => ({
          key: `line-${l.id}`,
          no: l.line_no,
          project_code: l.project_code,
          mat_code: l.mat_code,
          item_name: l.item_name ?? l.mat_code,
          unit: l.unit ?? '',
          stock_on_hand: l.stock_on_hand ?? 0,
          qty: l.qty,
          unit_price: l.unit_price,
          discount: l.discount ?? 0,
          disc_type: l.disc_type === 'amt' ? 'amt' : 'pct',
          wht_rate: l.wht_rate ?? null,
          cost_subgroup_id: l.cost_subgroup_id ?? null,
          cost_subgroup_display: '',
          description: l.description ?? '',
          remarks: l.remarks ?? '',
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลใบเบิกเงินสดย่อยไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    fetchPc()
  }, [isEdit, id, accessToken, form])

  const canEdit = !isEdit || docStatus === 'DRAFT' || docStatus === 'REJECTED'

  const buildLinesPayload = () => items.map((r) => ({
    project_code: r.project_code ?? '',
    mat_code: r.mat_code,
    cost_subgroup_id: r.cost_subgroup_id,
    description: r.description || undefined,
    qty: r.qty,
    unit_price: r.unit_price,
    discount: r.discount,
    disc_type: r.disc_type,
    wht_rate: useWht ? (r.wht_rate ?? 3) : null,
    remarks: r.remarks || undefined,
  }))

  const handleSave = async (status: 'DRAFT' | 'PENDING_APPROVAL') => {
    try {
      const values = await form.validateFields()
      if (items.length === 0) {
        message.error('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ')
        return
      }
      if (items.some((r) => !r.project_code)) {
        message.error('กรุณาเลือกโครงการให้ครบทุกแถว')
        return
      }
      if (items.some((r) => !r.mat_code)) {
        message.error('กรุณาเลือกวัสดุให้ครบทุกแถว')
        return
      }
      if (status === 'PENDING_APPROVAL' && !values.approver_id) {
        message.error('กรุณาเลือกผู้อนุมัติก่อนส่งอนุมัติ')
        return
      }
      setSubmitting(true)
      const payload: CreatePettyCashRequest = {
        purpose: values.purpose || undefined,
        currency: values.currency || 'THB',
        use_discount: useDisc,
        discount_type: discType,
        use_vat: useVat,
        use_wht: useWht,
        approver_id: values.approver_id ?? undefined,
        status,
        remarks: values.remarks || undefined,
        lines: buildLinesPayload(),
      }

      const saved = isEdit && id
        ? await pettyCashService.update(accessToken, id, payload)
        : await pettyCashService.create(accessToken, payload)

      message.success(status === 'PENDING_APPROVAL' ? 'ส่งอนุมัติเรียบร้อย' : 'บันทึกร่างเรียบร้อย')
      navigate(`/petty-cash/${saved.id}`)
    } catch (err: any) {
      if (err?.errorFields) return // antd form validation error, already shown inline
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  let subtotal = 0, totalDisc = 0, totalWht = 0
  items.forEach((r) => {
    const lineAmt = r.qty * r.unit_price
    subtotal += lineAmt
    totalDisc += useDisc ? calcDisc(lineAmt, r.discount, r.disc_type) : 0
    totalWht += useWht ? (lineAmt - (useDisc ? calcDisc(lineAmt, r.discount, r.disc_type) : 0)) * ((r.wht_rate ?? 3) / 100) : 0
  })
  // Header vat_amount is recomputed as 7% of (total-discount) rather than
  // summed per-line — mirrors POHandler.Create / calcPettyCashLines exactly.
  const totalVat = useVat ? (subtotal - totalDisc) * 0.07 : 0
  const netAmount = subtotal - totalDisc + totalVat - totalWht

  return (
    <div style={{ display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <PageHeader
          title={isEdit ? 'แก้ไขใบเบิกเงินสดย่อย' : 'สร้างใบเบิกเงินสดย่อย'}
          subtitle="เบิกเงินสดย่อยเพื่อซื้อ/เบิกจ่ายวัสดุสำหรับโครงการ — ไม่มีการตัด stock"
          breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'เบิกเงินสดย่อย' }, { title: isEdit ? 'แก้ไข' : 'สร้าง' }]}
        />

        <Card title={<span style={cardTitleStyle}>ข้อมูลทั่วไป</span>} style={{ ...cardStyle, marginBottom: 16 }} loading={loading}>
          <Form form={form} layout="vertical" disabled={!canEdit}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="currency" label="สกุลเงิน" initialValue="THB">
                  <Select
                    options={[{ value: 'THB', label: 'THB' }, { value: 'USD', label: 'USD' }]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="approver_id" label="ผู้อนุมัติ" rules={[{ required: true, message: 'กรุณาเลือกผู้อนุมัติ' }]}>
                  <Select
                    placeholder="เลือกผู้อนุมัติ"
                    showSearch
                    loading={approversLoading}
                    options={approvers}
                    filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="purpose" label="วัตถุประสงค์">
                  <Input.TextArea rows={2} placeholder="ระบุวัตถุประสงค์การเบิกเงินสดย่อย" maxLength={500} showCount />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="remarks" label="หมายเหตุ">
                  <Input.TextArea rows={2} placeholder="หมายเหตุเพิ่มเติม" maxLength={500} showCount />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <Card
          title={<span style={cardTitleStyle}>รายการ</span>}
          style={{ ...cardStyle, marginBottom: 16 }}
          loading={loading}
          extra={
            <Button icon={<CalculatorOutlined />} type={taxOpen ? 'primary' : 'default'} size="small" onClick={() => setTaxOpen((v) => !v)}>
              ภาษี / ส่วนลด
            </Button>
          }
        >
          <PettyCashLineItemsTable
            items={items}
            onChange={canEdit ? setItems : () => {}}
            useDisc={useDisc}
            discType={discType}
            useVat={useVat}
            useWht={useWht}
          />
        </Card>

        <Card title={<span style={cardTitleStyle}>สรุปยอด</span>} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>ยอดรวมก่อนลด</span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>฿ {fmt(subtotal)}</span>
              </div>
              {useDisc && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>ส่วนลด</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>- ฿ {fmt(totalDisc)}</span>
                </div>
              )}
              {useVat && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>VAT 7%</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#ca8a04' }}>+ ฿ {fmt(totalVat)}</span>
                </div>
              )}
              {useWht && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>WHT</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#dc2626' }}>- ฿ {fmt(totalWht)}</span>
                </div>
              )}
              <div style={{ borderTop: '0.5px solid #dbeafe', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>ยอดรวมสุทธิ</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>฿ {fmt(netAmount)}</span>
              </div>
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/petty-cash')}>กลับ</Button>
          <Space>
            <Button icon={<SaveOutlined />} onClick={() => handleSave('DRAFT')} loading={submitting} disabled={!canEdit}>
              บันทึกร่าง
            </Button>
            <PermissionButton
              menuCode={MENU_CODE}
              action={isEdit ? 'edit' : 'write'}
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSave('PENDING_APPROVAL')}
              loading={submitting}
              disabled={!canEdit}
            >
              ส่งอนุมัติ
            </PermissionButton>
          </Space>
        </div>
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
  )
}

export default PettyCashCreatePage
