import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Space, Select, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import { useAppSelector } from '@/store'
import { formatCostCodeDisplay } from '@/utils/costCode'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

type Source = 'WAREHOUSE' | 'PROJECT'

// GET /stock/by-project/:projectCode/balance
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

const errText = (err: any, fallback: string) =>
  err?.response?.data?.message || err?.response?.data?.error || fallback

interface Props {
  projectCode: string
}

const StockProjectBalance: React.FC<Props> = ({ projectCode }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [source, setSource] = useState<Source | null>(null)
  const [rows, setRows] = useState<BalanceRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [jobOptions, setJobOptions] = useState<{ value: string; label: string }[]>([])
  const [jobCode, setJobCode] = useState<string | undefined>(undefined)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Job filter applies to PROJECT-source balances only.
  useEffect(() => {
    if (!accessToken || source !== 'PROJECT') { setJobOptions([]); return }
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

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/stock/by-project/${encodeURIComponent(projectCode)}/balance`, {
          headers: authHeader,
          params: { search: search || undefined, page, page_size: pageSize, job_code: jobCode || undefined },
        })
        const d = res.data?.data ?? res.data
        if (!cancelled) {
          setSource(d?.source ?? null)
          // Backend envelope (stockPageData): rows are under `data`, cost per unit is `unit_cost`.
          const list: any[] = Array.isArray(d?.data) ? d.data : Array.isArray(d?.rows) ? d.rows : []
          setRows(list.map((r) => ({ ...r, last_unit_cost: r.last_unit_cost ?? r.unit_cost })))
          setTotal(Number(d?.total ?? 0))
        }
      } catch (err: any) {
        if (!cancelled) {
          setRows([])
          setTotal(0)
          message.error(errText(err, 'โหลดข้อมูลคงเหลือไม่สำเร็จ'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, projectCode, search, jobCode, page, pageSize])

  // WAREHOUSE and PROJECT balances are different data sources: separate column sets, never merged.
  const isWarehouse = source === 'WAREHOUSE'
  const columns = isWarehouse
    ? [
        { title: 'ลำดับ', key: 'no', width: 80, align: 'center' as const, render: (_: unknown, __: BalanceRow, i: number) => (page - 1) * pageSize + i + 1 },
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

  return (
    <Card style={{ ...cardStyle, marginTop: 16 }}>
      <Space wrap size="middle" style={{ marginBottom: 16 }}>
        {!isWarehouse && (
          <Select
            allowClear showSearch placeholder="ประเภท Job (ทั้งหมด)" style={{ width: 280 }}
            value={jobCode} onChange={(v) => { setJobCode(v); setPage(1) }} options={jobOptions}
            filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        )}
        <Input
          allowClear prefix={<SearchOutlined />} style={{ width: 300 }}
          placeholder={isWarehouse ? 'ค้นหารหัสวัสดุ / ชื่อ Item' : 'ค้นหารหัสวัสดุ / ชื่อวัสดุ / รหัสต้นทุน'}
          value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
        />
      </Space>
      <Table
        rowKey={(r) => `${r.mat_code}|${r.cost_code ?? ''}`}
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{
          current: page, pageSize, total,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps) },
        }}
        locale={{ emptyText: 'ไม่พบข้อมูลคงเหลือ' }}
      />
    </Card>
  )
}

export default StockProjectBalance
