import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table, Button, Select, Space, Tag, Input, Divider,
  Row, Col, Typography, Statistic, Upload, message,
} from 'antd'
import type { UploadProps } from 'antd'
import {
  AppstoreOutlined, CheckCircleOutlined, TagsOutlined,
  DownloadOutlined, InboxOutlined, CheckOutlined, WarningOutlined,
  PlusOutlined, CloseOutlined, SaveOutlined,
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const { Text, Title } = Typography

interface CostCodeRecord {
  key: string
  subjectCode: string
  subjectName: string
  jobCode: string
  jobName: string
  groupCode: string
  groupName: string
  subgroupCode: string
  subgroupName: string
  costCode: string
  isActive: boolean
}

// ── manual insert-row helpers ─────────────────────────────────────
const SectionPill: React.FC<{ color: string; bg: string; label: string }> = ({ color, bg, label }) => (
  <span style={{ display: 'inline-block', background: bg, color, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, marginBottom: 6 }}>
    {label}
  </span>
)

const FL: React.FC<{ text: string; required?: boolean }> = ({ text, required }) => (
  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
    {text}{required && <span style={{ color: '#f87171', marginLeft: 2 }}>*</span>}
  </div>
)

const VSep = () => <div style={{ width: 1, background: '#e5e7eb', alignSelf: 'stretch', margin: '0 2px', flexShrink: 0 }} />

interface PendingCostCodeRow {
  rowKey: string
  subjectCode: string; subjectName: string
  jobCode: string; jobName: string
  groupCode: string; groupName: string
  subgroupCode: string; subgroupName: string
}

const newRow = (): PendingCostCodeRow => ({
  rowKey: `${Date.now()}${Math.random()}`,
  subjectCode: '', subjectName: '',
  jobCode: '', jobName: '',
  groupCode: '', groupName: '',
  subgroupCode: '', subgroupName: '',
})

interface InsertCostCodeRowProps {
  row: PendingCostCodeRow; index: number
  onChange: (key: string, field: keyof PendingCostCodeRow, val: string) => void
  onRemove: (key: string) => void; canRemove: boolean
}

const InsertCostCodeRow: React.FC<InsertCostCodeRowProps> = ({ row, index, onChange, onRemove, canRemove }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', gap: 0 }}>

    {/* number */}
    <div style={{ flex: '0 0 28px', paddingTop: 30, marginRight: 12, textAlign: 'center' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {index + 1}
      </div>
    </div>

    {/* SUBJECT */}
    <div style={{ flex: '1 1 0', minWidth: 190, marginRight: 10 }}>
      <SectionPill color="#2563eb" bg="#dbeafe" label="Subject" />
      <Row gutter={6}>
        <Col span={10}>
          <FL text="รหัส Subject" required />
          <Input size="small" placeholder="S01" value={row.subjectCode}
            onChange={(e) => onChange(row.rowKey, 'subjectCode', e.target.value)} />
        </Col>
        <Col span={14}>
          <FL text="ชื่อ Subject" required />
          <Input size="small" placeholder="ชื่อ Subject" value={row.subjectName}
            onChange={(e) => onChange(row.rowKey, 'subjectName', e.target.value)} />
        </Col>
      </Row>
    </div>

    <VSep />

    {/* JOB */}
    <div style={{ flex: '1 1 0', minWidth: 190, marginLeft: 10, marginRight: 10 }}>
      <SectionPill color="#0284c7" bg="#e0f2fe" label="Job" />
      <Row gutter={6}>
        <Col span={10}>
          <FL text="รหัส Job" required />
          <Input size="small" placeholder="J01" value={row.jobCode}
            onChange={(e) => onChange(row.rowKey, 'jobCode', e.target.value)} />
        </Col>
        <Col span={14}>
          <FL text="ชื่อ Job" required />
          <Input size="small" placeholder="ชื่อ Job" value={row.jobName}
            onChange={(e) => onChange(row.rowKey, 'jobName', e.target.value)} />
        </Col>
      </Row>
    </div>

    <VSep />

    {/* GROUP */}
    <div style={{ flex: '1 1 0', minWidth: 190, marginLeft: 10, marginRight: 10 }}>
      <SectionPill color="#4f46e5" bg="#e0e7ff" label="Group" />
      <Row gutter={6}>
        <Col span={10}>
          <FL text="รหัส Group" required />
          <Input size="small" placeholder="G01" value={row.groupCode}
            onChange={(e) => onChange(row.rowKey, 'groupCode', e.target.value)} />
        </Col>
        <Col span={14}>
          <FL text="ชื่อ Group" required />
          <Input size="small" placeholder="ชื่อ Group" value={row.groupName}
            onChange={(e) => onChange(row.rowKey, 'groupName', e.target.value)} />
        </Col>
      </Row>
    </div>

    <VSep />

    {/* SUBGROUP */}
    <div style={{ flex: '1 1 0', minWidth: 190, marginLeft: 10 }}>
      <SectionPill color="#7c3aed" bg="#ede9fe" label="Subgroup" />
      <Row gutter={6}>
        <Col span={10}>
          <FL text="รหัส Subgroup" required />
          <Input size="small" placeholder="SG01" value={row.subgroupCode}
            onChange={(e) => onChange(row.rowKey, 'subgroupCode', e.target.value)} />
        </Col>
        <Col span={14}>
          <FL text="ชื่อ Subgroup" />
          <Input size="small" placeholder="ชื่อ Subgroup" value={row.subgroupName}
            onChange={(e) => onChange(row.rowKey, 'subgroupName', e.target.value)} />
        </Col>
      </Row>
    </div>

    {/* delete */}
    <div style={{ flex: '0 0 28px', paddingTop: 30, marginLeft: 6 }}>
      {canRemove && (
        <Button type="text" size="small" danger icon={<CloseOutlined style={{ fontSize: 12 }} />}
          onClick={() => onRemove(row.rowKey)} style={{ padding: '0 4px' }} />
      )}
    </div>
  </div>
)

// ── file import helpers ──────────────────────────────────────────
// Cost_Code.xlsx has no usable header row — columns are read by fixed
// position (A..H), and row 1 (partial labels) is skipped via range: 1.
const downloadTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['subjectCode', 'subjectName', 'jobCode', 'jobName', 'groupCode', 'groupName', 'subgroupCode', 'subgroupName'],
    ['S01', 'งานโครงสร้าง', 'J01', 'งานฐานราก', 'G01', 'วัสดุก่อสร้าง', 'SG01', 'เหล็กเส้น'],
    ['S02', 'งานสถาปัตย์', 'J02', 'งานตกแต่งภายใน', 'G02', 'วัสดุตกแต่ง', 'SG02', 'สีทาภายใน'],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'CostCode')
  XLSX.writeFile(wb, 'cost_code_template.xlsx')
}

interface ParsedRow {
  row: number; valid: boolean; error?: string
  data: {
    subjectCode: string; subjectName: string
    jobCode: string; jobName: string
    groupCode: string; groupName: string
    subgroupCode: string; subgroupName: string
  }
}

const isBlank = (v: string) => v.trim() === ''

const REQUIRED_FIELDS = ['subjectCode', 'subjectName', 'jobCode', 'jobName', 'groupCode', 'groupName', 'subgroupCode'] as const

const parseRows = (rows: unknown[][]): ParsedRow[] =>
  rows.map((cols, i) => {
    const cell = (idx: number) => String(cols[idx] ?? '').trim()
    const data = {
      subjectCode:  cell(0), subjectName:  cell(1),
      jobCode:      cell(2), jobName:      cell(3),
      groupCode:    cell(4), groupName:    cell(5),
      subgroupCode: cell(6), subgroupName: cell(7),
    }

    const missing = REQUIRED_FIELDS.filter((f) => isBlank(data[f]))
    if (missing.length > 0)
      return { row: i + 2, valid: false, error: `ข้อมูลไม่ครบในฟิลด์: ${missing.join(', ')}`, data }

    return { row: i + 2, valid: true, data }
  })

const readFileAsRows = (file: File): Promise<ParsedRow[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const ab = e.target?.result as ArrayBuffer
        const wb = XLSX.read(ab, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, range: 1 })
        const nonEmptyRows = rows.filter((r) => r.some((v) => String(v ?? '').trim() !== ''))
        if (nonEmptyRows.length === 0) { resolve([]); return }
        resolve(parseRows(nonEmptyRows))
      } catch {
        reject(new Error('อ่านไฟล์ไม่ได้'))
      }
    }
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'))
    reader.readAsArrayBuffer(file)
  })

// ── main page ────────────────────────────────────────────────────
const CostCodePage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<CostCodeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [subgroupCount, setSubgroupCount] = useState(0)
  const [filterGroupCode, setFilterGroupCode] = useState<string | undefined>()
  const [filterSubgroupCode, setFilterSubgroupCode] = useState<string | undefined>()

  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const fetchCostCodes = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/cost-code/list`, {
        params: { page, limit: 10 },
        headers: authHeader,
      })
      const rawList = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.items ?? res.data?.records)
      const list = Array.isArray(rawList) ? rawList : []
      setTotal(res.data?.total ?? res.data?.data?.total ?? list.length)

      if (import.meta.env.DEV && list.length > 0) {
        // eslint-disable-next-line no-console
        console.debug('[cost-code] sample list item shape:', list[0])
      }

      // Backend field names haven't been pinned down yet — read defensively
      // across snake_case / camelCase / nested-object shapes so the group
      // and subgroup filters populate regardless of the exact API contract.
      const pick = (obj: any, ...keys: string[]) => {
        for (const k of keys) {
          const v = k.split('.').reduce((o, part) => o?.[part], obj)
          if (v !== undefined && v !== null && v !== '') return String(v)
        }
        return ''
      }

      const mapped: CostCodeRecord[] = list.map((c: any) => {
        const subjectCode  = pick(c, 'subject_code', 'subjectCode', 'subject.code')
        const jobCode      = pick(c, 'job_code', 'jobCode', 'job.code')
        const groupCode    = pick(c, 'group_code', 'groupCode', 'group.code', 'cost_group_code')
        const subgroupCode = pick(c, 'subgroup_code', 'subGroupCode', 'subgroup.code', 'cost_subgroup_code')
        return {
          key: String(c.id ?? `${subjectCode}${jobCode}${groupCode}${subgroupCode}`),
          subjectCode, subjectName: pick(c, 'subject_name', 'subjectName', 'subject.name'),
          jobCode,     jobName:     pick(c, 'job_name', 'jobName', 'job.name'),
          groupCode,   groupName:   pick(c, 'group_name', 'groupName', 'group.name', 'cost_group_name'),
          subgroupCode, subgroupName: pick(c, 'subgroup_name', 'subGroupName', 'subgroup.name', 'cost_subgroup_name'),
          costCode: pick(c, 'cost_code', 'costCode') || `${subjectCode}${jobCode}${groupCode}${subgroupCode}`,
          isActive: c.is_active ?? c.isActive ?? true,
        }
      })
      setData(mapped)
      setActiveCount(mapped.filter((m) => m.isActive).length)
      setSubgroupCount(mapped.filter((m) => m.subgroupCode).length)
    } catch {
      message.error('โหลดข้อมูล Cost Code ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [accessToken, page])

  useEffect(() => { fetchCostCodes() }, [fetchCostCodes])

  // distinct group_name values from the already-loaded list, deduplicated
  const groupOptions = React.useMemo(() =>
    Array.from(new Set(data.map((d) => d.groupName).filter(Boolean)))
      .map((name) => ({ value: name, label: name })),
  [data])

  // distinct subgroup_name values, cascaded to the selected group
  const subgroupOptions = React.useMemo(() =>
    Array.from(new Set(
      data
        .filter((d) => !filterGroupCode || d.groupName === filterGroupCode)
        .map((d) => d.subgroupName)
        .filter(Boolean)
    )).map((name) => ({ value: name, label: name })),
  [data, filterGroupCode])

  const handleFilterGroupChange = (v: string | undefined) => {
    setFilterGroupCode(v)
    setFilterSubgroupCode(undefined)
  }

  const filteredData = data.filter((d) => {
    if (filterGroupCode && d.groupName !== filterGroupCode) return false
    if (filterSubgroupCode && d.subgroupName !== filterSubgroupCode) return false
    return true
  })

  const columns = [
    {
      title: 'Cost Code', dataIndex: 'costCode', key: 'costCode', width: 160,
      render: (v: string) => <Text code style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Subject / Job', key: 'subjectJob', width: 220,
      render: (_: unknown, r: CostCodeRecord) => (
        <Space direction="vertical" size={3}>
          <Tag color="blue" style={{ margin: 0, fontSize: 13 }}>{r.subjectCode} — {r.subjectName}</Tag>
          <Tag color="geekblue" style={{ margin: 0, fontSize: 13 }}>{r.jobCode} — {r.jobName}</Tag>
        </Space>
      ),
    },
    {
      title: 'Group Name', key: 'group', width: 200,
      render: (_: unknown, r: CostCodeRecord) => (
        <div>
          {r.groupCode && <Text code style={{ fontSize: 13 }}>{r.groupCode}</Text>}
          <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginTop: 3 }}>{r.groupName}</div>
        </div>
      ),
    },
    {
      title: 'Subgroup Name', key: 'subgroup', width: 200,
      render: (_: unknown, r: CostCodeRecord) => (
        <div>
          {r.subgroupCode && <Text code style={{ fontSize: 13 }}>{r.subgroupCode}</Text>}
          <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginTop: 3 }}>{r.subgroupName}</div>
        </div>
      ),
    },
    {
      title: 'Status', dataIndex: 'isActive', width: 90,
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'error'} style={{ borderRadius: 20, fontSize: 13 }}>{v ? 'ใช้งาน' : 'ปิด'}</Tag>
      ),
    },
  ]

  // ── manual insert rows ──
  const [pendingRows, setPendingRows] = useState<PendingCostCodeRow[]>([newRow()])
  const [submitting, setSubmitting] = useState(false)

  const updateRow = (rowKey: string, field: keyof PendingCostCodeRow, val: string) =>
    setPendingRows((p) => p.map((r) => r.rowKey === rowKey ? { ...r, [field]: val } : r))
  const removeRow = (rowKey: string) => setPendingRows((p) => p.filter((r) => r.rowKey !== rowKey))

  const handleSubmitAll = async () => {
    const invalid = pendingRows.some((r) =>
      !r.subjectCode || !r.subjectName ||
      !r.jobCode || !r.jobName ||
      !r.groupCode || !r.groupName ||
      !r.subgroupCode
    )
    if (invalid) { message.warning('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบทุกรายการ'); return }

    setSubmitting(true)
    try {
      const res = await axios.post(
        `${BASE_URL}/master/cost-code/import`,
        pendingRows.map((r) => ({
          subject_code:  r.subjectCode,  subject_name:  r.subjectName,
          job_code:      r.jobCode,      job_name:      r.jobName,
          group_code:    r.groupCode,    group_name:    r.groupName,
          subgroup_code: r.subgroupCode, subgroup_name: r.subgroupName,
        })),
        { headers: authHeader }
      )
      setPendingRows([newRow()])
      message.success(`บันทึก ${res.data?.count ?? pendingRows.length} รายการเรียบร้อย`)
      setPage(1)
      await fetchCostCodes()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!accessToken) return
    setExporting(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/cost-code/export`, {
        headers: authHeader,
        responseType: 'blob',
      })

      // Prefer the server-provided filename (Content-Disposition) over a
      // hardcoded one, so it stays in sync with whatever the backend names it.
      const disposition: string | undefined = res.headers?.['content-disposition']
      const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^;"]+)"?/i)
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const filename = match?.[1] ? decodeURIComponent(match[1]) : `cost-code-export-${today}.xlsx`

      const blob = new Blob([res.data], {
        type: res.data.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'ส่งออกข้อมูลไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  const [uploadFileName, setUploadFileName] = useState<string>('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const IMPORT_PAGE_SIZE = 10
  const [importPage, setImportPage] = useState(1)
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

  const [importSubmitting, setImportSubmitting] = useState(false)

  const handleUpload: UploadProps['beforeUpload'] = (file) => {
    const allowed = ['.csv', '.xlsx', '.xls']
    if (!allowed.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      message.error('รองรับเฉพาะไฟล์ .csv, .xlsx, .xls เท่านั้น')
      return false
    }
    readFileAsRows(file)
      .then((rows) => {
        if (rows.length === 0) { message.error('ไม่พบข้อมูลในไฟล์ หรือไฟล์ไม่ถูกต้อง'); return }
        setParsedRows(rows)
        setUploadFileName(file.name)
        setImportPage(1)
        setFlashRowKey(null)
      })
      .catch(() => {
        message.error('เกิดข้อผิดพลาดในการอ่านไฟล์')
      })
    return false
  }

  const handleConfirmImport = async () => {
    const valid = parsedRows.filter((r) => r.valid)
    if (valid.length === 0) { message.warning('ไม่มีรายการที่ถูกต้องสำหรับนำเข้า'); return }
    setImportSubmitting(true)
    try {
      const res = await axios.post(
        `${BASE_URL}/master/cost-code/import`,
        valid.map((r) => ({
          subject_code:  r.data.subjectCode,  subject_name:  r.data.subjectName,
          job_code:      r.data.jobCode,      job_name:      r.data.jobName,
          group_code:    r.data.groupCode,    group_name:    r.data.groupName,
          subgroup_code: r.data.subgroupCode, subgroup_name: r.data.subgroupName,
        })),
        { headers: authHeader }
      )
      setParsedRows([])
      setUploadFileName('')
      message.success(`นำเข้าสำเร็จ ${res.data.count ?? valid.length} รายการ`)
      setPage(1)
      await fetchCostCodes()
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
        title="จับคู่ Cost Code"
        subtitle="กำหนดรหัสและโครงสร้าง Cost Code ตาม Subject / Job / Group / Subgroup"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'Cost Code' }]}
      />

      <div style={{ padding: '0 0 32px', overflowX: 'hidden' }}>

        {/* stats */}
        <Row gutter={[16, 12]} style={{ marginBottom: 20 }}>
          {[
            { label: 'รายการทั้งหมด', value: total, icon: <AppstoreOutlined />, color: '#3b82f6', bg: '#eff6ff' },
            { label: 'ใช้งานอยู่', value: activeCount, icon: <CheckCircleOutlined />, color: '#10b981', bg: '#f0fdf4' },
            { label: 'ระดับที่มี Subgroup', value: subgroupCount, icon: <TagsOutlined />, color: '#7c3aed', bg: '#ede9fe' },
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
            <Title level={5} style={{ margin: 0 }}>รายการ Cost Code ทั้งหมด</Title>
            <Space wrap>
              <Select allowClear placeholder="กรองตาม Group" style={{ width: 240 }} options={groupOptions}
                value={filterGroupCode} onChange={handleFilterGroupChange} />
              <Select allowClear placeholder="กรองตาม Subgroup" style={{ width: 240 }} options={subgroupOptions}
                value={filterSubgroupCode} onChange={(v) => setFilterSubgroupCode(v)} disabled={!filterGroupCode} />
              <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
                Export Excel
              </Button>
            </Space>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table
              dataSource={filteredData} columns={columns} size="middle"
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
              rowKey="key" scroll={{ x: 1000 }}
            />
          </div>
        </div>

        {/* insert rows */}
        <div style={{ ...panelStyle, marginBottom: 20 }}>
          <div style={panelHead}>
            <div>
              <Title level={5} style={{ margin: 0 }}>เพิ่มรายการใหม่</Title>
              <Text style={{ fontSize: 12, color: '#9ca3af' }}>กรอกได้หลายรายการ แล้วกด "บันทึกทั้งหมด"</Text>
            </div>
            <Space>
              <Button icon={<PlusOutlined />} onClick={() => setPendingRows((p) => [...p, newRow()])}>เพิ่มแถว</Button>
            </Space>
          </div>

          <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
            <div style={{ minWidth: 1000 }}>
              {pendingRows.map((row, idx) => (
                <InsertCostCodeRow key={row.rowKey} row={row} index={idx}
                  onChange={updateRow} onRemove={removeRow} canRemove={pendingRows.length > 1} />
              ))}
            </div>
            <Button block type="dashed" icon={<PlusOutlined />} style={{ marginTop: 4 }}
              onClick={() => setPendingRows((p) => [...p, newRow()])}>
              + เพิ่มแถวใหม่
            </Button>
            <Divider style={{ margin: '16px 0' }} />
            <Row justify="end">
              <Space>
                <Button onClick={() => setPendingRows([newRow()])}>ล้างทั้งหมด</Button>
                <Button type="primary" size="large" icon={<SaveOutlined />} onClick={handleSubmitAll} loading={submitting}
                  style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', border: 'none', paddingLeft: 28, paddingRight: 28 }}>
                  บันทึกทั้งหมด ({pendingRows.length} รายการ)
                </Button>
              </Space>
            </Row>
          </div>
        </div>

        {/* upload panel */}
        <div style={panelStyle}>
          <div style={panelHead}>
            <div>
              <Title level={5} style={{ margin: 0 }}>อัปโหลดไฟล์เพื่อนำเข้า Cost Code</Title>
              <Text style={{ fontSize: 12, color: '#9ca3af' }}>นำเข้าโครงสร้าง Cost Code จากไฟล์ Excel หรือ CSV ได้ครั้งละหลายรายการ</Text>
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

                <Table<ParsedRow & { key: number }>
                  size="small"
                  dataSource={parsedRows.map((r, i) => ({ ...r, key: i }))}
                  pagination={parsedRows.length > IMPORT_PAGE_SIZE ? {
                    pageSize: IMPORT_PAGE_SIZE,
                    showSizeChanger: false,
                    current: importPage,
                    onChange: (page) => setImportPage(page),
                  } : false}
                  scroll={{ x: 900 }}
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
                    {
                      title: 'Subject', key: 'subject', width: 170,
                      render: (_: unknown, r: ParsedRow) => (
                        <div>
                          <Text code style={{ fontSize: 11 }}>{r.data.subjectCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{r.data.subjectName || <span style={{ color: '#f87171' }}>—</span>}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Job', key: 'job', width: 170,
                      render: (_: unknown, r: ParsedRow) => (
                        <div>
                          <Text code style={{ fontSize: 11 }}>{r.data.jobCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{r.data.jobName || <span style={{ color: '#f87171' }}>—</span>}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Group', key: 'group', width: 170,
                      render: (_: unknown, r: ParsedRow) => (
                        <div>
                          <Text code style={{ fontSize: 11 }}>{r.data.groupCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{r.data.groupName || <span style={{ color: '#f87171' }}>—</span>}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Subgroup', key: 'subgroup', width: 170,
                      render: (_: unknown, r: ParsedRow) => (
                        <div>
                          <Text code style={{ fontSize: 11 }}>{r.data.subgroupCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{r.data.subgroupName || <span style={{ color: '#f87171' }}>—</span>}</div>
                        </div>
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
    </div>
  )
}

export default CostCodePage
