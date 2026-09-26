import React, { useEffect, useState } from 'react'
import { Card, Table, Tag, message, Tooltip } from 'antd'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { JOB_TYPES } from '@/constants/jobTypes'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const PROJECT_COLUMN_DEFAULT_WIDTH = 240
const JOB_COLUMN_DEFAULT_WIDTH = 120
const REMARKS_COLUMN_DEFAULT_WIDTH = 220

// Same react-resizable pattern as POStatusPage.tsx / PRStatusPage.tsx — only
// columns that pass width/onResize via onHeaderCell get a drag handle; every
// other column's th renders through untouched.
interface ResizableTitleProps extends React.HTMLAttributes<HTMLElement> {
  onResize?: (e: React.SyntheticEvent, data: ResizeCallbackData) => void
  width?: number
}

const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResize, width, ...restProps } = props
  if (!width || !onResize) {
    return <th {...restProps} />
  }
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[60, 0]}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: -5,
            bottom: 0,
            top: 0,
            width: 10,
            cursor: 'col-resize',
            zIndex: 1,
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative' }} />
    </Resizable>
  )
}

// Matches the real DB CHECK constraint on purchase_request.status — kept in sync with
// the inline statusConfig in PRStatusPage.tsx (PR approval was removed; there is no
// PENDING_APPROVAL / APPROVED / REJECTED status anymore).
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
  locationCode: string
  projectCode: string | null
  projectName: string | null
  remarks: string | null
  prDate: string
  jobCode: string | null
  memoId: number | string | null
  memoNo: string | null
}

const PRHistoryPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [items, setItems] = useState<PRItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([])

  // Resizable widths for "โครงการ" / "Job" / "หมายเหตุ" — same pattern as
  // POStatusPage.tsx / PRStatusPage.tsx, not persisted (resets on refresh).
  const [projectColWidth, setProjectColWidth] = useState(PROJECT_COLUMN_DEFAULT_WIDTH)
  const [jobColWidth, setJobColWidth] = useState(JOB_COLUMN_DEFAULT_WIDTH)
  const [remarksColWidth, setRemarksColWidth] = useState(REMARKS_COLUMN_DEFAULT_WIDTH)
  const handleProjectColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setProjectColWidth(data.size.width)
  }
  const handleJobColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setJobColWidth(data.size.width)
  }
  const handleRemarksColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setRemarksColWidth(data.size.width)
  }

  // Same master/projects lookup used elsewhere (e.g. PRDetailPage.tsx, Memo pages)
  // to resolve a project_code into "code — full name" — GET /pr only returns the raw code.
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/master/projects`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const raw = Array.isArray(res.data)
          ? res.data
          : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setProjects(list.map((p: any) => ({
          value: p.project_code,
          label: p.project_code
            ? `${p.project_code} — ${p.project_name ?? p.name ?? ''}`
            : (p.project_name ?? p.name ?? String(p.id)),
        })))
      } catch {
        // Non-critical — falls back to the raw project_code if this fails.
      }
    }
    fetchProjects()
  }, [])

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
        locationCode: r.location_text  ?? '—',
        projectCode:  r.project_code   ?? null,
        projectName:  r.project_name   ?? null,
        remarks:      r.remarks        ?? null,
        prDate:       r.pr_date        ?? '',
        jobCode:      r.job_code       ?? null,
        memoId:       r.memo_id        ?? null,
        memoNo:       r.memo_no        ?? null,
      })))
      setTotal(Array.isArray(d) ? raw.length : (d?.total ?? raw.length))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(page, limit) }, [page, limit])

  const columns = [
    {
      title: 'เลขที่ PR',
      dataIndex: 'prNo',
      key: 'prNo',
      render: (v: string, record: PRItem) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/pr/${record.id}`)}>
          {v}
        </a>
      ),
    },
    {
      title: 'Ref. MEMO',
      key: 'memo',
      render: (_: unknown, record: PRItem) =>
        record.memoNo ? (
          <a
            style={{ color: '#2563eb', fontWeight: 600 }}
            onClick={() => navigate(`/memo/${record.memoId}`)}
          >
            {record.memoNo}
          </a>
        ) : (
          <span style={{ color: '#9ca3af' }}>—</span>
        ),
    },
    {
      title: 'โครงการ',
      dataIndex: 'projectCode',
      key: 'projectCode',
      width: projectColWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        width: projectColWidth,
        onResize: handleProjectColResize,
      }),
      render: (v: string | null, record: PRItem) => {
        if (!v) return <span style={{ color: '#9ca3af' }}>—</span>
        const label = projects.find((p) => p.value === v)?.label ?? (record.projectName || v)
        return (
          <Tooltip title={label}>
            <span>{label}</span>
          </Tooltip>
        )
      },
    },
    {
      title: 'Job',
      dataIndex: 'jobCode',
      key: 'jobCode',
      width: jobColWidth,
      onHeaderCell: () => ({
        width: jobColWidth,
        onResize: handleJobColResize,
      }),
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
      title: 'หมายเหตุ',
      dataIndex: 'remarks',
      key: 'remarks',
      width: remarksColWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        width: remarksColWidth,
        onResize: handleRemarksColResize,
      }),
      render: (v: string | null) => v || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'วันที่สร้าง',
      dataIndex: 'prDate',
      key: 'prDate',
      align: 'center' as const,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
  ]

  return (
    <div>
      <PageHeader
        title="ประวัติใบขอซื้อ"
        subtitle="ประวัติใบขอซื้อทั้งหมด"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบขอซื้อ' }, { title: 'ประวัติ' }]}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          components={{ header: { cell: ResizableTitle } }}
          size="small"
          scroll={{ x: 1300 }}
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

export default PRHistoryPage
