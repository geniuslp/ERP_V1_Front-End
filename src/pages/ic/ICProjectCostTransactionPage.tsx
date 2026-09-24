import React, { useEffect, useRef, useState } from 'react'
import { Card, Table, Space, Select, DatePicker, Input, Button, Tag, Spin, Result, message } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
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

const refTypeColor: Record<string, string> = {
  PO: 'blue',
  MOVEMENT_ISSUE: 'orange',
  MOVEMENT_TRANSFER: 'purple',
}

const refTypeLabel: Record<string, string> = {
  PO: 'รับเข้า PO',
  MOVEMENT_ISSUE: 'ตัดเบิก',
  MOVEMENT_TRANSFER: 'โอน',
}

interface ICProjectInfo {
  project_code: string
  project_name: string
}

interface CostTransaction {
  id: number
  txn_date: string
  ref_type: string
  ref_id?: number
  ref_no?: string
  mat_code: string
  mat_name?: string
  cost_code?: string
  qty: number
  qty_after?: number | null
  created_by_name?: string
  remarks?: string | null
}

const ICProjectCostTransactionPage: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>()
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ICProjectInfo | null>(null)

  const [data, setData] = useState<CostTransaction[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)

  const [refType, setRefType] = useState<string | undefined>()
  const [range, setRange] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Step 1: validate :projectCode and load the project context header.
  useEffect(() => {
    if (!projectCode) {
      navigate('/ic/projects', { replace: true })
      return
    }
    let cancelled = false
    const fetchProject = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/by-code/${projectCode}`, { headers: authHeader })
        const proj = res.data?.data ?? res.data
        if (!proj || !proj.project_code) {
          throw new Error('not found')
        }
        if (!cancelled) setProject(proj)
      } catch (err: any) {
        if (!cancelled) {
          message.error(
            err?.response?.data?.message || err?.message || `ไม่พบข้อมูลโครงการ (${projectCode})`
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchProject()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode])

  const fetchData = async () => {
    if (!projectCode) return
    setRowsLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/ic/projects/${projectCode}/cost-transactions`, {
        headers: authHeader,
        params: {
          ref_type: refType,
          search: search || undefined,
          date_from: range?.[0] ? range[0].format('YYYY-MM-DD') : undefined,
          date_to: range?.[1] ? range[1].format('YYYY-MM-DD') : undefined,
          page,
          page_size: 20,
        },
      })
      const body = res.data?.data ?? res.data
      const raw = Array.isArray(body) ? body : body?.data ?? []
      setData(Array.isArray(raw) ? raw : [])
      setTotal(body?.total ?? (Array.isArray(raw) ? raw.length : 0))
    } catch (err: any) {
      setData([])
      setTotal(0)
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setRowsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, refType, search, range, page])

  const handleSearchInputChange = (value: string) => {
    setSearchInput(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setPage(1)
      setSearch(value)
    }, 400)
  }

  useEffect(
    () => () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    },
    []
  )

  const handleRefClick = (record: CostTransaction) => {
    if (!record.ref_id) return
    if (record.ref_type === 'PO') {
      navigate(`/po/approval/${record.ref_id}`)
    } else if (record.ref_type === 'MOVEMENT_ISSUE' || record.ref_type === 'MOVEMENT_TRANSFER') {
      navigate(`/ic/projects/${projectCode}/movement/${record.ref_id}`)
    }
  }

  const columns = [
    {
      title: 'วันที่',
      dataIndex: 'txn_date',
      key: 'txn_date',
      render: (value: string) => (value ? dayjs(value).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'ประเภท',
      dataIndex: 'ref_type',
      key: 'ref_type',
      render: (value: string) => <Tag color={refTypeColor[value] ?? 'default'}>{refTypeLabel[value] ?? value}</Tag>,
    },
    {
      title: 'เลขที่เอกสารอ้างอิง',
      dataIndex: 'ref_no',
      key: 'ref_no',
      render: (value: string | undefined, record: CostTransaction) =>
        value ? (
          <span
            style={{ color: '#2563eb', fontWeight: 600, cursor: record.ref_id ? 'pointer' : 'default' }}
            onClick={() => handleRefClick(record)}
          >
            {value}
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: 'MatCode',
      dataIndex: 'mat_code',
      key: 'mat_code',
    },
    {
      title: 'MatName',
      dataIndex: 'mat_name',
      key: 'mat_name',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: 'CostCode',
      dataIndex: 'cost_code',
      key: 'cost_code',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: 'จำนวน',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
      render: (value: number) => {
        const isNegative = value < 0
        const color = isNegative ? '#dc2626' : '#16a34a'
        const sign = isNegative ? '' : '+'
        return <span style={{ color, fontWeight: 500 }}>{sign}{value}</span>
      },
    },
    {
      title: 'คงเหลือหลังรายการ',
      dataIndex: 'qty_after',
      key: 'qty_after',
      align: 'right' as const,
      render: (value: number | null | undefined) => (value ?? null) === null ? '-' : value,
    },
    {
      title: 'ผู้ทำรายการ',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: 'หมายเหตุ',
      dataIndex: 'remarks',
      key: 'remarks',
      render: (value: string | undefined | null) => value || '-',
    },
  ]

  if (loading) {
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
        title="รายการเคลื่อนไหว (โครงการ)"
        subtitle={`${project.project_code} — ${project.project_name}`}
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'โครงการ' },
          { title: project.project_name },
          { title: 'รายการเคลื่อนไหว' },
        ]}
      />

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Select
            placeholder="ประเภท"
            value={refType}
            onChange={(v) => {
              setRefType(v || undefined)
              setPage(1)
            }}
            allowClear
            style={{ width: 200 }}
            options={[
              { value: 'PO', label: 'รับเข้า PO' },
              { value: 'MOVEMENT_ISSUE', label: 'ตัดเบิก' },
              { value: 'MOVEMENT_TRANSFER', label: 'โอน' },
            ]}
          />
          <DatePicker.RangePicker
            value={range}
            onChange={(v) => {
              setRange(v)
              setPage(1)
            }}
            format="DD/MM/YYYY"
          />
          <Input
            placeholder="ค้นหาเลขที่เอกสาร / Material"
            value={searchInput}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
              setPage(1)
              setSearch(searchInput)
            }}
          >
            ค้นหา
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setRefType(undefined)
              setSearchInput('')
              setSearch('')
              setRange(null)
              setPage(1)
            }}
          >
            รีเซต
          </Button>
        </Space>

        <Table
          rowKey="id"
          loading={rowsLoading}
          columns={columns}
          dataSource={data}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (p) => setPage(p),
          }}
          locale={{ emptyText: 'ไม่พบรายการเคลื่อนไหว' }}
        />
      </Card>
    </div>
  )
}

export default ICProjectCostTransactionPage
