import React, { useMemo, useState } from 'react'
import { Modal, Upload, Table, Button, Space, Alert, Typography, Tag, message } from 'antd'
import type { UploadProps } from 'antd'
import { InboxOutlined, DownloadOutlined, WarningOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useAppSelector } from '@/store'
import { customerService } from '@/services/customerService'
import {
  CUSTOMER_EXCEL_COLUMNS, CUSTOMER_EXCEL_HEADERS, type CustomerExcelField,
} from '@/constants/customerExcel'
import type { CustomerImportRowError } from '@/types/customer'

const { Text } = Typography

const MAX_BYTES = 2 * 1024 * 1024
const MAX_ROWS = 2000
const MAX_CODE = 20
const MAX_NAME = 255
const MAX_TAX_ID = 20
const MAX_CREDIT = 50

type PreviewRow = Record<CustomerExcelField, string> & {
  key: number
  row: number // spreadsheet row number (header = 1)
  problems: string[]
}

const downloadTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([CUSTOMER_EXCEL_HEADERS])
  ws['!cols'] = CUSTOMER_EXCEL_COLUMNS.map((c) => ({ wch: c.width }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Customer')
  XLSX.writeFile(wb, 'customer_import_template.xlsx')
}

// Only a leaked raw DB error is replaced; plain-language backend messages show as returned.
const GENERIC_ERROR = 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'
const looksLikeRawDbError = (t: string) => /SQLSTATE|violates|foreign key constraint|duplicate key|null value in column|pq:/i.test(t)
const safeText = (t: string) => (looksLikeRawDbError(t) ? GENERIC_ERROR : t)

// Plain decimal text for a JS number — never scientific notation (String(1e21) would be).
const numberToPlain = (n: number) =>
  n.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 20 })

// Cell → trimmed string (also used for เลขประจำตัวผู้เสียภาษี: a 13-digit General-format
// number comes out as its full digits, never 1.23457E+12). Text cells are taken verbatim (leading zeros survive). Numeric
// cells with a custom number format (e.g. 0000000000) use Excel's formatted text so those
// zeros survive; plain numeric cells become a full-digit string. Leading zeros that Excel
// already discarded (General-format number) can't be recovered — format the column as Text.
const cellText = (cell?: XLSX.CellObject): string => {
  if (!cell || cell.v === undefined || cell.v === null) return ''
  if (cell.t === 'n') {
    if (cell.z && cell.z !== 'General' && cell.w) return cell.w.trim()
    return numberToPlain(cell.v as number)
  }
  if (cell.t === 's') return String(cell.v).trim()
  return String(cell.w ?? cell.v).trim()
}

// Parse the first sheet; returns rows or throws an Error with a user-facing message.
const parseFile = async (file: File): Promise<PreviewRow[]> => {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellNF: true, cellText: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws || !ws['!ref']) throw new Error('ไม่พบข้อมูลในไฟล์')
  const range = XLSX.utils.decode_range(ws['!ref'])

  // Header row = first row of the sheet; match header text literally (trimmed only).
  const colByField = new Map<CustomerExcelField, number>()
  for (let c = range.s.c; c <= range.e.c; c++) {
    const text = cellText(ws[XLSX.utils.encode_cell({ r: range.s.r, c })])
    const col = CUSTOMER_EXCEL_COLUMNS.find((x) => x.header === text || x.aliases?.includes(text))
    if (col && !colByField.has(col.field)) colByField.set(col.field, c)
  }
  const missing = CUSTOMER_EXCEL_COLUMNS.filter((c) => c.required && !colByField.has(c.field))
  if (missing.length > 0) {
    throw new Error(`ไม่พบหัวคอลัมน์ที่จำเป็น: ${missing.map((c) => `"${c.header}"`).join(', ')} (ดาวน์โหลดแม่แบบเพื่อดูหัวคอลัมน์ที่ถูกต้อง)`)
  }

  const rows: PreviewRow[] = []
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const values = {} as Record<CustomerExcelField, string>
    CUSTOMER_EXCEL_COLUMNS.forEach((col) => {
      const c = colByField.get(col.field)
      values[col.field] = c === undefined ? '' : cellText(ws[XLSX.utils.encode_cell({ r, c })])
    })
    if (Object.values(values).every((v) => !v)) continue // wholly blank row
    rows.push({ ...values, key: rows.length, row: r + 1, problems: [] })
  }
  if (rows.length === 0) throw new Error('ไม่พบข้อมูลในไฟล์')
  if (rows.length > MAX_ROWS) throw new Error(`ไฟล์มีมากกว่า ${MAX_ROWS.toLocaleString()} แถว (พบ ${rows.length.toLocaleString()} แถว)`)

  // Client-side checks — only code and name are required.
  const seen = new Map<string, number>()
  rows.forEach((r) => { if (r.customer_code) seen.set(r.customer_code.toLowerCase(), (seen.get(r.customer_code.toLowerCase()) ?? 0) + 1) })
  rows.forEach((r) => {
    if (!r.customer_code) r.problems.push('ต้องระบุรหัสลูกค้า')
    else if ([...r.customer_code].length > MAX_CODE) r.problems.push(`รหัสลูกค้ายาวเกิน ${MAX_CODE} ตัวอักษร`)
    else if ((seen.get(r.customer_code.toLowerCase()) ?? 0) > 1) r.problems.push('รหัสลูกค้าซ้ำในไฟล์')
    if (!r.customer_name) r.problems.push('ต้องระบุชื่อลูกค้า')
    else if ([...r.customer_name].length > MAX_NAME) r.problems.push(`ชื่อลูกค้ายาวเกิน ${MAX_NAME} ตัวอักษร`)
    if ([...r.credit_term].length > MAX_CREDIT) r.problems.push(`เครดิตยาวเกิน ${MAX_CREDIT} ตัวอักษร`)
    if ([...r.tax_id].length > MAX_TAX_ID) r.problems.push(`เลขประจำตัวผู้เสียภาษียาวเกิน ${MAX_TAX_ID} ตัวอักษร`)
  })
  return rows
}

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
}

const CustomerImportModal: React.FC<Props> = ({ open, onClose, onDone }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [fileError, setFileError] = useState('')
  const [serverErrors, setServerErrors] = useState<CustomerImportRowError[]>([])
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setFileName(''); setRows([]); setFileError(''); setServerErrors([])
  }
  const close = () => { reset(); onClose() }

  // Backend `row` = 1-based position in the submitted rows array, which is exactly
  // index + 1 into `rows` (blank rows were already dropped client-side) — NOT the
  // spreadsheet row. Keyed by that position, shown with the spreadsheet row number.
  const serverByKey = useMemo(() => {
    const m = new Map<number, string>()
    serverErrors.forEach((e) => {
      const key = e.row - 1
      const prev = m.get(key)
      m.set(key, prev ? `${prev}, ${e.message}` : e.message)
    })
    return m
  }, [serverErrors])

  const clientErrors = useMemo(
    () => rows.flatMap((r) => r.problems.map((p) => `แถวที่ ${r.row}: ${p}`)),
    [rows],
  )
  const problemCount = rows.filter((r) => r.problems.length > 0).length

  const handleBefore: UploadProps['beforeUpload'] = (file) => {
    reset()
    if (file.size > MAX_BYTES) {
      setFileError('ไฟล์ใหญ่เกิน 2 MB')
      return false
    }
    parseFile(file as unknown as File)
      .then((parsed) => { setRows(parsed); setFileName(file.name) })
      .catch((err: Error) => setFileError(err.message || 'อ่านไฟล์ไม่ได้'))
    return false // never auto-upload
  }

  const handleImport = async () => {
    setSubmitting(true)
    setServerErrors([])
    try {
      const opt = (v: string) => (v ? v : undefined)
      const res = await customerService.importRows(
        accessToken,
        rows.map((r) => ({
          customer_code: r.customer_code,
          customer_name: r.customer_name,
          tax_id: opt(r.tax_id),
          contact: opt(r.contact),
          contact_phone: opt(r.contact_phone),
          address: opt(r.address),
          credit_term: opt(r.credit_term),
          remarks: opt(r.remarks),
        })),
      )
      message.success(`เพิ่มใหม่ ${res.created} รายการ / อัปเดต ${res.updated} รายการ / ไม่เปลี่ยนแปลง ${res.unchanged} รายการ`)
      close()
      onDone()
    } catch (err: any) {
      const errs = err?.response?.data?.errors
      if (err?.response?.status === 400 && Array.isArray(errs)) {
        setServerErrors(errs.map((e: any) => ({ row: Number(e.row), field: e.field, message: safeText(String(e.message ?? '')) })))
      } else {
        const m = err?.response?.data?.message || err?.response?.data?.error
        message.error(typeof m === 'string' && m ? safeText(m) : 'นำเข้าข้อมูลไม่สำเร็จ')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const sheetRowOf = (position: number) => rows[position - 1]?.row ?? position

  return (
    <Modal
      open={open}
      title={<span style={{ fontFamily: 'Sarabun, sans-serif', fontWeight: 700, color: '#1e3a8a' }}>นำเข้า Excel — ลูกค้า</span>}
      onCancel={close}
      destroyOnClose
      width={960}
      footer={[
        <Button key="cancel" onClick={close} style={{ borderRadius: 8 }}>ยกเลิก</Button>,
        <Button
          key="ok"
          type="primary"
          loading={submitting}
          disabled={rows.length === 0 || problemCount > 0}
          onClick={handleImport}
          style={{ borderRadius: 8 }}
        >
          นำเข้า{rows.length > 0 ? ` (${rows.length} รายการ)` : ''}
          {problemCount > 0 ? ` — มีปัญหา ${problemCount} แถว` : ''}
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 12 }}>
        <Button type="link" icon={<DownloadOutlined />} onClick={downloadTemplate} style={{ padding: 0 }}>
          ดาวน์โหลดแม่แบบ
        </Button>
      </div>

      <Upload.Dragger
        accept=".xlsx,.xls,.csv"
        multiple={false}
        maxCount={1}
        showUploadList={false}
        beforeUpload={handleBefore}
        style={{ borderRadius: 10 }}
      >
        <p style={{ fontSize: 32, color: '#9ca3af', margin: 0 }}><InboxOutlined /></p>
        <p style={{ fontSize: 13, fontWeight: 600, margin: '6px 0 2px' }}>
          {fileName ? `${fileName} — คลิกเพื่อเลือกไฟล์ใหม่` : 'คลิกหรือลากไฟล์มาวางที่นี่'}
        </p>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
          รองรับ .xlsx / .xls / .csv ขนาดไม่เกิน 2 MB และไม่เกิน {MAX_ROWS.toLocaleString()} แถว
        </p>
      </Upload.Dragger>
      <Text style={{ display: 'block', marginTop: 8, fontSize: 12, color: '#6b7280' }}>
        จำเป็นต้องมีเฉพาะ "รหัสลูกค้า" และ "ชื่อลูกค้า" — คอลัมน์อื่นเว้นว่างได้
        (เบอร์โทรที่ขึ้นต้นด้วย 0 ควรตั้งรูปแบบคอลัมน์เป็น Text ก่อนกรอก)
      </Text>

      {fileError && <Alert type="error" showIcon message={fileError} style={{ marginTop: 12, borderRadius: 8 }} />}

      {clientErrors.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 12, borderRadius: 8 }}
          message={`พบข้อผิดพลาด ${clientErrors.length} จุด — กรุณาแก้ไขไฟล์แล้วอัปโหลดใหม่`}
          description={
            <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 140, overflowY: 'auto' }}>
              {clientErrors.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          }
        />
      )}

      {serverErrors.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 12, borderRadius: 8 }}
          message="นำเข้าไม่สำเร็จ — พบข้อผิดพลาดจากระบบ กรุณาแก้ไขไฟล์แล้วลองใหม่"
          description={
            <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 140, overflowY: 'auto' }}>
              {serverErrors.map((e, i) => (
                <li key={i}>แถวที่ {sheetRowOf(e.row)}{e.field ? ` (${e.field})` : ''}: {e.message}</li>
              ))}
            </ul>
          }
        />
      )}

      {rows.length > 0 && (
        <>
          <Space style={{ margin: '14px 0 8px' }}>
            <Text strong>ตัวอย่างข้อมูล</Text>
            <Tag color="blue">{rows.length} แถว</Tag>
            {problemCount > 0 && <Tag color="error" icon={<WarningOutlined />}>มีปัญหา {problemCount} แถว</Tag>}
          </Space>
          <Table<PreviewRow>
            size="small"
            rowKey="key"
            dataSource={rows}
            scroll={{ x: 1250 }}
            pagination={rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
            onRow={(r) => ({ style: (r.problems.length > 0 || serverByKey.has(r.key)) ? { background: '#fef2f2' } : undefined })}
            columns={[
              { title: 'แถว', dataIndex: 'row', width: 60, align: 'center' },
              ...CUSTOMER_EXCEL_COLUMNS.map((c) => ({
                title: c.header,
                dataIndex: c.field,
                width: c.field === 'customer_name' || c.field === 'address' ? 180 : c.field === 'tax_id' ? 150 : 120,
                ellipsis: true,
                render: (v: string) => v || <span style={{ color: c.required ? '#f87171' : '#9ca3af' }}>—</span>,
              })),
              {
                title: 'ปัญหา',
                key: 'problem',
                width: 200,
                render: (_: unknown, r: PreviewRow) => {
                  const t = r.problems.join(', ') || serverByKey.get(r.key)
                  return t ? <span style={{ color: '#dc2626', fontSize: 12 }}>{t}</span> : null
                },
              },
            ]}
          />
        </>
      )}
    </Modal>
  )
}

export default CustomerImportModal
