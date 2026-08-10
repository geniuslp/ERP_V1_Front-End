import React, { useEffect, useState } from 'react'
import { Card, Table, Space, message, Input, Row, Col, Tag, Typography, Button, DatePicker, Select, Spin } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { Dayjs } from 'dayjs'
import axios from 'axios'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import type { POLineItemGroup, POLineItemLine, MaterialSearchResult } from '@/types/po'
import { poApprovalService } from '@/services/poApprovalService'
import { POApprovalStatusTag } from '@/components/po/POStatusBadge'

const { RangePicker } = DatePicker
const { Text } = Typography
const BASE_URL = (import.meta as any).env?.VITE_API_URL

interface RequesterOption {
  value: number
  label: string
}

interface CodeOption {
  value: string
  label: string
}

const POLineItemsPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [items, setItems] = useState<POLineItemGroup[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)

  const [requesters, setRequesters] = useState<RequesterOption[]>([])
  const [requestersLoading, setRequestersLoading] = useState(false)

  const [jobOptions, setJobOptions] = useState<CodeOption[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)

  const [projectOptions, setProjectOptions] = useState<CodeOption[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)

  const [matOptions, setMatOptions] = useState<MaterialSearchResult[]>([])
  const [matFetching, setMatFetching] = useState(false)
  const matDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Uncommitted filter inputs vs. applied filters — same pattern as
  // POStatusPage: typing doesn't refetch, only "ค้นหา"/"ล้าง" commits.
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [poNoInput, setPoNoInput] = useState('')
  const [matCodeInput, setMatCodeInput] = useState<string | undefined>(undefined)
  const [jobCodeInput, setJobCodeInput] = useState<string | undefined>(undefined)
  const [projectCodeInput, setProjectCodeInput] = useState<string | undefined>(undefined)
  const [requestedByInput, setRequestedByInput] = useState<number | undefined>(undefined)
  const [filters, setFilters] = useState<{
    date_from?: string
    date_to?: string
    po_no?: string
    mat_code?: string
    requested_by?: number
    job_code?: string
    project_code?: string
  }>({})

  useEffect(() => {
    const fetchRequesters = async () => {
      setRequestersLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { role: 'requester' },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setRequesters(
          list.map((u: any) => ({
            value: Number(u.id),
            label: u.full_name ?? u.fullName ?? u.username,
          })),
        )
      } catch {
        message.error('โหลดรายชื่อผู้ขอซื้อไม่สำเร็จ')
      } finally {
        setRequestersLoading(false)
      }
    }
    fetchRequesters()
  }, [accessToken])

  useEffect(() => {
    // /master/cost-code/full is already flat with job_code/job_name on every
    // row (same source CostCodeSelectionModal uses) — dedupe client-side
    // rather than relying on a dedicated /jobs endpoint.
    const fetchJobs = async () => {
      setJobsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/cost-code/full`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        const seen = new Map<string, string>()
        list.forEach((c: any) => {
          if (c.job_code && !seen.has(c.job_code)) seen.set(c.job_code, c.job_name)
        })
        setJobOptions(
          Array.from(seen.entries())
            .map(([code, name]) => ({ value: code, label: name ? `${code} — ${name}` : code }))
            .sort((a, b) => a.value.localeCompare(b.value)),
        )
      } catch {
        message.error('โหลดรายการงานไม่สำเร็จ')
      } finally {
        setJobsLoading(false)
      }
    }
    fetchJobs()
  }, [accessToken])

  useEffect(() => {
    const fetchProjects = async () => {
      setProjectsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/projects`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
        setProjectOptions(
          (Array.isArray(list) ? list : [])
            .filter((p: any) => p.project_code)
            .map((p: any) => ({
              value: p.project_code,
              label: p.project_name ?? p.name ? `${p.project_code} — ${p.project_name ?? p.name}` : p.project_code,
            })),
        )
      } catch {
        message.error('โหลดรายการโครงการไม่สำเร็จ')
      } finally {
        setProjectsLoading(false)
      }
    }
    fetchProjects()
  }, [accessToken])

  const fetchMaterials = (term: string) => {
    const q = term.trim()
    if (!q) {
      setMatOptions([])
      return
    }
    axios
      .get(`${BASE_URL}/materials/search`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { q, limit: 20 },
      })
      .then((res) => {
        const list: MaterialSearchResult[] = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setMatOptions(list)
      })
      .catch(() => setMatOptions([]))
      .finally(() => setMatFetching(false))
  }

  const handleMatSearch = (value: string) => {
    if (matDebounceRef.current) clearTimeout(matDebounceRef.current)
    if (!value.trim()) {
      setMatOptions([])
      return
    }
    setMatFetching(true)
    matDebounceRef.current = setTimeout(() => fetchMaterials(value), 300)
  }

  const fetchData = async (p = page, l = limit, f = filters) => {
    setLoading(true)
    try {
      const res = await poApprovalService.getLineItems(accessToken, {
        page: p,
        page_size: l,
        date_from: f.date_from,
        date_to: f.date_to,
        po_no: f.po_no,
        mat_code: f.mat_code,
        requested_by: f.requested_by,
        job_code: f.job_code,
        project_code: f.project_code,
      })
      const data = res.data.data
      setItems(Array.isArray(data.data) ? data.data : [])
      setTotal(data.total ?? 0)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(page, limit, filters) }, [page, limit, filters])

  const handleSearch = () => {
    setPage(1)
    setFilters({
      date_from: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
      date_to: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      po_no: poNoInput.trim() || undefined,
      mat_code: matCodeInput,
      requested_by: requestedByInput,
      job_code: jobCodeInput,
      project_code: projectCodeInput,
    })
  }

  const handleClear = () => {
    setDateRange(null)
    setPoNoInput('')
    setMatCodeInput(undefined)
    setMatOptions([])
    setJobCodeInput(undefined)
    setProjectCodeInput(undefined)
    setRequestedByInput(undefined)
    setPage(1)
    setFilters({})
  }

  const columns: ColumnsType<POLineItemGroup> = [
    {
      title: 'เลขที่ PO',
      dataIndex: 'po_no',
      key: 'po_no',
      render: (v: string, record) =>
        record.po_id ? (
          <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/po/approval/${record.po_id}`)}>
            {v}
          </a>
        ) : (
          v
        ),
    },
    {
      title: 'วันที่สั่ง',
      dataIndex: 'po_date',
      key: 'po_date',
      render: (v: string) => v?.slice(0, 10) ?? '-',
    },
    {
      title: 'ผู้ขาย',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      render: (v?: string) => v || '-',
    },
    { title: 'ผู้ขอซื้อ', dataIndex: 'requested_by', key: 'requested_by' },
    {
      title: 'โครงการ',
      key: 'project',
      render: (_: unknown, r) =>
        r.project_code ? (
          <Tag color="geekblue" style={{ margin: 0, fontSize: 13 }}>
            {r.project_code}
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (_v: unknown, r) => <POApprovalStatusTag status={r.status} />,
    },
    {
      // PO's real after-discount total — comes straight from the backend
      // group object, not summed from `lines` (which may be filtered down
      // to only matching mat_code/job_code rows).
      title: 'มูลค่ารวม',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => v?.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
  ]

  const lineColumns: ColumnsType<POLineItemLine> = [
    { title: 'รหัสสินค้า', dataIndex: 'mat_code', key: 'mat_code' },
    {
      title: 'ชื่อสินค้า',
      dataIndex: 'mat_name',
      key: 'mat_name',
      render: (v?: string) => v || '-',
    },
    {
      title: 'จำนวนสั่ง',
      dataIndex: 'qty_ordered',
      key: 'qty_ordered',
      align: 'right',
      render: (v: number) => v?.toLocaleString('th-TH'),
    },
    {
      title: 'ราคาต่อหน่วย',
      dataIndex: 'unit_price',
      key: 'unit_price',
      align: 'right',
      render: (v: number) => v?.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'มูลค่า',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => v?.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'งาน',
      key: 'job',
      render: (_: unknown, l) =>
        l.job_name || l.job_code ? (
          <Tag color="geekblue" style={{ margin: 0, fontSize: 13 }}>
            {l.job_name || l.job_code}
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="รายการ PO"
        subtitle="รายการสินค้าที่สั่งซื้อทั้งหมด แยกตามบรรทัด"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบสั่งซื้อ' }, { title: 'รายการ PO' }]}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={6}>
            <RangePicker
              value={dateRange as any}
              onChange={(v) => setDateRange(v as [Dayjs | null, Dayjs | null] | null)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={4}>
            <Input
              placeholder="เลขที่ PO"
              value={poNoInput}
              onChange={(e) => setPoNoInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              placeholder="ค้นหาสินค้าด้วยรหัสหรือชื่อ"
              value={matCodeInput}
              onChange={(v) => setMatCodeInput(v)}
              onSearch={handleMatSearch}
              options={matOptions.map((m) => ({ value: m.mat_code, label: `${m.mat_code} — ${m.mat_name}` }))}
              loading={matFetching}
              showSearch
              filterOption={false}
              allowClear
              notFoundContent={matFetching ? <Spin size="small" /> : null}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={4}>
            <Select
              placeholder="ผู้ขอซื้อ"
              value={requestedByInput}
              onChange={(v) => setRequestedByInput(v)}
              options={requesters}
              loading={requestersLoading}
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              placeholder="งาน"
              value={jobCodeInput}
              onChange={(v) => setJobCodeInput(v)}
              options={jobOptions}
              loading={jobsLoading}
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              placeholder="โครงการ"
              value={projectCodeInput}
              onChange={(v) => setProjectCodeInput(v)}
              options={projectOptions}
              loading={projectsLoading}
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={3}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={loading} />
              <Button icon={<ReloadOutlined />} onClick={handleClear} />
            </Space>
          </Col>
        </Row>

        <Table
          rowKey={(r, idx) => `${r.po_no}-${idx}`}
          loading={loading}
          dataSource={items}
          columns={columns}
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'ไม่พบข้อมูล' }}
          expandable={{
            expandedRowRender: (record) => (
              <Table
                rowKey={(l, idx) => `${record.po_no}-${l.mat_code}-${idx}`}
                dataSource={record.lines}
                columns={lineColumns}
                size="small"
                pagination={false}
                locale={{ emptyText: 'ไม่พบรายการสินค้า' }}
                style={{ background: '#fff' }}
              />
            ),
            rowExpandable: (record) => (record.lines?.length ?? 0) > 0,
          }}
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

export default POLineItemsPage
