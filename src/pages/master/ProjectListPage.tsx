import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tooltip, Input, Select, Tag, Popconfirm, message } from 'antd'
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import type { Project, ProjectStatus } from '@/types/project'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

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

const mapProject = (raw: any): Project => ({
  id:           raw.id,
  projectCode:  raw.project_code,
  projectName:  raw.project_name,
  locationCode: raw.location_code,
  deptCode:     raw.dept_code,
  deptName:     raw.dept_name,
  ownerId:      raw.owner_id,
  ownerName:    raw.owner_name,
  projectOwnerName: raw.project_owner_name,
  responsiblePersonName: raw.responsible_person_name,
  jobCodes:     raw.job_codes ?? [],
  budgetAmount: raw.budget_amount ?? 0,
  consultantName: raw.consultant_name,
  consultantPhone: raw.consultant_phone,
  startDate:    raw.start_date,
  endDate:      raw.end_date,
  status:       raw.status ?? 'ACTIVE',
  isActive:     raw.is_active ?? true,
  createdAt:    raw.created_at,
  updatedAt:    raw.updated_at,
})

const ProjectListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProjectStatus | undefined>()

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/projects`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { search: search || undefined, status, page_size: 100 },
      })
      const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
      setData((Array.isArray(raw) ? raw : []).map(mapProject))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${BASE_URL}/master/projects/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('ลบโครงการสำเร็จ')
      fetchData()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'ลบไม่สำเร็จ')
    }
  }

  const handleReset = () => {
    setSearch('')
    setStatus(undefined)
  }

  useEffect(() => { fetchData() }, [search, status])

  const columns = [
    {
      title: 'รหัสโครงการ',
      dataIndex: 'projectCode',
      key: 'projectCode',
      render: (code: string, record: Project) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/master/projects/${record.id}/edit`)}>
          {code}
        </a>
      ),
    },
    { title: 'ชื่อโครงการ', dataIndex: 'projectName', key: 'projectName', ellipsis: true },
    {
      // Now backed by the required free-text responsible_person_name field
      // (the owner_id/users dropdown it replaces is deprecated server-side).
      title: 'ผู้รับผิดชอบหลัก',
      dataIndex: 'responsiblePersonName',
      key: 'responsiblePersonName',
      render: (val?: string) => val || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'มูลค่าโครงการ',
      dataIndex: 'budgetAmount',
      key: 'budgetAmount',
      align: 'right' as const,
      render: (val: number) => (val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'ระยะเวลา',
      key: 'duration',
      render: (_: any, record: Project) => {
        if (!record.startDate && !record.endDate) return <span style={{ color: '#9ca3af' }}>—</span>
        const start = record.startDate ? dayjs(record.startDate).format('DD/MM/YY') : '—'
        const end   = record.endDate   ? dayjs(record.endDate).format('DD/MM/YY')   : '—'
        return `${start} - ${end}`
      },
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (val: ProjectStatus) => <Tag color={statusColor[val]}>{statusLabel[val]}</Tag>,
    },
    {
      title: 'จัดการ',
      key: 'actions',
      width: 110,
      render: (_: any, record: Project) => (
        <Space>
          <Tooltip title="แก้ไข">
            <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/master/projects/${record.id}/edit`)} />
          </Tooltip>
          <Popconfirm title="ลบโครงการนี้?" okText="ลบ" cancelText="ยกเลิก" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="ลบ">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="โครงการ"
        subtitle="จัดการข้อมูลโครงการทั้งหมด"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'โครงการ' }]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/master/projects/create')}
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
          >
            เพิ่มโครงการ
          </Button>
        }
      />
      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="ค้นหารหัส/ชื่อโครงการ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="สถานะ"
            value={status}
            onChange={setStatus}
            allowClear
            style={{ width: 160 }}
            options={[
              { value: 'ACTIVE',   label: 'ดำเนินการ' },
              { value: 'INACTIVE', label: 'ไม่ใช้งาน' },
              { value: 'CLOSED',   label: 'ปิดโครงการ' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>ค้นหา</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>รีเซต</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 20, showTotal: (t) => `ทั้งหมด ${t} โครงการ` }}
          locale={{ emptyText: 'ไม่พบข้อมูลโครงการ' }}
        />
      </Card>
    </div>
  )
}

export default ProjectListPage
