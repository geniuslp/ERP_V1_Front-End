import React, { useState, useRef, useEffect } from 'react'
import {
  Card, Form, Select, DatePicker, Button, Space, message, Row, Col, Input, Modal, Alert,
} from 'antd'
import { useLocation } from 'react-router-dom'
import type { Memo } from '@/types'
import {
  SaveOutlined, SendOutlined, UploadOutlined, CloseCircleFilled, FileOutlined,
  PrinterOutlined, ArrowLeftOutlined, EditOutlined, CloseOutlined, StopOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import axios from 'axios'
import dayjs from 'dayjs'
import { useAppSelector } from '@/store'
import PurchaseOrderPrint from './PurchaseOrderPrint'
import POItemsTable from '@/components/common/POItemsTable'
import PRItemSelectionModal from '@/components/common/PRItemSelectionModal'
import TaxSidebarPanel from '@/pages/po/components/TaxSidebarPanel'
import type { PRListItem, PRLineWithPOStatus } from '@/types/pr'
import type { POLineItem } from '@/types/po'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

interface AttachedFile {
  uid: string
  name: string
  size: number
  file: File
}

interface SupplierOption {
  supplier_code: string
  supplier_name: string
}

const POCreatePage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const location = useLocation()
  const fromMemo: Memo | undefined = (location.state as any)?.memo
  const [form] = Form.useForm()
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [users, setUsers] = useState<{ value: number; label: string; dept?: string }[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [approvers, setApprovers] = useState<{ value: number; label: string; dept?: string }[]>([])
  const [approversLoading, setApproversLoading] = useState(false)
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [prOptions, setPrOptions] = useState<PRListItem[]>([])
  const [prOptionsLoading, setPrOptionsLoading] = useState(false)
  const [items, setItems] = useState<POLineItem[]>([])
  const [selectedPrId, setSelectedPrId] = useState<number | null>(null)
  const [prModalOpen, setPrModalOpen] = useState(false)
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [taxOpen, setTaxOpen] = useState(false)
  const [useDisc, setUseDisc] = useState(false)
  const [discType, setDiscType] = useState<'pct' | 'amt'>('pct')
  const [useVat, setUseVat] = useState(false)
  const [useWht, setUseWht] = useState(false)

  useEffect(() => {
    const fetchSuppliers = async () => {
      setSuppliersLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/suppliers`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setSuppliers(list)
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลผู้ขายไม่สำเร็จ'
        )
      } finally {
        setSuppliersLoading(false)
      }
    }
    fetchSuppliers()
  }, [])

  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { role: 'requester' },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setUsers(list.map((u: any) => ({
          value: Number(u.id),
          label: u.full_name ?? u.fullName ?? u.username,
          dept: u.department,
        })))
      } catch {
        message.error('โหลดรายชื่อผู้ขอซื้อไม่สำเร็จ')
      } finally {
        setUsersLoading(false)
      }
    }
    fetchUsers()
  }, [])

  useEffect(() => {
    const fetchApprovers = async () => {
      setApproversLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { role: 'approver' },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setApprovers(list.map((u: any) => ({
          value: Number(u.id),
          label: u.full_name ?? u.fullName ?? u.username,
          dept: u.department,
        })))
      } catch {
        message.error('โหลดรายชื่อผู้อนุมัติไม่สำเร็จ')
      } finally {
        setApproversLoading(false)
      }
    }
    fetchApprovers()
  }, [])

  useEffect(() => {
    const fetchLocations = async () => {
      setLocationsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/locations`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setLocations(list.map((l: any) => ({
          value: l.location_code,
          label: l.location_name ?? l.name,
        })))
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดสถานที่ไม่สำเร็จ'
        )
      } finally {
        setLocationsLoading(false)
      }
    }
    fetchLocations()
  }, [])

  useEffect(() => {
    const fetchPRs = async () => {
      setPrOptionsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/pr`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { page: 1, limit: 1000, status: 'APPROVED' },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data?.items ?? []
        setPrOptions(list)
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดรายการ PR ไม่สำเร็จ'
        )
      } finally {
        setPrOptionsLoading(false)
      }
    }
    fetchPRs()
  }, [])

  useEffect(() => {
    if (!fromMemo) return
    setItems(
      fromMemo.items.map((it, idx) => ({
        key: `from-memo-${it.id}`,
        no: idx + 1,
        pr_line_id: null,
        mat_code: '',
        mat_name: it.description,
        unit_name: it.unit,
        qty: it.quantity,
        unit_price: it.estimatedPrice,
        is_from_pr: false,
        description: it.remark ?? '',
      }))
    )
    setRemark(`[อ้างอิง Memo: ${fromMemo.memoNo}] ${fromMemo.note ?? ''}`.trim())
  }, [fromMemo])

  useEffect(() => {
    if (!fromMemo || !fromMemo.supplierName || suppliers.length === 0) return
    const matched = suppliers.find((s) => s.supplier_name === fromMemo.supplierName)
    if (matched) {
      form.setFieldsValue({ supplier_code: matched.supplier_code, vendorCode: matched.supplier_code })
    }
  }, [fromMemo, suppliers])

  const prLocked = items.some((i) => i.is_from_pr)
  const existingPrLineIds = items
    .filter((i) => i.is_from_pr && i.pr_line_id != null)
    .map((i) => i.pr_line_id as number)

  const handlePrChange = (newPrId: number | undefined) => {
    setSelectedPrId(newPrId ?? null)
    if (newPrId) {
      setPrModalOpen(true)
    } else {
      // cleared the dropdown — drop PR-sourced lines
      setItems((prev) => prev.filter((i) => !i.is_from_pr))
    }
  }

  // Fires on every option click (even re-selecting the same PR), so the
  // modal always reopens. onChange handles only the clear case above.
  const handlePrSelect = (prId: number) => {
    setSelectedPrId(prId)
    setPrModalOpen(true)
  }

  const handlePrItemsConfirm = (lines: PRLineWithPOStatus[]) => {
    setPrModalOpen(false)
    if (lines.length === 0) return
    setItems((prev) => {
      const existingLineIds = new Set(prev.map((i) => i.pr_line_id))
      const newLines = lines.filter((l) => !existingLineIds.has(l.id))
      const combined = [
        ...prev,
        ...newLines.map((l) => ({
          key: `pr-${l.id}`,
          no: 0,
          pr_line_id: l.id,
          mat_code: l.mat_code,
          mat_name: l.mat_name,
          unit_name: l.unit,
          qty: l.qty_remaining,
          unit_price: l.selected_unit_price ?? 0,
          is_from_pr: true,
        })),
      ]
      return combined.map((item, idx) => ({ ...item, no: idx + 1 }))
    })
  }

  const total = items.reduce((sum, i) => sum + i.qty * i.unit_price, 0)

  const validateItems = () => {
    if (items.length === 0) {
      message.warning('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ')
      return false
    }
    const invalid = items.some((i) => !i.mat_code || i.qty <= 0 || i.unit_price <= 0)
    if (invalid) {
      message.warning('กรุณากรอกรหัสวัสดุ จำนวน และราคาต่อหน่วยให้ถูกต้อง (มากกว่า 0) ทุกรายการ')
      return false
    }
    return true
  }

  const handleSubmit = async (status: 'DRAFT' | 'PENDING_APPROVAL') => {
    if (!validateItems()) return

    try {
      await form.validateFields()
    } catch {
      return
    }

    const values = form.getFieldsValue()
    if (!values.supplier_code) {
      message.warning('กรุณาเลือกผู้ขาย (Supplier)')
      return
    }

    const doSubmit = async () => {
      setSubmitting(true)
      try {
        const payload = {
          // ── Header ──
          supplier_code: values.supplier_code,
          warehouse_code: values.deliveryLocation,
          id: selectedPrId ?? null,
          rfq_id: null,
          currency: 'THB',
          expected_date: values.deliveryDate
            ? values.deliveryDate.format('YYYY-MM-DD')
            : undefined,
          payment_terms: values.paymentTerm ?? undefined,
          remarks: remark || undefined,
          status,

          // ── Tax (flat — not nested) ──
          use_discount: useDisc,
          discount_type: discType,
          use_vat: useVat,
          use_wht: useWht,

          // ── Lines ──
          lines: items.map((item, i) => ({
            line_no: i + 1,
            mat_code: item.mat_code,
            pr_line_id: item.pr_line_id ?? null,
            qty_ordered: item.qty,
            unit_price: item.unit_price,
            discount: item.disc ?? 0,
            wht_rate: useWht ? (item.wht_rate ?? 3) : null,
            description: item.description ?? undefined,
          })),
        }

        await axios.post(
          `${BASE_URL}/po`,
          payload,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        message.success(status === 'DRAFT' ? 'บันทึกร่าง PO สำเร็จ' : 'ส่งใบสั่งซื้อเรียบร้อยแล้ว')
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึก PO ไม่สำเร็จ'
        )
      } finally {
        setSubmitting(false)
      }
    }

    if (status === 'PENDING_APPROVAL') {
      const supplierLabel = suppliers.find((s) => s.supplier_code === values.supplier_code)?.supplier_name
      Modal.confirm({
        title: 'ยืนยันการส่งใบสั่งซื้อ',
        content: (
          <div>
            <div>ผู้ขาย: {supplierLabel ?? '-'}</div>
            <div>จำนวนรายการ: {items.length}</div>
            <div>มูลค่ารวม: ฿ {total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
          </div>
        ),
        okText: 'ยืนยันส่ง',
        cancelText: 'ยกเลิก',
        onOk: doSubmit,
      })
    } else {
      doSubmit()
    }
  }

  const poNumber = '6906-012'
  const poLatest = '6906-011'

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const newFiles: AttachedFile[] = Array.from(files).map((f) => ({
      uid: `${Date.now()}-${Math.random()}`,
      name: f.name,
      size: f.size,
      file: f,
    }))
    setAttachedFiles((prev) => [...prev, ...newFiles])
  }

  const removeFile = (uid: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.uid !== uid))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 12,
    border: 'none',
    boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  }

  const cardTitleStyle: React.CSSProperties = {
    color: '#1e3a8a',
    fontWeight: 600,
  }

  const labelStyle: React.CSSProperties = {
    color: '#374151',
    fontSize: 13,
  }

  return (
    <div>
      <PageHeader
        title="ออกใบสั่งซื้อ (PO)"
        subtitle="สร้างใบสั่งซื้อสินค้า/บริการเพื่อส่งอนุมัติ"
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'ใบสั่งซื้อ' },
          { title: 'สร้างใบสั่งซื้อ' },
        ]}
      />

      {fromMemo && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message={`กำลังสร้าง PO จากใบบันทึก: ${fromMemo.memoNo} — ${fromMemo.title}`}
          description="ข้อมูลถูก pre-fill จากใบบันทึกแล้ว สามารถแก้ไขได้ก่อนบันทึก"
        />
      )}

      <Row gutter={[16, 16]}>

        {/* ── Main Info Card ── */}
        <Col span={24}>
          <Card
            title={<span style={cardTitleStyle}>ข้อมูลใบสั่งซื้อ</span>}
            style={cardStyle}
          >
            <Form form={form} layout="vertical">
              <Row gutter={16}>

                {/* PO Number */}
                <Col xs={24} md={6}>
                  <Form.Item
                    label={
                      <span style={{ ...labelStyle, color: '#cc0000', fontWeight: 600 }}>
                        หมายเลข PO
                      </span>
                    }
                    name="poNumber"
                    initialValue={poNumber}
                  >
                    <Input
                      style={{ color: '#cc0000', fontWeight: 600 }}
                      prefix={
                        <span style={{ fontSize: 11, color: '#6b7280', marginRight: 4 }}>
                          ล่าสุด: <span style={{ color: '#cc0000' }}>{poLatest}</span>
                        </span>
                      }
                    />
                  </Form.Item>
                </Col>

                {/* Status */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>สถานะ</span>} name="status">
                    <Input defaultValue="open" disabled />
                  </Form.Item>
                </Col>

                {/* Date */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>วันที่</span>} name="date">
                    <Input
                      defaultValue={new Date().toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                      disabled
                    />
                  </Form.Item>
                </Col>

                {/* ชื่อย่อบริษัท — auto-filled from supplier select */}
                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={labelStyle}>ชื่อย่อบริษัท</span>}
                    name="vendorCode"
                  >
                    <Input disabled />
                  </Form.Item>
                </Col>

                {/* ชื่อบริษัท — supplier dropdown */}
                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span style={labelStyle}>ชื่อบริษัท</span>}
                    name="supplier_code"
                  >
                    <Select
                      showSearch
                      placeholder="- เลือกผู้ขาย -"
                      loading={suppliersLoading}
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={suppliers.map((s) => ({ value: s.supplier_code, label: s.supplier_name }))}
                      onChange={(code) => form.setFieldsValue({ vendorCode: code })}
                    />
                  </Form.Item>
                </Col>

                {/* เบอร์โทร */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>เบอร์โทร</span>} name="phone">
                    <Input />
                  </Form.Item>
                </Col>

                {/* Fax */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>Fax</span>} name="fax">
                    <Input />
                  </Form.Item>
                </Col>

                {/* พนักงานขาย */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>พนักงานขาย</span>} name="salesperson">
                    <Input />
                  </Form.Item>
                </Col>

                {/* อีเมลล์ */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>อีเมลล์</span>} name="email">
                    <Input />
                  </Form.Item>
                </Col>

                {/* เบอร์ติดต่อ */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>เบอร์ติดต่อ</span>} name="contactPhone">
                    <Input />
                  </Form.Item>
                </Col>

                {/* เงื่อนไขชำระเงิน */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>เงื่อนไขชำระเงิน</span>} name="paymentTerm">
                    <Input />
                  </Form.Item>
                </Col>

                {/* ผู้ขอซื้อ */}
                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={labelStyle}>ผู้ขอซื้อ</span>}
                    name="requestedBy"
                    rules={[{ required: true, message: 'กรุณาเลือกผู้ขอซื้อ' }]}
                  >
                    <Select
                      placeholder="- เลือกรายการ -"
                      loading={usersLoading}
                      showSearch
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      optionRender={(option) => (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span>{option.data.label}</span>
                          {option.data.dept && (
                            <span style={{ color: '#9ca3af', fontSize: 12, flexShrink: 0 }}>{option.data.dept}</span>
                          )}
                        </div>
                      )}
                      options={users}
                    />
                  </Form.Item>
                </Col>

                {/* สถานที่ส่งของ */}
                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={labelStyle}>สถานที่ส่งของ</span>}
                    name="deliveryLocation"
                    rules={[{ required: true, message: 'กรุณาเลือกสถานที่ส่งของ' }]}
                  >
                    <Select
                      placeholder="- เลือกรายการ -"
                      loading={locationsLoading}
                      showSearch
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={locations}
                    />
                  </Form.Item>
                </Col>

                {/* ผู้อนุมัติ */}
                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={labelStyle}>ผู้อนุมัติ</span>}
                    name="approver"
                    rules={[{ required: true, message: 'กรุณาเลือกผู้อนุมัติ' }]}
                  >
                    <Select
                      placeholder="- เลือกรายการ -"
                      loading={approversLoading}
                      showSearch
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
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

                {/* วันที่อนุมัติ */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>วันที่อนุมัติ</span>} name="approvedDate">
                    <Input disabled />
                  </Form.Item>
                </Col>

                {/* กำหนดส่งของ */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>กำหนดส่งของ</span>} name="deliveryDate">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                {/* Ref */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>Ref</span>} name="ref">
                    <Input />
                  </Form.Item>
                </Col>

                {/* PR Order */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>PR Order</span>} name="prOrder">
                    <Select
                      showSearch
                      allowClear
                      disabled={prLocked}
                      placeholder="- เลือก PR Order (เฉพาะที่อนุมัติแล้ว) -"
                      loading={prOptionsLoading}
                      onChange={handlePrChange}
                      onSelect={(val) => { if (val != null) handlePrSelect(val) }}
                      filterOption={(input, option) => {
                        const haystack = `${option?.pr_no ?? ''} ${option?.status ?? ''}`.toLowerCase()
                        return haystack.includes(input.toLowerCase())
                      }}
                      optionRender={(option) => (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span>{option.data.pr_no}</span>
                          <span style={{ color: '#9ca3af', fontSize: 12, flexShrink: 0 }}>
                            {option.data.pr_date}
                            {option.data.status ? ` · ${option.data.status}` : ''}
                          </span>
                        </div>
                      )}
                      options={prOptions.map((pr) => ({
                        value: pr.id,
                        label: pr.pr_no,
                        pr_no: pr.pr_no,
                        pr_date: pr.pr_date,
                        status: pr.status,
                      }))}
                    />
                  </Form.Item>
                  {selectedPrId && !prLocked && (
                    <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => setPrModalOpen(true)}>
                      เลือกรายการจาก PR
                    </Button>
                  )}
                </Col>

              </Row>
            </Form>
          </Card>
        </Col>

        {/* ── Items Table Card ── */}
        <Col span={24}>
          <Card
            title={<span style={cardTitleStyle}>เลือกรายการ วัสดุและบริการ</span>}
            style={cardStyle}
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 1, minWidth: 0, padding: 24 }}>
                <POItemsTable
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
        </Col>

        {/* ── Note Card ── */}
        <Col span={24}>
          <Card style={cardStyle}>
            <div style={{ color: '#cc0000', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              หมายเหตุ
            </div>
            <Input.TextArea
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </Card>
        </Col>

        {/* ── File Attachment Card ── */}
        <Col span={24}>
          <Card
            title={<span style={cardTitleStyle}>แนบไฟล์</span>}
            style={cardStyle}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              style={{ display: 'none' }}
              onChange={(e) => addFiles(e.target.files)}
              onClick={(e) => { ;(e.target as HTMLInputElement).value = '' }}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: `1.5px dashed ${isDragging ? '#2563eb' : '#bfdbfe'}`,
                borderRadius: 10,
                padding: '20px 24px',
                cursor: 'pointer',
                background: isDragging ? '#eff6ff' : '#f8faff',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <UploadOutlined style={{ fontSize: 22, color: '#2563eb' }} />
              <div>
                <div style={{ fontSize: 14, color: '#1e40af', fontWeight: 500 }}>
                  คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  รองรับไฟล์ JPG, PDF, DOC, XLS — สามารถเลือกได้หลายไฟล์พร้อมกัน
                </div>
              </div>
            </div>

            {attachedFiles.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {attachedFiles.map((f) => (
                  <div
                    key={f.uid}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#eff6ff',
                      border: '0.5px solid #bfdbfe',
                      borderRadius: 8,
                      padding: '5px 10px',
                      fontSize: 13,
                      color: '#1e40af',
                      maxWidth: 280,
                    }}
                  >
                    <FileOutlined style={{ fontSize: 14, flexShrink: 0 }} />
                    <span
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}
                      title={f.name}
                    >
                      {f.name}
                    </span>
                    <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>
                      ({formatSize(f.size)})
                    </span>
                    <CloseCircleFilled
                      onClick={(e) => { e.stopPropagation(); removeFile(f.uid) }}
                      style={{ fontSize: 14, color: '#93c5fd', cursor: 'pointer', flexShrink: 0, transition: 'color 0.15s' }}
                      onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#2563eb')}
                      onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#93c5fd')}
                    />
                  </div>
                ))}
              </div>
            )}

            {attachedFiles.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                {attachedFiles.length} ไฟล์ที่แนบ
              </div>
            )}
          </Card>
        </Col>

        {/* ── Action Bar Card ── */}
        <Col span={24}>
          <Card
            style={{
              ...cardStyle,
              position: 'sticky',
              bottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

              {/* Left: พิมพ์ + กลับ */}
              <Space>
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>พิมพ์</Button>
                <Button icon={<ArrowLeftOutlined />}>กลับหน้าหลัก</Button>
              </Space>

              {/* Right: action buttons */}
              <Space>
                <Button icon={<EditOutlined />}>Update</Button>
                <Button
                  icon={<CloseOutlined />}
                  style={{ borderColor: '#ef4444', color: '#ef4444' }}
                >
                  Cancel
                </Button>
                <Button
                  icon={<StopOutlined />}
                  style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
                >
                  Reject
                </Button>
                <Button
                  icon={<SaveOutlined />}
                  loading={submitting}
                  disabled={submitting}
                  onClick={() => handleSubmit('DRAFT')}
                >
                  บันทึกร่าง
                </Button>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={submitting}
                  disabled={submitting}
                  onClick={() => handleSubmit('PENDING_APPROVAL')}
                >
                  ส่งใบสั่งซื้อ
                </Button>
              </Space>

            </div>
          </Card>
        </Col>

      </Row>

      {/* Mounted but hidden on screen — takes over on window.print() */}
      <PurchaseOrderPrint />

      <PRItemSelectionModal
        open={prModalOpen}
        prId={selectedPrId}
        existingPrLineIds={existingPrLineIds}
        onClose={() => setPrModalOpen(false)}
        onConfirm={handlePrItemsConfirm}
      />
    </div>
  )
}

export default POCreatePage
