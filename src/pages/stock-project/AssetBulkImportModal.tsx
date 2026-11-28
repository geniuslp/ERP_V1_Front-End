import React, { useState } from 'react'
import { Alert, Button, Modal, Space, Table, Typography, Upload, message } from 'antd'
import { DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import axios from 'axios'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

// Bulk import for the asset register: Excel template -> preview -> POST /asset/bulk.
// The backend checks every row first and saves nothing if any row is wrong (errors come back per Excel row).
const BASE_URL = (import.meta as any).env?.VITE_API_URL

// Template headers = API field names (sheet_to_json keys rows by the literal header text, case-sensitive).
const HEADERS = ['mat_code', 'category', 'warehouse_code', 'project_code', 'location_code', 'qty', 'asset_no', 'serial_no', 'brand_model', 'acquired_date', 'cost', 'remark'] as const

export interface BulkRow {
  row_no: number
  mat_code: string
  category: string
  warehouse_code: string // exactly one of warehouse_code / project_code
  project_code: string | null
  location_code: string | null
  qty: number
  asset_no: string | null
  serial_no: string | null
  brand_model: string | null
  acquired_date: string | null
  cost: number | null
  remark: string | null
}
interface RowError { row_no: number; message: string }

const str = (v: unknown): string | null => {
  const s = v == null ? '' : String(v).trim()
  return s === '' ? null : s
}
// Excel date cell (Date with cellDates), 'YYYY-MM-DD' or 'DD/MM/YYYY' -> 'YYYY-MM-DD'; anything else is sent as-is
// so the backend reports it on its row.
const toIsoDate = (v: unknown): string | null => {
  if (v instanceof Date) return dayjs(v).format('YYYY-MM-DD')
  const s = str(v)
  if (!s) return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return s
}
const toNum = (v: unknown): number | null => {
  const s = str(v)
  if (s == null) return null
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
  accessToken?: string
  categories: { code: string; name: string }[]
  warehouses: { value: string | number; label: string }[]
}

const AssetBulkImportModal: React.FC<Props> = ({ open, onClose, onDone, accessToken, categories, warehouses }) => {
  const [rows, setRows] = useState<BulkRow[]>([])
  const [fileName, setFileName] = useState('')
  const [errors, setErrors] = useState<RowError[]>([])
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setRows([])
    setFileName('')
    setErrors([])
  }
  const close = () => {
    if (saving) return
    reset()
    onClose()
  }

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const example = [
      ['px0111000200010', 'TOOL', 'FAC-S', '', '', 10, '', '', '', '2026-11-27', 120, 'ของใหม่ในคลัง Fac ระบบออกเลขให้ 10 ชิ้น'],
      ['px0111000200010', 'TOOL', '', '2026-LMT-010', '', 1, 'px0111000200010-0001', 'SN-001', '', '', '', 'ของเดิมที่มีเลขแล้ว อยู่คลังโครงการ'],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...HEADERS], ...example]), 'assets')
    const help = [
      ['คอลัมน์', 'จำเป็น', 'คำอธิบาย'],
      ['mat_code', 'ใช่', 'รหัสวัสดุจาก Master วัสดุ'],
      ['category', 'ใช่', categories.map((c) => `${c.code} = ${c.name}`).join(', ')],
      ['warehouse_code', 'ใส่อย่างใดอย่างหนึ่ง', `คลัง Fac: ${warehouses.map((w) => w.label).join(', ')}`],
      ['project_code', 'ใส่อย่างใดอย่างหนึ่ง', 'รหัสโครงการ (คลังโครงการ) — ใส่ warehouse_code หรือ project_code อย่างใดอย่างหนึ่ง'],
      ['location_code', '', 'รหัสตำแหน่งในคลัง (ว่างได้)'],
      ['qty', 'ใช่ (ถ้าไม่มี asset_no)', 'จำนวนชิ้น ระบบออกเลขที่ Asset ให้ทีละชิ้น'],
      ['asset_no', '', 'ใส่เมื่อของมีเลขอยู่แล้ว รูปแบบ {mat_code}-0001 (1 แถว = 1 ชิ้น, qty = 1) ชิ้นใหม่ของรหัสเดียวกันจะรันเลขต่อจากเลขสูงสุด'],
      ['serial_no', '', 'ใส่ได้เมื่อ qty = 1'],
      ['brand_model', '', 'ยี่ห้อ / รุ่น'],
      ['acquired_date', '', 'วันที่ได้มา YYYY-MM-DD หรือ DD/MM/YYYY'],
      ['cost', '', 'ราคาต่อชิ้น (บาท)'],
      ['remark', '', 'หมายเหตุ'],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(help), 'คำอธิบาย')
    XLSX.writeFile(wb, 'asset_import_template.xlsx')
  }

  const readFile = async (file: File) => {
    setErrors([])
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      const parsed: BulkRow[] = []
      raw.forEach((r, i) => {
        if (HEADERS.every((h) => str(r[h]) == null)) return // blank line
        const assetNo = str(r.asset_no)
        const qty = toNum(r.qty)
        parsed.push({
          row_no: i + 2, // header is Excel row 1
          mat_code: str(r.mat_code) ?? '',
          category: (str(r.category) ?? '').toUpperCase(),
          warehouse_code: str(r.warehouse_code) ?? '',
          project_code: str(r.project_code),
          location_code: str(r.location_code),
          qty: qty == null ? (assetNo ? 1 : 0) : qty,
          asset_no: assetNo,
          serial_no: str(r.serial_no),
          brand_model: str(r.brand_model),
          acquired_date: toIsoDate(r.acquired_date),
          cost: toNum(r.cost),
          remark: str(r.remark),
        })
      })
      if (parsed.length === 0) {
        message.warning('ไม่พบข้อมูลในไฟล์ (ใช้หัวคอลัมน์ตาม Template)')
        return
      }
      setRows(parsed)
      setFileName(file.name)
    } catch {
      message.error('อ่านไฟล์ไม่สำเร็จ กรุณาใช้ไฟล์ .xlsx ตาม Template')
    }
  }

  const submit = async () => {
    const badNum = rows.find((r) => Number.isNaN(r.qty) || Number.isNaN(r.cost as number))
    if (badNum) {
      setErrors([{ row_no: badNum.row_no, message: 'qty หรือ cost ไม่ใช่ตัวเลข' }])
      return
    }
    setSaving(true)
    setErrors([])
    try {
      const res = await axios.post(`${BASE_URL}/asset/bulk`, { rows }, { headers: { Authorization: `Bearer ${accessToken}` } })
      message.success(res.data?.message || 'นำเข้าเรียบร้อย')
      reset()
      onDone()
    } catch (e: any) {
      const list: RowError[] = e?.response?.data?.errors ?? []
      if (list.length > 0) setErrors(list)
      message.error(e?.response?.data?.error || e?.response?.data?.message || 'นำเข้าไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const units = rows.reduce((s, r) => s + (Number.isFinite(r.qty) ? r.qty : 0), 0)
  const errorRows = new Set(errors.map((e) => e.row_no))

  const columns: ColumnsType<BulkRow> = [
    { title: 'แถว', dataIndex: 'row_no', key: 'row_no', width: 60, align: 'center' },
    { title: 'mat_code', dataIndex: 'mat_code', key: 'mat_code', width: 160 },
    { title: 'category', dataIndex: 'category', key: 'category', width: 140 },
    { title: 'คลัง / โครงการ', key: 'home', width: 150, render: (_v, r) => r.warehouse_code || r.project_code || '-' },
    { title: 'ตำแหน่ง', dataIndex: 'location_code', key: 'loc', width: 90, render: (v) => v ?? '-' },
    { title: 'จำนวน', dataIndex: 'qty', key: 'qty', width: 70, align: 'right' },
    { title: 'asset_no', dataIndex: 'asset_no', key: 'no', width: 190, render: (v) => v ?? <Typography.Text type="secondary">ออกเลขใหม่</Typography.Text> },
    { title: 'serial_no', dataIndex: 'serial_no', key: 'sn', width: 110, render: (v) => v ?? '-' },
  ]

  return (
    <Modal
      open={open}
      title="นำเข้า Asset จาก Excel"
      width="min(1100px, 96vw)"
      onCancel={close}
      maskClosable={false}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={close} disabled={saving}>ยกเลิก</Button>,
        <Button key="ok" type="primary" onClick={submit} loading={saving} disabled={rows.length === 0}>
          นำเข้า{rows.length > 0 ? ` ${units} ชิ้น` : ''}
        </Button>,
      ]}
    >
      <Space wrap style={{ marginBottom: 12 }}>
        <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>ดาวน์โหลด Template</Button>
        {fileName && <Typography.Text type="secondary">{fileName} — {rows.length} แถว / {units} ชิ้น</Typography.Text>}
      </Space>
      <Upload.Dragger
        accept=".xlsx,.xls"
        multiple={false}
        showUploadList={false}
        beforeUpload={(f) => { readFile(f); return false }}
        style={{ marginBottom: 12, padding: '4px 0' }}
      >
        <p style={{ margin: 0, fontSize: 28, color: '#1d4ed8' }}><InboxOutlined /></p>
        <p style={{ margin: '4px 0 0' }}>ลากไฟล์ Excel มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>.xlsx / .xls — เลือกไฟล์ใหม่ได้ทุกเมื่อ ข้อมูลเดิมในตัวอย่างจะถูกแทนที่</p>
      </Upload.Dragger>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        ของใหม่: ใส่ qty แล้วเว้น asset_no ว่าง ระบบออกเลขให้ · ของเดิมที่มีเลขแล้ว: ใส่ asset_no ทีละแถว (1 แถว = 1 ชิ้น) ·
        ถ้ามีแถวไหนผิด จะยังไม่บันทึกอะไรเลย ให้แก้ไฟล์แล้วนำเข้าใหม่
      </Typography.Paragraph>
      {errors.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={`พบข้อผิดพลาด ${errors.length} รายการ — ยังไม่ได้บันทึกข้อมูล`}
          description={
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {errors.map((e, i) => <div key={i}>{e.row_no > 0 ? `แถว ${e.row_no}: ` : ''}{e.message}</div>)}
            </div>
          }
        />
      )}
      <Table<BulkRow>
        size="small"
        rowKey="row_no"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 50, hideOnSinglePage: true }}
        scroll={{ x: 900, y: 360 }}
        locale={{ emptyText: 'เลือกไฟล์ Excel เพื่อดูตัวอย่างก่อนนำเข้า' }}
        onRow={(r) => ({ style: errorRows.has(r.row_no) ? { background: '#fef2f2' } : undefined })}
      />
    </Modal>
  )
}

export default AssetBulkImportModal
