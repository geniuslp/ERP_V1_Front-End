import { formatProjectTier } from '@/utils/projectTier'
import React, { useEffect, useRef, useState } from 'react'
import { Card, Table, Input, Select, Row, Col, Typography, Modal, Space, Tag, Spin, Tooltip, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { poApprovalService } from '@/services/poApprovalService'
import { financeService } from '@/services/financeService'
import { POApprovalStatusTag } from '@/components/po/POStatusBadge'
import type { POLineItemGroup, POLine, PODetail } from '@/types/po'
import { formatCostCodeDisplay } from '@/utils/costCode'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const thb = (n?: number) =>
  (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface CostBreakdown {
  po: number
  wo: number
  petty_cash: number
}

// Row of GET /project-overview (backend-confirmed contract).
interface ProjectOverviewRow {
  project_code: string
  project_name: string
  customer_name?: string | null
  contract_budget: number
  project_tier?: number | null
  pu_cost: number
  pu_balance: number
  ac_cost: number
  ac_balance: number
  usage_pct: number | null
  status: string
  status_label: string
  pu_breakdown?: CostBreakdown
  ac_breakdown?: CostBreakdown
}

const STATUS_COLOR: Record<string, string> = {
  NORMAL: 'green',
  NEAR_LIMIT: 'orange',
  OVER_BUDGET: 'red',
  NO_BUDGET: 'default',
  CLOSED: 'blue',
  INACTIVE: 'default',
}

// The default list hides INACTIVE; it is only returned when status=INACTIVE is passed.
const STATUS_OPTIONS = [
  { value: 'NORMAL', label: 'ปกติ' },
  { value: 'NEAR_LIMIT', label: 'ใกล้เต็มงบ' },
  { value: 'OVER_BUDGET', label: 'เกินงบ' },
  { value: 'NO_BUDGET', label: 'ไม่มีงบ' },
  { value: 'CLOSED', label: 'ปิดโครงการ' },
  { value: 'INACTIVE', label: 'ไม่ใช้งาน' },
]

// Level-2 data cached per project_code once its row is first expanded — the
// PO list (GET /po/line-items) and this project's paid_amount (summed from
// financeService.list, filtered by project_code) are fetched together since
// both require the same network round-trip moment; there's no cheap way to
// get paid_amount for every project up front (see StatCards comment below).
interface ProjectPOSummary {
  pos: POLineItemGroup[]
  paidAmount: number
}

// Shape of GET /project-overview/search results — backend-confirmed new
// endpoint (internal/handlers/project_overview.go). Fields are read
// defensively since this is freshly built and not yet exercised end-to-end
// from this page.
interface SearchResultItem {
  type: 'project' | 'po_line'
  project_code?: string
  project_name?: string
  po_id?: number
  po_no?: string
  mat_code?: string
  mat_name?: string
}

// Same react-resizable pattern as POStatusPage.tsx (copied locally, there is no shared
// component): only header cells that receive width/onResize get a drag handle.
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
      minConstraints={[MIN_COL_WIDTH, 0]}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', right: -5, bottom: 0, top: 0, width: 10, cursor: 'col-resize', zIndex: 1 }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative' }} />
    </Resizable>
  )
}

const MIN_COL_WIDTH = 80
const EXPAND_COL_WIDTH = 48
const COL_WIDTHS_STORAGE_KEY = 'project-overview.col-widths'
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  project: 280,
  customer_name: 200,
  contract_budget: 150,
  project_tier: 90,
  pu_cost: 140,
  pu_balance: 140,
  ac_cost: 140,
  ac_balance: 140,
  status: 150,
}

// Per-viewer convenience only — any storage failure falls back to the defaults.
const loadColWidths = (): Record<string, number> => {
  try {
    const saved = JSON.parse(localStorage.getItem(COL_WIDTHS_STORAGE_KEY) ?? 'null')
    if (saved && typeof saved === 'object') {
      const merged = { ...DEFAULT_COL_WIDTHS }
      for (const k of Object.keys(merged)) {
        if (typeof saved[k] === 'number' && saved[k] >= MIN_COL_WIDTH) merged[k] = saved[k]
      }
      return merged
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_COL_WIDTHS }
}

const ProjectOverviewPage: React.FC = () => {
  const [colWidths, setColWidths] = useState<Record<string, number>>(loadColWidths)
  const handleColResize =
    (key: string) =>
    (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
      const width = Math.max(MIN_COL_WIDTH, Math.round(data.size.width))
      setColWidths((prev) => {
        const next = { ...prev, [key]: width }
        try {
          localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
    }

  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [projects, setProjects] = useState<ProjectOverviewRow[]>([])
  const [loading, setLoading] = useState(false)

  const [expandedProjectKeys, setExpandedProjectKeys] = useState<React.Key[]>([])
  const [projectPOs, setProjectPOs] = useState<Record<string, ProjectPOSummary>>({})
  const [poLoadingKeys, setPoLoadingKeys] = useState<Set<string>>(new Set())

  const [poLines, setPoLines] = useState<Record<number, POLine[]>>({})
  const [lineLoadingKeys, setLineLoadingKeys] = useState<Set<number>>(new Set())

  // Debounced search — same pattern as SupplierPage.tsx: `searchInput` tracks
  // raw keystrokes so the box stays responsive, `search` is the debounced
  // value that actually triggers the API call.
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [detailModal, setDetailModal] = useState<{ open: boolean; loading: boolean; po: PODetail | null }>({
    open: false,
    loading: false,
    po: null,
  })

  // Server-side search / status filter / pagination — GET /project-overview.
  const [tableSearchInput, setTableSearchInput] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const tableSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/project-overview`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          search: tableSearch || undefined,
          status: statusFilter || undefined,
          page,
          page_size: pageSize,
        },
      })
      const payload = res.data?.data ?? res.data
      const list = Array.isArray(payload) ? payload : payload?.data ?? []
      setProjects(Array.isArray(list) ? list : [])
      setTotal(payload?.total ?? (Array.isArray(list) ? list.length : 0))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลโครงการไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableSearch, statusFilter, page, pageSize])

  const handleTableSearchChange = (value: string) => {
    setTableSearchInput(value)
    if (tableSearchRef.current) clearTimeout(tableSearchRef.current)
    tableSearchRef.current = setTimeout(() => {
      setTableSearch(value.trim())
      setPage(1)
    }, 400)
  }

  useEffect(
    () => () => {
      if (tableSearchRef.current) clearTimeout(tableSearchRef.current)
    },
    [],
  )

  const fetchProjectPOs = async (projectCode: string) => {
    if (projectPOs[projectCode] || poLoadingKeys.has(projectCode)) return
    setPoLoadingKeys((prev) => new Set(prev).add(projectCode))
    try {
      const [lineItemsRes, paymentsResult] = await Promise.all([
        poApprovalService.getLineItems(accessToken, { project_code: projectCode, page: 1, page_size: 100 }),
        financeService.list(accessToken, { doc_type: 'PO', project_code: projectCode, page: 1, page_size: 1000 }),
      ])
      const pos = lineItemsRes.data.data.data ?? []
      const paidAmount = paymentsResult.items.reduce((sum, it) => sum + (it.paid_amount ?? 0), 0)
      setProjectPOs((prev) => ({ ...prev, [projectCode]: { pos, paidAmount } }))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดรายการ PO ของโครงการไม่สำเร็จ')
    } finally {
      setPoLoadingKeys((prev) => {
        const next = new Set(prev)
        next.delete(projectCode)
        return next
      })
    }
  }

  const fetchPoLines = async (poId: number) => {
    if (poLines[poId] || lineLoadingKeys.has(poId)) return
    setLineLoadingKeys((prev) => new Set(prev).add(poId))
    try {
      const res = await axios.get(`${BASE_URL}/po/${poId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const raw = res.data?.data ?? res.data
      setPoLines((prev) => ({ ...prev, [poId]: raw.lines ?? [] }))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดรายการสินค้าของ PO ไม่สำเร็จ')
    } finally {
      setLineLoadingKeys((prev) => {
        const next = new Set(prev)
        next.delete(poId)
        return next
      })
    }
  }

  const openPoDetailModal = async (poId: number) => {
    setDetailModal({ open: true, loading: true, po: null })
    try {
      const res = await axios.get(`${BASE_URL}/po/${poId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const raw = res.data?.data ?? res.data
      setDetailModal({ open: true, loading: false, po: raw })
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูล PO ไม่สำเร็จ')
      setDetailModal({ open: false, loading: false, po: null })
    }
  }

  const handleSearchInputChange = (value: string) => {
    setSearchInput(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (!value.trim()) {
      setSearch('')
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    searchDebounceRef.current = setTimeout(() => setSearch(value.trim()), 400)
  }

  useEffect(
    () => () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    },
    [],
  )

  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    const run = async () => {
      setSearching(true)
      try {
        const res = await axios.get(`${BASE_URL}/project-overview/search`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { q: search },
        })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        if (!cancelled) setSearchResults(Array.isArray(raw) ? raw : [])
      } catch (err: any) {
        if (!cancelled) {
          message.error(err?.response?.data?.message || err?.message || 'ค้นหาไม่สำเร็จ')
          setSearchResults([])
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [search, accessToken])

  const clearSearch = () => {
    setSearchInput('')
    setSearch('')
    setSearchResults([])
  }

  const handleResultClick = (item: SearchResultItem) => {
    if (item.type === 'project' && item.project_code) {
      const code = item.project_code
      // The table is server-paginated, so the clicked project may not be on the
      // current page — narrow the table to it (and drop the status filter, which
      // could hide it) before expanding and scrolling.
      if (tableSearch !== code || statusFilter) {
        if (tableSearchRef.current) clearTimeout(tableSearchRef.current)
        setTableSearchInput(code)
        setTableSearch(code)
        setStatusFilter(undefined)
        setPage(1)
      }
      setExpandedProjectKeys((prev) => (prev.includes(code) ? prev : [...prev, code]))
      fetchProjectPOs(code)
      // Scroll to the row once it's rendered — the row may already be on
      // screen (client-side-paginated full list), so this is a same-page
      // scroll, not a re-fetch/navigation.
      requestAnimationFrame(() => {
        document.getElementById(`project-row-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    } else if (item.type === 'po_line' && item.po_id != null) {
      openPoDetailModal(item.po_id)
    }
    clearSearch()
  }

  // ---- columns ----

  const lineColumns: ColumnsType<POLine> = [
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code', width: 130 },
    { title: 'ชื่อวัสดุ', dataIndex: 'mat_name', key: 'mat_name', width: 160, ellipsis: true },
    { title: 'Spec', dataIndex: 'spec', key: 'spec', width: 140, ellipsis: true, render: (v?: string) => v || '-' },
    // 'หน่วย' (unit) column removed — GET /po/:id's line items confirmed via
    // diagnostic log to have NO unit_name field (or any other unit field) at
    // all. Not fabricating a value; flag to backend if unit display is
    // wanted here — it would need to be added to the response first.
    { title: 'สั่งซื้อ', dataIndex: 'qty_ordered', key: 'qty_ordered', width: 70, align: 'right' },
    { title: 'รับแล้ว', dataIndex: 'qty_received', key: 'qty_received', width: 70, align: 'right' },
    {
      title: 'ราคา/หน่วย',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 90,
      align: 'right',
      render: (v: number) => thb(v),
    },
    {
      title: 'Cost Code',
      dataIndex: 'cost_code',
      key: 'cost_code',
      width: 140,
      render: (v?: string) => formatCostCodeDisplay(v) || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    { title: 'มูลค่า', dataIndex: 'amount', key: 'amount', width: 100, align: 'right', render: (v: number) => thb(v) },
  ]

  const poColumns: ColumnsType<POLineItemGroup> = [
    { title: 'เลขที่ PO', dataIndex: 'po_no', key: 'po_no' },
    {
      title: 'วันที่',
      dataIndex: 'po_date',
      key: 'po_date',
      render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    { title: 'ผู้ขาย', dataIndex: 'supplier_name', key: 'supplier_name', render: (v?: string) => v || '-' },
    { title: 'มูลค่า', dataIndex: 'net_amount', key: 'net_amount', align: 'right', render: (v: number) => thb(v) },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (v: POLineItemGroup['status']) => <POApprovalStatusTag status={v} />,
    },
  ]

  const breakdownTip = (b?: CostBreakdown) =>
    b ? (
      <div>
        <div>PO: {thb(b.po)}</div>
        <div>WO: {thb(b.wo)}</div>
        <div>Petty Cash: {thb(b.petty_cash)}</div>
      </div>
    ) : undefined

  const balanceCell = (v: number) => (
    <span style={{ fontWeight: 600, color: v < 0 ? '#dc2626' : undefined }}>{thb(v)}</span>
  )

  // Widths are overridden from `colWidths` state below (baseColumns -> projectColumns).
  const baseColumns: ColumnsType<ProjectOverviewRow> = [
    {
      title: 'รหัสโครงการ / ชื่อโครงการ',
      key: 'project',
      fixed: 'left',
      ellipsis: true,
      // On-screen convention: "{code} {name}", single space, no dash.
      render: (_: unknown, r) => [r.project_code, r.project_name].filter(Boolean).join(' '),
    },
    {
      title: 'ลูกค้า',
      dataIndex: 'customer_name',
      key: 'customer_name',
      ellipsis: true,
      render: (v?: string | null) => v || '-',
    },
    {
      title: 'Contract Budget',
      dataIndex: 'contract_budget',
      key: 'contract_budget',
      width: 150,
      align: 'right',
      render: (v: number) => thb(v),
    },
    {
      title: 'Tier',
      dataIndex: 'project_tier',
      key: 'project_tier',
      width: 90,
      align: 'center',
      render: (v?: number | null) => formatProjectTier(v),
    },
    {
      title: 'Pu.Cost',
      dataIndex: 'pu_cost',
      key: 'pu_cost',
      width: 150,
      align: 'right',
      render: (v: number, r) => (
        <Tooltip title={breakdownTip(r.pu_breakdown)}>
          <div>
            <div>{thb(v)}</div>
            {r.usage_pct != null && (
              <div style={{ fontSize: 11, color: '#64748b' }}>{r.usage_pct.toFixed(2)}%</div>
            )}
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Pu.Balance',
      dataIndex: 'pu_balance',
      key: 'pu_balance',
      width: 150,
      align: 'right',
      render: balanceCell,
    },
    {
      title: 'Ac.Cost',
      dataIndex: 'ac_cost',
      key: 'ac_cost',
      width: 150,
      align: 'right',
      render: (v: number, r) => (
        <Tooltip title={breakdownTip(r.ac_breakdown)}>
          <span>{thb(v)}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Ac.Balance',
      dataIndex: 'ac_balance',
      key: 'ac_balance',
      width: 150,
      align: 'right',
      render: balanceCell,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string, r) => (
        <Tag color={STATUS_COLOR[v] ?? 'default'} style={{ margin: 0, whiteSpace: 'nowrap' }}>
          {r.status_label}
        </Tag>
      ),
    },
  ]

  // Every column is drag-resizable; widths live in state (and localStorage) so they survive
  // paging/search/filter reloads. Status gets extra left padding (cells + header) so its
  // left-aligned tag doesn't touch the right-aligned Ac.Balance numbers.
  const projectColumns: ColumnsType<ProjectOverviewRow> = baseColumns.map((col) => {
    const key = String(col.key)
    const width = colWidths[key]
    const pad: React.CSSProperties | undefined = key === 'status' ? { paddingLeft: 24 } : undefined
    return {
      ...col,
      width,
      onHeaderCell: () =>
        ({ width, onResize: handleColResize(key), style: pad }) as React.HTMLAttributes<HTMLElement>,
      onCell: pad ? () => ({ style: pad }) : undefined,
    }
  })
  const tableScrollX = Object.values(colWidths).reduce((a, b) => a + b, 0) + EXPAND_COL_WIDTH

  return (
    <div>
      <PageHeader
        title="ภาพรวมโครงการ"
        subtitle="สรุปงบประมาณ ยอดผูกพัน และรายการ Memo/PR/PO แยกตามโครงการ"
        breadcrumbs={[{ title: 'Home' }, { title: 'ภาพรวมโครงการ' }]}
      />

      <Card style={{ ...cardStyle, marginBottom: 20 }}>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Typography.Text style={{ display: 'block', marginBottom: 8, color: '#374151' }}>
              ค้นหาโครงการ
            </Typography.Text>
            <Input
              placeholder="รหัสหรือชื่อโครงการ..."
              prefix={<SearchOutlined />}
              value={tableSearchInput}
              onChange={(e) => handleTableSearchChange(e.target.value)}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={6}>
            <Typography.Text style={{ display: 'block', marginBottom: 8, color: '#374151' }}>
              สถานะ
            </Typography.Text>
            <Select
              placeholder="- ทุกสถานะ (ไม่รวมไม่ใช้งาน) -"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v ?? undefined)
                setPage(1)
              }}
              allowClear
              options={STATUS_OPTIONS}
            />
          </Col>
          <Col xs={24} md={10}>
            <Typography.Text style={{ display: 'block', marginBottom: 8, color: '#374151' }}>
              ค้นหาข้ามโครงการ/PO/วัสดุ
            </Typography.Text>
            <Input
              placeholder="ค้นหาโครงการ, PO, หรือวัสดุ..."
              prefix={<SearchOutlined />}
              value={searchInput}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              allowClear
              onClear={clearSearch}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
        {searchInput.trim().length >= 2 && (
          <div
            style={{
              marginTop: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {searching ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>กำลังค้นหา...</div>
            ) : searchResults.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>ไม่พบผลลัพธ์</div>
            ) : (
              searchResults.map((r, i) => (
                <div
                  key={i}
                  onClick={() => handleResultClick(r)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    borderBottom: i < searchResults.length - 1 ? '1px solid #f1f5f9' : undefined,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Tag color={r.type === 'project' ? 'blue' : 'purple'}>
                    {r.type === 'project' ? 'โครงการ' : 'PO'}
                  </Tag>
                  {r.type === 'project' ? (
                    <span>
                      {r.project_code} — {r.project_name}
                    </span>
                  ) : (
                    <span>
                      {r.po_no} · {r.mat_code} {r.mat_name ? `— ${r.mat_name}` : ''}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      <Card style={cardStyle}>
        <Table
          rowKey="project_code"
          loading={loading}
          dataSource={projects}
          columns={projectColumns}
          components={{ header: { cell: ResizableTitle } }}
          size="middle"
          scroll={{ x: tableScrollX }}
          locale={{ emptyText: 'ไม่พบข้อมูลโครงการ' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
            showTotal: (t) => `ทั้งหมด ${t} โครงการ`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          onRow={(record) => ({ id: `project-row-${record.project_code}` } as React.HTMLAttributes<HTMLElement>)}
          expandable={{
            fixed: 'left',
            expandedRowKeys: expandedProjectKeys,
            onExpandedRowsChange: (keys) => setExpandedProjectKeys(keys as React.Key[]),
            onExpand: (expanded, record) => {
              if (expanded) fetchProjectPOs(record.project_code)
            },
            expandedRowRender: (record) => {
              const summary = projectPOs[record.project_code]
              const isLoading = poLoadingKeys.has(record.project_code)
              return (
                <div>
                  {!isLoading && summary && (
                    <div style={{ marginBottom: 12, fontSize: 13, color: '#374151' }}>
                      ยอดจ่ายจริงของโครงการนี้:{' '}
                      <strong style={{ color: '#16a34a' }}>{thb(summary.paidAmount)} บาท</strong>
                    </div>
                  )}
                  <Table
                    rowKey={(r) => String(r.po_id ?? r.po_no)}
                    loading={isLoading}
                    dataSource={summary?.pos ?? []}
                    columns={poColumns}
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: 'ไม่พบ PO ในโครงการนี้' }}
                    expandable={{
                      rowExpandable: (r) => r.po_id != null,
                      onExpand: (expanded, r) => {
                        if (expanded && r.po_id != null) fetchPoLines(r.po_id)
                      },
                      expandedRowRender: (r) => (
                        <Table
                          rowKey={(l, idx) => `${r.po_id}-${l.mat_code}-${idx}`}
                          loading={r.po_id != null && lineLoadingKeys.has(r.po_id)}
                          dataSource={r.po_id != null ? poLines[r.po_id] ?? [] : []}
                          columns={lineColumns}
                          size="small"
                          pagination={false}
                          scroll={{ x: 'max-content' }}
                          locale={{ emptyText: 'ไม่พบรายการสินค้า' }}
                        />
                      ),
                    }}
                  />
                </div>
              )
            },
          }}
        />
      </Card>

      <Modal
        title={detailModal.po ? `รายละเอียด PO — ${detailModal.po.po_no}` : 'รายละเอียด PO'}
        open={detailModal.open}
        onCancel={() => setDetailModal({ open: false, loading: false, po: null })}
        footer={null}
        width={800}
      >
        {detailModal.loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : detailModal.po ? (
          <>
            <Space direction="vertical" style={{ marginBottom: 16 }}>
              <div>ผู้ขาย: {detailModal.po.supplier_name}</div>
              <div>
                สถานะ: <POApprovalStatusTag status={detailModal.po.status} />
              </div>
              <div>มูลค่าสุทธิ: {thb(detailModal.po.net_amount)} บาท</div>
            </Space>
            <Table
              rowKey={(l, idx) => `${l.mat_code}-${idx}`}
              dataSource={detailModal.po.lines}
              columns={lineColumns}
              size="small"
              pagination={false}
            />
          </>
        ) : null}
      </Modal>
    </div>
  )
}

export default ProjectOverviewPage
