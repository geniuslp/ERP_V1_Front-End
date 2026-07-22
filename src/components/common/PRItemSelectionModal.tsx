import React, { useEffect, useState } from 'react'
import { Modal, Table, Checkbox, Tag, Tooltip, Button, Space, Popover, message } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '@/store'
import type { PRLineWithPOStatus, PRPriceHistoryEntry } from '@/types/pr'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

interface Props {
  open: boolean
  prId: number | null
  existingPrLineIds: number[]
  onClose: () => void
  onConfirm: (lines: PRLineWithPOStatus[]) => void
}

type RowState = 'available' | 'partial' | 'taken'

const getRowState = (line: PRLineWithPOStatus): RowState => {
  if (line.qty_remaining <= 0) return 'taken'
  if (line.qty_ordered > 0) return 'partial'
  return 'available'
}

const rowBg: Record<RowState, string | undefined> = {
  available: undefined,
  partial: '#FFFDE7',
  taken: '#F5F5F5',
}

const HISTORY_DISPLAY_LIMIT = 8

const formatCurrency = (v: number) =>
  `฿${v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatShortDate = (d?: string | null) => (d ? dayjs(d).format('DD MMM YYYY') : '-')

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s)

const formatPoNos = (referencedPos: PRLineWithPOStatus['referenced_pos']) =>
  referencedPos?.map((p) => p.po_no).join(', ') || '-'

const PRItemSelectionModal: React.FC<Props> = ({ open, prId, existingPrLineIds, onClose, onConfirm }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [prNo, setPrNo] = useState('')
  const [lines, setLines] = useState<PRLineWithPOStatus[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [openHistoryId, setOpenHistoryId] = useState<number | null>(null)
  const [selectedPrices, setSelectedPrices] = useState<Record<number, number>>({})

  useEffect(() => {
    if (!open || !prId) {
      setLines([])
      setPrNo('')
      setSelectedIds(new Set())
      setOpenHistoryId(null)
      setSelectedPrices({})
      return
    }

    let cancelled = false
    const fetchLines = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/pr/${prId}/lines-with-po-status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const data = res.data?.data ?? res.data
        if (cancelled) return
        setPrNo(data?.pr_no ?? '')
        const rawLines = Array.isArray(data?.lines) ? data.lines : []
        // API keys each line as `pr_line_id`; ensure a stable unique `id`
        // so rowKey and selection don't collide across rows.
        const normalized = rawLines.map((l: any) => ({
          ...l,
          id: l.id ?? l.pr_line_id ?? l.line_no,
        }))
        setLines(normalized)
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'โหลดรายการจาก PR ไม่สำเร็จ'
        message.error(errMsg)
        setLines([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setSelectedIds(new Set())
    fetchLines()
    return () => { cancelled = true }
  }, [open, prId, accessToken])

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
    onConfirm(
      lines
        .filter((l) => selectedIds.has(l.id))
        .map((l) => ({ ...l, selected_unit_price: selectedPrices[l.id] }))
    )
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
          : `This item has already been fully ordered by ${formatPoNos(r.referenced_pos)}`
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
      title: 'Material Code',
      dataIndex: 'mat_code',
      width: 160,
    },
    {
      title: 'Description',
      dataIndex: 'mat_name',
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      width: 80,
      align: 'center' as const,
    },
    {
      title: 'Qty Requested',
      dataIndex: 'qty_requested',
      width: 110,
      align: 'center' as const,
    },
    {
      title: 'Qty Ordered',
      dataIndex: 'qty_ordered',
      width: 110,
      align: 'center' as const,
    },
    {
      title: 'Qty Remaining',
      dataIndex: 'qty_remaining',
      width: 120,
      align: 'center' as const,
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#15803d' : '#dc2626', fontWeight: 600 }}>{v}</span>
      ),
    },
    {
      title: 'Last Price',
      key: 'last_price',
      width: 170,
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
      title: 'Referenced PO(s)',
      dataIndex: 'referenced_pos',
      width: 220,
      render: (_: unknown, r: PRLineWithPOStatus) => {
        const state = getRowState(r)
        const pos = r.referenced_pos ?? []
        const posText = formatPoNos(pos)
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
              <Tag color="red" style={{ margin: 0 }}>Taken</Tag>
            )}
            {state === 'partial' && (
              <>
                <Tag color="orange" style={{ margin: 0 }}>Partial</Tag>
                <span style={{ fontSize: 11, color: '#b45309' }}>
                  Note: {r.qty_ordered} units already ordered by {posText}
                </span>
              </>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <Modal
      title={
        <span style={{ color: '#1e3a8a', fontWeight: 700 }}>
          Select Items from PR: {prNo || '-'}
        </span>
      }
      open={open}
      onCancel={onClose}
      width="min(1357px, 97vw)"
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: 13 }}>
            {selectedIds.size} item(s) selected
          </span>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" disabled={selectedIds.size === 0} onClick={handleConfirm}>
              Confirm Selection
            </Button>
          </Space>
        </div>
      }
    >
      <div style={{ marginBottom: 12, fontSize: 13, color: '#374151' }}>
        Total {lines.length} items — {availableCount} available, {partialCount} partially taken, {takenCount} fully taken
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={lines}
        columns={columns}
        pagination={false}
        size="small"
        scroll={{ x: 1357, y: 560 }}
        onRow={(record) => ({ style: { backgroundColor: rowBg[getRowState(record)] } })}
        locale={{ emptyText: 'ไม่มีรายการในใบขอซื้อนี้' }}
      />
    </Modal>
  )
}

export default PRItemSelectionModal
