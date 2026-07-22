import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space, Tag,
  Row, Col, Typography, Statistic, Divider, Upload, message,
} from 'antd'
import type { UploadProps } from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined,
  CloseOutlined, AppstoreOutlined, CheckCircleOutlined,
  UploadOutlined, DownloadOutlined, InboxOutlined, CheckOutlined, WarningOutlined,
  FileExcelOutlined,
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import type { Material } from '@/types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const { Text, Title } = Typography

type MaterialRecord = Material & { key: string }

interface PendingRow {
  rowKey: string
  groupId: string
  subGroupCode: string
  subGroupName: string
  materialCode: string
  materialName: string
  specCode: string
  specDescription: string
  brandCode: string
  brandName: string
  unitCode: string
  unitName: string
}


const newRow = (): PendingRow => ({
  rowKey: `${Date.now()}${Math.random()}`,
  groupId: '', subGroupCode: '', subGroupName: '',
  materialCode: '', materialName: '',
  specCode: '', specDescription: '',
  brandCode: '', brandName: '',
  unitCode: '', unitName: '',
})

// ── helpers ──────────────────────────────────────────────────────
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

// ── insert row (new entry) ────────────────────────────────────────
interface GroupOption { value: string; label: string }

interface InsertRowProps {
  row: PendingRow; index: number
  groupOptions: GroupOption[]
  onChange: (key: string, field: keyof PendingRow, val: string) => void
  onRemove: (key: string) => void; canRemove: boolean
}

const InsertRow: React.FC<InsertRowProps> = ({ row, index, groupOptions, onChange, onRemove, canRemove }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', gap: 0 }}>

    {/* number */}
    <div style={{ flex: '0 0 28px', paddingTop: 30, marginRight: 12, textAlign: 'center' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {index + 1}
      </div>
    </div>

    {/* GROUP */}
    <div style={{ flex: '0 0 170px', marginRight: 10 }}>
      <SectionPill color="#2563eb" bg="#dbeafe" label="Group" />
      <FL text="กลุ่ม" required />
      <Select size="small" style={{ width: '100%' }} placeholder="เลือกกลุ่ม"
        options={groupOptions} value={row.groupId || undefined}
        onChange={(v) => onChange(row.rowKey, 'groupId', v)} />
    </div>

    <VSep />

    {/* SUBGROUP — free text */}
    <div style={{ flex: '0 0 200px', marginLeft: 10, marginRight: 10 }}>
      <SectionPill color="#0284c7" bg="#e0f2fe" label="Sub Group" />
      <Row gutter={6}>
        <Col span={11}>
          <FL text="รหัสกลุ่มย่อย" required />
          <Input size="small" placeholder="SUB001" value={row.subGroupCode}
            onChange={(e) => onChange(row.rowKey, 'subGroupCode', e.target.value)} />
        </Col>
        <Col span={13}>
          <FL text="ชื่อกลุ่มย่อย" required />
          <Input size="small" placeholder="ชื่อกลุ่มย่อย" value={row.subGroupName}
            onChange={(e) => onChange(row.rowKey, 'subGroupName', e.target.value)} />
        </Col>
      </Row>
    </div>

    <VSep />

    {/* MATERIAL */}
    <div style={{ flex: '1 1 0', minWidth: 180, marginLeft: 10, marginRight: 10 }}>
      <SectionPill color="#4f46e5" bg="#e0e7ff" label="Material" />
      <Row gutter={6}>
        <Col span={10}>
          <FL text="รหัสวัสดุ" required />
          <Input size="small" placeholder="MAT001" value={row.materialCode}
            onChange={(e) => onChange(row.rowKey, 'materialCode', e.target.value)} />
        </Col>
        <Col span={14}>
          <FL text="ชื่อวัสดุ" required />
          <Input size="small" placeholder="ชื่อวัสดุ" value={row.materialName}
            onChange={(e) => onChange(row.rowKey, 'materialName', e.target.value)} />
        </Col>
      </Row>
    </div>

    <VSep />

    {/* SPEC */}
    <div style={{ flex: '0 0 210px', marginLeft: 10, marginRight: 10 }}>
      <SectionPill color="#7c3aed" bg="#ede9fe" label="Spec" />
      <Row gutter={6}>
        <Col span={10}>
          <FL text="รหัสสเปค" />
          <Input size="small" placeholder="SP001" value={row.specCode}
            onChange={(e) => onChange(row.rowKey, 'specCode', e.target.value)} />
        </Col>
        <Col span={14}>
          <FL text="คำอธิบาย" />
          <Input size="small" placeholder="เช่น 3×1200×2400" value={row.specDescription}
            onChange={(e) => onChange(row.rowKey, 'specDescription', e.target.value)} />
        </Col>
      </Row>
    </div>

    <VSep />

    {/* BRAND */}
    <div style={{ flex: '0 0 190px', marginLeft: 10, marginRight: 10 }}>
      <SectionPill color="#b45309" bg="#fef3c7" label="Brand" />
      <Row gutter={6}>
        <Col span={10}>
          <FL text="รหัสยี่ห้อ" />
          <Input size="small" placeholder="BR001" value={row.brandCode}
            onChange={(e) => onChange(row.rowKey, 'brandCode', e.target.value)} />
        </Col>
        <Col span={14}>
          <FL text="ชื่อยี่ห้อ" />
          <Input size="small" placeholder="ชื่อยี่ห้อ" value={row.brandName}
            onChange={(e) => onChange(row.rowKey, 'brandName', e.target.value)} />
        </Col>
      </Row>
    </div>

    <VSep />

    {/* UNIT */}
    <div style={{ flex: '0 0 170px', marginLeft: 10, marginRight: 10 }}>
      <SectionPill color="#059669" bg="#d1fae5" label="Unit" />
      <Row gutter={6}>
        <Col span={10}>
          <FL text="รหัสหน่วย" required />
          <Input size="small" placeholder="UN001" value={row.unitCode}
            onChange={(e) => onChange(row.rowKey, 'unitCode', e.target.value)} />
        </Col>
        <Col span={14}>
          <FL text="ชื่อหน่วย" required />
          <Input size="small" placeholder="เช่น ชิ้น, กก." value={row.unitName}
            onChange={(e) => onChange(row.rowKey, 'unitName', e.target.value)} />
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
const FILE_COLS = ['groupCode', 'subGroupCode', 'subGroupName', 'materialCode', 'materialName', 'specCode', 'specDescription', 'brandCode', 'brandName', 'unitCode', 'unitName']

const downloadTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    FILE_COLS,
    ['GRP001', 'SUB001', 'วัตถุดิบเหล็ก', 'MAT001', 'เหล็กแผ่น SS400', 'SP001', '3x1200x2400 mm', 'BR001', 'TATA Steel', 'UN001', 'แผ่น'],
    ['GRP002', 'SUB003', 'สินค้าอุปโภค', 'MAT004', 'ถุงพลาสติก', '', '', 'BR004', 'Thai Poly', 'UN004', 'ถุง'],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Material')
  XLSX.writeFile(wb, 'material_template.xlsx')
}

interface ParsedRow { row: number; groupCode: string; groupId: string; valid: boolean; error?: string; data: Omit<MaterialRecord, 'key' | 'id' | 'isActive'> }

const isBlank = (v: string) => v.trim() === ''

const REQUIRED_FIELDS = ['groupCode', 'subGroupCode', 'subGroupName', 'materialCode', 'materialName', 'unitCode', 'unitName'] as const

type GroupRaw = { id: string; group_code: string; group_name: string }

const parseRows = (rows: Record<string, string>[], groups: GroupRaw[]): ParsedRow[] =>
  rows.map((cols, i) => {
    const get = (f: string) => String(cols[f] ?? '').trim()
    const groupCode       = get('groupCode')
    const subGroupCode    = get('subGroupCode')
    const subGroupName    = get('subGroupName')
    const materialCode    = get('materialCode')
    const materialName    = get('materialName')
    const specCode        = get('specCode')
    const specDescription = get('specDescription')
    const brandCode       = get('brandCode')
    const brandName       = get('brandName')
    const unitCode        = get('unitCode')
    const unitName        = get('unitName')

    const grp = groups.find((g) => g.group_code === groupCode)

    const data = {
      groupId: grp?.id ?? '',
      subGroupCode, subGroupName,
      materialCode, materialName,
      specCode, specDescription,
      brandCode, brandName,
      unitCode, unitName,
    }

    const missing = REQUIRED_FIELDS.filter((f) => isBlank(get(f)))
    if (missing.length > 0)
      return { row: i + 2, groupCode, groupId: grp?.id ?? '', valid: false, error: `ข้อมูลไม่ครบในฟิลด์: ${missing.join(', ')}`, data }

    if (!grp)
      return { row: i + 2, groupCode, groupId: '', valid: false, error: `ไม่พบกลุ่ม "${groupCode}"`, data }

    return { row: i + 2, groupCode, groupId: grp.id, valid: true, data }
  })

const MISSING_COLS_ERROR = 'MISSING_COLUMNS'

const readFileAsRows = (file: File, groups: GroupRaw[]): Promise<ParsedRow[]> =>
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
        resolve(parseRows(json, groups))
      } catch (err) {
        reject(err instanceof Error && err.name === MISSING_COLS_ERROR ? err : new Error('อ่านไฟล์ไม่ได้'))
      }
    }
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'))
    reader.readAsArrayBuffer(file)
  })

// ── main page ────────────────────────────────────────────────────
const MaterialPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<MaterialRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [groups, setGroups] = useState<GroupRaw[]>([])
  const [filterGroup, setFilterGroup] = useState<string | undefined>()
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([newRow()])
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<MaterialRecord | null>(null)
  const [editForm] = Form.useForm()

  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [duplicateCount, setDuplicateCount] = useState(0)

  // load groups once
  useEffect(() => {
    if (!accessToken) return
    axios.get(`${BASE_URL}/groups`, { headers: authHeader })
      .then((res) => setGroups(res.data?.data ?? []))
      .catch(() => {})
  }, [accessToken])

  // load material stats once
  useEffect(() => {
    if (!accessToken) return
    axios.get(`${BASE_URL}/master/materials/stats`, { headers: authHeader })
      .then((res) => {
        const stats = res.data?.data ?? res.data ?? {}
        setDuplicateCount(stats.duplicates ?? 0)
      })
      .catch(() => {})
  }, [accessToken])

  const fetchMaterials = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/allMaterial`, {
        params: { page, limit: 10 },
        headers: authHeader,
      })
      const rawList = Array.isArray(res.data) ? res.data : res.data?.data
      const list = Array.isArray(rawList) ? rawList : []
      setTotal(res.data?.total ?? 0)
      setData(list.map((m: any) => ({
        key:             m.mat_code,
        id:              m.mat_code,
        groupId:         m.group_code,
        subGroupCode:    m.subgroup_code    ?? '',
        subGroupName:    m.subgroup_name    ?? '',
        materialCode:    m.mat_code,
        materialName:    m.mat_name_th      ?? '',
        matCodeName:     m.mat_code_name    ?? '',
        specCode:        m.spec_code        ?? '',
        specDescription: m.spec_description ?? '',
        brandCode:       m.brand_code       ?? '',
        brandName:       m.brand_name       ?? '',
        unitCode:        m.unit_code        ?? '',
        unitName:        m.unit_name        ?? '',
        isActive:        m.is_active,
      })))
    } catch {
      message.error('โหลดข้อมูลวัสดุไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [accessToken, page])

  // load materials — re-runs when page changes
  useEffect(() => { fetchMaterials() }, [fetchMaterials])

  const groupOptions = groups.map((g) => ({ value: g.group_code, label: `${g.group_code} — ${g.group_name}` }))
  const groupById = (id: string) => groups.find((g) => g.group_code === id)

  const [uploadFileName, setUploadFileName] = useState<string>('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const IMPORT_PAGE_SIZE = 10
  const [importPage, setImportPage] = useState(1)
  const [flashRowKey, setFlashRowKey] = useState<number | null>(null)
  const importRowRefs = useRef<Record<number, HTMLElement | null>>({})

  // ✅ แก้ไข: รอ render page ก่อนแล้วค่อย scroll
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

  // ✅ แก้ไข: เอา scroll ออก เหลือแค่ clear flash
  useEffect(() => {
    if (flashRowKey === null) return
    const timer = setTimeout(() => setFlashRowKey(null), 1300)
    return () => clearTimeout(timer)
  }, [flashRowKey])

  const filteredData = data.filter((d) => {
    if (filterGroup && d.groupId !== filterGroup) return false
    return true
  })

  const columns = [
    {
      title: 'MateCode', dataIndex: 'materialCode', key: 'mateCode', width: 180,
      render: (v: string) => <Text code style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Group / Sub Group', key: 'grp', width: 200,
      render: (_: unknown, r: MaterialRecord) => {
        const g = groupById(r.groupId)
        return (
          <Space direction="vertical" size={3}>
            {g && <Tag color="blue" style={{ margin: 0, fontSize: 13 }}>{g.group_code}</Tag>}
            <Tag color="geekblue" style={{ margin: 0, fontSize: 13 }}>{r.subGroupCode}</Tag>
          </Space>
        )
      },
    },
    {
      title: 'Material Name', key: 'mat', width: 240,
      render: (_: unknown, r: MaterialRecord) => (
        <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{r.matCodeName || r.materialName}</div>
      ),
    },
    {
      title: 'Spec', key: 'spec', width: 320, align: 'left' as const,
      render: (_: unknown, r: MaterialRecord) => (r.specCode || r.specDescription) ? (
        <div>
          {r.specCode && <Text code style={{ fontSize: 13 }}>{r.specCode}</Text>}
          {r.specDescription && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>{r.specDescription}</div>}
        </div>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Brand', key: 'brand', width: 190,
      render: (_: unknown, r: MaterialRecord) => r.brandName ? (
        <div>
          {r.brandCode && <Text code style={{ fontSize: 13 }}>{r.brandCode}</Text>}
          <div style={{ fontSize: 13, marginTop: 3 }}>{r.brandName}</div>
        </div>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Unit', key: 'unit', width: 130,
      render: (_: unknown, r: MaterialRecord) => (
        <div>
          {r.unitCode && <Text code style={{ fontSize: 13 }}>{r.unitCode}</Text>}
          <div style={{ fontSize: 13, marginTop: 3 }}>{r.unitName}</div>
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

  const openEdit = (r: MaterialRecord) => { setEditing(r); editForm.setFieldsValue(r); setEditOpen(true) }
  const handleDelete = (key: string) => { setData(data.filter((d) => d.key !== key)); message.success('ลบรายการเรียบร้อย') }
  const handleEditOk = () => {
    editForm.validateFields().then((values) => {
      setData(data.map((d) => d.key === editing!.key ? { ...d, ...values } : d))
      message.success('แก้ไขเรียบร้อย')
      setEditOpen(false)
    })
  }

  const updateRow = (rowKey: string, field: keyof PendingRow, val: string) =>
    setPendingRows((p) => p.map((r) => r.rowKey === rowKey ? { ...r, [field]: val } : r))
  const removeRow = (rowKey: string) => setPendingRows((p) => p.filter((r) => r.rowKey !== rowKey))

  const [submitting, setSubmitting] = useState(false)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/materials/export`, {
        headers: authHeader,
        responseType: 'blob',
      })
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `materials_${dateStr}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Export ไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  const handleSubmitAll = async () => {
    const invalid = pendingRows.some((r) =>
      !r.groupId || !r.subGroupCode || !r.subGroupName ||
      !r.materialCode || !r.materialName || !r.unitCode || !r.unitName
    )
    if (invalid) { message.warning('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบทุกรายการ'); return }

    setSubmitting(true)
    try {
      await axios.post(`${BASE_URL}/master/materials`,
        pendingRows.map((r) => ({
          group_code:       r.groupId,
          subgroup_code:    r.subGroupCode,
          subgroup_name:    r.subGroupName,
          mat_name_code:    r.materialCode,
          mat_name_th:      r.materialName,
          spec_code:        r.specCode        || '000',
          spec_description: r.specDescription || '-',
          brand_code:       r.brandCode       || '000',
          brand_name:       r.brandName       || '-',
          unit_code:        r.unitCode,
          unit_name:        r.unitName,
        })),
        { headers: authHeader }
      )
      setPendingRows([newRow()])
      message.success(`บันทึก ${pendingRows.length} รายการเรียบร้อย`)
      setPage(1)
    } catch {
      message.error('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpload: UploadProps['beforeUpload'] = (file) => {
    const allowed = ['.csv', '.xlsx', '.xls']
    if (!allowed.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      message.error('รองรับเฉพาะไฟล์ .csv, .xlsx, .xls เท่านั้น')
      return false
    }
    readFileAsRows(file, groups)
      .then((rows) => {
        if (rows.length === 0) { message.error('ไม่พบข้อมูลในไฟล์ หรือไฟล์ไม่ถูกต้อง'); return }
        setParsedRows(rows)
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
    setImportSubmitting(true)
    try {
      const res = await axios.post(
        `${BASE_URL}/master/materials/bulk`,
        valid.map((r) => ({
          group_code:       r.groupCode,
          subgroup_code:    r.data.subGroupCode,
          subgroup_name:    r.data.subGroupName,
          mat_name_code:    r.data.materialCode,
          mat_name_th:      r.data.materialName,
          spec_code:        r.data.specCode,
          spec_description: r.data.specDescription,
          brand_code:       r.data.brandCode,
          brand_name:       r.data.brandName,
          unit_code:        r.data.unitCode,
          unit_name:        r.data.unitName,
        })),
        { headers: authHeader }
      )
      setParsedRows([])
      setUploadFileName('')
      message.success(`นำเข้าสำเร็จ ${res.data.count} รายการ`)
      await fetchMaterials()
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
        title="จัดการวัสดุ (Material)"
        subtitle="กำหนดรหัสและชื่อวัสดุ สเปค ยี่ห้อ และหน่วยตามกลุ่ม"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'วัสดุ' }]}
      />

      <div style={{ padding: '0 0 32px', overflowX: 'hidden' }}>

        {/* stats */}
        <Row gutter={[16, 12]} style={{ marginBottom: 20 }}>
          {[
            { label: 'รายการทั้งหมด', value: total, icon: <AppstoreOutlined />, color: '#3b82f6', bg: '#eff6ff' },
            { label: 'ใช้งานอยู่', value: total, icon: <CheckCircleOutlined />, color: '#10b981', bg: '#f0fdf4' },
            { label: 'Matcode ซ้ำ', value: duplicateCount, icon: <WarningOutlined />, color: '#ef4444', bg: '#fef2f2' },
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
            <Title level={5} style={{ margin: 0 }}>รายการวัสดุทั้งหมด</Title>
            <Space wrap>
              <Select allowClear placeholder="กรองตามกลุ่ม" style={{ width: 260 }} options={groupOptions}
                value={filterGroup} onChange={(v) => setFilterGroup(v)} />
              <Button icon={<FileExcelOutlined />} loading={exporting} onClick={handleExport}>
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
              rowKey="key" scroll={{ x: 1100 }}
            />
          </div>
        </div>

        {/* insert rows */}
        <div style={panelStyle}>
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
            <div style={{ minWidth: 1100 }}>
              {pendingRows.map((row, idx) => (
                <InsertRow key={row.rowKey} row={row} index={idx}
                  groupOptions={groupOptions}
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
        <div style={{ ...panelStyle, marginTop: 20 }}>
          <div style={panelHead}>
            <div>
              <Title level={5} style={{ margin: 0 }}>อัปโหลดไฟล์เพื่ออัปเดตข้อมูล</Title>
              <Text style={{ fontSize: 12, color: '#9ca3af' }}>นำเข้าข้อมูลวัสดุจากไฟล์ Excel หรือ CSV ได้ครั้งละหลายรายการ</Text>
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
                    { title: 'GroupCode', dataIndex: 'groupCode', width: 100 },
                    {
                      title: 'SubGroup', key: 'sub', width: 170,
                      render: (_: unknown, r: ParsedRow) => (
                        <div>
                          <Text code style={{ fontSize: 11 }}>{r.data.subGroupCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{r.data.subGroupName || <span style={{ color: '#f87171' }}>—</span>}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Material', key: 'mat', width: 200,
                      render: (_: unknown, r: ParsedRow) => (
                        <div>
                          <Text code style={{ fontSize: 11 }}>{r.data.materialCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 12 }}>{r.data.materialName || <span style={{ color: '#f87171' }}>—</span>}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Spec', key: 'spec', width: 300, align: 'left' as const,
                      render: (_: unknown, r: ParsedRow) => (
                        <div style={{ textAlign: 'left' }}>
                          <Text code style={{ fontSize: 13 }}>{r.data.specCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 13, color: '#6b7280' }}>{r.data.specDescription || ''}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Brand', key: 'brand', width: 130,
                      render: (_: unknown, r: ParsedRow) => (
                        <div>
                          <Text code style={{ fontSize: 11 }}>{r.data.brandCode || <span style={{ color: '#f87171' }}>—</span>}</Text>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{r.data.brandName || <span style={{ color: '#f87171' }}>—</span>}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Unit', key: 'unit', width: 110,
                      render: (_: unknown, r: MaterialRecord) => (
                        <div style={{ fontSize: 12 }}>{r.unitName}</div>
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

      {/* edit modal */}
      <Modal title="แก้ไขรายการวัสดุ" open={editOpen} onOk={handleEditOk} onCancel={() => setEditOpen(false)}
        okText="บันทึก" cancelText="ยกเลิก" width={580}>
        <Divider style={{ margin: '12px 0' }} />
        <Form form={editForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="กลุ่ม" name="groupId" rules={[{ required: true, message: 'กรุณาเลือก' }]}>
                <Select options={groupOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, color: '#0284c7', margin: '0 0 12px' }}>กลุ่มย่อย</Divider>
          <Row gutter={12}>
            <Col span={10}><Form.Item label="รหัสกลุ่มย่อย" name="subGroupCode" rules={[{ required: true }]}><Input placeholder="SUB001" /></Form.Item></Col>
            <Col span={14}><Form.Item label="ชื่อกลุ่มย่อย" name="subGroupName" rules={[{ required: true }]}><Input placeholder="ชื่อกลุ่มย่อย" /></Form.Item></Col>
          </Row>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, color: '#4f46e5', margin: '0 0 12px' }}>วัสดุ</Divider>
          <Row gutter={12}>
            <Col span={10}><Form.Item label="รหัสวัสดุ" name="materialCode" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={14}><Form.Item label="ชื่อวัสดุ" name="materialName" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, color: '#7c3aed', margin: '0 0 12px' }}>สเปค</Divider>
          <Row gutter={12}>
            <Col span={10}><Form.Item label="รหัสสเปค" name="specCode"><Input /></Form.Item></Col>
            <Col span={14}><Form.Item label="คำอธิบายสเปค" name="specDescription"><Input /></Form.Item></Col>
          </Row>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, color: '#b45309', margin: '0 0 12px' }}>ยี่ห้อ</Divider>
          <Row gutter={12}>
            <Col span={10}><Form.Item label="รหัสยี่ห้อ" name="brandCode"><Input /></Form.Item></Col>
            <Col span={14}><Form.Item label="ชื่อยี่ห้อ" name="brandName"><Input /></Form.Item></Col>
          </Row>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, color: '#059669', margin: '0 0 12px' }}>หน่วย</Divider>
          <Row gutter={12}>
            <Col span={10}><Form.Item label="รหัสหน่วย" name="unitCode" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={14}><Form.Item label="ชื่อหน่วย" name="unitName" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Divider style={{ margin: '0 0 12px' }} />
          <Form.Item label="สถานะ" name="isActive">
            <Select options={[{ value: true, label: 'ใช้งาน' }, { value: false, label: 'ปิดใช้งาน' }]} style={{ width: 160 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default MaterialPage