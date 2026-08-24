import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, message, Input, Row, Col, Select, DatePicker, Tag, Tooltip } from 'antd'
import { PlusOutlined, EyeOutlined, EditOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import StatusBadge from '@/components/common/StatusBadge'
import { useAppSelector } from '@/store'
import { pettyCashService } from '@/services/pettyCashService'
import type { PettyCashRequisition } from '@/types/pettyCash'
import axios from 'axios'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'
const CREATE_MENU_CODE = 'MENU_PETTY_CASH_CREATE'

const { RangePicker } = DatePicker

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'DRAFT', label: 'ร่าง' },
  { value: 'PENDING_APPROVAL', label: 'รออนุมัติ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ปฏิเสธ' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
]

const PettyCashListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const user = useAppSelector((s) => s.auth.user)

  const [items, setItems] = useState<PettyCashRequisition[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)

  const [pcNoInput, setPcNoInput] = useState('')
  const [projectFilter, setProjectFilter] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/master/projects`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setProjects(list.map((p: any) => ({
          value: p.project_code,
          label: p.project_code ? `${p.project_code} — ${p.project_name ?? ''}` : (p.project_name ?? String(p.id)),
        })))
      } catch {
        setProjects([])
      }
    }
    fetchProjects()
  }, [accessToken])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await pettyCashService.list(accessToken, {
        status: statusFilter || undefined,
        project_code: projectFilter || undefined,
        date_from: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
        date_to: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
        page,
        page_size: pageSize,
      })
      setItems(res.data)
      setTotal(res.total)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page, pageSize, statusFilter, projectFilter, dateRange])

  // Backend GET /petty-cash has no pc_no search param — filter the current
  // page client-side (matches the search UX of other list pages in this app).
  const filtered = items.filter((r) => {
    if (!pcNoInput.trim()) return true
    return r.pc_no.toLowerCase().includes(pcNoInput.trim().toLowerCase())
  })

  const handleReset = () => {
    setPcNoInput('')
    setProjectFilter(undefined)
    setStatusFilter('')
    setDateRange(null)
    setPage(1)
  }

  const columns: ColumnsType<PettyCashRequisition> = [
    {
      title: 'เลขที่',
      dataIndex: 'pc_no',
      key: 'pc_no',
      render: (v: string, r) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/petty-cash/${r.id}`)}>{v}</a>
      ),
    },
    { title: 'วันที่', dataIndex: 'pc_date', key: 'pc_date', render: (v: string) => v?.slice(0, 10) ?? '-' },
    {
      title: 'โครงการ',
      key: 'project',
      width: 220,
      render: (_: unknown, r) => {
        const codes = r.project_codes ?? []
        if (codes.length === 0) return '-'
        const shown = codes.slice(0, 2)
        const rest = codes.length - shown.length
        return (
          <Space size={4} wrap>
            {shown.map((c) => <Tag key={c} style={{ margin: 0 }}>{c}</Tag>)}
            {rest > 0 && (
              <Tooltip title={codes.slice(2).join(', ')}>
                <Tag style={{ margin: 0 }}>+{rest}</Tag>
              </Tooltip>
            )}
          </Space>
        )
      },
    },
    { title: 'ผู้ขอเบิก', dataIndex: 'requested_by_name', key: 'requested_by_name', render: (v?: string) => v || '-' },
    {
      title: 'มูลค่าสุทธิ',
      dataIndex: 'net_amount',
      key: 'net_amount',
      align: 'right',
      render: (v: number, r) => `${v.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ${r.currency}`,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r) => {
        const isOwner = user && String(r.requested_by) === String(user.id)
        const canEdit = isOwner && (r.status === 'DRAFT' || r.status === 'REJECTED')
        return (
          <Space size={4}>
            <Button type="link" icon={<EyeOutlined />} size="small" onClick={() => navigate(`/petty-cash/${r.id}`)}>
              ดู
            </Button>
            {canEdit && (
              <PermissionButton
                menuCode={CREATE_MENU_CODE}
                action="edit"
                type="link"
                icon={<EditOutlined />}
                size="small"
                onClick={() => navigate(`/petty-cash/${r.id}/edit`)}
              >
                แก้ไข
              </PermissionButton>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="เบิกเงินสดย่อย"
        subtitle="รายการใบเบิกเงินสดย่อยทั้งหมด"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'เบิกเงินสดย่อย' }]}
        extra={
          <PermissionButton
            menuCode={CREATE_MENU_CODE}
            action="write"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/petty-cash/create')}
          >
            สร้างใบเบิกเงินสดย่อย
          </PermissionButton>
        }
      />

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={5}>
            <Input
              placeholder="ค้นหาเลขที่"
              value={pcNoInput}
              onChange={(e) => setPcNoInput(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="โครงการ"
              allowClear
              showSearch
              options={projects}
              value={projectFilter}
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              onChange={(v) => { setProjectFilter(v); setPage(1) }}
            />
          </Col>
          <Col xs={24} md={4}>
            <Select
              style={{ width: '100%' }}
              options={statusOptions}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1) }}
            />
          </Col>
          <Col xs={24} md={6}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={(v) => { setDateRange(v as [Dayjs, Dayjs] | null); setPage(1) }}
            />
          </Col>
          <Col xs={24} md={4}>
            <Space>
              <Button icon={<SearchOutlined />} type="primary" onClick={fetchData} loading={loading}>ค้นหา</Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>ล้าง</Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          size="small"
          locale={{ emptyText: 'ไม่พบข้อมูล' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (p, s) => { setPage(p); setPageSize(s) },
          }}
        />
      </Card>
    </div>
  )
}

export default PettyCashListPage
