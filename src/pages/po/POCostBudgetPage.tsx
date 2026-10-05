import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Tag, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import CostBudgetModal from './CostBudgetModal'
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

const POCostBudgetPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [search, setSearch] = useState('')

  const [selected, setSelected] = useState<ProjectRow | null>(null)

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

  const projectColumns: ColumnsType<ProjectRow> = [
    {
      title: 'Project',
      key: 'project',
      render: (_: unknown, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>{r.projectCode}</div>
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
          onRow={(r) => ({ onClick: () => setSelected(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      <CostBudgetModal projectCode={selected?.projectCode ?? null} onClose={() => setSelected(null)} />
    </div>
  )
}

export default POCostBudgetPage
