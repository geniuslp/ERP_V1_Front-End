import React, { useEffect, useState } from 'react'
import { Card, Table, Space, Input, Button, message } from 'antd'
import { SearchOutlined, ReloadOutlined, InboxOutlined, RollbackOutlined, SwapOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

interface ICProject {
  id: number
  project_code: string
  project_name: string
  customer_name?: string | null
}

const ICProjectListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [data, setData] = useState<ICProject[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/ic/projects`, {
        headers: authHeader,
        params: { search: search || undefined, page, page_size: pageSize },
      })
      const payload = res.data?.data ?? res.data
      const rows = Array.isArray(payload) ? payload : payload?.data ?? []
      setData(Array.isArray(rows) ? rows : [])
      setTotal(payload?.total ?? rows?.length ?? 0)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const handleSearch = () => {
    setPage(1)
    fetchData()
  }

  const handleReset = () => {
    setSearch('')
    setPage(1)
  }

  const columns = [
    {
      title: 'ลำดับ',
      key: 'index',
      width: 70,
      render: (_: unknown, __: ICProject, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: 'Project Code',
      dataIndex: 'project_code',
      key: 'project_code',
      render: (code: string) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{code}</span>,
    },
    {
      title: 'Project Name',
      dataIndex: 'project_name',
      key: 'project_name',
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (value: string | null | undefined) => value || '-',
    },
    {
      title: 'Action',
      key: 'action',
      width: 320,
      render: (_: unknown, record: ICProject) => (
        <Space wrap onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            icon={<InboxOutlined />}
            onClick={() => navigate(`/ic/projects/${record.id}/po-receive`)}
          >
            PO Receive
          </Button>
          <Button
            size="small"
            icon={<RollbackOutlined />}
            onClick={() => navigate(`/ic/projects/${record.id}/po-return`)}
          >
            PO Return
          </Button>
          <Button
            size="small"
            icon={<SwapOutlined />}
            onClick={() => navigate(`/ic/projects/${record.project_code}/movements`)}
          >
            ตัดเบิก/โอน
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ข้อมูลโครงการสำหรับ IC"
        subtitle="เลือกโครงการเพื่อดำเนินการ PO Receive / PO Return"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Inventory Control' }, { title: 'ข้อมูลโครงการ' }]}
      />
      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="ค้นหารหัส/ชื่อโครงการ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            ค้นหา
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            รีเซต
          </Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          onRow={(record) => ({
            onClick: () => navigate(`/ic/projects/${record.id}/po-receive`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `ทั้งหมด ${t} โครงการ`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          locale={{ emptyText: 'ไม่พบข้อมูลโครงการ' }}
        />
      </Card>
    </div>
  )
}

export default ICProjectListPage
