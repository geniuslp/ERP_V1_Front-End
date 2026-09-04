import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Select, Space, Button, DatePicker, Row, Col, Tag, message } from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { JOB_TYPES } from '@/constants/jobTypes'

// Edit uses the create page's own menu code (same convention as
// POStatusPage.tsx gating its edit button with MENU_PO_CREATE).
const MENU_CODE = 'MENU_PR_CREATE'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const statusConfig: Record<string, { color: string; label: string }> = {
  DRAFT:            { color: 'default', label: 'ร่าง' },
  COMPLETED:        { color: 'green',   label: 'เสร็จสมบูรณ์' },
  STOCK_CHECK:      { color: 'blue',    label: 'ตรวจสต็อก' },
  PARTIALLY_FILLED: { color: 'gold',    label: 'สั่งซื้อบางส่วน' },
  FULFILLED:        { color: 'green',   label: 'เสร็จสิ้น' },
  CANCELLED:        { color: 'default', label: 'ยกเลิก' },
}

interface PRItem {
  id: number
  prNo: string
  status: string
  requestedBy: string
  approverName: string | null
  locationCode: string
  projectCode: string | null
  remarks: string | null
  prDate: string
  jobCode: string | null
}

const PRStatusPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [items, setItems]   = useState<PRItem[]>([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [limit, setLimit]   = useState(20)
  const [loading, setLoading] = useState(false)

  // filter state — kept for UI, not yet sent to API
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState<string | undefined>()
  // Filters the already-fetched page's rows client-side — GET /pr has no
  // confirmed job_code query param, unlike a server-side filter.
  const [jobCode, setJobCode] = useState<string | undefined>()

  const fetchData = async (p = page, l = limit) => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/pr`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { page: p, limit: l },
      })
      const d = res.data?.data ?? res.data
      const raw = Array.isArray(d) ? d : d?.items ?? []
      setItems(raw.map((r: any) => ({
        id:           r.id,
        prNo:         r.pr_no          ?? '',
        status:       r.status         ?? 'DRAFT',
        requestedBy:  r.requested_by   ?? '—',
        approverName: r.approver_name  ?? null,
        locationCode: r.location_code  ?? '—',
        projectCode:  r.project_code   ?? null,
        remarks:      r.remarks        ?? null,
        prDate:       r.pr_date        ?? '',
        jobCode:      r.job_code       ?? null,
      })))
      setTotal(Array.isArray(d) ? raw.length : (d?.total ?? raw.length))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(page, limit) }, [page, limit])

  const filteredItems = jobCode ? items.filter((i) => i.jobCode === jobCode) : items

  const columns = [
    {
      title: 'เลขที่ PR',
      dataIndex: 'prNo',
      key: 'prNo',
      render: (v: string, record: PRItem) => (
        <a
          style={{ color: '#2563eb', fontWeight: 600 }}
          onClick={() => navigate(`/pr/${record.id}`)}
        >
          {v}
        </a>
      ),
    },
    {
      title: 'รายการ',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      render: (v: string | null) => v || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'ผู้ขอ',
      dataIndex: 'requestedBy',
      key: 'requestedBy',
    },
    {
      title: 'แผนก',
      dataIndex: 'locationCode',
      key: 'locationCode',
    },
    {
      title: 'ประเภท Job',
      dataIndex: 'jobCode',
      key: 'jobCode',
      render: (v: string | null) => (v ? (JOB_TYPES.find((jt) => jt.code === v)?.label ?? v) : '—'),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => {
        const cfg = statusConfig[v] ?? { color: 'default', label: v }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: 'มูลค่า (บาท)',
      key: 'amount',
      align: 'right' as const,
      render: () => <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'วันที่',
      dataIndex: 'prDate',
      key: 'prDate',
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'จัดการ',
      key: 'action',
      width: 160,
      render: (_: any, record: PRItem) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/pr/${record.id}`)}
          />
          {record.status === 'DRAFT' && (
            <PermissionButton
              menuCode={MENU_CODE}
              action="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/pr/${record.id}/edit`)}
            >
              แก้ไข
            </PermissionButton>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ตรวจสอบสถานะ PR"
        subtitle="ติดตามสถานะใบขอซื้อทั้งหมด"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบขอซื้อ' }, { title: 'ตรวจสอบสถานะ' }]}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(page, limit)} loading={loading}>
            รีเฟรช
          </Button>
        }
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="ค้นหาเลขที่หรือรายการ (ยังไม่รองรับ)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              placeholder="กรองตามสถานะ (ยังไม่รองรับ)"
              allowClear
              style={{ width: '100%' }}
              value={status}
              onChange={setStatus}
              disabled
              options={[
                { value: 'DRAFT',            label: 'ร่าง' },
                { value: 'COMPLETED',        label: 'เสร็จสมบูรณ์' },
                { value: 'STOCK_CHECK',      label: 'ตรวจสต็อก' },
                { value: 'PARTIALLY_FILLED', label: 'สั่งซื้อบางส่วน' },
                { value: 'FULFILLED',        label: 'เสร็จสิ้น' },
                { value: 'CANCELLED',        label: 'ยกเลิก' },
              ]}
            />
          </Col>
          <Col xs={24} md={6}>
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              placeholder={['วันเริ่ม (ยังไม่รองรับ)', 'วันสิ้นสุด']}
              disabled
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              placeholder="กรองตามประเภท Job"
              allowClear
              style={{ width: '100%' }}
              value={jobCode}
              onChange={setJobCode}
              options={JOB_TYPES.map((jt) => ({ value: jt.code, label: jt.label }))}
            />
          </Col>
          <Col>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => { setSearch(''); setStatus(undefined); setJobCode(undefined) }}
            >
              รีเซ็ต
            </Button>
          </Col>
        </Row>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={filteredItems}
          columns={columns}
          size="small"
          scroll={{ x: 1080 }}
          locale={{ emptyText: 'ไม่พบข้อมูล' }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (p, l) => { setPage(p); setLimit(l) },
          }}
        />
      </Card>
    </div>
  )
}

export default PRStatusPage
