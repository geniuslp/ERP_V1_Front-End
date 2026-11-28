import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  Button, Card, Col, DatePicker, Form, Grid, Input, InputNumber, Modal, Row, Select, Space, Table, Tabs, Tag, Typography, message,
} from 'antd'
import { EditOutlined, HistoryOutlined, PlusOutlined, PrinterOutlined, QrcodeOutlined, ScanOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { formatMoney } from '@/utils/formatMoney'
import AssetBulkImportModal from './AssetBulkImportModal'
import { useProjectOptions } from '@/hooks/useProjectOptions'

// IC > คลัง (Stock) > 2.3 คลัง Asset — asset register (backend /asset, migration 074).
// One row = one physical unit; units of the same material share mat_code and get asset_no "{mat_code}-{NNNN}",
// issued by the backend when they are added.
const BASE_URL = (import.meta as any).env?.VITE_API_URL
const MENU_CODE = 'MENU_IC_STOCK_ASSET'
const cardStyle: React.CSSProperties = { borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }

const STATUS: Record<string, { label: string; color: string }> = {
  IN_STOCK: { label: 'อยู่ในคลัง', color: 'green' },
  IN_USE: { label: 'ใช้งาน', color: 'blue' },
  REPAIR: { label: 'ส่งซ่อม', color: 'orange' },
  LOST: { label: 'สูญหาย', color: 'red' },
  DISPOSED: { label: 'ตัดจำหน่าย', color: 'default' },
}
const STATUS_OPTIONS = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))
const statusTag = (s?: string | null) => (s ? <Tag color={STATUS[s]?.color}>{STATUS[s]?.label ?? s}</Tag> : '-')

interface Category { id: number; code: string; name: string }
interface Asset {
  id: number
  asset_no: string
  mat_code: string
  mat_name: string
  unit_name: string | null
  category_id: number
  category_code: string
  serial_no: string | null
  brand_model: string | null
  warehouse_code: string | null // home = a warehouse (คลัง Fac) …
  warehouse_name: string | null
  location_code: string | null
  location_name: string | null
  project_code: string | null // … or a project (คลังโครงการ) — exactly one of the two
  project_name: string | null
  custodian_user_id: number | null
  custodian_name: string | null
  status: string
  acquired_date: string | null
  cost: number | null
  remark: string | null
}
interface Movement {
  id: number
  action: 'CREATE' | 'UPDATE'
  from_warehouse_code: string | null
  to_warehouse_code: string | null
  from_location_code: string | null
  to_location_code: string | null
  from_project_code: string | null
  to_project_code: string | null
  from_custodian_name: string | null
  to_custodian_name: string | null
  from_status: string | null
  to_status: string | null
  remark: string | null
  moved_at: string
  moved_by_name: string
}
type Opt = { value: string | number; label: string }

// "Home" of an asset in one Select value: 'wh:FAC-S' (คลัง Fac) or 'pj:2026-LMT-010' (คลังโครงการ).
const homeValue = (a: { warehouse_code: string | null; project_code: string | null }) =>
  a.warehouse_code ? `wh:${a.warehouse_code}` : a.project_code ? `pj:${a.project_code}` : undefined
const splitHome = (v?: string | null) => ({
  warehouse_code: v?.startsWith('wh:') ? v.slice(3) : null,
  project_code: v?.startsWith('pj:') ? v.slice(3) : null,
})
const homeLabel = (a: Pick<Asset, 'warehouse_code' | 'warehouse_name' | 'project_code' | 'project_name'>) =>
  a.warehouse_code
    ? `${a.warehouse_code}${a.warehouse_name ? ` ${a.warehouse_name}` : ''}`
    : a.project_code ? `${a.project_code} ${a.project_name ?? ''}`.trim() : '-'

// QR content = the asset number itself (same convention as the stock QR page, which encodes mat_code), so a
// handheld scanner can also type it straight into the search box. Generated in the browser — nothing is stored.
const SCAN_DIV_ID = 'asset-qr-reader'
const HTML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (ch) => HTML_ESC[ch])

// Opens a print window with one sticker per asset: QR + asset number + material name + warehouse / project code.
function printAssetLabels(list: { asset_no: string; mat_name: string; warehouse_code: string | null; project_code: string | null }[]) {
  const labels = list.map((a) => `
    <div class="label">
      <div class="qr">${renderToStaticMarkup(<QRCodeSVG value={a.asset_no} size={256} level="M" />)}</div>
      <div class="txt">
        <div class="no">${escapeHtml(a.asset_no)}</div>
        <div class="name">${escapeHtml(a.mat_name)}</div>
        <div class="wh">${escapeHtml(a.warehouse_code ?? a.project_code ?? '')}</div>
      </div>
    </div>`).join('')
  const win = window.open('', '_blank')
  if (!win) {
    message.error('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต pop-up แล้วลองใหม่')
    return
  }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR Asset</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
    <style>
      @page { size: A4; margin: 8mm; }
      body { margin: 0; font-family: 'Sarabun', sans-serif; }
      .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
      .label { display: flex; gap: 2mm; align-items: center; border: 0.3mm dashed #9ca3af; padding: 2mm; height: 30mm; box-sizing: border-box; break-inside: avoid; }
      .qr svg { width: 25mm; height: 25mm; display: block; }
      .txt { min-width: 0; }
      .no { font-weight: 700; font-size: 9pt; word-break: break-all; }
      .name { font-size: 7.5pt; line-height: 1.2; max-height: 3.6em; overflow: hidden; }
      .wh { font-size: 7pt; color: #4b5563; }
    </style></head><body><div class="sheet">${labels}</div>
    <script>document.fonts.ready.then(function () { window.focus(); window.print(); });</script>
    </body></html>`)
  win.document.close()
}

const errText = (e: any, fallback: string): string =>
  e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback

const AssetRegisterPage: React.FC = () => {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const headers = useMemo(() => ({ Authorization: `Bearer ${accessToken}` }), [accessToken])

  // reference data
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Opt[]>([])
  const [locations, setLocations] = useState<Opt[]>([])
  const [users, setUsers] = useState<Opt[]>([])

  // filters + list
  const [category, setCategory] = useState<string>('')
  // filter: 'wh:CODE' / 'pj:CODE' (see homeValue)
  const [home, setHome] = useState<string | undefined>()
  // Projects the user may use: a Project-department user gets only their own (scope=related), others every project.
  const { options: projectOptions } = useProjectOptions({ exclude_warehouse: true, scope: 'related' })
  const [status, setStatus] = useState<string | undefined>()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Asset[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [showPrice, setShowPrice] = useState(false)

  // modals
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [historyOf, setHistoryOf] = useState<Asset | null>(null)
  const [history, setHistory] = useState<Movement[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const addQty = Form.useWatch('qty', addForm)

  // QR: selection for label printing, single-QR modal, camera scanner
  const [selected, setSelected] = useState<Asset[]>([])
  const [qrOf, setQrOf] = useState<Asset | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  // material picker (remote search)
  const [matOptions, setMatOptions] = useState<Opt[]>([])
  const [matLoading, setMatLoading] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    const get = (url: string) => axios.get(`${BASE_URL}${url}`, { headers }).then((r) => r.data?.data ?? [])
    get('/asset/categories')
      .then((list: Category[]) => {
        setCategories(list)
        setCategory((c) => c || list[0]?.code || '')
      })
      .catch((e) => message.error(errText(e, 'โหลดประเภท Asset ไม่สำเร็จ')))
    get('/master/warehouses')
      .then((list: any[]) => setWarehouses(list.filter((w) => w.is_active !== false).map((w) => ({ value: w.warehouse_code, label: `${w.warehouse_code} ${w.warehouse_name ?? ''}`.trim() }))))
      .catch(() => setWarehouses([]))
    get('/master/locations')
      .then((list: any[]) => setLocations(list.filter((l) => l.is_active !== false).map((l) => ({ value: l.location_code, label: `${l.location_code} ${l.location_name ?? ''}`.trim() }))))
      .catch(() => setLocations([]))
    get('/users/options')
      .then((list: any[]) => setUsers(list.map((u) => ({ value: Number(u.id), label: u.username }))))
      .catch(() => setUsers([]))
  }, [accessToken, headers])

  const load = useCallback(async () => {
    if (!category) return
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/asset`, {
        headers,
        params: {
          category, status, search: search || undefined, page, limit: pageSize,
          warehouse_code: splitHome(home).warehouse_code || undefined,
          project_code: splitHome(home).project_code || undefined,
        },
      })
      setRows(res.data?.data ?? [])
      setTotal(res.data?.total ?? 0)
      setShowPrice(Boolean(res.data?.show_price))
    } catch (e) {
      message.error(errText(e, 'โหลดทะเบียน Asset ไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }, [headers, category, home, status, search, page, pageSize])

  // One grouped Select for "where the asset lives": คลัง Fac (warehouses) or คลังโครงการ (projects).
  const homeOptions = useMemo(() => [
    { label: 'คลัง Fac', options: warehouses.map((w) => ({ value: `wh:${w.value}`, label: w.label })) },
    { label: 'คลังโครงการ', options: projectOptions.map((p) => ({ value: `pj:${p.value}`, label: p.label })) },
  ], [warehouses, projectOptions])

  useEffect(() => { load() }, [load])

  const searchMaterials = useCallback(async (q: string) => {
    setMatLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/asset/materials`, { headers, params: { search: q } })
      setMatOptions((res.data?.data ?? []).map((m: any) => ({
        value: m.mat_code,
        label: `${m.mat_code} ${m.mat_name}${m.unit_name ? ` (${m.unit_name})` : ''}`,
      })))
    } catch {
      setMatOptions([])
    } finally {
      setMatLoading(false)
    }
  }, [headers])

  const currentCategory = categories.find((c) => c.code === category)

  const openAdd = () => {
    addForm.resetFields()
    addForm.setFieldsValue({ category_id: currentCategory?.id, qty: 1, home })
    setMatOptions([])
    searchMaterials('')
    setAddOpen(true)
  }

  const submitAdd = async () => {
    const v = await addForm.validateFields()
    setSaving(true)
    try {
      const { home: h, ...rest } = v
      const res = await axios.post(`${BASE_URL}/asset`, {
        ...rest,
        ...splitHome(h),
        acquired_date: v.acquired_date ? dayjs(v.acquired_date).format('YYYY-MM-DD') : null,
        serial_no: v.qty === 1 ? v.serial_no : null,
      }, { headers })
      const nos: string[] = res.data?.data?.asset_nos ?? []
      setAddOpen(false)
      Modal.success({
        title: res.data?.message || 'เพิ่ม Asset เรียบร้อย',
        content: nos.length <= 1 ? nos[0] : `${nos[0]} ถึง ${nos[nos.length - 1]} (${nos.length} ชิ้น)`,
      })
      load()
    } catch (e) {
      message.error(errText(e, 'เพิ่ม Asset ไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  const stopScanner = async () => {
    const sc = scannerRef.current
    scannerRef.current = null
    try { if (sc) await sc.stop() } catch { /* already stopped */ }
  }

  // A scanned asset number: find it in any category, switch to its tab and filter the list to it.
  const onScanned = async (code: string) => {
    await stopScanner()
    setScanOpen(false)
    const text = code.trim()
    try {
      const res = await axios.get(`${BASE_URL}/asset`, { headers, params: { search: text, limit: 5 } })
      const found: Asset | undefined = (res.data?.data ?? []).find((a: Asset) => a.asset_no === text)
      if (!found) {
        message.warning(`ไม่พบ Asset เลขที่ ${text}`)
        return
      }
      setCategory(found.category_code)
      setHome(undefined)
      setStatus(undefined)
      setSearchInput(found.asset_no)
      setSearch(found.asset_no)
      setPage(1)
      message.success(`พบ ${found.asset_no}`)
    } catch (e) {
      message.error(errText(e, 'ค้นหา Asset ไม่สำเร็จ'))
    }
  }

  useEffect(() => {
    if (!scanOpen) return
    setScanError(null)
    const timer = setTimeout(async () => {
      try {
        const sc = new Html5Qrcode(SCAN_DIV_ID)
        scannerRef.current = sc
        await sc.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, (text) => { onScanned(text) }, undefined)
      } catch (err: any) {
        const denied = err?.name === 'NotAllowedError' || /permission/i.test(err?.message ?? '')
        setScanError(denied
          ? 'ไม่ได้รับอนุญาตให้เข้าถึงกล้อง กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์แล้วลองใหม่อีกครั้ง'
          : 'ไม่สามารถเปิดกล้องได้ — ' + (err?.message ?? err))
      }
    }, 300)
    return () => { clearTimeout(timer); stopScanner() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen])

  const openEdit = (a: Asset) => {
    editForm.resetFields()
    editForm.setFieldsValue({
      serial_no: a.serial_no,
      brand_model: a.brand_model,
      home: homeValue(a),
      location_code: a.location_code,
      custodian_user_id: a.custodian_user_id,
      status: a.status,
      acquired_date: a.acquired_date ? dayjs(a.acquired_date) : null,
      cost: a.cost,
      remark: a.remark,
    })
    setEditing(a)
  }

  const submitEdit = async () => {
    if (!editing) return
    const v = await editForm.validateFields()
    setSaving(true)
    try {
      const { home: h, ...rest } = v
      await axios.put(`${BASE_URL}/asset/${editing.id}`, {
        ...rest,
        ...splitHome(h),
        custodian_user_id: v.custodian_user_id ?? null,
        location_code: v.location_code ?? null,
        acquired_date: v.acquired_date ? dayjs(v.acquired_date).format('YYYY-MM-DD') : null,
      }, { headers })
      message.success('บันทึกเรียบร้อย')
      setEditing(null)
      load()
    } catch (e) {
      message.error(errText(e, 'บันทึกไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  const openHistory = async (a: Asset) => {
    setHistoryOf(a)
    setHistory([])
    setHistoryLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/asset/${a.id}/movements`, { headers })
      setHistory(res.data?.data ?? [])
    } catch (e) {
      message.error(errText(e, 'โหลดประวัติไม่สำเร็จ'))
    } finally {
      setHistoryLoading(false)
    }
  }

  const columns: ColumnsType<Asset> = [
    { title: 'ลำดับ', key: 'no', width: 60, align: 'center', render: (_v, _r, i) => (page - 1) * pageSize + i + 1 },
    { title: 'เลขที่ Asset', dataIndex: 'asset_no', key: 'asset_no', width: 190, render: (v: string) => <b style={{ color: '#1d4ed8' }}>{v}</b> },
    { title: 'รายละเอียด', key: 'mat', width: 300, render: (_v, r) => <div><div>{r.mat_name}</div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.mat_code}</Typography.Text></div> },
    { title: 'Serial / ยี่ห้อ-รุ่น', key: 'serial', width: 180, render: (_v, r) => [r.serial_no, r.brand_model].filter(Boolean).join(' / ') || '-' },
    {
      title: 'คลัง / โครงการ', key: 'home', width: 220,
      render: (_v, r) => (
        <div>
          <Tag color={r.warehouse_code ? 'geekblue' : 'cyan'} style={{ marginRight: 4 }}>{r.warehouse_code ? 'Fac' : 'โครงการ'}</Tag>
          {homeLabel(r)}
        </div>
      ),
    },
    { title: 'ตำแหน่ง', key: 'loc', width: 140, render: (_v, r) => r.location_name ?? r.location_code ?? '-' },
    { title: 'ผู้ถือครอง', dataIndex: 'custodian_name', key: 'cust', width: 140, render: (v: string | null) => v || '-' },
    { title: 'สถานะ', dataIndex: 'status', key: 'status', width: 110, render: statusTag },
    ...(showPrice ? [{ title: 'ราคา', dataIndex: 'cost', key: 'cost', width: 120, align: 'right' as const, render: (v: number | null) => formatMoney(v) }] : []),
    {
      title: 'จัดการ', key: 'action', width: 130, align: 'center', fixed: isMobile ? undefined : 'right',
      render: (_v, r) => (
        <Space size={4}>
          <Button size="small" type="text" icon={<QrcodeOutlined />} title="QR Code" onClick={() => setQrOf(r)} />
          <PermissionButton menuCode={MENU_CODE} action="update" size="small" type="text" icon={<EditOutlined />} title="แก้ไข" onClick={() => openEdit(r)} />
          <Button size="small" type="text" icon={<HistoryOutlined />} title="ประวัติ" onClick={() => openHistory(r)} />
        </Space>
      ),
    },
  ]

  const change = (from: string | null, to: string | null) => `${from ?? '-'} → ${to ?? '-'}`
  const historyColumns: ColumnsType<Movement> = [
    { title: 'วันที่', dataIndex: 'moved_at', key: 'at', width: 140, render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm') },
    { title: 'รายการ', dataIndex: 'action', key: 'action', width: 80, render: (v: string) => (v === 'CREATE' ? 'เพิ่ม' : 'แก้ไข') },
    {
      title: 'การเปลี่ยนแปลง', key: 'chg', render: (_v, m) => {
        const parts: React.ReactNode[] = []
        if (m.action === 'CREATE') parts.push(`รับเข้า${m.to_project_code ? `คลังโครงการ ${m.to_project_code}` : `คลัง ${m.to_warehouse_code ?? ''}`}${m.to_location_code ? ` / ${m.to_location_code}` : ''}`)
        else {
          if (m.from_warehouse_code || m.to_warehouse_code) parts.push(`คลัง: ${change(m.from_warehouse_code, m.to_warehouse_code)}`)
          if (m.from_location_code || m.to_location_code) parts.push(`ตำแหน่ง: ${change(m.from_location_code, m.to_location_code)}`)
          if (m.from_project_code || m.to_project_code) parts.push(`โครงการ: ${change(m.from_project_code, m.to_project_code)}`)
          if (m.from_custodian_name || m.to_custodian_name) parts.push(`ผู้ถือครอง: ${change(m.from_custodian_name, m.to_custodian_name)}`)
          if (m.from_status || m.to_status) parts.push(`สถานะ: ${change(m.from_status && (STATUS[m.from_status]?.label ?? m.from_status), m.to_status && (STATUS[m.to_status]?.label ?? m.to_status))}`)
        }
        return <div>{parts.map((p, i) => <div key={i}>{p}</div>)}{m.remark && <Typography.Text type="secondary">หมายเหตุ: {m.remark}</Typography.Text>}</div>
      },
    },
    { title: 'ผู้ทำรายการ', dataIndex: 'moved_by_name', key: 'by', width: 140 },
  ]

  const resetPage = () => setPage(1)

  return (
    <div>
      <PageHeader
        title="คลัง Asset"
        subtitle="ทะเบียน Asset รายชิ้น — เลขที่ Asset = รหัสวัสดุ-ลำดับ ระบบออกให้อัตโนมัติ"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Inventory Control' }, { title: 'คลัง (Stock)' }, { title: 'คลัง Asset' }]}
      />
      <Card style={cardStyle}>
        <Tabs
          activeKey={category}
          onChange={(k) => { setCategory(k); resetPage() }}
          items={categories.map((c) => ({ key: c.code, label: c.name }))}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 12 }}>
          <Space wrap size={12}>
            <Select allowClear showSearch optionFilterProp="label" placeholder="ทุกคลัง / โครงการ" style={{ width: 280 }}
              options={homeOptions} value={home} onChange={(v) => { setHome(v); resetPage() }} />
            <Select allowClear placeholder="ทุกสถานะ" style={{ width: 150 }} options={STATUS_OPTIONS} value={status}
              onChange={(v) => { setStatus(v); resetPage() }} />
            <Input
              allowClear
              placeholder="ค้นหาเลขที่ Asset / รหัสวัสดุ / ชื่อ / Serial"
              style={{ width: isMobile ? '100%' : 320 }}
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); if (!e.target.value) { setSearch(''); resetPage() } }}
              onPressEnter={() => { setSearch(searchInput.trim()); resetPage() }}
              suffix={<SearchOutlined style={{ cursor: 'pointer' }} onClick={() => { setSearch(searchInput.trim()); resetPage() }} />}
            />
          </Space>
          <Space wrap size={8}>
            <Button icon={<ScanOutlined />} onClick={() => setScanOpen(true)}>สแกน QR</Button>
            <Button icon={<PrinterOutlined />} disabled={selected.length === 0} onClick={() => printAssetLabels(selected)}>
              พิมพ์ QR{selected.length > 0 ? ` (${selected.length})` : ''}
            </Button>
            <PermissionButton menuCode={MENU_CODE} action="write" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              นำเข้า Excel
            </PermissionButton>
            <PermissionButton menuCode={MENU_CODE} action="write" type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={!currentCategory}>
              เพิ่ม Asset
            </PermissionButton>
          </Space>
        </div>
        <Table<Asset>
          size="small"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1500 }}
          locale={{ emptyText: 'ยังไม่มี Asset ในประเภทนี้' }}
          rowSelection={{
            selectedRowKeys: selected.map((a) => a.id),
            preserveSelectedRowKeys: true,
            onChange: (_keys, picked) => setSelected((prev) => {
              // keep picks from other pages / tabs: drop this page's rows from prev, then add what is ticked now
              const onPage = new Set(rows.map((a) => a.id))
              return [...prev.filter((a) => !onPage.has(a.id)), ...picked.filter((a): a is Asset => !!a && onPage.has(a.id))]
            }),
          }}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true,
            showTotal: (t) => `ทั้งหมด ${t} ชิ้น`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
        />
      </Card>

      {/* ── add ── */}
      <Modal
        open={addOpen}
        title="เพิ่ม Asset"
        width={isMobile ? '100%' : 720}
        onCancel={() => !saving && setAddOpen(false)}
        onOk={submitAdd}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={saving}
        maskClosable={false}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" preserve={false}>
          <Form.Item name="mat_code" label="รหัสวัสดุ" rules={[{ required: true, message: 'กรุณาเลือกรหัสวัสดุ' }]}>
            <Select
              showSearch
              placeholder="พิมพ์รหัสหรือชื่อวัสดุเพื่อค้นหา"
              filterOption={false}
              onSearch={searchMaterials}
              loading={matLoading}
              options={matOptions}
              notFoundContent={matLoading ? 'กำลังค้นหา…' : 'ไม่พบวัสดุ'}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="category_id" label="ประเภท Asset" rules={[{ required: true, message: 'กรุณาเลือกประเภท' }]}>
                <Select options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="qty" label="จำนวน (ชิ้น)" extra="ระบบออกเลขที่ Asset ให้ทีละชิ้น" rules={[{ required: true, message: 'กรุณาระบุจำนวน' }]}>
                <InputNumber min={1} max={500} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="home" label="คลัง / โครงการ" rules={[{ required: true, message: 'กรุณาเลือกคลังหรือโครงการ' }]}>
                <Select showSearch optionFilterProp="label" options={homeOptions} placeholder="เลือกคลัง Fac หรือ คลังโครงการ" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="location_code" label="ตำแหน่ง">
                <Select allowClear showSearch optionFilterProp="label" options={locations} placeholder="ไม่ระบุ" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="serial_no" label="Serial No." extra={addQty > 1 ? 'ระบุได้เมื่อเพิ่มทีละ 1 ชิ้น (แก้รายชิ้นได้ภายหลัง)' : undefined}>
                <Input maxLength={100} disabled={addQty > 1} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="brand_model" label="ยี่ห้อ / รุ่น">
                <Input maxLength={200} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="acquired_date" label="วันที่ได้มา">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="cost" label="ราคาต่อชิ้น (บาท)">
                <InputNumber min={0} precision={2} placeholder="0.00" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="หมายเหตุ">
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── edit ── */}
      <Modal
        open={!!editing}
        title={editing ? `แก้ไข ${editing.asset_no}` : 'แก้ไข'}
        width={isMobile ? '100%' : 720}
        onCancel={() => !saving && setEditing(null)}
        onOk={submitEdit}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={saving}
        maskClosable={false}
        destroyOnClose
      >
        {editing && <Typography.Paragraph type="secondary">{editing.mat_code} {editing.mat_name}</Typography.Paragraph>}
        <Form form={editForm} layout="vertical" preserve={false}>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="home" label="คลัง / โครงการ" rules={[{ required: true, message: 'กรุณาเลือกคลังหรือโครงการ' }]}>
                <Select showSearch optionFilterProp="label" options={homeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="location_code" label="ตำแหน่ง">
                <Select allowClear showSearch optionFilterProp="label" options={locations} placeholder="ไม่ระบุ" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="status" label="สถานะ" rules={[{ required: true, message: 'กรุณาเลือกสถานะ' }]}>
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="custodian_user_id" label="ผู้ถือครอง">
                <Select allowClear showSearch optionFilterProp="label" options={users} placeholder="ไม่ระบุ" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="serial_no" label="Serial No.">
                <Input maxLength={100} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="brand_model" label="ยี่ห้อ / รุ่น">
                <Input maxLength={200} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="acquired_date" label="วันที่ได้มา">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            {showPrice && (
              <Col xs={24} md={12}>
                <Form.Item name="cost" label="ราคา (บาท)">
                  <InputNumber min={0} precision={2} placeholder="0.00" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            )}
          </Row>
          <Form.Item name="remark" label="หมายเหตุ (ของ Asset)">
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>
          <Form.Item name="movement_remark" label="เหตุผลการเปลี่ยนแปลง" extra="บันทึกลงประวัติของชิ้นนี้">
            <Input maxLength={300} placeholder="เช่น ย้ายไปโรงงานปราจีน, ส่งซ่อมที่ร้าน…" />
          </Form.Item>
        </Form>
      </Modal>

      <AssetBulkImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => { setImportOpen(false); load() }}
        accessToken={accessToken}
        categories={categories}
        warehouses={warehouses}
      />

      {/* ── single QR ── */}
      <Modal
        open={!!qrOf}
        title={qrOf ? `QR Code ${qrOf.asset_no}` : 'QR Code'}
        onCancel={() => setQrOf(null)}
        footer={[
          <Button key="close" onClick={() => setQrOf(null)}>ปิด</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => qrOf && printAssetLabels([qrOf])}>พิมพ์</Button>,
        ]}
        width={360}
        destroyOnClose
      >
        {qrOf && (
          <div style={{ textAlign: 'center' }}>
            <QRCodeSVG value={qrOf.asset_no} size={220} level="M" />
            <div style={{ fontWeight: 700, marginTop: 8 }}>{qrOf.asset_no}</div>
            <div style={{ color: '#6b7280' }}>{qrOf.mat_name}</div>
          </div>
        )}
      </Modal>

      {/* ── scan ── */}
      <Modal
        open={scanOpen}
        title="สแกน QR Asset"
        footer={null}
        onCancel={async () => { await stopScanner(); setScanOpen(false) }}
        width={isMobile ? '100%' : 420}
        destroyOnClose
      >
        <div id={SCAN_DIV_ID} style={{ width: '100%', minHeight: 260 }} />
        {scanError && <Typography.Paragraph type="danger" style={{ marginTop: 8 }}>{scanError}</Typography.Paragraph>}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          หันกล้องไปที่ QR บนตัว Asset — ใช้เครื่องสแกนแบบมือถือได้เช่นกัน โดยสแกนลงช่องค้นหาแล้วกด Enter
        </Typography.Text>
      </Modal>

      {/* ── history ── */}
      <Modal
        open={!!historyOf}
        title={historyOf ? `ประวัติ ${historyOf.asset_no}` : 'ประวัติ'}
        width={isMobile ? '100%' : 860}
        footer={null}
        onCancel={() => setHistoryOf(null)}
        destroyOnClose
      >
        <Table<Movement> size="small" rowKey="id" loading={historyLoading} columns={historyColumns} dataSource={history} pagination={false} scroll={{ x: 640 }} />
      </Modal>
    </div>
  )
}

export default AssetRegisterPage
