import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Typography, Tag, Row } from 'antd'
import type { UploadProps } from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  DownloadOutlined, InboxOutlined, CheckOutlined, WarningOutlined,
} from '@ant-design/icons'
import { Upload } from 'antd'
import * as XLSX from 'xlsx'
import PageHeader from '@/components/common/PageHeader'
import axios from 'axios'
import { useAppSelector } from '@/store'
import { PAYMENT_TERM_OPTIONS } from '@/constants/paymentTerms'

// Customer form reuses Supplier's shared option list verbatim, just excluding
// "เงินสด" at render time (per explicit instruction — the shared source
// itself is not altered, so "เงินสด" stays available on the Supplier page).
const CUSTOMER_CREDIT_TERM_OPTIONS = PAYMENT_TERM_OPTIONS.filter((o) => o.value !== 'เงินสด')

interface Customer {
  cus_id: number
  customer_code: string
  customer_name: string
  address?: string
  contact?: string
  credit_term?: string
  remarks?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// Backend keys customers by cus_id (GET/PUT/DELETE /customer/:id) — key the table row on it.
type CustomerRecord = Customer & { key: number }

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const { Text, Title } = Typography

// ── file import helpers — mirrors MaterialPage.tsx's client-side-only
// parse/validate/preview pattern exactly (no server-side preview/validate
// endpoint; the file is never uploaded raw, only the parsed+validated rows
// are POSTed as JSON to a /bulk endpoint) ──────────────────────────────
const FILE_COLS = ['customer_code', 'customer_name', 'address', 'contact', 'credit_term', 'remarks']

// Template is now generated server-side (GET /customer/import/template) so
// current dropdown options (credit_term, etc.) are baked in as Excel data
// validation and the template never goes stale — no more client-side
// XLSX.writeFile generation here.
const downloadTemplate = async (accessToken?: string) => {
  try {
    const res = await axios.get(`${BASE_URL}/customer/import/template`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'customer_import_template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err: any) {
    message.error(err?.response?.data?.message || err?.message || 'ดาวน์โหลด Template ไม่สำเร็จ')
  }
}

interface ParsedRow {
  row: number
  valid: boolean
  error?: string
  data: {
    customer_code: string
    customer_name: string
    address: string
    contact: string
    credit_term: string
    remarks: string
  }
}

const isBlank = (v: string) => v.trim() === ''
const REQUIRED_FIELDS = ['customer_code', 'customer_name'] as const

const parseRows = (rows: Record<string, string>[], validCreditTerms: string[]): ParsedRow[] =>
  rows.map((cols, i) => {
    const get = (f: string) => String(cols[f] ?? '').trim()
    const data = {
      customer_code: get('customer_code'),
      customer_name: get('customer_name'),
      address: get('address'),
      contact: get('contact'),
      credit_term: get('credit_term'),
      remarks: get('remarks'),
    }
    const missing = REQUIRED_FIELDS.filter((f) => isBlank(get(f)))
    if (missing.length > 0)
      return { row: i + 2, valid: false, error: `ข้อมูลไม่ครบในฟิลด์: ${missing.join(', ')}`, data }

    if (data.credit_term && !validCreditTerms.includes(data.credit_term))
      return { row: i + 2, valid: false, error: `เครดิต "${data.credit_term}" ไม่ใช่ตัวเลือกที่ถูกต้อง`, data }

    return { row: i + 2, valid: true, data }
  })

const MISSING_COLS_ERROR = 'MISSING_COLUMNS'

const readFileAsRows = (file: File, validCreditTerms: string[]): Promise<ParsedRow[]> =>
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
        resolve(parseRows(json, validCreditTerms))
      } catch (err) {
        reject(err instanceof Error && err.name === MISSING_COLS_ERROR ? err : new Error('อ่านไฟล์ไม่ได้'))
      }
    }
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'))
    reader.readAsArrayBuffer(file)
  })

const panelStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 14,
  boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0', overflow: 'hidden',
}
const panelHead: React.CSSProperties = {
  padding: '16px 20px', borderBottom: '1px solid #f3f4f6',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}

const CustomerPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }
  const [data, setData] = useState<CustomerRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  // `search` is the debounced value actually sent to the API; `searchInput`
  // tracks the raw keystrokes so the box stays responsive while typing.
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searching, setSearching] = useState(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Import panel state (mirrors MaterialPage.tsx)
  const [uploadFileName, setUploadFileName] = useState('')
  // The parsed rows drive the client-side preview only. The backend actually
  // parses the .xlsx itself, so the ORIGINAL file is kept here and sent as
  // multipart/form-data on submit — the parsed JSON is never POSTed.
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const IMPORT_PAGE_SIZE = 10
  const [importPage, setImportPage] = useState(1)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [flashRowKey, setFlashRowKey] = useState<number | null>(null)
  const importRowRefs = useRef<Record<number, HTMLElement | null>>({})

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

  useEffect(() => {
    if (flashRowKey === null) return
    const timer = setTimeout(() => setFlashRowKey(null), 1300)
    return () => clearTimeout(timer)
  }, [flashRowKey])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/customer`, {
        headers: authHeader,
        params: { page: currentPage, page_size: pageSize, search: search || undefined },
      })
      const body = res.data?.data ?? res.data
      const list: Customer[] = Array.isArray(body) ? body : body?.items ?? body?.data ?? []
      setData(list.map((r) => ({ ...r, key: r.cus_id })))
      setTotal(res.data?.total ?? body?.total ?? list.length)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ'
      )
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }, [accessToken, currentPage, pageSize, search])

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

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setOpen(true)
  }

  const openEdit = (record: CustomerRecord) => {
    setEditing(record)
    form.resetFields()
    form.setFieldsValue(record)
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        const { customer_code, ...updateValues } = values
        await axios.put(`${BASE_URL}/customer/${editing.cus_id}`, updateValues, {
          headers: authHeader,
        })
        message.success('แก้ไขข้อมูลลูกค้าสำเร็จ')
        closeModal()
        fetchCustomers()
      } else {
        const res = await axios.post(`${BASE_URL}/customer`, values, {
          headers: authHeader,
        })
        const created: Customer = res.data?.data ?? res.data
        message.success(`สร้างลูกค้าสำเร็จ รหัส: ${created.customer_code}`)
        closeModal()
        // response already carries the full created record — no refetch needed
        setData((prev) => [{ ...created, key: created.cus_id }, ...prev])
        setTotal((prev) => prev + 1)
      }
    } catch (err: any) {
      if (!editing && err?.response?.status === 409) {
        form.setFields([{ name: 'customer_code', errors: ['รหัสลูกค้านี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น'] }])
      } else {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึกไม่สำเร็จ'
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${BASE_URL}/customer/${id}`, {
        headers: authHeader,
      })
      message.success('ปิดใช้งานลูกค้าสำเร็จ')
      fetchCustomers()
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ปิดใช้งานไม่สำเร็จ'
      )
    }
  }

  const handleUpload: UploadProps['beforeUpload'] = (file) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      message.error('รองรับเฉพาะไฟล์ .xlsx เท่านั้น')
      return false
    }
    readFileAsRows(file, CUSTOMER_CREDIT_TERM_OPTIONS.map((o) => String(o.value)))
      .then((rows) => {
        if (rows.length === 0) { message.error('ไม่พบข้อมูลในไฟล์ หรือไฟล์ไม่ถูกต้อง'); return }
        setParsedRows(rows)
        setUploadFile(file)
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
    if (!uploadFile) { message.error('ไม่พบไฟล์ที่อัปโหลด กรุณาเลือกไฟล์ใหม่'); return }
    setImportSubmitting(true)
    try {
      // Backend parses the .xlsx itself — send the original file as
      // multipart/form-data, not the client-parsed JSON rows (those only
      // drive the preview table above).
      const formData = new FormData()
      formData.append('file', uploadFile)
      const res = await axios.post(
        `${BASE_URL}/customer/import`,
        formData,
        { headers: { ...authHeader, 'Content-Type': 'multipart/form-data' } }
      )
      setParsedRows([])
      setUploadFile(null)
      setUploadFileName('')
      message.success(`นำเข้าสำเร็จ ${res.data?.count ?? valid.length} รายการ`)
      await fetchCustomers()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'นำเข้าข้อมูลไม่สำเร็จ'
      message.error(msg)
    } finally {
      setImportSubmitting(false)
    }
  }

  const columns = [
    {
      title: 'ลำดับ',
      key: 'no',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, __: CustomerRecord, index: number) =>
        (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: 'รหัสลูกค้า',
      dataIndex: 'customer_code',
      width: 130,
      render: (v: string) => <Text style={{ fontFamily: 'Sarabun, IBM Plex Sans Thai, sans-serif' }}>{v}</Text>,
    },
    {
      title: 'ชื่อลูกค้า',
      dataIndex: 'customer_name',
      width: 220,
      render: (v: string) => <Text strong style={{ fontSize: 14, color: '#1e3a8a' }}>{v}</Text>,
    },
    {
      title: 'ผู้ติดต่อ',
      dataIndex: 'contact',
      width: 220,
      ellipsis: true,
      render: (v?: string) => v || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'เครดิต (วัน)',
      dataIndex: 'credit_term',
      width: 110,
      align: 'center' as const,
      render: (v?: string) => (v == null || v === '' ? <span style={{ color: '#9ca3af' }}>—</span> : v),
    },
    {
      title: 'หมายเหตุ',
      dataIndex: 'remarks',
      width: 200,
      ellipsis: true,
      render: (v?: string) => v || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: '',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, r: CustomerRecord) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          {r.is_active && (
            <Popconfirm title="ยืนยันการปิดใช้งานลูกค้ารายนี้?" onConfirm={() => handleDelete(r.cus_id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ลูกค้า (Customer)"
        subtitle="จัดการข้อมูลลูกค้า"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'ลูกค้า' }]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 8 }}>
            สร้างลูกค้า
          </Button>
        }
      />

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="ค้นหาชื่อ / รหัสลูกค้า"
            allowClear
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={searchInput}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
          />
          <Button
            onClick={() => {
              setSearchInput('')
              setSearching(true)
              setCurrentPage(1)
              setSearch('')
            }}
            style={{ borderRadius: 8 }}
          >
            ล้างค้นหา
          </Button>
        </Space>

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
            total,
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (page, size) => { setCurrentPage(page); setPageSize(size) },
          }}
        />
      </Card>

      {/* upload panel — mirrors MaterialPage.tsx's inline import section exactly */}
      <div style={{ ...panelStyle, marginTop: 20 }}>
        <div style={panelHead}>
          <div>
            <Title level={5} style={{ margin: 0 }}>อัปโหลดไฟล์เพื่อนำเข้าข้อมูล</Title>
            <Text style={{ fontSize: 12, color: '#9ca3af' }}>นำเข้าข้อมูลลูกค้าจากไฟล์ Excel ได้ครั้งละหลายรายการ</Text>
          </div>
          <Button icon={<DownloadOutlined />} onClick={() => downloadTemplate(accessToken)}>ดาวน์โหลด Template (.xlsx)</Button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <Upload.Dragger
            name="file" accept=".xlsx" showUploadList={false}
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
                รองรับไฟล์ <Text code>.xlsx</Text> เท่านั้น
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
                onRow={((r: ParsedRow & { key: number }) => ({
                  ref: (el: HTMLElement | null) => { importRowRefs.current[r.key] = el },
                })) as any}
                rowClassName={((r: ParsedRow & { key: number }) =>
                  r.key === flashRowKey ? 'import-row-flash' : (r.valid ? '' : 'import-row-error')
                ) as any}
                columns={[
                  {
                    title: '#', key: 'no', width: 48, align: 'center' as const,
                    render: (_: unknown, r: ParsedRow) => (
                      <Text style={{ fontSize: 11, color: r.valid ? '#6b7280' : '#ef4444' }}>{r.row}</Text>
                    ),
                  },
                  {
                    title: 'รหัสลูกค้า', key: 'code', width: 130,
                    render: (_: unknown, r: ParsedRow) => (
                      <Text code style={{ fontSize: 11 }}>{r.data.customer_code || <span style={{ color: '#f87171' }}>—</span>}</Text>
                    ),
                  },
                  {
                    title: 'ชื่อลูกค้า', key: 'name', width: 200,
                    render: (_: unknown, r: ParsedRow) => (
                      <div style={{ fontSize: 12 }}>{r.data.customer_name || <span style={{ color: '#f87171' }}>—</span>}</div>
                    ),
                  },
                  {
                    title: 'ผู้ติดต่อ', key: 'contact', width: 200,
                    render: (_: unknown, r: ParsedRow) => (
                      <div style={{ fontSize: 12 }}>{r.data.contact || '—'}</div>
                    ),
                  },
                  {
                    title: 'เครดิต', key: 'credit', width: 100,
                    render: (_: unknown, r: ParsedRow) => (
                      <div style={{ fontSize: 12 }}>{r.data.credit_term || '—'}</div>
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
                  <Button onClick={() => { setParsedRows([]); setUploadFile(null); setUploadFileName(''); setImportPage(1); setFlashRowKey(null) }}>ล้างข้อมูล</Button>
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

      <Modal
        title={<span style={{ fontFamily: 'Sarabun, sans-serif', fontWeight: 700, color: '#1e3a8a' }}>{editing ? 'แก้ไขลูกค้า' : 'สร้างลูกค้า'}</span>}
        open={open}
        onCancel={closeModal}
        destroyOnClose
        width={560}
        footer={[
          <Button key="cancel" onClick={closeModal} style={{ borderRadius: 8 }}>ยกเลิก</Button>,
          <Button key="save" type="primary" loading={saving} onClick={handleSave} style={{ borderRadius: 8 }}>บันทึก</Button>,
        ]}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="customer_code"
            label="รหัสลูกค้า"
            rules={editing ? [] : [{ required: true, message: 'กรุณากรอกรหัสลูกค้า' }]}
            extra={editing ? undefined : 'รหัสลูกค้าต้องไม่ซ้ำกับที่มีอยู่ในระบบ'}
          >
            <Input placeholder="เช่น CUS-000001" disabled={!!editing} style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="customer_name" label="ชื่อลูกค้า" rules={[{ required: true, message: 'กรุณากรอกชื่อลูกค้า' }]}>
            <Input placeholder="ชื่อบริษัท / ลูกค้า" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="address" label="ที่อยู่">
            <Input.TextArea rows={3} placeholder="ที่อยู่" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="contact" label="ผู้ติดต่อ / เบอร์โทร">
            <Input.TextArea rows={2} placeholder="ชื่อผู้ติดต่อ และเบอร์โทร" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="credit_term" label="เครดิต (วัน)">
            <Select placeholder="เลือกเครดิต" options={CUSTOMER_CREDIT_TERM_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="remarks" label="หมายเหตุ">
            <Input.TextArea rows={3} placeholder="หมายเหตุ" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CustomerPage
