import React, { useEffect, useState } from 'react'
import { Card, Table, Select, Input, Space, Spin, Result, Button, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

interface ICProjectInfo {
  project_code: string
  project_name: string
}

interface StockRow {
  mat_code: string
  mat_name: string
  cost_code: string
  cost_name: string
  unit: string
  qty_on_hand: number
  last_unit_cost?: number | null
  updated_at?: string | null
}

const formatNumber = (value: number | null | undefined, digits = 2) =>
  value == null ? '-' : Number(value).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: digits })

const ICProjectStockPage: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>()
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [projectLoading, setProjectLoading] = useState(true)
  const [project, setProject] = useState<ICProjectInfo | null>(null)

  const [jobOptions, setJobOptions] = useState<{ value: string; label: string }[]>([])
  const [jobCode, setJobCode] = useState<string | undefined>(undefined)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [rows, setRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(false)

  // Project header (also validates :projectCode).
  useEffect(() => {
    if (!projectCode) {
      navigate('/ic/projects', { replace: true })
      return
    }
    let cancelled = false
    const load = async () => {
      setProjectLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/by-code/${projectCode}`, { headers: authHeader })
        const proj = res.data?.data ?? res.data
        if (!proj || !proj.project_code) throw new Error('not found')
        if (!cancelled) setProject(proj)
      } catch (err: any) {
        if (!cancelled) message.error(err?.response?.data?.message || err?.message || `ไม่พบข้อมูลโครงการ (${projectCode})`)
      } finally {
        if (!cancelled) setProjectLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode])

  // Job code filter options.
  useEffect(() => {
    if (!projectCode) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/${projectCode}/job-codes`, { headers: authHeader })
        const raw = res.data?.data ?? res.data
        const list = Array.isArray(raw) ? raw : []
        if (!cancelled) {
          setJobOptions(list.map((jc: any) => ({ value: jc.job_code, label: `${jc.job_code} - ${jc.job_name}` })))
        }
      } catch (err: any) {
        if (!cancelled) message.error(err?.response?.data?.message || err?.message || 'โหลดประเภท Job ไม่สำเร็จ')
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode])

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Stock rows — refetch on job code / search change.
  useEffect(() => {
    if (!projectCode) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/${projectCode}/stock`, {
          headers: authHeader,
          params: { job_code: jobCode || undefined, search: search || undefined },
        })
        const raw = res.data?.data ?? res.data
        const list = Array.isArray(raw) ? raw : raw?.data ?? []
        if (!cancelled) setRows(Array.isArray(list) ? list : [])
      } catch (err: any) {
        if (!cancelled) {
          setRows([])
          message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลคงเหลือไม่สำเร็จ')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, jobCode, search])

  // Warehouse-linked projects have no cost codes: every returned row has empty cost_code.
  // An empty result is not treated as warehouse-linked, so the columns stay for normal projects.
  const isWarehouseLinked = rows.length > 0 && rows.every((r) => !r.cost_code)

  const columns = [
    { title: 'MatCode', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'MatName', dataIndex: 'mat_name', key: 'mat_name' },
    ...(isWarehouseLinked
      ? []
      : [
          { title: 'CostCode', dataIndex: 'cost_code', key: 'cost_code', render: (v: string) => v || '-' },
        ]),
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 80 },
    {
      title: 'คงเหลือ',
      dataIndex: 'qty_on_hand',
      key: 'qty_on_hand',
      align: 'right' as const,
      render: (v: number) => formatNumber(v),
    },
    {
      title: 'ต้นทุนล่าสุด/หน่วย',
      dataIndex: 'last_unit_cost',
      key: 'last_unit_cost',
      align: 'right' as const,
      render: (v: number | null | undefined) => formatNumber(v),
    },
    {
      title: 'อัปเดตล่าสุด',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-'),
    },
  ]

  if (projectLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!project) {
    return (
      <div style={{ padding: 24 }}>
        <Result
          status="error"
          title="โหลดข้อมูลโครงการไม่สำเร็จ"
          subTitle={`ไม่พบข้อมูลโครงการรหัส ${projectCode}`}
          extra={
            <Button type="primary" onClick={() => navigate('/ic/projects')}>
              กลับไปหน้ารายการโครงการ
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="คงเหลือวัสดุ"
        subtitle={`${project.project_code} — ${project.project_name}`}
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'Inventory Control' },
          { title: 'ข้อมูลโครงการ' },
          { title: 'คงเหลือวัสดุ' },
        ]}
      />
      <Card style={cardStyle}>
        <Space wrap size="middle" style={{ marginBottom: 16 }}>
          <Select
            allowClear
            showSearch
            placeholder="ประเภท Job (ทั้งหมด)"
            value={jobCode}
            onChange={(v) => setJobCode(v)}
            options={jobOptions}
            style={{ width: 280 }}
            filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="ค้นหา MatCode / MatName / CostCode"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 300 }}
          />
        </Space>
        <Table
          rowKey={(r) => `${r.mat_code}|${r.cost_code}`}
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 20, showTotal: (t) => `ทั้งหมด ${t} รายการ` }}
          locale={{ emptyText: 'ไม่พบข้อมูลคงเหลือ' }}
        />
      </Card>
    </div>
  )
}

export default ICProjectStockPage
