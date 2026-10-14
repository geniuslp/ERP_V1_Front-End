import React, { useMemo, useState } from 'react'
import { Modal, Upload, Table, Button, Space, Alert, Typography, Tag, message } from 'antd'
import type { UploadProps } from 'antd'
import { InboxOutlined, DownloadOutlined, WarningOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useAppSelector } from '@/store'
import { customerService } from '@/services/customerService'
import type { CustomerImportRowError } from '@/types/customer'

const { Text } = Typography

const MAX_BYTES = 2 * 1024 * 1024
const MAX_ROWS = 2000
const MAX_CODE = 20
const MAX_NAME = 255
const TEMPLATE_HEADERS = ['รหัสลูกค้า', 'ชื่อลูกค้า']

const CODE_HEADERS = ['รหัสลูกค้า', 'customer code', 'customer_code']
const NAME_HEADERS = ['ชื่อลูกค้า', 'customer name', 'customer_name']
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()

interface PreviewRow {
  key: number
  row: number // spreadsheet row number (header = 1)
  code: string
  name: string
  problem?: string
}

const downloadTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS])
  ws['!cols'] = [{ wch: 20 }, { wch: 50 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Customer')
  XLSX.writeFile(wb, 'customer_import_template.xlsx')
}

// Only a leaked raw DB error is replaced; plain-language backend messages show as returned.
const GENERIC_ERROR = 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'
const looksLikeRawDbError = (t: string) => /SQLSTATE|violates|foreign key constraint|duplicate key|null value in column|pq:/i.test(t)
const safeText = (t: string) => (looksLikeRawDbError(t) ? GENERIC_ERROR : t)

// Parse the first sheet; returns rows or throws an Error with a user-facing message.
const parseFile = async (file: File): Promise<PreviewRow[]> => {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('ไม่พบข้อมูลในไฟล์')
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true })
  if (rawRows.length === 0) throw new Error('ไม่พบข้อมูลในไฟล์')

  const header = rawRows[0].map(norm)
  const codeIdx = header.findIndex((h) => CODE_HEADERS.includes(h))
  const nameIdx = header.findIndex((h) => NAME_HEADERS.includes(h))
  const missing: string[] = []
  if (codeIdx < 0) missing.push('"รหัสลูกค้า" (Customer Code)')
  if (nameIdx < 0) missing.push('"ชื่อลูกค้า" (Customer Name)')
  if (missing.length > 0) throw new Error(`ไม่พบหัวคอลัมน์ที่จำเป็น: ${missing.join(', ')}`)

  // Data rows; spreadsheet row numbers are recovered from the sheet range because blank rows are skipped.
  const startRow = (XLSX.utils.decode_range(ws['!ref'] ?? 'A1').s.r) + 1
  const rows: PreviewRow[] = []
  rawRows.forEach((r, i) => {
    if (i === 0) return
    const code = String(r[codeIdx] ?? '').trim()
    const name = String(r[nameIdx] ?? '').trim()
    if (!code && !name) return // wholly blank row
    rows.push({ key: rows.length, row: startRow + i, code, name })
  })
  if (rows.length === 0) throw new Error('ไม่พบข้อมูลในไฟล์')
  if (rows.length > MAX_ROWS) throw new Error(`ไฟล์มีมากกว่า ${MAX_ROWS.toLocaleString()} แถว (พบ ${rows.length.toLocaleString()} แถว)`)

  // Client-side checks.
  const seen = new Map<string, number>()
  rows.forEach((r) => { if (r.code) seen.set(r.code, (seen.get(r.code) ?? 0) + 1) })
  rows.forEach((r) => {
    const reasons: string[] = []
    if (!r.code) reasons.push('รหัสลูกค้าว่าง')
    else if ([...r.code].length > MAX_CODE) reasons.push(`รหัสลูกค้ายาวเกิน ${MAX_CODE} ตัวอักษร`)
    else if ((seen.get(r.code) ?? 0) > 1) reasons.push('รหัสลูกค้าซ้ำในไฟล์')
    if (!r.name) reasons.push('ชื่อลูกค้าว่าง')
    else if ([...r.name].length > MAX_NAME) reasons.push(`ชื่อลูกค้ายาวเกิน ${MAX_NAME} ตัวอักษร`)
    if (reasons.length > 0) r.problem = reasons.join(', ')
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

  const serverByRow = useMemo(() => {
    const m = new Map<number, string>()
    serverErrors.forEach((e) => {
      const prev = m.get(e.row)
      m.set(e.row, prev ? `${prev}, ${e.message}` : e.message)
    })
    return m
  }, [serverErrors])

  const problemCount = rows.filter((r) => r.problem).length

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
      const res = await customerService.importRows(
        accessToken,
        rows.map((r) => ({ customer_code: r.code, customer_name: r.name })),
      )
      message.success(`เพิ่มใหม่ ${res.created} รายการ / แก้ชื่อ ${res.updated} รายการ / ไม่เปลี่ยนแปลง ${res.unchanged} รายการ`)
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

  return (
    <Modal
      open={open}
      title={<span style={{ fontFamily: 'Sarabun, sans-serif', fontWeight: 700, color: '#1e3a8a' }}>นำเข้า Excel — ลูกค้า</span>}
      onCancel={close}
      destroyOnClose
      width={720}
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
        ช่องอื่น (ผู้ติดต่อ, เบอร์โทร, ที่อยู่, หมายเหตุ) ไปแก้ไขทีหลังได้ในหน้ารายการ
      </Text>

      {fileError && <Alert type="error" showIcon message={fileError} style={{ marginTop: 12, borderRadius: 8 }} />}

      {serverErrors.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 12, borderRadius: 8 }}
          message="นำเข้าไม่สำเร็จ — พบข้อผิดพลาดจากระบบ กรุณาแก้ไขไฟล์แล้วลองใหม่"
          description={
            <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 140, overflowY: 'auto' }}>
              {serverErrors.map((e, i) => (
                <li key={i}>แถว {e.row}{e.field ? ` (${e.field})` : ''}: {e.message}</li>
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
            pagination={rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
            onRow={(r) => ({ style: (r.problem || serverByRow.has(r.row)) ? { background: '#fef2f2' } : undefined })}
            columns={[
              { title: 'แถว', dataIndex: 'row', width: 60, align: 'center' },
              { title: 'รหัสลูกค้า', dataIndex: 'code', width: 150, render: (v: string) => v || <span style={{ color: '#f87171' }}>—</span> },
              { title: 'ชื่อลูกค้า', dataIndex: 'name', render: (v: string) => v || <span style={{ color: '#f87171' }}>—</span> },
              {
                title: 'ปัญหา',
                key: 'problem',
                width: 220,
                render: (_: unknown, r: PreviewRow) => {
                  const t = r.problem || serverByRow.get(r.row)
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
