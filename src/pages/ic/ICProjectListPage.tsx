import React, { useEffect, useState } from 'react'
import { Card, Table, Space, Select, Empty, Modal, message } from 'antd'
import { InboxOutlined, SwapOutlined, ContainerOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import OptionCard from '@/components/common/OptionCard'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const PREPARER_ROLE_CODES = [
  'ADMIN_CENTER',
  'ROLE_A_PROJECT',
  'ROLE_A_PURCHASE',
  'ROLE_H1_PURCHASE',
  'ROLE_H2_PURCHASE',
  'ROLE_M_PURCHASE',
  'ROLE_S_PURCHASE',
  'ROLE_SV_PURCHASE',
]

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
  const [searchParams, setSearchParams] = useSearchParams()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [data, setData] = useState<ICProject[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<ICProject | null>(null)

  const [projectOptions, setProjectOptions] = useState<{ value: string; label: string }[]>([])
  const [projectCode, setProjectCode] = useState<string | undefined>(undefined)
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([])
  const [preparedBy, setPreparedBy] = useState<string | undefined>(undefined)

  // Options for the "ชื่อโครงการ" Select: all projects.
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects`, {
          headers: authHeader,
          params: { page: 1, page_size: 1000 },
        })
        const payload = res.data?.data ?? res.data
        const rows = Array.isArray(payload) ? payload : payload?.data ?? []
        setProjectOptions(
          (Array.isArray(rows) ? rows : []).map((p: ICProject) => ({
            value: p.project_code,
            label: `${p.project_code} - ${p.project_name}`,
          }))
        )
      } catch {
        message.error('โหลดรายชื่อโครงการไม่สำเร็จ')
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Options for the "ผู้จัดทำ" Select: users holding any of PREPARER_ROLE_CODES.
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, { headers: authHeader })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setUserOptions(
          list
            .filter((u: any) => (u.roles ?? []).some((r: any) => PREPARER_ROLE_CODES.includes(r.role_code)))
            .map((u: any) => ({ value: String(u.id), label: u.full_name ?? u.fullName ?? u.username }))
        )
      } catch {
        message.error('โหลดรายชื่อผู้จัดทำไม่สำเร็จ')
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async () => {
    if (!projectCode) {
      setData([])
      setTotal(0)
      return
    }
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/ic/projects`, {
        headers: authHeader,
        params: { search: projectCode, page: 1, page_size: 50 },
      })
      const payload = res.data?.data ?? res.data
      const rows = Array.isArray(payload) ? payload : payload?.data ?? []
      const exact = (Array.isArray(rows) ? rows : []).filter((r: ICProject) => r.project_code === projectCode)
      setData(exact)
      setTotal(exact.length)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode])

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
  ]

  // Return target (see utils/icNavigation.ts): ?project=<code>[&open=1][&prepared_by=<id>].
  // Pre-selects the project once the options are loaded, then reopens the tile modal after the
  // table has loaded that project. `open` is stripped from the URL so a refresh doesn't reopen it.
  const [pendingOpen, setPendingOpen] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('project')
    if (!code || projectOptions.length === 0) return
    if (!projectOptions.some((o) => o.value === code)) return // unknown code: ignore silently
    setProjectCode(code)
    const pb = searchParams.get('prepared_by')
    if (pb) setPreparedBy(pb)
    if (searchParams.get('open') === '1') {
      setPendingOpen(code)
      const next = new URLSearchParams(searchParams)
      next.delete('open')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, projectOptions])

  useEffect(() => {
    if (!pendingOpen || loading) return
    const row = data.find((r) => r.project_code === pendingOpen)
    if (row) {
      setSelected(row)
      setPendingOpen(null)
    }
  }, [pendingOpen, data, loading])

  const goTo = (path: string) => {
    setSelected(null)
    navigate(preparedBy ? `${path}?prepared_by=${encodeURIComponent(preparedBy)}` : path)
  }

  return (
    <div>
      <PageHeader
        title="ข้อมูลโครงการสำหรับ IC"
        subtitle="เลือกโครงการเพื่อดำเนินการ PO Receive / PO Return"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Inventory Control' }, { title: 'ข้อมูลโครงการ' }]}
      />
      <Card style={cardStyle}>
        <Space direction="vertical" size={12} style={{ width: '100%', marginBottom: 16 }}>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>
              <span style={{ color: '#dc2626' }}>* </span>ชื่อโครงการ
            </div>
            <Select
              showSearch
              allowClear
              placeholder="เลือกโครงการ"
              options={projectOptions}
              value={projectCode}
              onChange={setProjectCode}
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              style={{ width: '100%', maxWidth: 560 }}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>
              <span style={{ color: '#dc2626' }}>* </span>ผู้จัดทำ
            </div>
            <Select
              showSearch
              allowClear
              placeholder="เลือกผู้จัดทำ"
              options={userOptions}
              value={preparedBy}
              onChange={setPreparedBy}
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              style={{ width: '100%', maxWidth: 560 }}
            />
          </div>
        </Space>
        {!projectCode ? (
          <Empty description="กรุณาเลือกโครงการ" />
        ) : (
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          onRow={(record) => ({
            onClick: () => {
              if (!preparedBy) {
                message.warning('กรุณาเลือกผู้จัดทำก่อน')
                return
              }
              setSelected(record)
            },
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
        )}
      </Card>
      <Modal
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={null}
        centered
        width={760}
        title={selected ? `${selected.project_code} — ${selected.project_name}` : ''}
      >
        {selected && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 8 }}>
            <OptionCard
              icon={<InboxOutlined style={{ fontSize: 40 }} />}
              label="PO Receive / PO Return"
              base="#2563eb"
              hover="#1d4ed8"
              onClick={() => goTo(`/ic/projects/${selected.id}/po-receive`)}
            />
            <OptionCard
              icon={<SwapOutlined style={{ fontSize: 40 }} />}
              label="Issue / Transfer"
              base="#0ea5e9"
              hover="#0284c7"
              onClick={() => goTo(`/ic/projects/${selected.project_code}/movements`)}
            />
            <OptionCard
              icon={<ContainerOutlined style={{ fontSize: 40 }} />}
              label="คงเหลือวัสดุ"
              base="#1d4ed8"
              hover="#1e40af"
              onClick={() => goTo(`/ic/projects/${selected.project_code}/stock`)}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ICProjectListPage
