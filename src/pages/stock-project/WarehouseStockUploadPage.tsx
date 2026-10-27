import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Empty, Input, Modal, Select, Space, Table, Tag, Tooltip, Typography, Upload, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { InboxOutlined, PlusCircleOutlined, SearchOutlined, SyncOutlined, UploadOutlined } from '@ant-design/icons'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { formatCostCodeDisplay } from '@/utils/costCode'

const { Text } = Typography
const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = { borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }

type Mode = 'update' | 'add'

// ── list of the selected warehouse (GET /stock/warehouse-items) ──────────────────────────────────────────────
interface StockRow {
  id: number
  mat_code: string
  mat_name?: string | null
  cost_code?: string | null
  unit?: string | null
  qty_on_hand: number
  unit_cost?: number | null
  store_description?: string | null
}

const fmt = (v: number | null | undefined) =>
  v == null ? '-' : Number(v).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmtPrice = (v: number | null | undefined) =>
  v == null ? '-' : Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── upload preview (POST /stock/warehouse-upload/preview|apply) ──────────────────────────────────────────────
interface PreviewRow {
  row_no: number
  mat_code: string
  mat_name: string
  unit: string
  file_qty: number
  current_qty: number | null
  new_qty: number
  is_new: boolean
  merged_rows?: number[] // Add mode: the file rows of this code that were summed into this one
  status: 'ok' | 'code_not_found' | 'other_warehouse' | 'invalid_qty' | 'duplicate'
  message?: string
}

interface Preview {
  rows: PreviewRow[]
  summary: { total: number; new_items: number; problems: number }
  problems: string[]
  can_apply: boolean
}

const STATUS_LABEL: Record<PreviewRow['status'], { text: string; color: string }> = {
  ok: { text: 'พร้อมบันทึก', color: 'green' },
  code_not_found: { text: 'ไม่พบรหัสวัสดุ', color: 'red' },
  other_warehouse: { text: 'อยู่คลังอื่น', color: 'red' },
  invalid_qty: { text: 'จำนวนไม่ถูกต้อง', color: 'red' },
  duplicate: { text: 'รหัสซ้ำในไฟล์', color: 'red' },
}

const MODE_TEXT: Record<Mode, { title: string; hint: string }> = {
  update: { title: 'Upload Update (เขียนทับยอด)', hint: 'ยอดคงเหลือจะถูกตั้งเป็นจำนวนในไฟล์' },
  add: { title: 'Upload Add (เติมเข้าคลัง)', hint: 'จำนวนในไฟล์จะถูกบวกเพิ่มจากยอดเดิม เช่น รับของคืนจากหน้างานกลับเข้าสต็อก ถ้ารหัสวัสดุเดียวกันอยู่หลายแถว ระบบจะรวมจำนวนให้' },
}

const qtyFmt = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : v.toLocaleString('th-TH', { maximumFractionDigits: 4 })

interface UploadModalProps {
  mode: Mode | null // null = closed
  warehouse: string | undefined
  warehouseLabel: string
  token: string
  onClose: () => void
  onDone: () => void
}

/**
 * One modal per upload kind (Update / Add): drag the Excel file in (or click to browse), check the preview, confirm.
 * The backend is all-or-nothing, so a file with any bad row changes nothing.
 */
const WarehouseUploadModal: React.FC<UploadModalProps> = ({ mode, warehouse, warehouseLabel, token, onClose, onDone }) => {
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)

  useEffect(() => { if (mode) { setFile(null); setPreview(null) } }, [mode])

  const send = (path: 'preview' | 'apply', f: File) => {
    const fd = new FormData()
    fd.append('file', f)
    fd.append('mode', mode ?? '')
    fd.append('warehouse_code', warehouse ?? '')
    return axios.post(`${BASE_URL}/stock/warehouse-upload/${path}`, fd, { headers: { Authorization: `Bearer ${token}` } })
  }

  const onFile = async (f: File) => {
    if (!warehouse) { message.warning('กรุณาเลือกคลังก่อน'); return }
    setLoading(true)
    try {
      const res = await send('preview', f)
      setFile(f)
      setPreview(res.data?.data)
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.response?.data?.error || 'ตรวจไฟล์ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  const apply = async () => {
    if (!file) return
    setApplying(true)
    try {
      const res = await send('apply', file)
      const d = res.data?.data
      message.success(`บันทึกเรียบร้อย ${d?.rows ?? 0} รายการ (เพิ่มรายการใหม่ ${d?.created ?? 0}, ปรับยอด ${d?.updated ?? 0})`)
      onDone()
    } catch (e: any) {
      const problems: string[] | undefined = e?.response?.data?.problems
      message.error(problems?.[0] || e?.response?.data?.error || e?.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setApplying(false)
    }
  }

  const columns: ColumnsType<PreviewRow> = [
    { title: 'แถว', dataIndex: 'row_no', width: 60 },
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', width: 190 },
    { title: 'ชื่อวัสดุ', dataIndex: 'mat_name', ellipsis: true, render: (v: string) => v || '—' },
    { title: 'หน่วย', dataIndex: 'unit', width: 80, render: (v: string) => v || '—' },
    { title: 'ยอดเดิม', dataIndex: 'current_qty', width: 100, align: 'right', render: (v: number | null) => qtyFmt(v) },
    {
      title: mode === 'add' ? 'เพิ่ม' : 'ตามไฟล์', dataIndex: 'file_qty', width: 100, align: 'right',
      render: (v: number) => (mode === 'add' ? `+ ${qtyFmt(v)}` : qtyFmt(v)),
    },
    { title: 'ยอดใหม่', dataIndex: 'new_qty', width: 110, align: 'right', render: (v: number) => <b>{qtyFmt(v)}</b> },
    {
      title: 'สถานะ', dataIndex: 'status', width: 190,
      render: (s: PreviewRow['status'], r) => (
        <span title={r.message}>
          <Tag color={STATUS_LABEL[s].color}>{STATUS_LABEL[s].text}</Tag>
          {s === 'ok' && r.is_new && <Tag color="blue">รายการใหม่</Tag>}
          {r.merged_rows && r.merged_rows.length > 1 && (
            <Tag color="purple" title={`รวมยอดจากแถว ${r.merged_rows.join(', ')}`}>รวม {r.merged_rows.length} แถว</Tag>
          )}
        </span>
      ),
    },
  ]

  return (
    <Modal
      open={!!mode}
      width={preview ? 1100 : 640}
      maskClosable={false}
      destroyOnClose
      title={mode ? `${MODE_TEXT[mode].title} — คลัง ${warehouseLabel}` : ''}
      onCancel={() => !applying && onClose()}
      footer={preview ? [
        <Button key="again" disabled={applying} onClick={() => { setFile(null); setPreview(null) }}>เลือกไฟล์ใหม่</Button>,
        <Button key="cancel" disabled={applying} onClick={onClose}>ยกเลิก</Button>,
        <Button key="ok" type="primary" icon={<UploadOutlined />} loading={applying} disabled={!preview.can_apply} onClick={apply}>
          ยืนยันบันทึก
        </Button>,
      ] : [<Button key="cancel" onClick={onClose}>ปิด</Button>]}
    >
      {!preview && mode && (
        <>
          <Text type="secondary">{MODE_TEXT[mode].hint}</Text>
          <Upload.Dragger
            accept=".xlsx,.xls"
            multiple={false}
            maxCount={1}
            showUploadList={false}
            disabled={loading || !warehouse}
            beforeUpload={(f) => { onFile(f as unknown as File); return false }}
            style={{ marginTop: 16 }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">{loading ? 'กำลังตรวจไฟล์...' : 'ลากไฟล์ Excel มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}</p>
            <p className="ant-upload-hint">
              ใช้แบบฟอร์มเดียวกับหน้า Stock Items (หัวตาราง 3 แถว ข้อมูลเริ่มแถวที่ 4) — ระบบจะแสดงตัวอย่างให้ตรวจก่อนบันทึกเสมอ
            </p>
          </Upload.Dragger>
        </>
      )}

      {preview && mode && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text>{file?.name} · ทั้งหมด {preview.summary.total} รายการ</Text>
            {preview.summary.new_items > 0 && <Text> · รายการใหม่ {preview.summary.new_items}</Text>}
            {preview.summary.problems > 0 && <Text type="danger"> · มีปัญหา {preview.summary.problems}</Text>}
          </div>
          {!preview.can_apply && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              message="ไฟล์นี้บันทึกไม่ได้ ต้องแก้ไฟล์ก่อนแล้วอัปโหลดใหม่ (ยังไม่มีอะไรถูกบันทึก)"
              description={<div style={{ maxHeight: 120, overflow: 'auto' }}>{preview.problems.map((p, i) => <div key={i}>{p}</div>)}</div>}
            />
          )}
          {preview.can_apply && mode === 'update' && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Update จะเขียนทับยอดคงเหลือเดิมด้วยจำนวนในไฟล์ ตรวจคอลัมน์ ยอดใหม่ ให้ถูกต้องก่อนยืนยัน" />
          )}
          <Table<PreviewRow>
            rowKey="row_no"
            size="small"
            columns={columns}
            dataSource={preview.rows}
            pagination={{ pageSize: 50, showSizeChanger: false }}
            scroll={{ x: 900, y: 420 }}
            rowClassName={(r) => (r.status === 'ok' ? '' : 'ant-table-row-selected')}
          />
        </>
      )}
    </Modal>
  )
}

/**
 * Master > คลังสินค้า (อัปโหลด Excel): choose a warehouse, see its stock list (same columns as the Stock page), and
 * upload the Stock Items template into it - "Upload Update" overwrites quantities, "Upload Add" adds on top. Both
 * upload buttons stay disabled until a warehouse is chosen.
 */
const WarehouseStockUploadPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const headers = { Authorization: `Bearer ${accessToken}` }

  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([])
  const [warehouse, setWarehouse] = useState<string | undefined>()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<StockRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [uploadMode, setUploadMode] = useState<Mode | null>(null)

  useEffect(() => {
    if (!accessToken) return
    axios.get(`${BASE_URL}/master/warehouses`, { headers })
      .then((res) => {
        const raw = res.data?.data?.data ?? res.data?.data ?? res.data ?? []
        setWarehouses((Array.isArray(raw) ? raw : []).map((w: any) => ({
          value: w.warehouse_code,
          label: `${w.warehouse_code} — ${w.warehouse_name ?? ''}`.trim(),
        })))
      })
      .catch(() => message.error('โหลดรายชื่อคลังไม่สำเร็จ'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  const load = useCallback(async (p: number) => {
    if (!warehouse || !accessToken) { setRows([]); setTotal(0); return }
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/stock/warehouse-items`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { warehouse_code: warehouse, search: search || undefined, page: p, page_size: pageSize },
      })
      const d = res.data?.data
      setRows(Array.isArray(d?.data) ? d.data : [])
      setTotal(d?.total ?? 0)
      setPage(p)
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.response?.data?.error || 'โหลดรายการคลังไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [warehouse, search, pageSize, accessToken])

  useEffect(() => { load(1) }, [load])

  const warehouseLabel = warehouses.find((w) => w.value === warehouse)?.label ?? warehouse ?? ''
  const needWarehouse = 'เลือกคลังก่อนจึงจะอัปโหลดได้'

  const columns: ColumnsType<StockRow> = [
    { title: 'ลำดับ', key: 'no', width: 70, align: 'center', render: (_: unknown, __: StockRow, i: number) => (page - 1) * pageSize + i + 1 },
    { title: 'Cost Code', dataIndex: 'cost_code', width: 130, align: 'center', render: (v?: string | null) => formatCostCodeDisplay(v ?? '') || '-' },
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', align: 'center', render: (v: string) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{v}</span> },
    { title: 'รายละเอียด', dataIndex: 'mat_name', render: (v?: string | null) => v || '-' },
    { title: 'รายละเอียดคลัง', dataIndex: 'store_description', render: (v?: string | null) => v || '-' },
    { title: 'คงเหลือ', dataIndex: 'qty_on_hand', width: 110, align: 'center', render: fmt },
    { title: 'หน่วย', dataIndex: 'unit', width: 90, align: 'center', render: (v?: string | null) => v || '-' },
    { title: 'ราคา', dataIndex: 'unit_cost', width: 120, align: 'center', render: fmtPrice },
  ]

  const uploadButton = (mode: Mode, icon: React.ReactNode, primary: boolean) => (
    <Tooltip title={warehouse ? undefined : needWarehouse}>
      <span>
        <Button type={primary ? 'primary' : 'default'} icon={icon} disabled={!warehouse} onClick={() => setUploadMode(mode)}>
          Upload {mode === 'update' ? 'Update' : 'Add'}
        </Button>
      </span>
    </Tooltip>
  )

  return (
    <div>
      <PageHeader
        title="คลังสินค้า"
        subtitle="ดูรายการสินค้าของแต่ละคลัง และอัปโหลดข้อมูลจาก Excel (Update เขียนทับยอด / Add เติมเข้าคลัง)"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Master' }, { title: 'คลังสินค้า' }]}
      />

      <Card style={cardStyle}>
        <Space wrap size={12} style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space wrap size={12}>
            <Select
              showSearch
              placeholder="เลือกคลัง"
              style={{ width: 280 }}
              value={warehouse}
              onChange={(v) => { setWarehouse(v); setSearchInput(''); setSearch('') }}
              options={warehouses}
              optionFilterProp="label"
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="ค้นหารหัสวัสดุ / ชื่อ"
              style={{ width: 260 }}
              disabled={!warehouse}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={() => setSearch(searchInput.trim())}
              onBlur={() => setSearch(searchInput.trim())}
            />
          </Space>
          <Space wrap size={12}>
            {uploadButton('update', <SyncOutlined />, true)}
            {uploadButton('add', <PlusCircleOutlined />, false)}
          </Space>
        </Space>

        {warehouse ? (
          <Table<StockRow>
            rowKey="id"
            size="middle"
            loading={loading}
            columns={columns}
            dataSource={rows}
            scroll={{ x: 900 }}
            locale={{ emptyText: 'ยังไม่มีสินค้าในคลังนี้' }}
            pagination={{ current: page, pageSize, total, showSizeChanger: false, showTotal: (t) => `ทั้งหมด ${t} รายการ`, onChange: (p) => load(p) }}
          />
        ) : (
          <Empty description="เลือกคลังเพื่อดูรายการสินค้า" style={{ padding: '40px 0' }} />
        )}
      </Card>

      <WarehouseUploadModal
        mode={uploadMode}
        warehouse={warehouse}
        warehouseLabel={warehouseLabel}
        token={accessToken}
        onClose={() => setUploadMode(null)}
        onDone={() => { setUploadMode(null); load(1) }}
      />
    </div>
  )
}

export default WarehouseStockUploadPage
