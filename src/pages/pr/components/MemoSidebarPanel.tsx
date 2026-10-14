import React, { useEffect, useState } from 'react'
import { Input, Table, Button, Descriptions, Empty, Spin, Space, Tag, Tooltip, Checkbox, message } from 'antd'
import {
  CloseOutlined, ArrowLeftOutlined, CheckOutlined, SearchOutlined,
  ExpandOutlined, ShrinkOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import MemoStatusBadge from '@/pages/memo/components/MemoStatusBadge'
import { useAppSelector } from '@/store'
import type { Memo } from '@/types'
import { resolveFileUrl } from '@/utils/fileUrl'
import type { MemoLineInput } from '@/components/common/PRItemsTable'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

type SidebarSize = 'compact' | 'expanded'

const SIDEBAR_WIDTH: Record<SidebarSize, number> = {
  compact: 280,
  expanded: 480,
}

// One row of GET /memo/:id/available-lines
interface MemoLineRow extends MemoLineInput {
  remark?: string | null
  taken: boolean
  taken_by_pr_id?: number | null
  taken_by_pr_no?: string | null
}

interface MemoSidebarPanelProps {
  open: boolean
  onClose: () => void
  // "Apply selection": lines to add (newly ticked) and memo_line ids to remove
  // (Memo-derived PR lines that were unticked). The caller applies both.
  onApply: (memo: Memo, addLines: MemoLineInput[], removeIds: number[]) => void
  selectedMemoId?: string
  // Edit mode: the PR's own Memo cannot change — open straight into its detail.
  lockedMemoId?: number | null
  // Edit mode: the saved PR's id, so its own lines are not reported as taken.
  excludePrId?: number | null
  // memo_line ids currently on the PR form (saved or not yet saved).
  formMemoLineIds: number[]
  // Bumped by the caller (after a 409 or a successful save) to refetch the Memo list and the open detail's lines.
  refreshKey?: number
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: '#60a5fa',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
}

const SizeControls: React.FC<{ size: SidebarSize; onShrink: () => void; onExpand: () => void }> = ({
  size, onShrink, onExpand,
}) => (
  <Space size={4}>
    <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>{size}</Tag>
    {size === 'expanded' ? (
      <Tooltip title="Compact">
        <Button size="small" icon={<ShrinkOutlined />} onClick={onShrink} />
      </Tooltip>
    ) : (
      <Tooltip title="Expand">
        <Button size="small" icon={<ExpandOutlined />} onClick={onExpand} />
      </Tooltip>
    )}
  </Space>
)

// Map raw API response (snake_case) → typed Memo object
const mapMemo = (raw: any): Memo => ({
  ...raw,
  id:          String(raw.id),
  memoNo:      raw.memo_no           ?? raw.memoNo        ?? '',
  status:      raw.status            ?? 'DRAFT',
  requestedBy: raw.requested_by_name ?? raw.requestedBy   ?? '',
  department:  raw.department,
  projectName: raw.project_name      ?? raw.projectName,
  projectCode: raw.project_code      ?? raw.projectCode,
  deliveryLocation: raw.delivery_location ?? raw.deliveryLocation,
  note:        raw.note,
  attachments: (raw.attachments ?? []).map((a: any) => ({
    filePath: a.file_path ?? a.filePath,
    fileName: a.file_name ?? a.fileName,
    fileSize: a.file_size ?? a.fileSize,
    fileType: a.file_type ?? a.fileType,
  })),
  createdAt:   raw.created_at        ?? raw.createdAt     ?? '',
})

const MemoSidebarPanel: React.FC<MemoSidebarPanelProps> = ({
  open, onClose, onApply, selectedMemoId, lockedMemoId, excludePrId, formMemoLineIds, refreshKey = 0,
}) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [size, setSize] = useState<SidebarSize>('compact')
  const [search, setSearch] = useState('')
  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(false)
  const [detailMemo, setDetailMemo] = useState<Memo | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [lines, setLines] = useState<MemoLineRow[]>([])
  const [linesLoading, setLinesLoading] = useState(false)
  // The panel is a live selector; nothing changes on the PR until "Apply selection".
  // Selection is kept as a diff against the PR form: `ticked` = lines ticked that are
  // not on the form yet (to add), `unticked` = form lines the user unticked (to remove).
  const [ticked, setTicked] = useState<number[]>([])
  const [unticked, setUnticked] = useState<number[]>([])

  useEffect(() => {
    if (!open) return
    const fetchMemos = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/memo`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            search: search || undefined,
            status: 'APPROVED',
            exclude_used_by_pr: 'true',
            all_users: 'true',
            page_size: 50,
          },
        })
        const raw = Array.isArray(res.data)
          ? res.data
          : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setMemos(list.map(mapMemo))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูล Memo ไม่สำเร็จ')
        setMemos([])
      } finally {
        setLoading(false)
      }
    }
    fetchMemos()
  }, [open, search, refreshKey])

  const fetchLines = async (memoId: number | string) => {
    setLinesLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/memo/${memoId}/available-lines`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: excludePrId ? { exclude_pr_id: excludePrId } : undefined,
      })
      const raw = res.data?.data ?? res.data
      setLines(Array.isArray(raw) ? raw : [])
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดรายการ Memo ไม่สำเร็จ')
      setLines([])
    } finally {
      setLinesLoading(false)
    }
  }

  const openDetail = async (memo: Memo) => {
    setView('detail')
    setTicked([])
    setUnticked([])
    setDetailLoading(true)
    fetchLines(memo.id)
    try {
      const res = await axios.get(`${BASE_URL}/memo/${memo.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const raw = res.data?.data ?? res.data ?? memo
      setDetailMemo(mapMemo(raw))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดรายละเอียด Memo ไม่สำเร็จ')
      setDetailMemo(memo)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCardClick = (memo: Memo) => openDetail(memo)

  // Every time the panel opens: reset ticks and refetch. Edit mode jumps straight
  // to the PR's own Memo (its list entry may be gone once all its lines are used).
  useEffect(() => {
    if (!open) return
    setTicked([])
    setUnticked([])
    if (lockedMemoId) openDetail({ id: String(lockedMemoId) } as Memo)
    else setView('list')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lockedMemoId])

  // Caller-requested refresh (e.g. after a 409 "line already taken" on save)
  useEffect(() => {
    if (open && view === 'detail' && detailMemo) {
      setTicked([])
      setUnticked([])
      fetchLines(detailMemo.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const formIds = new Set(formMemoLineIds)
  // 'taken'   = used by ANOTHER saved PR (backend taken flag; counts as Used)
  // 'selected'= ticked: on the PR form (saved or not) and not unticked, or newly ticked
  // 'available'= empty, tickable
  type RowState = 'taken' | 'selected' | 'available'
  const stateOf = (l: MemoLineRow): RowState => {
    if (l.taken) return 'taken'
    if (formIds.has(l.id) ? !unticked.includes(l.id) : ticked.includes(l.id)) return 'selected'
    return 'available'
  }
  const selectedCount = lines.filter((l) => stateOf(l) === 'selected').length
  const usedCount = lines.filter((l) => l.taken).length
  // Select-all only touches rows that are neither taken by another PR nor already on the form.
  const selectAllIds = lines.filter((l) => !l.taken && !formIds.has(l.id)).map((l) => l.id)
  const allTicked = selectAllIds.length > 0 && selectAllIds.every((id) => ticked.includes(id))

  const addLines = lines.filter((l) => !l.taken && !formIds.has(l.id) && ticked.includes(l.id))
  const removeIds = lines.filter((l) => !l.taken && formIds.has(l.id) && unticked.includes(l.id)).map((l) => l.id)

  const toggleLine = (l: MemoLineRow, checked: boolean) => {
    if (l.taken) return
    if (formIds.has(l.id)) {
      setUnticked((prev) => (checked ? prev.filter((id) => id !== l.id) : [...prev, l.id]))
    } else {
      setTicked((prev) => (checked ? [...prev, l.id] : prev.filter((id) => id !== l.id)))
    }
  }

  const handleApply = () => {
    if (!detailMemo || (addLines.length === 0 && removeIds.length === 0)) return
    onApply(detailMemo, addLines, removeIds)
    setTicked([])
    setUnticked([])
    setView('list')
    onClose()
  }

  const columns = [
    { title: '#', dataIndex: 'line_no', key: 'no', width: 32, align: 'center' as const },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (v: string, r: MemoLineRow) => {
        const st = stateOf(r)
        return (
          <div style={{ color: st === 'taken' ? '#9ca3af' : undefined }}>
            <div>{v}</div>
            {st === 'taken' && (
              <Tag color="default" style={{ margin: '2px 0 0', fontSize: 11, color: '#374151' }}>
                In {r.taken_by_pr_no ?? `PR #${r.taken_by_pr_id}`}
              </Tag>
            )}
            {st === 'selected' && <Tag color="blue" style={{ margin: '2px 0 0', fontSize: 11 }}>Selected</Tag>}
          </div>
        )
      },
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 52,
      align: 'right' as const,
      render: (v: number) => (v ?? 0).toLocaleString('th-TH'),
    },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 52 },
  ]

  return (
    <div
      style={{
        width: open ? SIDEBAR_WIDTH[size] : 0,
        minWidth: open ? SIDEBAR_WIDTH[size] : 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderLeft: open ? '0.5px solid #dbeafe' : 'none',
        background: '#ffffff',
        boxShadow: open ? '-4px 0 20px rgba(15,45,94,0.06)' : 'none',
        transition: 'width .3s cubic-bezier(.4,0,.2,1), min-width .3s cubic-bezier(.4,0,.2,1)',
        position: 'relative',
      }}
    >
      <div style={{ width: SIDEBAR_WIDTH[size], height: '100%', position: 'relative' }}>

        {/* ── LIST VIEW ── */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 8px' }}>
            <span style={sectionTitleStyle}>Memo Reference</span>
            <Space size={8}>
              <SizeControls size={size} onShrink={() => setSize('compact')} onExpand={() => setSize('expanded')} />
              <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
            </Space>
          </div>

          <div style={{ padding: '0 16px 12px' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              placeholder="ค้นหา Memo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin />
              </div>
            ) : memos.length === 0 ? (
              <Empty description="ไม่พบใบบันทึกขอซื้อ (Memo) ที่อนุมัติแล้ว" />
            ) : (
              memos.map((memo) => (
                <div
                  key={memo.id}
                  onClick={() => handleCardClick(memo)}
                  style={{
                    border: `0.5px solid ${memo.id === selectedMemoId ? '#2563eb' : '#dbeafe'}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    marginBottom: 8,
                    cursor: 'pointer',
                    background: memo.id === selectedMemoId ? '#eff6ff' : 'transparent',
                    transition: 'border-color .15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 12 }}>{memo.memoNo}</span>
                    <MemoStatusBadge status={memo.status} />
                  </div>
                  {(() => {
                    const projectText = [memo.projectCode, memo.projectName].filter(Boolean).join(' ') || '-'
                    return (
                      <div style={{ fontSize: 11, color: '#60a5fa', display: 'flex', minWidth: 0 }}>
                        <Tooltip title={projectText}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {projectText}
                          </span>
                        </Tooltip>
                        <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                          &nbsp;· {memo.createdAt ? dayjs(memo.createdAt).format('DD/MM/YYYY') : '—'}
                        </span>
                      </div>
                    )
                  })()}
                  {(memo as any).total_lines != null && (
                    <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                      remaining {(memo as any).remaining_lines ?? 0} of {(memo as any).total_lines} items
                    </div>
                  )}
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
              {!lockedMemoId && <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={() => setView('list')} />}
              <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 13 }}>{detailMemo?.memoNo}</span>
              {detailMemo && <MemoStatusBadge status={detailMemo.status} />}
            </Space>
            <Space size={8}>
              <SizeControls size={size} onShrink={() => setSize('compact')} onExpand={() => setSize('expanded')} />
              <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
            </Space>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
            <Descriptions column={1} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Requester">{detailMemo?.requestedBy}</Descriptions.Item>
              <Descriptions.Item label="Department">{detailMemo?.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Project Code">{detailMemo?.projectCode || '—'}</Descriptions.Item>
              <Descriptions.Item label="Date">
                {detailMemo?.createdAt ? dayjs(detailMemo.createdAt).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
            </Descriptions>

            {detailMemo?.note && (
              <div style={{ background: '#f0f5ff', borderRadius: 8, padding: 10, fontSize: 12, marginBottom: 12 }}>
                {detailMemo.note}
              </div>
            )}

            {detailMemo?.attachments && detailMemo.attachments.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#60a5fa', marginBottom: 4 }}>
                  ไฟล์แนบจาก Memo
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {detailMemo.attachments.map((f) => (
                    <a
                      key={f.filePath}
                      href={resolveFileUrl(f.filePath)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: '#f0f5ff',
                        border: '0.5px solid #bfdbfe',
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: 12,
                        color: '#1e40af',
                        maxWidth: 240,
                        textDecoration: 'none',
                      }}
                    >
                      <span
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}
                        title={f.fileName}
                      >
                        {f.fileName}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div style={{ borderTop: '0.5px solid #dbeafe', margin: '4px 0 12px' }} />
            <div style={{ ...sectionTitleStyle, marginBottom: 8 }}>Line Items</div>

            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              Selected {selectedCount} of {lines.length} · Used {usedCount}
            </div>
            <Table
              dataSource={lines}
              rowKey="id"
              size="small"
              pagination={false}
              loading={detailLoading || linesLoading}
              scroll={{ x: 400 }}
              columns={columns}
              rowSelection={{
                selectedRowKeys: lines.filter((l) => stateOf(l) !== 'available').map((l) => l.id),
                columnWidth: 36,
                // Header select-all touches only available rows (not taken, not already on the form).
                columnTitle: (
                  <Checkbox
                    checked={allTicked}
                    indeterminate={selectAllIds.some((id) => ticked.includes(id)) && !allTicked}
                    disabled={selectAllIds.length === 0}
                    onChange={(e) => setTicked((prev) => (
                      e.target.checked
                        ? Array.from(new Set([...prev, ...selectAllIds]))
                        : prev.filter((id) => !selectAllIds.includes(id))
                    ))}
                  />
                ),
                getCheckboxProps: (l: MemoLineRow) => ({ disabled: l.taken }),
                onSelect: (l: MemoLineRow, selected: boolean) => toggleLine(l, selected),
              }}
            />
          </div>

          <div style={{ padding: 16, borderTop: '0.5px solid #dbeafe' }}>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              block
              disabled={!detailMemo || linesLoading || (addLines.length === 0 && removeIds.length === 0)}
              onClick={handleApply}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}
            >
              Apply selection (Add {addLines.length} · Remove {removeIds.length})
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default MemoSidebarPanel