import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm, message, Tabs, Upload, Typography, Switch, Row, Col } from 'antd'
import type { UploadProps } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, InboxOutlined, CheckOutlined, WarningOutlined, ImportOutlined, SearchOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import axios from 'axios'
import { useAppSelector } from '@/store'
import * as XLSX from 'xlsx'

interface Supplier {
  id: number
  supplier_name: string
  tax_id?: string
  address?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  payment_terms?: string
  is_active: boolean
  office_phone?: string
  fax?: string
  currency?: string
  sales_person?: string
  sales_person_phone?: string
  remarks?: string
}

// Backend identifies/edits suppliers by id (PUT/DELETE /master/suppliers/:id) —
// no separate code column exists. Key the table row on id to match.
type SupplierRecord = Supplier & { key: number }

// "Bulk import" modal — separate feature from the Excel-file-based bulk import
// above (which POSTs { items } to /master/suppliers/bulk). This one is a
// paste/type-multiple-rows editable table, POSTing { suppliers } to /supplier/bulk.
// The supplier's id is deliberately NOT part of this row shape — the backend
// auto-assigns it per row and returns it in the response instead.
interface BulkRow {
  key: string
  supplier_name: string
  supplier_short_name: string
  tax_id: string
  address: string
  contact_name: string
  contact_phone: string
  contact_email: string
  office_phone: string
  fax: string
  payment_terms: string
  currency: string
  sales_person: string
}

let bulkRowSeq = 0
const makeEmptyBulkRow = (): BulkRow => ({
  key: `bulk-${Date.now()}-${bulkRowSeq++}`,
  supplier_name: '',
  supplier_short_name: '',
  tax_id: '',
  address: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  office_phone: '',
  fax: '',
  payment_terms: '',
  currency: '',
  sales_person: '',
})
const makeEmptyBulkRows = (n: number) => Array.from({ length: n }, makeEmptyBulkRow)

interface ExcelRow {
  rowNum: number
  supplier_name: string
  tax_id: string
  address: string
  contact_name: string
  contact_phone: string
  contact_email: string
  payment_terms: string
  is_active: string
  errors: string[]
}

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

// The supplier's id is NOT part of the template/import payload — the backend
// auto-assigns it (PK) per row and returns it in the bulk-import response instead.
const EXCEL_HEADERS = [
  'supplier_name', 'tax_id', 'address',
  'contact_name', 'contact_phone', 'contact_email', 'payment_terms', 'is_active',
]

interface CreatedSupplier {
  supplier_name: string
  id: number
}

const TH: React.CSSProperties = {
  padding: '7px 10px',
  textAlign: 'left',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  fontFamily: 'Sarabun, Tahoma, sans-serif',
  fontSize: 13,
  color: '#fff',
}

const TD: React.CSSProperties = {
  padding: '5px 10px',
  borderBottom: '1px solid #eee',
  verticalAlign: 'top',
  fontFamily: 'Sarabun, Tahoma, sans-serif',
  fontSize: 13,
}

const { Text } = Typography

const toBoolean = (v: string) =>
  v === '' || v.toLowerCase() === 'true' || v === '1' || v === 'ใช้งาน'

const parseExcelRows = (raw: Record<string, unknown>[]): ExcelRow[] =>
  raw.map((row, i) => {
    const g = (k: string) => String(row[k] ?? '').trim()
    const supplier_name = g('supplier_name')
    const contact_email = g('contact_email')
    const errors: string[] = []
    // Only supplier_name is validated — the supplier's id is backend-generated
    // (auto-increment PK) and never part of the import template, so it's never checked here.
    if (!supplier_name) errors.push('supplier_name: required')
    return {
      rowNum: i + 2,
      supplier_name,
      tax_id: g('tax_id'),
      address: g('address'),
      contact_name: g('contact_name'),
      contact_phone: g('contact_phone'),
      contact_email,
      payment_terms: g('payment_terms'),
      is_active: g('is_active'),
      errors,
    }
  })

const SupplierPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<SupplierRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Upload panel state
  const [parsedRows, setParsedRows] = useState<ExcelRow[]>([])
  const [uploadFileName, setUploadFileName] = useState('')
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [panelResult, setPanelResult] = useState<{ imported: number; duplicates: number; created: CreatedSupplier[] } | null>(null)

  // Excel import state (modal tab)
  const [activeTab, setActiveTab] = useState('form')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [importSummary, setImportSummary] = useState<{ imported: number; duplicates: number; created: CreatedSupplier[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bulk import (editable table) modal state
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() => makeEmptyBulkRows(3))
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkAttempted, setBulkAttempted] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ count: number; created: CreatedSupplier[] } | null>(null)

  // `search` is the debounced value actually sent to the API; `searchInput`
  // tracks the raw keystrokes so the box stays responsive while typing.
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searching, setSearching] = useState(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/suppliers`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: search ? { supplier_name: search } : undefined,
      })
      const list: Supplier[] = Array.isArray(res.data) ? res.data : res.data?.data ?? []
      setData(list.map((r) => ({ ...r, key: r.id })))
      setCurrentPage(1)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ'
      )
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }, [accessToken, search])

  // debounce the search box: wait 400ms after typing stops before hitting the
  // API, and jump back to page 1 since the result set changes.
  const handleSearchInputChange = (value: string) => {
    setSearchInput(value)
    setSearching(true)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setCurrentPage(1)
      setSearch(value)
    }, 400)
  }

  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
  }, [])

  // re-runs when accessToken becomes available or (debounced) search changes
  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const resetExcelState = () => {
    setExcelFile(null)
    setExcelRows([])
    setIsDragging(false)
    setImporting(false)
    setImportProgress('')
    setImportSummary(null)
  }

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setActiveTab('form')
    resetExcelState()
    setOpen(true)
  }

  const openEdit = (record: SupplierRecord) => {
    setEditing(record)
    form.resetFields()
    form.setFieldsValue(record)
    setActiveTab('form')
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    resetExcelState()
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    console.log('[SupplierPage] handleSave payload:', values) // TEMP DIAGNOSTIC — remove after Issue investigation
    setSaving(true)
    try {
      if (editing) {
        await axios.put(`${BASE_URL}/master/suppliers/${editing.id}`, values, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('แก้ไขข้อมูลผู้ขายสำเร็จ')
      } else {
        await axios.post(`${BASE_URL}/master/suppliers`, values, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('เพิ่มผู้ขายสำเร็จ')
      }
      closeModal()
      fetchSuppliers()
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึกไม่สำเร็จ'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${BASE_URL}/master/suppliers/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('ลบผู้ขายสำเร็จ')
      fetchSuppliers()
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ลบไม่สำเร็จ'
      )
    }
  }

  const openBulkModal = () => {
    setBulkRows(makeEmptyBulkRows(3))
    setBulkAttempted(false)
    setBulkResult(null)
    setBulkOpen(true)
  }

  const closeBulkModal = () => {
    setBulkOpen(false)
    setBulkRows(makeEmptyBulkRows(3))
    setBulkAttempted(false)
    setBulkResult(null)
  }

  const updateBulkRow = (key: string, field: keyof Omit<BulkRow, 'key'>, value: string) => {
    setBulkRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  }

  const addBulkRow = () => setBulkRows((prev) => [...prev, makeEmptyBulkRow()])

  const removeBulkRow = (key: string) => setBulkRows((prev) => prev.filter((r) => r.key !== key))

  const handleBulkSubmit = async () => {
    setBulkAttempted(true)
    // Rows the user never touched at all (still fully blank) are just unused
    // slots in the editable table, not something to validate/submit.
    const nonEmptyRows = bulkRows.filter((r) =>
      (Object.keys(r) as (keyof BulkRow)[]).some((k) => k !== 'key' && String(r[k]).trim() !== '')
    )
    if (nonEmptyRows.length === 0) {
      message.warning('กรุณากรอกข้อมูลผู้ขายอย่างน้อย 1 แถว')
      return
    }
    // Only supplier_name is required — no other validation (no duplicate-within-
    // batch check, no format check). The id is generated by the backend,
    // so it's never checked here and never sent in the request.
    if (nonEmptyRows.some((r) => !r.supplier_name.trim())) {
      message.error('กรุณากรอกชื่อผู้ขาย (จำเป็น) ให้ครบทุกแถว')
      return
    }
    setBulkSubmitting(true)
    try {
      const suppliers = nonEmptyRows.map(({ key, ...rest }) => rest)
      const res = await axios.post(
        `${BASE_URL}/supplier/bulk`,
        { suppliers },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const body = res.data?.data ?? res.data
      const created: CreatedSupplier[] = (body?.suppliers ?? body?.created ?? []).map((s: any) => ({
        supplier_name: s.supplier_name,
        id: s.id,
      }))
      const count = typeof body?.count === 'number' ? body.count : created.length || suppliers.length
      setBulkResult({ count, created })
      fetchSuppliers()
    } catch (err: any) {
      const data = err?.response?.data
      // Surface which row failed when the backend provides one, e.g.
      // { error: "duplicate supplier", index: 2 } / { row: 3 }.
      const rowRef = data?.index != null ? ` (แถวที่ ${Number(data.index) + 1})` : data?.row != null ? ` (แถวที่ ${data.row})` : ''
      message.error(
        (data?.message || data?.error || err?.message || 'นำเข้าซัพพลายเออร์ไม่สำเร็จ') + rowRef
      )
    } finally {
      setBulkSubmitting(false)
    }
  }

  const downloadTemplate = () => {
    const exampleRow = [
      'บริษัท ตัวอย่าง จำกัด', '0123456789012',
      '123 ถนนสุขุมวิท กรุงเทพ', 'สมชาย ใจดี',
      '02-123-4567', 'contact@example.com', '30', 'TRUE',
    ]
    const ws = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, exampleRow])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers')
    XLSX.writeFile(wb, 'supplier_template.xlsx')
  }

  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      message.error('รองรับเฉพาะไฟล์ .xlsx และ .xls เท่านั้น')
      return
    }
    setExcelFile(file)
    setImportSummary(null)
    setImportProgress('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const bytes = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(bytes, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        setExcelRows(parseExcelRows(raw))
      } catch {
        message.error('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์')
        setExcelFile(null)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleBulkImport = async () => {
    const validRows = excelRows.filter((r) => r.errors.length === 0)
    if (!validRows.length) return
    setImporting(true)
    setImportProgress(`กำลังนำเข้าข้อมูล ${validRows.length} รายการ...`)
    setImportSummary(null)
    try {
      const items = validRows.map((row) => ({
        supplier_name: row.supplier_name,
        tax_id: row.tax_id,
        address: row.address,
        contact_name: row.contact_name,
        contact_phone: row.contact_phone,
        contact_email: row.contact_email,
        payment_terms: row.payment_terms,
        is_active: toBoolean(row.is_active),
      }))
      const res = await axios.post(
        `${BASE_URL}/master/suppliers/bulk`,
        { items },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const { imported = 0, duplicates = 0 } = res.data
      const created: CreatedSupplier[] = (res.data?.suppliers ?? res.data?.created ?? []).map((s: any) => ({
        supplier_name: s.supplier_name,
        id: s.id,
      }))
      setImportSummary({ imported, duplicates, created })
      setImportProgress('')
      if (imported > 0) fetchSuppliers()
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'นำเข้าไม่สำเร็จ'
      )
      setImportProgress('')
    } finally {
      setImporting(false)
    }
  }

  // Upload panel handlers
  const handlePanelUpload: UploadProps['beforeUpload'] = (file) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      message.error('รองรับเฉพาะไฟล์ .xlsx, .xls, .csv เท่านั้น')
      return false
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const bytes = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(bytes, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        if (!raw.length) { message.warning('ไม่พบข้อมูลในไฟล์'); return }
        setParsedRows(parseExcelRows(raw))
        setUploadFileName(file.name)
        setPanelResult(null)
      } catch {
        message.error('ไม่สามารถอ่านไฟล์ได้')
      }
    }
    reader.readAsArrayBuffer(file)
    return false
  }

  const handlePanelConfirmImport = async () => {
    const valid = parsedRows.filter((r) => r.errors.length === 0)
    if (!valid.length) { message.warning('ไม่มีรายการที่ถูกต้องสำหรับนำเข้า'); return }
    setImportSubmitting(true)
    try {
      const items = valid.map((row) => ({
        supplier_name: row.supplier_name,
        tax_id: row.tax_id,
        address: row.address,
        contact_name: row.contact_name,
        contact_phone: row.contact_phone,
        contact_email: row.contact_email,
        payment_terms: row.payment_terms,
        is_active: toBoolean(row.is_active),
      }))
      const res = await axios.post(
        `${BASE_URL}/master/suppliers/bulk`,
        { items },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      setParsedRows([])
      setUploadFileName('')
      const { imported = 0, duplicates = 0 } = res.data
      const created: CreatedSupplier[] = (res.data?.suppliers ?? res.data?.created ?? []).map((s: any) => ({
        supplier_name: s.supplier_name,
        id: s.id,
      }))
      setPanelResult({ imported, duplicates, created })
      message.success(`นำเข้าสำเร็จ ${imported} รายการ${duplicates > 0 ? ` / ซ้ำ ${duplicates} รายการ` : ''}`)
      fetchSuppliers()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'นำเข้าไม่สำเร็จ')
    } finally {
      setImportSubmitting(false)
    }
  }

  const panelValidCount = parsedRows.filter((r) => r.errors.length === 0).length
  const panelErrorCount = parsedRows.filter((r) => r.errors.length > 0).length

  const panelUploadColumns = [
    {
      title: '#', key: 'no', width: 48, align: 'center' as const,
      render: (_: unknown, r: ExcelRow) => (
        <Text style={{ fontSize: 11, color: r.errors.length === 0 ? '#6b7280' : '#ef4444' }}>{r.rowNum}</Text>
      ),
    },
    { title: 'ชื่อผู้ขาย', dataIndex: 'supplier_name' },
    { title: 'อีเมล', dataIndex: 'contact_email', width: 180 },
    { title: 'ใช้งาน', dataIndex: 'is_active', width: 90 },
    {
      title: 'สถานะ', key: 'status', width: 240,
      render: (_: unknown, r: ExcelRow) => r.errors.length === 0
        ? <Tag color="success" style={{ fontSize: 11 }}><CheckOutlined /> ถูกต้อง</Tag>
        : <Tag color="error" icon={<WarningOutlined />} style={{ fontSize: 11, whiteSpace: 'normal', height: 'auto', lineHeight: '1.4' }}>{r.errors.join(' / ')}</Tag>,
    },
  ]

  const createdSupplierColumns = [
    { title: 'ชื่อผู้ขาย', dataIndex: 'supplier_name', key: 'supplier_name' },
    {
      title: 'ID ผู้ขายที่สร้าง', dataIndex: 'id', key: 'id', width: 180,
      render: (v: number) => <Tag color="blue">{v}</Tag>,
    },
  ]

  const validCount = excelRows.filter((r) => r.errors.length === 0).length
  const errorCount = excelRows.filter((r) => r.errors.length > 0).length

  const supplierForm = (
    <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
      <Form.Item name="supplier_name" label="ชื่อผู้ขาย" rules={[{ required: true, message: 'กรุณากรอกชื่อผู้ขาย' }]}>
        <Input placeholder="ชื่อบริษัท / ร้านค้า" />
      </Form.Item>
      <Form.Item name="tax_id" label="เลขประจำตัวผู้เสียภาษี">
        <Input placeholder="0123456789012" />
      </Form.Item>
      <Form.Item name="address" label="ที่อยู่">
        <Input.TextArea rows={3} placeholder="ที่อยู่" />
      </Form.Item>
      <Form.Item name="contact_phone" label="เบอร์โทรผู้ติดต่อ">
        <Input placeholder="0XX-XXX-XXXX" />
      </Form.Item>
      <Form.Item name="contact_email" label="อีเมล">
        <Input placeholder="email@example.com" />
      </Form.Item>
      <Form.Item name="office_phone" label="เบอร์โทรสำนักงาน">
        <Input placeholder="0X-XXX-XXXX" />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="sales_person" label="พนักงานขาย">
            <Input placeholder="ชื่อพนักงานขาย" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="sales_person_phone" label="Tel">
            <Input placeholder="0XX-XXX-XXXX" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="currency" label="สกุลเงิน">
        <Input placeholder="เช่น THB, USD" />
      </Form.Item>
      <Form.Item name="payment_terms" label="เงื่อนไขการชำระเงิน">
        <Select
          placeholder="เลือกเงื่อนไขการชำระเงิน"
          options={[
            { label: 'เงินสด', value: 'เงินสด' },
            ...[7, 15, 30, 45, 90].map((d) => ({ label: `${d} วัน`, value: `${d} วัน` })),
          ]}
          allowClear
        />
      </Form.Item>
      <Form.Item name="is_active" label="สถานะการใช้งาน" valuePropName="checked" initialValue={true}>
        <Switch checkedChildren="ใช้งาน" unCheckedChildren="ปิดใช้งาน" />
      </Form.Item>
      <Form.Item name="remarks" label="หมายเหตุ">
        <Input.TextArea rows={3} placeholder="หมายเหตุ" />
      </Form.Item>
    </Form>
  )

  const excelPanel = (
    <div style={{ fontFamily: 'Sarabun, Tahoma, sans-serif', fontSize: 14, paddingTop: 8 }}>
      {/* Template download */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
          ดาวน์โหลด Template
        </Button>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        style={{
          border: `2px dashed ${isDragging ? '#2563a8' : '#aaa'}`,
          borderRadius: 8,
          padding: '28px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragging ? '#e8f0fe' : '#fafafa',
          transition: 'border-color 0.2s, background 0.2s',
          marginBottom: 16,
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        {excelFile ? (
          <div>
            <div style={{ fontSize: 15, color: '#2563a8', fontWeight: 600, marginBottom: 4 }}>
              📄 {excelFile.name}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>คลิกเพื่อเลือกไฟล์ใหม่</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 8 }}>📂</div>
            <div style={{ color: '#555', marginBottom: 4 }}>ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</div>
            <div style={{ fontSize: 12, color: '#888' }}>รองรับ .xlsx, .xls เท่านั้น</div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>

      {/* Preview table */}
      {excelRows.length > 0 && !importSummary && (
        <>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#555', display: 'flex', gap: 20 }}>
            <span>ทั้งหมด: <strong>{excelRows.length}</strong> แถว</span>
            <span style={{ color: '#22c55e' }}>ถูกต้อง: <strong>{validCount}</strong></span>
            {errorCount > 0 && (
              <span style={{ color: '#dc2626' }}>ผิดพลาด: <strong>{errorCount}</strong></span>
            )}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#2563a8', position: 'sticky', top: 0 }}>
                  {['#', 'ชื่อผู้ขาย', 'อีเมล', 'ใช้งาน', 'ข้อผิดพลาด'].map((h) => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {excelRows.map((row) => {
                  const hasErr = row.errors.length > 0
                  return (
                    <tr key={row.rowNum} style={{ background: hasErr ? '#fef2f2' : '#fff' }}>
                      <td style={TD}>{row.rowNum}</td>
                      <td style={{ ...TD, color: !row.supplier_name ? '#dc2626' : undefined }}>
                        {row.supplier_name || <em style={{ color: '#dc2626' }}>ว่าง</em>}
                      </td>
                      <td style={TD}>
                        {row.contact_email || '—'}
                      </td>
                      <td style={TD}>{row.is_active || '—'}</td>
                      <td style={{ ...TD, color: '#dc2626', fontSize: 12 }}>
                        {row.errors.join(' / ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Progress */}
      {importProgress && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: 6, color: '#2563a8',
        }}>
          ⏳ {importProgress}
        </div>
      )}

      {/* Summary */}
      {importSummary && (
        <div style={{
          marginTop: 12, padding: '14px 16px',
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6,
        }}>
          <div style={{ fontWeight: 600, color: '#22c55e', marginBottom: 6 }}>✅ นำเข้าเสร็จสิ้น</div>
          <div>สำเร็จ: <strong>{importSummary.imported}</strong> รายการ</div>
          {importSummary.duplicates > 0 && (
            <div style={{ color: '#b45309' }}>
              ซ้ำ / ผิดพลาด: <strong>{importSummary.duplicates}</strong> รายการ
            </div>
          )}
          {importSummary.created.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <Table
                rowKey="id"
                size="small"
                dataSource={importSummary.created}
                columns={createdSupplierColumns}
                pagination={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )

  const modalFooter = () => {
    if (activeTab === 'form' || editing) {
      return [
        <Button key="cancel" onClick={closeModal}>ยกเลิก</Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>บันทึก</Button>,
      ]
    }
    if (importSummary) {
      return [
        <Button key="close" type="primary" onClick={closeModal}>ปิด</Button>,
      ]
    }
    return [
      <Button key="cancel" onClick={closeModal}>ยกเลิก</Button>,
      <Button
        key="import"
        type="primary"
        loading={importing}
        disabled={excelRows.length === 0 || errorCount > 0 || validCount === 0}
        onClick={handleBulkImport}
      >
        นำเข้า{validCount > 0 ? ` (${validCount} รายการ)` : ''}
      </Button>,
    ]
  }

  const bulkCellInput = (row: BulkRow, field: keyof Omit<BulkRow, 'key'>, placeholder: string, required?: boolean) => {
    const isEmpty = !row[field].trim()
    return (
      <Input
        size="small"
        value={row[field]}
        placeholder={placeholder}
        status={required && bulkAttempted && isEmpty ? 'error' : undefined}
        onChange={(e) => updateBulkRow(row.key, field, e.target.value)}
      />
    )
  }

  const bulkColumns = [
    {
      title: <span>ชื่อผู้ขาย <span style={{ color: '#dc2626' }}>*</span></span>,
      key: 'supplier_name',
      width: 200,
      render: (_: unknown, r: BulkRow) => bulkCellInput(r, 'supplier_name', 'ชื่อบริษัท / ร้านค้า', true),
    },
    {
      title: 'ชื่อย่อ', key: 'supplier_short_name', width: 140,
      render: (_: unknown, r: BulkRow) => bulkCellInput(r, 'supplier_short_name', 'ชื่อย่อ'),
    },
    {
      title: 'เลขผู้เสียภาษี', key: 'tax_id', width: 160,
      render: (_: unknown, r: BulkRow) => bulkCellInput(r, 'tax_id', '0123456789012'),
    },
    {
      title: 'ที่อยู่', key: 'address', width: 220,
      render: (_: unknown, r: BulkRow) => bulkCellInput(r, 'address', 'ที่อยู่'),
    },
    {
      title: 'ผู้ติดต่อ', key: 'contact_name', width: 150,
      render: (_: unknown, r: BulkRow) => bulkCellInput(r, 'contact_name', 'ชื่อผู้ติดต่อ'),
    },
    {
      title: 'เบอร์โทรผู้ติดต่อ', key: 'contact_phone', width: 150,
      render: (_: unknown, r: BulkRow) => bulkCellInput(r, 'contact_phone', '0XX-XXX-XXXX'),
    },
    {
      title: 'อีเมล', key: 'contact_email', width: 190,
      render: (_: unknown, r: BulkRow) => bulkCellInput(r, 'contact_email', 'email@example.com'),
    },
    {
      title: 'เบอร์โทรสำนักงาน', key: 'office_phone', width: 150,
      render: (_: unknown, r: BulkRow) => bulkCellInput(r, 'office_phone', '0X-XXX-XXXX'),
    },
    {
      title: 'เงื่อนไขชำระเงิน', key: 'payment_terms', width: 140,
      render: (_: unknown, r: BulkRow) => bulkCellInput(r, 'payment_terms', 'เช่น 30 วัน'),
    },
    {
      title: 'สกุลเงิน', key: 'currency', width: 110,
      render: (_: unknown, r: BulkRow) => bulkCellInput(r, 'currency', 'เช่น THB'),
    },
    {
      title: 'พนักงานขาย', key: 'sales_person', width: 150,
      render: (_: unknown, r: BulkRow) => bulkCellInput(r, 'sales_person', 'ชื่อพนักงานขาย'),
    },
    {
      title: '', key: 'action', width: 50, fixed: 'right' as const,
      render: (_: unknown, r: BulkRow) => (
        <Button
          size="small"
          danger
          type="text"
          icon={<DeleteOutlined />}
          onClick={() => removeBulkRow(r.key)}
          disabled={bulkRows.length <= 1}
        />
      ),
    },
  ]

  const bulkModalFooter = bulkResult
    ? [<Button key="close" type="primary" onClick={closeBulkModal}>ปิด</Button>]
    : [
        <Button key="cancel" onClick={closeBulkModal}>ยกเลิก</Button>,
        <Button
          key="submit"
          type="primary"
          loading={bulkSubmitting}
          onClick={handleBulkSubmit}
          style={{ background: '#2563eb', border: 'none' }}
        >
          นำเข้าซัพพลายเออร์
        </Button>,
      ]

  const columns = [
    {
      title: 'ลำดับ',
      key: 'no',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, __: SupplierRecord, index: number) =>
        (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: <div style={{ textAlign: 'center' }}>ชื่อผู้ขาย</div>,
      dataIndex: 'supplier_name',
      width: 180,
      render: (v: string) => (
        <div style={{ textAlign: 'left', paddingLeft: 36 }}>
          <Text strong style={{ fontSize: 14, color: '#1e3a8a' }}>{v}</Text>
        </div>
      ),
    },
    { title: 'ผู้ติดต่อ', dataIndex: 'contact_name', width: 140 },
    { title: 'เบอร์โทร', dataIndex: 'contact_phone', width: 120 },
    { title: 'อีเมล', dataIndex: 'contact_email', width: 180, ellipsis: true },
    {
      title: 'หมายเหตุ',
      dataIndex: 'remarks',
      width: 180,
      ellipsis: true,
      render: (v?: string) => v || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: '',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, r: SupplierRecord) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="ยืนยันการลบ?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ผู้ขาย (Supplier)"
        subtitle="จัดการข้อมูลผู้ขายและซัพพลายเออร์"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'ผู้ขาย' }]}
      />

      <Card
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}
        extra={
          <Space>
            <Input
              placeholder="ค้นหาชื่อร้าน / ชื่อผู้ขาย"
              allowClear
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              value={searchInput}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              style={{ width: 260 }}
            />
            <Button icon={<ImportOutlined />} onClick={openBulkModal}>
              นำเข้าซัพพลายเออร์ (Bulk)
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              เพิ่มผู้ขาย
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="key"
          loading={loading || searching}
          dataSource={data}
          columns={columns}
          size="small"
          scroll={{ x: 900 }}
          pagination={{
            current: currentPage,
            pageSize,
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (page, size) => { setCurrentPage(page); setPageSize(size) },
          }}
        />
      </Card>

      {/* Upload panel */}
      <Card
        style={{ marginTop: 20, borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}
        title={<span style={{ fontWeight: 600 }}>อัปโหลดไฟล์เพื่อนำเข้าข้อมูล</span>}
        extra={
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
            ดาวน์โหลด Template (.xlsx)
          </Button>
        }
      >
        <Upload.Dragger
          name="file"
          accept=".xlsx,.xls,.csv"
          showUploadList={false}
          beforeUpload={handlePanelUpload}
          style={{
            borderRadius: 10,
            borderColor: parsedRows.length ? '#3b82f6' : '#d1d5db',
            background: parsedRows.length ? '#eff6ff' : undefined,
          }}
        >
          <div style={{ padding: parsedRows.length ? '8px 0' : '14px 0' }}>
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

        {panelResult && (
          <div style={{ marginTop: 16, padding: '14px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6 }}>
            <div style={{ fontWeight: 600, color: '#22c55e', marginBottom: 6 }}>✅ นำเข้าเสร็จสิ้น</div>
            <div>สำเร็จ: <strong>{panelResult.imported}</strong> รายการ</div>
            {panelResult.duplicates > 0 && (
              <div style={{ color: '#b45309' }}>ซ้ำ / ผิดพลาด: <strong>{panelResult.duplicates}</strong> รายการ</div>
            )}
            {panelResult.created.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <Table
                  rowKey="id"
                  size="small"
                  dataSource={panelResult.created}
                  columns={createdSupplierColumns}
                  pagination={false}
                />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onClick={() => setPanelResult(null)}>นำเข้าอีกครั้ง</Button>
            </div>
          </div>
        )}

        {!panelResult && parsedRows.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '16px 0 10px' }}>
              <Text strong style={{ fontSize: 13 }}>ตรวจสอบข้อมูล</Text>
              <Tag color="blue" style={{ fontSize: 11 }}>{uploadFileName}</Tag>
              <Tag color="success" style={{ fontSize: 11 }}>
                <CheckOutlined /> ถูกต้อง {panelValidCount} รายการ
              </Tag>
              {panelErrorCount > 0 && (
                <Tag color="error" style={{ fontSize: 11 }}>
                  <WarningOutlined /> มีข้อผิดพลาด {panelErrorCount} รายการ
                </Tag>
              )}
            </div>

            <Table
              size="small"
              dataSource={parsedRows.map((r, i) => ({ ...r, key: i }))}
              columns={panelUploadColumns}
              scroll={{ x: 800 }}
              pagination={parsedRows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
              rowClassName={(r: ExcelRow) => (r.errors.length === 0 ? '' : 'import-row-error')}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button onClick={() => { setParsedRows([]); setUploadFileName('') }}>ล้างข้อมูล</Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={importSubmitting}
                disabled={panelValidCount === 0}
                onClick={handlePanelConfirmImport}
                style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', border: 'none' }}
              >
                ยืนยันนำเข้า ({panelValidCount} รายการ)
              </Button>
            </div>
          </>
        )}
      </Card>

      <Modal
        title={editing ? 'แก้ไขผู้ขาย' : activeTab === 'excel' ? 'นำเข้าผู้ขาย จาก Excel' : 'เพิ่มผู้ขาย'}
        open={open}
        onCancel={closeModal}
        footer={modalFooter()}
        destroyOnClose
        width={activeTab === 'excel' ? 800 : 560}
      >
        {editing ? (
          supplierForm
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'form', label: 'กรอกข้อมูล', children: supplierForm },
              { key: 'excel', label: 'นำเข้า Excel', children: excelPanel },
            ]}
          />
        )}
      </Modal>

      <Modal
        title={<span style={{ fontFamily: 'Sarabun, sans-serif', fontWeight: 700, color: '#1e3a8a' }}>นำเข้าซัพพลายเออร์ (Bulk)</span>}
        open={bulkOpen}
        onCancel={closeBulkModal}
        footer={bulkModalFooter}
        destroyOnClose
        width={1200}
      >
        {bulkResult ? (
          <div
            style={{
              padding: '14px 16px',
              background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
            }}
          >
            <div style={{ fontWeight: 600, color: '#16a34a', marginBottom: bulkResult.created.length > 0 ? 10 : 0 }}>
              <CheckOutlined /> นำเข้าสำเร็จ {bulkResult.count} รายการ
            </div>
            {bulkResult.created.length > 0 && (
              <Table
                rowKey="id"
                size="small"
                dataSource={bulkResult.created}
                columns={createdSupplierColumns}
                pagination={false}
              />
            )}
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
              กรอกข้อมูลผู้ขายหลายรายการพร้อมกัน — ต้องระบุ "ชื่อผู้ขาย" เท่านั้น ฟิลด์อื่นเว้นว่างได้ (รหัสผู้ขายจะถูกสร้างโดยระบบอัตโนมัติ)
            </div>
            <Table
              rowKey="key"
              size="small"
              dataSource={bulkRows}
              columns={bulkColumns}
              pagination={false}
              scroll={{ x: 1780 }}
            />
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addBulkRow}
              style={{ marginTop: 12, width: '100%' }}
            >
              เพิ่มแถว
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default SupplierPage
