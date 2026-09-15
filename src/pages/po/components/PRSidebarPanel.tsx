import React, { useEffect, useState } from 'react'
import { Input, Table, Button, Descriptions, Empty, Spin, Space, Tag, Tooltip, Checkbox, Popover, message } from 'antd'
import { CloseOutlined, ArrowLeftOutlined, CheckOutlined, SearchOutlined, DownOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '@/store'
import type { PRListItem, PRLineWithPOStatus, PRPriceHistoryEntry } from '@/types/pr'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const LIST_WIDTH = 340
const DETAIL_WIDTH = 'min(1300px, 92vw)'

interface PRSidebarPanelProps {
  open: boolean
  onClose: () => void
  // Reuses POCreatePage's existing prOptions data source (from
  // getAvailablePRs) — same fields already fetched: pr_no, pr_date, status,
  // requested_by.
  prOptions: PRListItem[]
  prOptionsLoading: boolean
  selectedPrId: number | null
  existingPrLineIds: number[]
  // Fired when the user confirms "ใช้ PR นี้" with at least one line checked
  // — the parent (POCreatePage) both runs the same auto-fill it always did
  // on PR selection AND imports the checked lines, in one step.
  onUsePr: (prId: number, checkedLines: PRLineWithPOStatus[]) => void
}

// ── Merged from PRItemSelectionModal.tsx (the line-item table this sidebar's
// detail view now embeds directly, per the merge requirement) — column defs,
// status logic, and price-history popover reused as-is, adapted to local
// component scope. ──────────────────────────────────────────────────────
type RowState = 'available' | 'partial' | 'taken'

const getRowState = (line: PRLineWithPOStatus): RowState => {
  if (line.qty_remaining <= 0) return 'taken'
  if (line.qty_ordered > 0) return 'partial'
  return 'available'
}

// Semantic tones per DESIGN.md: warning `#d97706` (partial), page bg `#f0f5ff` neutral for taken.
const rowBg: Record<RowState, string | undefined> = {
  available: undefined,
  partial: '#fffbeb',
  taken: '#f0f5ff',
}

const HISTORY_DISPLAY_LIMIT = 8

const formatCurrency = (v: number) =>
  `฿${v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatShortDate = (d?: string | null) => (d ? dayjs(d).format('DD MMM YYYY') : '-')

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s)

const formatPoNos = (referencedPos: PRLineWithPOStatus['referenced_pos']) =>
  referencedPos?.map((p) => p.po_no).join(', ') || '-'

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: '#60a5fa',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
}

// Header info shown in the detail view's Descriptions block — a defensive
// subset read straight off GET /pr/:id's raw response (project_name isn't
// on the typed PRDetail yet, same as POCreatePage's own fetchPrDetail effect
// reading raw.project_name directly).
interface PrDetailHeader {
  pr_no: string
  status: string
  requested_by: string
  project_name?: string | null
  project_code?: string | null
  pr_date?: string
}

const PRSidebarPanel: React.FC<PRSidebarPanelProps> = ({
  open, onClose, prOptions, prOptionsLoading, selectedPrId, existingPrLineIds, onUsePr,
}) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const navigate = useNavigate()

  const [view, setView] = useState<'list' | 'detail'>('list')
  const [search, setSearch] = useState('')

  const [detailLoading, setDetailLoading] = useState(false)
  const [detailPr, setDetailPr] = useState<PrDetailHeader | null>(null)
  const [detailPrId, setDetailPrId] = useState<number | null>(null)
  const [lines, setLines] = useState<PRLineWithPOStatus[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [openHistoryId, setOpenHistoryId] = useState<number | null>(null)
  const [selectedPrices, setSelectedPrices] = useState<Record<number, number>>({})

  // Always reopen to the list view (same as MemoSidebarPanel's list→detail
  // flow starting fresh each time the panel opens).
  useEffect(() => {
    if (open) {
      setView('list')
      setSearch('')
    }
  }, [open])

  const filteredOptions = prOptions.filter((pr) => {
    if (!search.trim()) return true
    const haystack = `${pr.pr_no} ${pr.status} ${pr.requested_by}`.toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  const handleCardClick = async (pr: PRListItem) => {
    setView('detail')
    setDetailLoading(true)
    setDetailPrId(pr.id)
    setSelectedIds(new Set())
    setSelectedPrices({})
    setOpenHistoryId(null)
    try {
      const [prRes, linesRes] = await Promise.all([
        axios.get(`${BASE_URL}/pr/${pr.id}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        axios.get(`${BASE_URL}/pr/${pr.id}/lines-with-po-status`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])
      const rawPr = prRes.data?.data ?? prRes.data
      const rawLinesData = linesRes.data?.data ?? linesRes.data
      setDetailPr({
        pr_no: rawPr?.pr_no ?? pr.pr_no,
        status: rawPr?.status ?? pr.status,
        requested_by: rawPr?.requested_by ?? pr.requested_by,
        project_name: rawPr?.project_name ?? null,
        project_code: rawPr?.project_code ?? pr.project_code,
        pr_date: rawPr?.pr_date ?? pr.pr_date,
      })
      const rawLineList = Array.isArray(rawLinesData?.lines) ? rawLinesData.lines : []
      // Same normalization PRItemSelectionModal used: API keys each line as
      // `pr_line_id`; ensure a stable unique `id` for rowKey/selection.
      setLines(rawLineList.map((l: any) => ({ ...l, id: l.id ?? l.pr_line_id ?? l.line_no })))
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดรายละเอียด PR ไม่สำเร็จ'
      message.error(errMsg)
      setDetailPr({
        pr_no: pr.pr_no, status: pr.status, requested_by: pr.requested_by,
        project_code: pr.project_code, pr_date: pr.pr_date,
      })
      setLines([])
    } finally {
      setDetailLoading(false)
    }
  }

  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleUsePrice = (lineId: number, price: number) => {
    setSelectedPrices((prev) => ({ ...prev, [lineId]: price }))
    setOpenHistoryId(null)
    message.success(`เลือกใช้ราคา ${formatCurrency(price)} สำหรับรายการนี้`)
  }

  const handleConfirm = () => {
    if (!detailPrId) return
    const checked = lines
      .filter((l) => selectedIds.has(l.id))
      .map((l) => ({ ...l, selected_unit_price: selectedPrices[l.id] }))
    onUsePr(detailPrId, checked)
  }

  const availableCount = lines.filter((l) => getRowState(l) === 'available').length
  const partialCount = lines.filter((l) => getRowState(l) === 'partial').length
  const takenCount = lines.filter((l) => getRowState(l) === 'taken').length

  const renderPriceHistoryContent = (r: PRLineWithPOStatus) => {
    const history = r.price_history ?? []
    const visible = history.slice(0, HISTORY_DISPLAY_LIMIT)
    const moreCount = history.length - visible.length

    return (
      <div style={{ width: 580, maxWidth: '90vw', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '4px 6px' }}>Date</th>
              <th style={{ padding: '4px 6px' }}>Price/Unit</th>
              <th style={{ padding: '4px 6px', textAlign: 'center' }}>Qty</th>
              <th style={{ padding: '4px 6px' }}>Supplier</th>
              <th style={{ padding: '4px 6px' }}>Project</th>
              <th style={{ padding: '4px 6px' }}>PO No.</th>
              <th style={{ padding: '4px 6px' }} />
            </tr>
          </thead>
          <tbody>
            {visible.map((h: PRPriceHistoryEntry, idx: number) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{formatShortDate(h.date)}</td>
                <td style={{ padding: '4px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(h.price)}</td>
                <td style={{ padding: '4px 6px', textAlign: 'center' }}>{h.qty}</td>
                <td style={{ padding: '4px 6px' }}>{h.supplier_name}</td>
                <td style={{ padding: '4px 6px' }}>
                  {h.project_name ? (
                    <div>
                      <div>{h.project_name}</div>
                      {h.project_code && (
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{h.project_code}</div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{h.po_no}</td>
                <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>
                  <a onClick={() => handleUsePrice(r.id, h.price)}>Use this price</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {moreCount > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
            +{moreCount} more record(s)
          </div>
        )}
      </div>
    )
  }

  const columns = [
    {
      title: '',
      key: 'select',
      width: 44,
      align: 'center' as const,
      render: (_: unknown, r: PRLineWithPOStatus) => {
        const alreadyInPo = existingPrLineIds.includes(r.id)
        const disabled = r.qty_remaining <= 0 || alreadyInPo
        const checkbox = (
          <Checkbox
            checked={selectedIds.has(r.id)}
            disabled={disabled}
            onChange={(e) => toggleSelect(r.id, e.target.checked)}
          />
        )
        if (!disabled) return checkbox
        const tooltipMsg = alreadyInPo
          ? 'รายการนี้ถูกเลือกไว้ใน PO นี้แล้ว'
          : `สั่งครบแล้ว — สั่งไปแล้วโดย ${formatPoNos(r.referenced_pos)}`
        return (
          <Tooltip title={tooltipMsg}>
            <span style={{ cursor: 'not-allowed' }}>{checkbox}</span>
          </Tooltip>
        )
      },
    },
    {
      title: 'No.',
      dataIndex: 'line_no',
      width: 50,
      align: 'center' as const,
    },
    {
      title: 'รหัสวัสดุ',
      dataIndex: 'mat_code',
      width: 140,
    },
    {
      title: 'รายละเอียด',
      dataIndex: 'mat_name',
    },
    {
      title: 'หน่วย',
      dataIndex: 'unit',
      width: 70,
      align: 'center' as const,
    },
    {
      title: 'Cost Code',
      key: 'cost_code',
      width: 130,
      render: (_: unknown, r: PRLineWithPOStatus) =>
        r.job_code ? (
          <Tooltip title={r.cost_subgroup_name ?? ''}>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {r.job_code}{r.job_name ? ` — ${r.job_name}` : ''}
            </span>
          </Tooltip>
        ) : (
          <span style={{ color: '#9ca3af', fontSize: 12 }}>-</span>
        ),
    },
    {
      title: 'จำนวนที่ขอ',
      dataIndex: 'qty_requested',
      width: 90,
      align: 'center' as const,
    },
    {
      title: 'คงเหลือที่สั่งได้',
      dataIndex: 'qty_remaining',
      width: 140,
      align: 'center' as const,
      render: (v: number, r: PRLineWithPOStatus) => (
        <div>
          <div style={{ color: v > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
            คงเหลือที่สั่งได้: {v}
          </div>
          {getRowState(r) === 'partial' && (
            <div style={{ fontSize: 11, color: '#d97706' }}>
              สั่งไปแล้ว {r.qty_ordered}/{r.qty_requested}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'ราคาล่าสุด',
      key: 'last_price',
      width: 160,
      render: (_: unknown, r: PRLineWithPOStatus) => {
        if (r.last_price == null) {
          return <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 13 }}>No history</span>
        }

        const history = r.price_history ?? []
        const prevPrice = history[1]?.price
        const dealBg =
          prevPrice == null
            ? undefined
            : r.last_price < prevPrice
              ? '#f0fdf4'
              : r.last_price > prevPrice
                ? '#fef2f2'
                : undefined

        const isOpen = openHistoryId === r.id
        const usedPrice = selectedPrices[r.id]
        const lastProjectName = history[0]?.project_name

        return (
          <Popover
            open={isOpen}
            onOpenChange={(visible) => setOpenHistoryId(visible ? r.id : null)}
            trigger="click"
            placement="rightTop"
            content={renderPriceHistoryContent(r)}
          >
            <div style={{ display: 'inline-block', cursor: 'pointer' }}>
              <Space
                size={6}
                style={{ backgroundColor: dealBg, padding: '4px 8px', borderRadius: 4 }}
              >
                <span>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{formatCurrency(r.last_price)}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{formatShortDate(r.last_price_date)}</div>
                  {lastProjectName && (
                    <div style={{ fontSize: 11, color: '#2563eb', maxWidth: 150 }}>
                      📁 {truncate(lastProjectName, 30)}
                    </div>
                  )}
                </span>
                <DownOutlined
                  style={{
                    fontSize: 10,
                    color: '#6b7280',
                    transform: isOpen ? 'rotate(180deg)' : undefined,
                    transition: 'transform 0.15s',
                  }}
                />
              </Space>
              {usedPrice != null && (
                <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>
                  Using {formatCurrency(usedPrice)}
                </div>
              )}
            </div>
          </Popover>
        )
      },
    },
    {
      title: 'PO ที่อ้างอิง',
      dataIndex: 'referenced_pos',
      width: 200,
      render: (_: unknown, r: PRLineWithPOStatus) => {
        const state = getRowState(r)
        const pos = r.referenced_pos ?? []
        return (
          <Space direction="vertical" size={2}>
            {pos.length > 0 ? (
              <Space size={[4, 4]} wrap>
                {pos.map((p) => (
                  <Tag
                    key={p.po_id}
                    color="blue"
                    style={{ margin: 0, cursor: 'pointer' }}
                    onClick={() => navigate(`/po/approval/${p.po_id}`)}
                  >
                    {p.po_no}
                  </Tag>
                ))}
              </Space>
            ) : (
              <span style={{ fontSize: 13 }}>-</span>
            )}
            {state === 'taken' && (
              <Tag color="red" style={{ margin: 0 }}>สั่งครบแล้ว</Tag>
            )}
            {state === 'partial' && (
              <Tag color="orange" style={{ margin: 0 }}>สั่งบางส่วน</Tag>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 999 }}
        />
      )}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: open ? (view === 'detail' ? DETAIL_WIDTH : LIST_WIDTH) : 0,
          minWidth: open ? (view === 'detail' ? DETAIL_WIDTH : LIST_WIDTH) : 0,
          overflow: 'hidden',
          background: '#ffffff',
          zIndex: 1000,
          boxShadow: open ? '-4px 0 20px rgba(15,45,94,0.15)' : 'none',
          transition: 'width .25s cubic-bezier(.4,0,.2,1), min-width .25s cubic-bezier(.4,0,.2,1)',
        }}
      >
        <div style={{ width: view === 'detail' ? DETAIL_WIDTH : LIST_WIDTH, height: '100%', position: 'relative' }}>

          {/* ── LIST VIEW ── */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 8px' }}>
              <span style={sectionTitleStyle}>PR Order</span>
              <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
            </div>

            <div style={{ padding: '0 16px 12px' }}>
              <Input
                prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                placeholder="ค้นหา PR"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
              />
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
              {prOptionsLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin />
                </div>
              ) : filteredOptions.length === 0 ? (
                <Empty description="ไม่พบ PR ที่พร้อมใช้งาน" />
              ) : (
                filteredOptions.map((pr) => (
                  <div
                    key={pr.id}
                    onClick={() => handleCardClick(pr)}
                    style={{
                      border: `0.5px solid ${pr.id === selectedPrId ? '#2563eb' : '#dbeafe'}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      marginBottom: 8,
                      cursor: 'pointer',
                      background: pr.id === selectedPrId ? '#eff6ff' : 'transparent',
                      transition: 'border-color .15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 12 }}>{pr.pr_no}</span>
                      <Tag style={{ margin: 0, fontSize: 11 }}>{pr.status}</Tag>
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 2 }}>{pr.requested_by || '—'}</div>
                    <div style={{ fontSize: 11, color: '#60a5fa' }}>
                      {pr.pr_date ? dayjs(pr.pr_date).format('DD/MM/YYYY') : '—'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── DETAIL VIEW (slides in via translateX) ── */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              transform: view === 'detail' ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
              zIndex: 2,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 8px' }}>
              <Space size={8}>
                <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={() => setView('list')} />
                <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 13 }}>{detailPr?.pr_no}</span>
                {detailPr && <Tag style={{ margin: 0 }}>{detailPr.status}</Tag>}
              </Space>
              <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
              <Descriptions column={4} size="small" style={{ marginBottom: 12 }}>
                <Descriptions.Item label="Requester">{detailPr?.requested_by || '—'}</Descriptions.Item>
                <Descriptions.Item label="Project">{detailPr?.project_name || detailPr?.project_code || '—'}</Descriptions.Item>
                <Descriptions.Item label="Date">
                  {detailPr?.pr_date ? dayjs(detailPr.pr_date).format('DD/MM/YYYY') : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">{detailPr?.status || '—'}</Descriptions.Item>
              </Descriptions>

              <div style={{ marginBottom: 8, fontSize: 13, color: '#374151' }}>
                ทั้งหมด {lines.length} รายการ — สั่งได้ {availableCount} / สั่งบางส่วน {partialCount} / สั่งครบแล้ว {takenCount}
              </div>

              <Table
                rowKey="id"
                loading={detailLoading}
                dataSource={lines}
                columns={columns}
                pagination={false}
                size="small"
                scroll={{ x: 1200, y: 480 }}
                onRow={(record) => ({ style: { backgroundColor: rowBg[getRowState(record)] } })}
                locale={{ emptyText: 'ไม่มีรายการในใบขอซื้อนี้' }}
              />
            </div>

            <div style={{ padding: 16, borderTop: '0.5px solid #dbeafe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#6b7280', fontSize: 13 }}>เลือกแล้ว {selectedIds.size} รายการ</span>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                disabled={selectedIds.size === 0 || !detailPrId}
                onClick={handleConfirm}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                }}
              >
                ใช้ PR นี้
              </Button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

export default PRSidebarPanel
