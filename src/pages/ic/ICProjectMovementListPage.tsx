import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Tag, Spin, Result, Space, message } from 'antd'
import { PlusOutlined, EyeOutlined, BarChartOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import axios from 'axios'
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

interface MovementRow {
  id: number
  doc_no: string
  doc_type: 'ISSUE' | 'TRANSFER'
  job_code?: string
  job_name?: string
  doc_date?: string
  requested_by_name?: string
  status?: string
}

const docTypeTag = (type: string) =>
  type === 'ISSUE' ? (
    <Tag color="green">ตัดเบิก</Tag>
  ) : type === 'TRANSFER' ? (
    <Tag color="blue">โอนข้ามโครงการ</Tag>
  ) : (
    <Tag>{type}</Tag>
  )

const ICProjectMovementListPage: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>()
  const { search: locationSearch } = useLocation()
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ICProjectInfo | null>(null)

  const [rows, setRows] = useState<MovementRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)

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

  // Step 2: load movement documents for this project.
  useEffect(() => {
    if (!projectCode) return
    let cancelled = false
    const fetchRows = async () => {
      setRowsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/${projectCode}/movements`, { headers: authHeader })
        const raw = res.data?.data ?? res.data
        const list = Array.isArray(raw) ? raw : raw?.data ?? []
        if (!cancelled) setRows(Array.isArray(list) ? list : [])
      } catch (err: any) {
        if (!cancelled) message.error(err?.response?.data?.message || err?.message || 'โหลดรายการเอกสารไม่สำเร็จ')
      } finally {
        if (!cancelled) setRowsLoading(false)
      }
    }
    fetchRows()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode])

  const goToDetail = (id: number) => navigate(`/ic/projects/${projectCode}/movement/${id}`)

  const columns = [
    {
      title: 'No',
      key: 'no',
      width: 60,
      render: (_: unknown, __: MovementRow, index: number) => index + 1,
    },
    {
      title: 'เลขที่เอกสาร',
      dataIndex: 'doc_no',
      key: 'doc_no',
      render: (value: string) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{value}</span>,
    },
    {
      title: 'ประเภทเอกสาร',
      dataIndex: 'doc_type',
      key: 'doc_type',
      render: (value: string) => docTypeTag(value),
    },
    {
      title: 'ประเภท Job',
      key: 'job',
      render: (_: unknown, record: MovementRow) =>
        record.job_code ? `${record.job_code}${record.job_name ? ` - ${record.job_name}` : ''}` : '-',
    },
    {
      title: 'วันที่เอกสาร',
      dataIndex: 'doc_date',
      key: 'doc_date',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: 'ผู้ขอเบิก',
      dataIndex: 'requested_by_name',
      key: 'requested_by_name',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: 'Action',
      key: 'action',
      width: 90,
      render: (_: unknown, record: MovementRow) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            goToDetail(record.id)
          }}
        >
          ดู
        </Button>
      ),
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
        title="เอกสารตัดเบิก/โอน (โครงการ)"
        subtitle={`${project.project_code} — ${project.project_name}`}
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'โครงการ' },
          { title: project.project_name },
          { title: 'ตัดเบิก/โอน' },
        ]}
        extra={
          <Space>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => navigate(`/ic/projects/${projectCode}/cost-transactions`)}
            >
              ดูรายการเคลื่อนไหว
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(`/ic/projects/${projectCode}/movement/create${locationSearch}`)}
            >
              สร้างใบใหม่
            </Button>
          </Space>
        }
      />

      <Card style={cardStyle}>
        <Table
          rowKey="id"
          loading={rowsLoading}
          columns={columns}
          dataSource={rows}
          onRow={(record) => ({
            onClick: () => goToDetail(record.id),
            style: { cursor: 'pointer' },
          })}
          pagination={false}
          locale={{ emptyText: 'ยังไม่มีเอกสาร — กด "สร้างใบใหม่" เพื่อเริ่มสร้างเอกสารตัดเบิก/โอน' }}
        />
      </Card>
    </div>
  )
}

export default ICProjectMovementListPage
