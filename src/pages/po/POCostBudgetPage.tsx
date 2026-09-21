import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Tag, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import type { ProjectStatus } from '@/types/project'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const thb = (n?: number) =>
  (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Same status Tag color/label mapping as ProjectListPage.tsx, kept in sync manually
// for visual consistency between the two project-selector tables.
const statusColor: Record<ProjectStatus, string> = {
  ACTIVE: 'green',
  INACTIVE: 'default',
  CLOSED: 'red',
}
const statusLabel: Record<ProjectStatus, string> = {
  ACTIVE: 'ดำเนินการ',
  INACTIVE: 'ไม่ใช้งาน',
  CLOSED: 'ปิดโครงการ',
}

interface ProjectRow {
  id: number
  projectCode: string
  projectName: string
  consultantName?: string
  consultantPhone?: string
  status: ProjectStatus
  customerName?: string
  budgetAmount: number
  startDate?: string
  endDate?: string
}

const mapProject = (raw: any): ProjectRow => ({
  id: raw.id,
  projectCode: raw.project_code,
  projectName: raw.project_name,
  consultantName: raw.consultant_name,
  consultantPhone: raw.consultant_phone,
  status: raw.status ?? 'ACTIVE',
  customerName: raw.customer_name,
  budgetAmount: raw.budget_amount ?? 0,
  startDate: raw.start_date,
  endDate: raw.end_date,
})

interface CostBudgetLine {
  cost_code: string
  cost_subgroup_name: string
  budget: number
  pu_cost: number
  pu_bal: number
  ac_cost: number
  ac_bal: number
}

interface CostBudgetTotals {
  budget: number
  pu_cost: number
  pu_bal: number
  ac_cost: number
  ac_bal: number
}

const POCostBudgetPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Level-2 data cached per project_code once its row is first expanded —
  // same pattern as ProjectOverviewPage.tsx's projectPOs/poLoadingKeys.
  const [expandedProjectKeys, setExpandedProjectKeys] = useState<React.Key[]>([])
  const [costBudgetByProject, setCostBudgetByProject] = useState<
    Record<string, { lines: CostBudgetLine[]; totals: CostBudgetTotals | null }>
  >({})
  const [lineLoadingKeys, setLineLoadingKeys] = useState<Set<string>>(new Set())

  // Same GET /master/projects endpoint + { search, page_size } param shape as
  // ProjectListPage.tsx's fetchData() — page_size raised to list the full set
  // for this selector rather than paginating server-side.
  const fetchProjects = async () => {
    setProjectsLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/projects`, {
        headers: authHeader,
        params: { search: search || undefined, page_size: 1000 },
      })
      const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
      setProjects((Array.isArray(raw) ? raw : []).map(mapProject))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลโครงการไม่สำเร็จ')
    } finally {
      setProjectsLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [search])

  const fetchCostBudget = async (projectCode: string) => {
    setLineLoadingKeys((prev) => new Set(prev).add(projectCode))
    try {
      const res = await axios.get(`${BASE_URL}/po/cost-budget`, {
        headers: authHeader,
        params: { project_code: projectCode },
      })
      const body = res.data?.data ?? res.data
      const rows: CostBudgetLine[] = Array.isArray(body) ? body : body?.rows ?? []
      const rawTotals = Array.isArray(body) ? undefined : body?.totals
      // Backend confirmed to compute pu_cost/ac_cost totals; pu_bal/ac_bal
      // totals aren't guaranteed present, so derive them the same way each
      // row does (budget - cost) rather than assume the API always sends them.
      const totalBudget = rawTotals?.budget ?? rows.reduce((s, r) => s + (r.budget ?? 0), 0)
      const totalPuCost = rawTotals?.pu_cost ?? rows.reduce((s, r) => s + (r.pu_cost ?? 0), 0)
      const totalAcCost = rawTotals?.ac_cost ?? rows.reduce((s, r) => s + (r.ac_cost ?? 0), 0)
      setCostBudgetByProject((prev) => ({
        ...prev,
        [projectCode]: {
          lines: rows,
          totals: {
            budget: totalBudget,
            pu_cost: totalPuCost,
            pu_bal: rawTotals?.pu_bal ?? totalBudget - totalPuCost,
            ac_cost: totalAcCost,
            ac_bal: rawTotals?.ac_bal ?? totalBudget - totalAcCost,
          },
        },
      }))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลงบประมาณต้นทุนไม่สำเร็จ')
      setCostBudgetByProject((prev) => ({ ...prev, [projectCode]: { lines: [], totals: null } }))
    } finally {
      setLineLoadingKeys((prev) => {
        const next = new Set(prev)
        next.delete(projectCode)
        return next
      })
    }
  }

  const balCellStyle = (v: number): React.CSSProperties => ({
    color: v < 0 ? '#dc2626' : undefined,
    fontWeight: v < 0 ? 600 : undefined,
  })

  const projectColumns: ColumnsType<ProjectRow> = [
    {
      title: 'Project',
      key: 'project',
      render: (_: unknown, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#2563eb' }}>{r.projectCode}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{r.projectName}</div>
        </div>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_: unknown, r) =>
        r.consultantName || r.consultantPhone ? (
          <div style={{ fontSize: 12 }}>
            <div>{r.consultantName || '—'}</div>
            <div style={{ color: '#6b7280' }}>{r.consultantPhone || ''}</div>
          </div>
        ) : (
          <span style={{ color: '#9ca3af' }}>—</span>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: ProjectStatus) => <Tag color={statusColor[v]}>{statusLabel[v]}</Tag>,
    },
    {
      title: 'Owner',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (v?: string) => v || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'Budget',
      dataIndex: 'budgetAmount',
      key: 'budgetAmount',
      align: 'right',
      render: (v: number) => thb(v),
    },
    {
      title: 'Date',
      key: 'duration',
      render: (_: unknown, r) => {
        if (!r.startDate && !r.endDate) return <span style={{ color: '#9ca3af' }}>—</span>
        const start = r.startDate ? dayjs(r.startDate).format('DD/MM/YY') : '—'
        const end = r.endDate ? dayjs(r.endDate).format('DD/MM/YY') : '—'
        return `${start} - ${end}`
      },
    },
  ]

  const lineColumns: ColumnsType<CostBudgetLine> = [
    { title: 'No.', key: 'no', width: 60, align: 'center', render: (_: unknown, __: unknown, idx: number) => idx + 1 },
    { title: 'CostCode', dataIndex: 'cost_code', key: 'cost_code', width: 140 },
    { title: 'Description', dataIndex: 'cost_subgroup_name', key: 'cost_subgroup_name', ellipsis: true },
    { title: 'Budget', dataIndex: 'budget', key: 'budget', align: 'right', render: (v: number) => thb(v) },
    { title: 'PuCost', dataIndex: 'pu_cost', key: 'pu_cost', align: 'right', render: (v: number) => thb(v) },
    {
      title: 'PuBal',
      dataIndex: 'pu_bal',
      key: 'pu_bal',
      align: 'right',
      render: (v: number) => <span style={balCellStyle(v)}>{thb(v)}</span>,
    },
    { title: 'Ac.Cost', dataIndex: 'ac_cost', key: 'ac_cost', align: 'right', render: (v: number) => thb(v) },
    {
      title: 'Ac.Bal',
      dataIndex: 'ac_bal',
      key: 'ac_bal',
      align: 'right',
      render: (v: number) => <span style={balCellStyle(v)}>{thb(v)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="งบประมาณต้นทุน"
        subtitle="Cost Budget"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบสั่งซื้อ' }, { title: 'งบประมาณต้นทุน' }]}
      />

      <Card style={cardStyle} title="เลือกโครงการ">
        <Input
          placeholder="ค้นหารหัส/ชื่อโครงการ"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 280, marginBottom: 16 }}
        />
        <Table
          rowKey="id"
          loading={projectsLoading}
          columns={projectColumns}
          dataSource={projects}
          size="middle"
          pagination={{ pageSize: 10, showTotal: (t) => `ทั้งหมด ${t} โครงการ` }}
          locale={{ emptyText: 'ไม่พบข้อมูลโครงการ' }}
          scroll={{ x: 'max-content' }}
          expandable={{
            expandedRowKeys: expandedProjectKeys,
            onExpandedRowsChange: (keys) => setExpandedProjectKeys(keys as React.Key[]),
            onExpand: (expanded, record) => {
              if (expanded && !costBudgetByProject[record.projectCode]) {
                fetchCostBudget(record.projectCode)
              }
            },
            expandedRowRender: (record) => {
              const entry = costBudgetByProject[record.projectCode]
              const isLoading = lineLoadingKeys.has(record.projectCode)
              return (
                <Table
                  rowKey={(r, idx) => `${r.cost_code}-${idx}`}
                  loading={isLoading}
                  columns={lineColumns}
                  dataSource={entry?.lines ?? []}
                  size="small"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: 'ไม่พบข้อมูลงบประมาณต้นทุนสำหรับโครงการนี้' }}
                  summary={() =>
                    entry?.totals ? (
                      <Table.Summary.Row style={{ fontWeight: 700, background: '#eff6ff' }}>
                        <Table.Summary.Cell index={0} colSpan={3}>
                          รวม
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          {thb(entry.totals.budget)}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                          {thb(entry.totals.pu_cost)}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="right">
                          <span style={balCellStyle(entry.totals.pu_bal)}>{thb(entry.totals.pu_bal)}</span>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} align="right">
                          {thb(entry.totals.ac_cost)}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={5} align="right">
                          <span style={balCellStyle(entry.totals.ac_bal)}>{thb(entry.totals.ac_bal)}</span>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    ) : null
                  }
                />
              )
            },
          }}
        />
      </Card>
    </div>
  )
}

export default POCostBudgetPage
