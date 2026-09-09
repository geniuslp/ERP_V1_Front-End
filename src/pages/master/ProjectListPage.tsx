import React, { useEffect, useRef, useState } from 'react'
import { Card, Table, Button, Space, Tooltip, Input, Select, Tag, Popconfirm, message, Typography, Modal, Row } from 'antd'
import type { UploadProps } from 'antd'
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  DownloadOutlined, InboxOutlined, CheckOutlined, WarningOutlined,
} from '@ant-design/icons'
import { Upload } from 'antd'
import * as XLSX from 'xlsx'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import type { Project, ProjectStatus } from '@/types/project'
import { permissionMatrixService } from '@/services/permissionMatrix.service'
import { JOB_TYPES } from '@/constants/jobTypes'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const statusColor: Record<ProjectStatus, string> = {
  ACTIVE: 'green',
  INACTIVE: 'default',
  CLOSED: 'red',
}
const statusLabel: Record<ProjectStatus, string> = {
  ACTIVE: 'ดำเนินการ',
  INACTIVE: 'ไม่ใช้งาน',
  CLOSED: 'ปิดโครงการ',
}

const mapProject = (raw: any): Project => ({
  id:           raw.id,
  projectCode:  raw.project_code,
  projectName:  raw.project_name,
  locationCode: raw.location_code,
  deptCode:     raw.dept_code,
  deptName:     raw.dept_name,
  ownerId:      raw.owner_id,
  ownerName:    raw.owner_name,
  projectOwnerName: raw.project_owner_name,
  customerId:   raw.customer_id,
  customerName: raw.customer_name,
  responsiblePersonName: raw.responsible_person_name,
  jobCodes:     raw.job_codes ?? [],
  budgetAmount: raw.budget_amount ?? 0,
  consultantName: raw.consultant_name,
  consultantPhone: raw.consultant_phone,
  startDate:    raw.start_date,
  endDate:      raw.end_date,
  status:       raw.status ?? 'ACTIVE',
  isActive:     raw.is_active ?? true,
  createdAt:    raw.created_at,
  updatedAt:    raw.updated_at,
})

const { Text, Title } = Typography

// ── file import helpers — mirrors MaterialPage.tsx's client-side-only
// parse/validate/preview pattern exactly (no server-side preview/validate
// endpoint; the file is never uploaded raw, only the parsed+validated rows
// are POSTed as JSON to a /bulk endpoint) ──────────────────────────────
// Matches the backend-generated template's real header exactly (confirmed
// against GET /master/projects/import/template) — no "dept_code" column
// exists in the file; the job-code header is "job Code" (space + capital C),
// not "job_code"; and no "status" column since is_active always defaults to
// true on import. "Project location_code", "consultant_name" and
// "consultant_phone" are present as columns but not hard-required — the
// Create/Edit form (ProjectCreateEditPage.tsx) doesn't mark location_code as
// required and has no consultant_name/consultant_phone fields at all, so
// these stay optional (checked for header presence only, not in
// REQUIRED_FIELDS below).
const FILE_COLS = [
  'project_code', 'project_name', 'customer_code', 'Project location_code',
  'start_date', 'end_date', 'budget_amount', 'job Code',
  'consultant_name', 'consultant_phone', 'responsible_person_name',
]

// Template is now generated server-side (GET /master/projects/import/template)
// so current dropdown options (department, job code, etc.) are baked in as
// Excel data validation and the template never goes stale — no more
// client-side XLSX.writeFile generation here.
const downloadTemplate = async (accessToken?: string) => {
  try {
    const res = await axios.get(`${BASE_URL}/master/projects/import/template`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'project_import_template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err: any) {
    message.error(err?.response?.data?.message || err?.message || 'ดาวน์โหลด Template ไม่สำเร็จ')
  }
}

interface CustomerRaw { cus_id: number; customer_code: string }

interface ParsedRow {
  row: number
  valid: boolean
  error?: string
  data: {
    project_code: string
    project_name: string
    responsible_person_name: string
    customer_code: string
    customer_id: number | null
    location_code: string
    consultant_name: string
    consultant_phone: string
    job_codes: string[]
    budget_amount: number
    start_date: string
    end_date: string
    status: string
  }
}

const isBlank = (v: string) => v.trim() === ''
const REQUIRED_FIELDS = ['project_code', 'project_name', 'responsible_person_name', 'budget_amount'] as const

// Mirrors the backend's same toggle exactly — customer_code / job_code
// existence checks are disabled system-wide while data is still being
// migrated/cleaned up, without deleting the check logic itself.
const ENABLE_IMPORT_EXISTENCE_CHECKS = false // TODO: re-enable once system goes live

const parseRows = (
  rows: Record<string, string>[],
  customers: CustomerRaw[],
  validDeptCodes: string[],
  validJobCodes: string[],
): ParsedRow[] =>
  rows.map((cols, i) => {
    // Header cells can carry stray leading/trailing whitespace (e.g. the real
    // template's budget_amount header is " budget_amount ") — the
    // header-presence check tolerates this by trimming both sides, but a
    // direct cols[f] lookup would not, since sheet_to_json keys each row by
    // the literal (untrimmed) header string. Normalize once per row so every
    // field read via get() is whitespace-tolerant, not just budget_amount.
    const normalizedCols: Record<string, string> = {}
    for (const key of Object.keys(cols)) normalizedCols[key.trim()] = cols[key]
    const get = (f: string) => String(normalizedCols[f] ?? '').trim()
    const project_code = get('project_code')
    const project_name = get('project_name')
    const responsible_person_name = get('responsible_person_name')
    const customer_code = get('customer_code')
    const location_code = get('Project location_code')
    const consultant_name = get('consultant_name')
    const consultant_phone = get('consultant_phone')
    // Header is "job Code" (space + capital C), not "job_code" — see FILE_COLS comment.
    const job_codes_raw = get('job Code')
    const budget_amount_raw = get('budget_amount')
    const start_date = get('start_date')
    const end_date = get('end_date')
    // No "status" column in the template — is_active always defaults to true
    // on import, so this just stays ACTIVE unconditionally.
    const status = 'ACTIVE'

    const cust = customer_code ? customers.find((c) => c.customer_code === customer_code) : undefined
    // Cell values like "MP / ME / MS / MG / OH" use "/" as the separator, not
    // "," — split on either, matching the backend's same tolerant split.
    const job_codes = job_codes_raw ? job_codes_raw.split(/[,/]/).map((s) => s.trim()).filter(Boolean) : []

    const data = {
      project_code, project_name, responsible_person_name,
      customer_code, customer_id: cust?.cus_id ?? null,
      location_code, consultant_name, consultant_phone,
      job_codes,
      budget_amount: Number(budget_amount_raw) || 0,
      start_date, end_date, status,
    }

    const missing = REQUIRED_FIELDS.filter((f) => isBlank(get(f)))
    if (missing.length > 0)
      return { row: i + 2, valid: false, error: `ข้อมูลไม่ครบในฟิลด์: ${missing.join(', ')}`, data }

    if (ENABLE_IMPORT_EXISTENCE_CHECKS && customer_code && !cust)
      return { row: i + 2, valid: false, error: `ไม่พบลูกค้ารหัส "${customer_code}"`, data }

    if (ENABLE_IMPORT_EXISTENCE_CHECKS) {
      const invalidJobCodes = job_codes.filter((jc) => !validJobCodes.includes(jc))
      if (invalidJobCodes.length > 0)
        return { row: i + 2, valid: false, error: `ประเภทงานไม่ถูกต้อง: ${invalidJobCodes.join(', ')}`, data }
    }

    return { row: i + 2, valid: true, data }
  })

const MISSING_COLS_ERROR = 'MISSING_COLUMNS'

const readFileAsRows = (
  file: File,
  customers: CustomerRaw[],
  validDeptCodes: string[],
  validJobCodes: string[],
): Promise<ParsedRow[]> =>
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
        const trimmedPresentCols = presentCols.map((c) => c.trim())
        const missing = FILE_COLS.filter((col) => !trimmedPresentCols.includes(col.trim()))
        if (missing.length > 0) {
          const err = new Error(missing.join(','))
          err.name = MISSING_COLS_ERROR
          reject(err)
          return
        }
        resolve(parseRows(json, customers, validDeptCodes, validJobCodes))
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

const ProjectListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }
  const [data, setData] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProjectStatus | undefined>()
  const [customers, setCustomers] = useState<CustomerRaw[]>([])
  const [deptCodes, setDeptCodes] = useState<string[]>([])

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

  // For the customer_code → customer_id lookup in the import preview, same
  // pattern MaterialPage.tsx uses for group_code → group_id.
  useEffect(() => {
    if (!accessToken) return
    axios.get(`${BASE_URL}/customer`, {
      headers: authHeader,
      params: { page: 1, page_size: 1000 },
    })
      .then((res) => {
        const body = res.data?.data ?? res.data
        const list = Array.isArray(body) ? body : body?.items ?? body?.data ?? []
        setCustomers(list)
      })
      .catch(() => message.error('โหลดข้อมูลลูกค้าไม่สำเร็จ'))
  }, [accessToken])

  // For the dept_code lookup in the import preview — same GET /departments
  // source ProjectCreateEditPage.tsx already uses for its dept_code dropdown.
  useEffect(() => {
    if (!accessToken) return
    permissionMatrixService.getDepartments(accessToken)
      .then((depts) => setDeptCodes(depts.map((d) => d.dept_code)))
      .catch(() => message.error('โหลดข้อมูลแผนกไม่สำเร็จ'))
  }, [accessToken])

  // Job codes for the import preview reuse the same JOB_TYPES constant
  // ProjectCreateEditPage.tsx's job_codes Select already sources its options
  // from — there is no separate GET /cost-job list backing that dropdown.
  const validJobCodes = JOB_TYPES.map((jt) => jt.code)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/projects`, {
        headers: authHeader,
        params: { search: search || undefined, status, page_size: 100 },
      })
      const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
      setData((Array.isArray(raw) ? raw : []).map(mapProject))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${BASE_URL}/master/projects/${id}`, {
        headers: authHeader,
      })
      message.success('ลบโครงการสำเร็จ')
      fetchData()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'ลบไม่สำเร็จ')
    }
  }

  const handleReset = () => {
    setSearch('')
    setStatus(undefined)
  }

  useEffect(() => { fetchData() }, [search, status])

  const handleUpload: UploadProps['beforeUpload'] = (file) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      message.error('รองรับเฉพาะไฟล์ .xlsx เท่านั้น')
      return false
    }
    readFileAsRows(file, customers, deptCodes, validJobCodes)
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
        `${BASE_URL}/master/projects/import`,
        formData,
        { headers: { ...authHeader, 'Content-Type': 'multipart/form-data' } }
      )
      setParsedRows([])
      setUploadFile(null)
      setUploadFileName('')
      message.success(`นำเข้าสำเร็จ ${res.data?.count ?? valid.length} รายการ`)
      await fetchData()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'นำเข้าข้อมูลไม่สำเร็จ'
      message.error(msg)
    } finally {
      setImportSubmitting(false)
    }
  }

  const columns = [
    {
      title: 'รหัสโครงการ',
      dataIndex: 'projectCode',
      key: 'projectCode',
      width: '10%',
      render: (code: string, record: Project) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/master/projects/${record.id}/edit`)}>
          {code}
        </a>
      ),
    },
    { title: 'ชื่อโครงการ', dataIndex: 'projectName', key: 'projectName', width: '30%', ellipsis: true },
    {
      // Now backed by the required free-text responsible_person_name field
      // (the owner_id/users dropdown it replaces is deprecated server-side).
      title: 'ผู้รับผิดชอบหลัก',
      dataIndex: 'responsiblePersonName',
      key: 'responsiblePersonName',
      width: '15%',
      render: (val?: string) => val || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'มูลค่าโครงการ',
      dataIndex: 'budgetAmount',
      key: 'budgetAmount',
      width: '7%',
      align: 'right' as const,
      render: (val: number) => `${(val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`,
    },
    {
      title: 'ระยะเวลา',
      key: 'duration',
      render: (_: any, record: Project) => {
        if (!record.startDate && !record.endDate) return <span style={{ color: '#9ca3af' }}>—</span>
        const start = record.startDate ? dayjs(record.startDate).format('DD/MM/YY') : '—'
        const end   = record.endDate   ? dayjs(record.endDate).format('DD/MM/YY')   : '—'
        return `${start} - ${end}`
      },
    },
    {
      title: 'จัดการ',
      key: 'actions',
      width: 110,
      render: (_: any, record: Project) => (
        <Space>
          <Tooltip title="แก้ไข">
            <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/master/projects/${record.id}/edit`)} />
          </Tooltip>
          <Popconfirm title="ลบโครงการนี้?" okText="ลบ" cancelText="ยกเลิก" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="ลบ">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      align: 'right' as const,
      render: (val: ProjectStatus) => <Tag color={statusColor[val]}>{statusLabel[val]}</Tag>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="โครงการ"
        subtitle="จัดการข้อมูลโครงการทั้งหมด"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'โครงการ' }]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/master/projects/create')}
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
          >
            เพิ่มโครงการ
          </Button>
        }
      />
      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="ค้นหารหัส/ชื่อโครงการ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="สถานะ"
            value={status}
            onChange={setStatus}
            allowClear
            style={{ width: 160 }}
            options={[
              { value: 'ACTIVE',   label: 'ดำเนินการ' },
              { value: 'INACTIVE', label: 'ไม่ใช้งาน' },
              { value: 'CLOSED',   label: 'ปิดโครงการ' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>ค้นหา</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>รีเซต</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 20, showTotal: (t) => `ทั้งหมด ${t} โครงการ` }}
          locale={{ emptyText: 'ไม่พบข้อมูลโครงการ' }}
        />
      </Card>

      {/* upload panel — mirrors MaterialPage.tsx's inline import section exactly */}
      <div style={{ ...panelStyle, marginTop: 20 }}>
        <div style={panelHead}>
          <div>
            <Title level={5} style={{ margin: 0 }}>อัปโหลดไฟล์เพื่อนำเข้าข้อมูล</Title>
            <Text style={{ fontSize: 12, color: '#9ca3af' }}>นำเข้าข้อมูลโครงการจากไฟล์ Excel ได้ครั้งละหลายรายการ</Text>
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
                scroll={{ x: 900 }}
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
                    title: 'รหัสโครงการ', key: 'code', width: 110,
                    render: (_: unknown, r: ParsedRow) => (
                      <Text code style={{ fontSize: 11 }}>{r.data.project_code || <span style={{ color: '#f87171' }}>—</span>}</Text>
                    ),
                  },
                  {
                    title: 'ชื่อโครงการ', key: 'name', width: 180,
                    render: (_: unknown, r: ParsedRow) => (
                      <div style={{ fontSize: 12 }}>{r.data.project_name || <span style={{ color: '#f87171' }}>—</span>}</div>
                    ),
                  },
                  {
                    title: 'ผู้รับผิดชอบหลัก', key: 'resp', width: 150,
                    render: (_: unknown, r: ParsedRow) => (
                      <div style={{ fontSize: 12 }}>{r.data.responsible_person_name || <span style={{ color: '#f87171' }}>—</span>}</div>
                    ),
                  },
                  {
                    title: 'ประเภทงาน', key: 'job', width: 180,
                    render: (_: unknown, r: ParsedRow) => {
                      const badJobCodes = ENABLE_IMPORT_EXISTENCE_CHECKS
                        ? r.data.job_codes.filter((jc) => !validJobCodes.includes(jc))
                        : []
                      return r.data.job_codes.length > 0 ? (
                        <div style={{ fontSize: 12, color: badJobCodes.length > 0 ? '#f87171' : undefined }}>
                          {r.data.job_codes.join(', ')}{badJobCodes.length > 0 ? ` (ไม่ถูกต้อง: ${badJobCodes.join(', ')})` : ''}
                        </div>
                      ) : <span style={{ fontSize: 12 }}>—</span>
                    },
                  },
                  {
                    title: 'เจ้าของโครงการ', key: 'customer', width: 160,
                    render: (_: unknown, r: ParsedRow) => (
                      <div style={{ fontSize: 12 }}>
                        {r.data.customer_code
                          ? (r.data.customer_id || !ENABLE_IMPORT_EXISTENCE_CHECKS
                              ? r.data.customer_code
                              : <span style={{ color: '#f87171' }}>{r.data.customer_code} (ไม่พบ)</span>)
                          : '—'}
                      </div>
                    ),
                  },
                  {
                    title: 'มูลค่า', key: 'budget', width: 120, align: 'right' as const,
                    render: (_: unknown, r: ParsedRow) => (
                      <div style={{ fontSize: 12 }}>{r.data.budget_amount.toLocaleString('th-TH')}</div>
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
    </div>
  )
}

export default ProjectListPage
