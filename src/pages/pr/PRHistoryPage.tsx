import React, { useEffect, useState } from 'react'
import { Card, Table, Tag, message, Tooltip, Space, Button, Popconfirm, Select } from 'antd'
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { ROW_TINT_CLASS } from '@/constants/rowTint'
import { ORDER_TYPE_LABEL, ORDER_TYPE_OPTIONS } from '@/constants/orderTypes'

// Same convention as PRStatusPage.tsx's edit button — edit is gated by the
// create page's own menu code, not a history-specific one.
const MENU_CODE = 'MENU_PR_CREATE'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

// Row tint by status — mapping unchanged, only the shared palette (src/index.css's
// .row-tint-* classes, see src/constants/rowTint.ts) changed. STOCK_CHECK
// (pending-equivalent) and PARTIALLY_FILLED (partial) get tinted regardless of
// PO-conversion state. COMPLETED/FULFILLED only tint green once every line has
// actually been converted to a PO (poConversionStatus === 'FULLY_CONVERTED') —
// a PR that's COMPLETED/FULFILLED but still has lines needing a PO stays plain,
// same as DRAFT/CANCELLED. Applies the same way regardless of order_type.
const ROW_TINT_CATEGORY: Record<string, string> = {
  PARTIALLY_FILLED: ROW_TINT_CLASS.orange,
  STOCK_CHECK:       ROW_TINT_CLASS.gray,
}
// hasRemaining (GET /pr's has_remaining) is true while any line still has qty left to
// buy; a PR fully reserved from stock has nothing left, so it counts as done (green)
// even though it never converted to a PO. Falls back to po_conversion_status only if
// the API doesn't send the field.
const getRowClassName = (status?: string, poConversionStatus?: string, hasRemaining?: boolean): string => {
  if (status === 'COMPLETED' || status === 'FULFILLED') {
    const done = hasRemaining != null ? !hasRemaining : poConversionStatus === 'FULLY_CONVERTED'
    if (done) return ROW_TINT_CLASS.green
  }
  return ROW_TINT_CATEGORY[status ?? ''] ?? ''
}

const PR_NO_COLUMN_DEFAULT_WIDTH = 110
const MEMO_COLUMN_DEFAULT_WIDTH = 100
const PROJECT_COLUMN_DEFAULT_WIDTH = 320
const JOB_COLUMN_DEFAULT_WIDTH = 80
const REQUESTED_BY_COLUMN_DEFAULT_WIDTH = 140
const REMARKS_COLUMN_DEFAULT_WIDTH = 220
const CREATED_AT_COLUMN_DEFAULT_WIDTH = 120
const ACTION_COLUMN_DEFAULT_WIDTH = 150

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
  // GET /pr's po_conversion_status — same field PRStatusPage.tsx already reads
  // ('FULLY_CONVERTED' | 'PARTIALLY_CONVERTED' | 'NOT_CONVERTED') — used to gate
  // the green tint so COMPLETED/FULFILLED only tints green once every line has
  // actually been converted to PO.
  poConversionStatus: string
  // GET /pr's has_remaining — undefined when the API omits it.
  hasRemaining?: boolean
  // GET /pr's has_active_po_link — same field/meaning as PRStatusPage.tsx's
  // PRItem.hasActivePoLink; mirrors the backend's PUT /pr/:id guard so the
  // edit button never appears when the save would just be rejected.
  hasActivePoLink: boolean
  orderType: string | null
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
  const [orderTypeFilter, setOrderTypeFilter] = useState<string | undefined>(undefined)

  // Resizable widths — all columns, same pattern as POStatusPage.tsx / PRStatusPage.tsx,
  // not persisted (resets on refresh).
  const [prNoColWidth, setPrNoColWidth] = useState(PR_NO_COLUMN_DEFAULT_WIDTH)
  const [memoColWidth, setMemoColWidth] = useState(MEMO_COLUMN_DEFAULT_WIDTH)
  const [projectColWidth, setProjectColWidth] = useState(PROJECT_COLUMN_DEFAULT_WIDTH)
  const [jobColWidth, setJobColWidth] = useState(JOB_COLUMN_DEFAULT_WIDTH)
  const [requestedByColWidth, setRequestedByColWidth] = useState(REQUESTED_BY_COLUMN_DEFAULT_WIDTH)
  const [remarksColWidth, setRemarksColWidth] = useState(REMARKS_COLUMN_DEFAULT_WIDTH)
  const [createdAtColWidth, setCreatedAtColWidth] = useState(CREATED_AT_COLUMN_DEFAULT_WIDTH)
  const handlePrNoColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setPrNoColWidth(data.size.width)
  }
  const handleMemoColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setMemoColWidth(data.size.width)
  }
  const handleProjectColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setProjectColWidth(data.size.width)
  }
  const handleJobColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setJobColWidth(data.size.width)
  }
  const handleRequestedByColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setRequestedByColWidth(data.size.width)
  }
  const handleRemarksColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setRemarksColWidth(data.size.width)
  }
  const handleCreatedAtColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setCreatedAtColWidth(data.size.width)
  }
  const [actionColWidth, setActionColWidth] = useState(ACTION_COLUMN_DEFAULT_WIDTH)
  const handleActionColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setActionColWidth(data.size.width)
  }

  // Same master/projects lookup used elsewhere (e.g. PRDetailPage.tsx, Memo pages)
  // to resolve a project_code into "code full name" — GET /pr only returns the raw code.
  // On-screen display convention (per PR/PO/Memo consistency pass): "{code} {name}",
  // a single space, no dash — the dash format is reserved for print pages only.
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
            ? [p.project_code, p.project_name ?? p.name].filter(Boolean).join(' ')
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
        params: { page: p, limit: l, order_type: orderTypeFilter },
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
        poConversionStatus: r.po_conversion_status ?? 'NOT_CONVERTED',
        hasRemaining: r.has_remaining ?? undefined,
        hasActivePoLink: r.has_active_po_link ?? false,
        orderType:    r.order_type     ?? null,
      })))
      setTotal(Array.isArray(d) ? raw.length : (d?.total ?? raw.length))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(page, limit) }, [page, limit, orderTypeFilter])

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${BASE_URL}/pr/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('ลบใบขอซื้อสำเร็จ')
      // Stay on the current page after refresh, unless the deleted row was the
      // last one on this page — then step back one page (which refetches via
      // the [page, limit] effect above).
      if (items.length === 1 && page > 1) {
        setPage(page - 1)
      } else {
        fetchData(page, limit)
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'ลบใบขอซื้อไม่สำเร็จ')
    }
  }

  const columns = [
    {
      title: 'เลขที่ PR',
      dataIndex: 'prNo',
      key: 'prNo',
      width: prNoColWidth,
      onHeaderCell: () => ({
        width: prNoColWidth,
        onResize: handlePrNoColResize,
      }),
      render: (v: string, record: PRItem) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/pr/${record.id}`)}>
          {v}
        </a>
      ),
    },
    {
      title: 'Ref. MEMO',
      key: 'memo',
      width: memoColWidth,
      onHeaderCell: () => ({
        width: memoColWidth,
        onResize: handleMemoColResize,
      }),
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
      align: 'center' as const,
      // Short code only (e.g. "MP"), not the full "CODE - Name" label — same
      // display pattern as POStatusPage.tsx's Job column.
      render: (v: string | null) => {
        if (!v) return <span style={{ color: '#9ca3af' }}>—</span>
        const code = v.split(' - ')[0].trim()
        return <Tag color="geekblue" style={{ margin: 0, fontSize: 13 }}>{code}</Tag>
      },
    },
    {
      title: 'ประเภทการสั่งซื้อ',
      dataIndex: 'orderType',
      key: 'orderType',
      width: 150,
      render: (v: string | null) =>
        v ? <Tag color="blue" style={{ margin: 0 }}>{ORDER_TYPE_LABEL[v] ?? v}</Tag> : <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'ผู้ขอซื้อ',
      dataIndex: 'requestedBy',
      key: 'requestedBy',
      width: requestedByColWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        width: requestedByColWidth,
        onResize: handleRequestedByColResize,
      }),
      render: (v: string) => v || <span style={{ color: '#9ca3af' }}>—</span>,
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
      width: createdAtColWidth,
      onHeaderCell: () => ({
        width: createdAtColWidth,
        onResize: handleCreatedAtColResize,
      }),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'จัดการ',
      key: 'action',
      width: actionColWidth,
      onHeaderCell: () => ({
        width: actionColWidth,
        onResize: handleActionColResize,
      }),
      render: (_: any, record: PRItem) => (
        <Space>
          <Tooltip title="ดูรายละเอียด">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/pr/${record.id}`)}
            />
          </Tooltip>
          {record.status === 'DRAFT' && !record.hasActivePoLink && (
            <Tooltip title="แก้ไข">
              <PermissionButton
                menuCode={MENU_CODE}
                action="edit"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/pr/${record.id}/edit`)}
              />
            </Tooltip>
          )}
          {record.status === 'DRAFT' && !record.hasActivePoLink && (
            <Popconfirm
              title="ต้องการลบเอกสารนี้ใช่หรือไม่"
              okText="ลบ"
              cancelText="ยกเลิก"
              onConfirm={() => handleDelete(record.id)}
            >
              <Tooltip title="ลบ">
                <PermissionButton
                  menuCode={MENU_CODE}
                  action="delete"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
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
        <Select
          allowClear
          placeholder="ประเภทการสั่งซื้อ: ทั้งหมด"
          style={{ width: 220, marginBottom: 12 }}
          value={orderTypeFilter}
          options={ORDER_TYPE_OPTIONS}
          onChange={(v) => { setOrderTypeFilter(v); setPage(1) }}
        />
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          components={{ header: { cell: ResizableTitle } }}
          rowClassName={(record) => getRowClassName(record.status, record.poConversionStatus, record.hasRemaining)}
          size="small"
          scroll={{ x: 1480 }}
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
