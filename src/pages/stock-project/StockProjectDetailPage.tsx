import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Space, Spin, Result, Button, Select, message } from 'antd'
import { SearchOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { formatCostCodeDisplay } from '@/utils/costCode'

const BASE_URL = (import.meta as any).env?.VITE_API_URL
const LIST_ROUTE = '/master/stock'
const TYPE_LABEL: Record<string, string> = {
  receive: 'PO Receive / PO Return',
  movement: 'Issue / Transfer',
  balance: 'คงเหลือวัสดุ',
}

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

interface ProjectInfo {
  project_code: string
  project_name: string
  is_warehouse_project: boolean
  warehouse_code?: string | null
}

type Source = 'WAREHOUSE' | 'PROJECT'

// NOTE: row fields below follow the contract draft (IC stock page layout);
// adjust to the backend's final report.
interface BalanceRow {
  mat_code: string
  mat_name: string
  cost_code?: string | null
  unit?: string | null
  qty_on_hand: number
  last_unit_cost?: number | null
  store_description?: string | null // WAREHOUSE source: stock_item.description_store
  updated_at?: string | null
}

const fmt = (v: number | null | undefined) =>
  v == null ? '-' : Number(v).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmtPrice = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-')

const useDebounced = (value: string, ms = 400) => {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value.trim()), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

const errText = (err: any, fallback: string) =>
  err?.response?.data?.message || err?.response?.data?.error || fallback

const StockProjectDetailPage: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>()
  const navigate = useNavigate()
  const dataType = useSearchParams()[0].get('type') ?? 'balance'
  const listRoute = `${LIST_ROUTE}?type=${dataType}`
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }
  const base = `${BASE_URL}/stock/by-project/${encodeURIComponent(projectCode ?? '')}`

  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [projectLoading, setProjectLoading] = useState(true)

  // ── balance ──
  const [source, setSource] = useState<Source | null>(null)
  const [balRows, setBalRows] = useState<BalanceRow[]>([])
  const [balTotal, setBalTotal] = useState(0)
  const [balLoading, setBalLoading] = useState(false)
  const [balSearchInput, setBalSearchInput] = useState('')
  const balSearch = useDebounced(balSearchInput)
  const [balPage, setBalPage] = useState(1)
  const [balPageSize, setBalPageSize] = useState(20)

  const [jobOptions, setJobOptions] = useState<{ value: string; label: string }[]>([])
  const [jobCode, setJobCode] = useState<string | undefined>(undefined)

  // Project header (also validates :projectCode) — looked up through the list endpoint.
  useEffect(() => {
    if (!accessToken || !projectCode) return
    let cancelled = false
    setProjectLoading(true)
    axios.get(`${BASE_URL}/stock/by-project`, { headers: authHeader, params: { search: projectCode, page: 1, page_size: 50 } })
      .then((res) => {
        const payload = res.data?.data ?? res.data
        const rows = Array.isArray(payload) ? payload : payload?.data ?? payload?.rows ?? []
        const hit = (Array.isArray(rows) ? rows : []).find((r: ProjectInfo) => r.project_code === projectCode)
        if (!cancelled) setProject(hit ?? null)
      })
      .catch(() => { if (!cancelled) setProject(null) })
      .finally(() => { if (!cancelled) setProjectLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, projectCode])

  // Job filter applies to PROJECT-source balances only (job codes of the project).
  useEffect(() => {
    if (!accessToken || !projectCode || dataType !== 'balance' || source !== 'PROJECT') return
    let cancelled = false
    axios.get(`${BASE_URL}/ic/projects/${encodeURIComponent(projectCode)}/job-codes`, { headers: authHeader })
      .then((res) => {
        const raw = res.data?.data ?? res.data
        const list = Array.isArray(raw) ? raw : []
        if (!cancelled) setJobOptions(list.map((jc: any) => ({ value: jc.job_code, label: `${jc.job_code} - ${jc.job_name}` })))
      })
      .catch(() => { if (!cancelled) setJobOptions([]) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, projectCode, source])

  useEffect(() => { setBalPage(1) }, [balSearch, jobCode])
  useEffect(() => {
    if (!accessToken || !projectCode || dataType !== 'balance') return
    let cancelled = false
    const load = async () => {
      setBalLoading(true)
      try {
        const res = await axios.get(`${base}/balance`, {
          headers: authHeader,
          params: { search: balSearch || undefined, page: balPage, page_size: balPageSize, job_code: jobCode || undefined },
        })
        const d = res.data?.data ?? res.data
        if (!cancelled) {
          setSource(d?.source ?? null)
          // Backend envelope (stockPageData): rows are under `data`, cost per unit is `unit_cost`.
          const list: any[] = Array.isArray(d?.data) ? d.data : Array.isArray(d?.rows) ? d.rows : []
          setBalRows(list.map((r) => ({ ...r, last_unit_cost: r.last_unit_cost ?? r.unit_cost })))
          setBalTotal(Number(d?.total ?? 0))
        }
      } catch (err: any) {
        if (!cancelled) {
          setBalRows([])
          setBalTotal(0)
          message.error(errText(err, 'โหลดข้อมูลคงเหลือไม่สำเร็จ'))
        }
      } finally {
        if (!cancelled) setBalLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, projectCode, dataType, balSearch, jobCode, balPage, balPageSize])

  // WAREHOUSE and PROJECT balances are different data sources: separate column sets, never merged.
  const isWarehouse = source === 'WAREHOUSE'
  const balColumns = isWarehouse
    ? [
        { title: 'ลำดับ', key: 'no', width: 80, align: 'center' as const, render: (_: unknown, __: BalanceRow, i: number) => (balPage - 1) * balPageSize + i + 1 },
        { title: 'รหัสต้นทุน', dataIndex: 'cost_code', key: 'cost_code', width: 130, align: 'center' as const, render: (v?: string | null) => formatCostCodeDisplay(v ?? '') || '-' },
        { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code', align: 'center' as const, render: (v: string) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{v}</span> },
        { title: 'รายละเอียด', dataIndex: 'mat_name', key: 'mat_name' },
        { title: 'รายละเอียดคลัง', dataIndex: 'store_description', key: 'store_description', render: (v?: string | null) => v || '-' },
        { title: 'ปริมาณ', dataIndex: 'qty_on_hand', key: 'qty_on_hand', width: 110, align: 'center' as const, render: fmt },
        { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 90, align: 'center' as const },
        { title: 'ราคา', dataIndex: 'last_unit_cost', key: 'last_unit_cost', width: 120, align: 'center' as const, render: fmtPrice },
      ]
    : [
        { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code' },
        { title: 'ชื่อวัสดุ', dataIndex: 'mat_name', key: 'mat_name' },
        { title: 'รหัสต้นทุน', dataIndex: 'cost_code', key: 'cost_code', render: (v?: string | null) => formatCostCodeDisplay(v ?? '') || '-' },
        { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 80 },
        { title: 'ปริมาณ', dataIndex: 'qty_on_hand', key: 'qty_on_hand', align: 'right' as const, render: fmt },
        { title: 'ต้นทุนล่าสุด/หน่วย', dataIndex: 'last_unit_cost', key: 'last_unit_cost', align: 'right' as const, render: fmt },
        { title: 'อัปเดตล่าสุด', dataIndex: 'updated_at', key: 'updated_at', render: fmtDate },
      ]

  if (projectLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>
  }
  if (!project) {
    return (
      <div style={{ padding: 24 }}>
        <Result
          status="error"
          title="โหลดข้อมูลโครงการไม่สำเร็จ"
          subTitle={`ไม่พบข้อมูลโครงการรหัส ${projectCode}`}
          extra={<Button type="primary" onClick={() => navigate(listRoute)}>กลับไปหน้ารายการโครงการ</Button>}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={TYPE_LABEL[dataType] ?? 'คลัง (Stock)'}
        subtitle={`${project.project_code} — ${project.project_name}`}
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Inventory Control' }, { title: 'คลัง (Stock)' }]}
        extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate(listRoute)}>เปลี่ยนโครงการ</Button>}
      />
      {dataType !== 'balance' ? (
        <Card style={cardStyle}>
          <Result status="info" title="เร็ว ๆ นี้ (Coming soon)" subTitle={`${TYPE_LABEL[dataType] ?? dataType} ยังไม่พร้อมใช้งาน`} />
        </Card>
      ) : (
      <Card style={cardStyle}>
        <Space wrap size="middle" style={{ marginBottom: 16 }}>
          {!isWarehouse && (
            <Select
              allowClear showSearch placeholder="ประเภท Job (ทั้งหมด)" style={{ width: 280 }}
              value={jobCode} onChange={setJobCode} options={jobOptions}
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          )}
          <Input
            allowClear prefix={<SearchOutlined />} style={{ width: 300 }}
            placeholder={isWarehouse ? 'ค้นหารหัสวัสดุ / ชื่อ Item' : 'ค้นหารหัสวัสดุ / ชื่อวัสดุ / รหัสต้นทุน'}
            value={balSearchInput} onChange={(e) => setBalSearchInput(e.target.value)}
          />
        </Space>
        <Table
          rowKey={(r) => `${r.mat_code}|${r.cost_code ?? ''}`}
          loading={balLoading}
          columns={balColumns}
          dataSource={balRows}
          pagination={{
            current: balPage, pageSize: balPageSize, total: balTotal,
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (p, ps) => { setBalPage(p); setBalPageSize(ps) },
          }}
          locale={{ emptyText: 'ไม่พบข้อมูลคงเหลือ' }}
        />
      </Card>
      )}
    </div>
  )
}

export default StockProjectDetailPage
