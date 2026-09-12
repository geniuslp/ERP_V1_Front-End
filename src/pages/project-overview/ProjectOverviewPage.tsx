import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Table, Input, Select, Row, Col, Typography, Modal, Space, Tag, Spin, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { poApprovalService } from '@/services/poApprovalService'
import { financeService } from '@/services/financeService'
import { POApprovalStatusTag } from '@/components/po/POStatusBadge'
import type { POLineItemGroup, POLine, PODetail } from '@/types/po'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const thb = (n?: number) =>
  (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface ProjectOverviewRow {
  project_code: string
  project_name: string
  budget_amount: number
  spent_amount: number
  remaining_amount: number
}

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

const ProjectOverviewPage: React.FC = () => {
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

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/projects`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        // Fetched in one batch and paginated client-side (Table's own
        // pagination below) — same convention as ProjectListPage.tsx — so the
        // StatCard totals below can sum across every project, not just the
        // current visible page.
        params: { page_size: 1000 },
      })
      const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
      const list = Array.isArray(raw) ? raw : []
      setProjects(
        list.map((p: any) => ({
          project_code: p.project_code,
          project_name: p.project_name ?? p.name ?? '',
          budget_amount: p.budget_amount ?? 0,
          spent_amount: p.spent_amount ?? 0,
          remaining_amount: p.remaining_amount ?? 0,
        })),
      )
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลโครงการไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // budget/spent/remaining only — paid_amount is deliberately excluded here
  // per decision: it's only available per-project once that row's PO list is
  // lazy-loaded (fetchProjectPOs), so there's no cheap way to sum it across
  // every project up front without loading all of them immediately.
  const totals = useMemo(
    () =>
      projects.reduce(
        (acc, p) => ({
          budget: acc.budget + p.budget_amount,
          spent: acc.spent + p.spent_amount,
          remaining: acc.remaining + p.remaining_amount,
        }),
        { budget: 0, spent: 0, remaining: 0 },
      ),
    [projects],
  )

  // Client-side project filter for the level-1 table only — separate from
  // handleSearchInputChange's cross-entity search below. This dropdown never
  // hits the API; it just narrows which already-loaded `projects` rows are
  // shown. The search bar, by contrast, queries GET /project-overview/search
  // across projects/POs/materials and jumps to/opens a result rather than
  // filtering this table's rows. The two are intentionally independent —
  // clearing one has no effect on the other.
  const [projectFilter, setProjectFilter] = useState<string | undefined>(undefined)
  const projectFilterOptions = useMemo(
    () => projects.map((p) => ({ value: p.project_code, label: `${p.project_code} — ${p.project_name}` })),
    [projects],
  )
  const filteredProjects = useMemo(
    () => (projectFilter ? projects.filter((p) => p.project_code === projectFilter) : projects),
    [projects, projectFilter],
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
      // Clear the project filter first if it's narrowed to a different
      // project — otherwise the clicked project's row wouldn't be rendered
      // at all and the scroll-into-view below would silently find nothing.
      setProjectFilter((prev) => (prev && prev !== code ? undefined : prev))
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
      key: 'cost_code',
      width: 140,
      render: (_: unknown, r: POLine) =>
        r.cost_code ? (
          <span>
            {r.cost_code}
            {r.cost_subgroup_name ? ` — ${r.cost_subgroup_name}` : ''}
          </span>
        ) : (
          <span style={{ color: '#9ca3af' }}>—</span>
        ),
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

  const projectColumns: ColumnsType<ProjectOverviewRow> = [
    { title: 'รหัสโครงการ', dataIndex: 'project_code', key: 'project_code' },
    { title: 'ชื่อโครงการ', dataIndex: 'project_name', key: 'project_name', ellipsis: true },
    {
      title: 'งบประมาณ',
      dataIndex: 'budget_amount',
      key: 'budget_amount',
      align: 'right',
      render: (v: number) => thb(v),
    },
    {
      title: 'ใช้ไปแล้ว',
      dataIndex: 'spent_amount',
      key: 'spent_amount',
      align: 'right',
      render: (v: number) => thb(v),
    },
    {
      title: 'คงเหลือ',
      dataIndex: 'remaining_amount',
      key: 'remaining_amount',
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: v < 0 ? '#dc2626' : '#16a34a' }}>{thb(v)}</span>
      ),
    },
  ]

  const statCards = [
    { label: 'งบประมาณรวม', value: totals.budget, color: '#2563eb' },
    { label: 'ใช้ไปแล้วรวม', value: totals.spent, color: '#d97706' },
    { label: 'คงเหลือรวม', value: totals.remaining, color: totals.remaining < 0 ? '#dc2626' : '#16a34a' },
  ]

  return (
    <div>
      <PageHeader
        title="ภาพรวมโครงการ"
        subtitle="สรุปงบประมาณ ยอดผูกพัน และรายการ Memo/PR/PO แยกตามโครงการ"
        breadcrumbs={[{ title: 'Home' }, { title: 'ภาพรวมโครงการ' }]}
      />

      <Row gutter={16} style={{ marginBottom: 20 }}>
        {statCards.map((c) => (
          <Col xs={24} sm={8} key={c.label}>
            <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
              <Typography.Text style={{ color: '#64748b', fontSize: 12 }}>{c.label}</Typography.Text>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>
                {thb(c.value)} บาท
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ ...cardStyle, marginBottom: 20 }}>
        <Row gutter={16}>
          <Col xs={24} md={10}>
            <Typography.Text style={{ display: 'block', marginBottom: 8, color: '#374151' }}>
              กรองตามโครงการ
            </Typography.Text>
            <Select
              placeholder="- ดูทุกโครงการ -"
              style={{ width: '100%' }}
              value={projectFilter}
              onChange={(v) => setProjectFilter(v ?? undefined)}
              allowClear
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={projectFilterOptions}
            />
          </Col>
          <Col xs={24} md={14}>
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
          dataSource={filteredProjects}
          columns={projectColumns}
          size="middle"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'ไม่พบข้อมูลโครงการ' }}
          pagination={{ pageSize: 20, showTotal: (t) => `ทั้งหมด ${t} โครงการ` }}
          onRow={(record) => ({ id: `project-row-${record.project_code}` } as React.HTMLAttributes<HTMLElement>)}
          expandable={{
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
