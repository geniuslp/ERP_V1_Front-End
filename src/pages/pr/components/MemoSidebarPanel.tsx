import React, { useEffect, useState } from 'react'
import { Input, Table, Button, Descriptions, Empty, Spin, Space, Tag, Tooltip } from 'antd'
import {
  CloseOutlined, ArrowLeftOutlined, CheckOutlined, SearchOutlined,
  ExpandOutlined, ShrinkOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import MemoStatusBadge from '@/pages/memo/components/MemoStatusBadge'
import { mockMemos } from '@/utils/mockData'
import { useAppSelector } from '@/store'
import type { Memo, MemoItem } from '@/types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

type SidebarSize = 'compact' | 'expanded'

const SIDEBAR_WIDTH: Record<SidebarSize, number> = {
  compact: 280,
  expanded: 480,
}

interface MemoSidebarPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (memo: Memo) => void
  selectedMemoId?: string
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

const MemoSidebarPanel: React.FC<MemoSidebarPanelProps> = ({ open, onClose, onSelect, selectedMemoId }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [size, setSize] = useState<SidebarSize>('compact')
  const [search, setSearch] = useState('')
  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(false)
  const [detailMemo, setDetailMemo] = useState<Memo | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const fetchMemos = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/memo`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { search: search || undefined, status: 'APPROVED', page_size: 50 },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setMemos(list.length ? list : mockMemos)
      } catch {
        setMemos(mockMemos)
      } finally {
        setLoading(false)
      }
    }
    fetchMemos()
  }, [open, search])

  const handleCardClick = async (memo: Memo) => {
    setView('detail')
    setDetailLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/memo/${memo.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      setDetailMemo(res.data?.data ?? res.data ?? memo)
    } catch {
      setDetailMemo(memo)
    } finally {
      setDetailLoading(false)
    }
  }

  const columns = [
    { title: '#', key: 'no', width: 36, align: 'center' as const, render: (_: any, __: any, idx: number) => idx + 1 },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 52,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('th-TH'),
    },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 52 },
    {
      title: 'Est. Price',
      dataIndex: 'estimatedPrice',
      key: 'estimatedPrice',
      width: 80,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 84,
      align: 'right' as const,
      render: (_: any, record: MemoItem) => (
        <span style={{ fontWeight: 500 }}>
          {(record.quantity * record.estimatedPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
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
              <Empty description="ไม่พบใบบันทึก" />
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
                  <div style={{ fontSize: 13, marginBottom: 2 }}>{memo.title}</div>
                  <div style={{ fontSize: 11, color: '#60a5fa' }}>
                    {memo.requestedBy} · {dayjs(memo.createdAt).format('DD/MM/YYYY')}
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
              <Descriptions.Item label="Project">{detailMemo?.projectName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Date">
                {detailMemo ? dayjs(detailMemo.createdAt).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
            </Descriptions>

            {detailMemo?.note && (
              <div style={{ background: '#f0f5ff', borderRadius: 8, padding: 10, fontSize: 12, marginBottom: 12 }}>
                {detailMemo.note}
              </div>
            )}

            <div style={{ borderTop: '0.5px solid #dbeafe', margin: '4px 0 12px' }} />
            <div style={{ ...sectionTitleStyle, marginBottom: 8 }}>Line Items</div>

            <Table
              dataSource={detailMemo?.items ?? []}
              rowKey="id"
              size="small"
              pagination={false}
              loading={detailLoading}
              scroll={{ x: 400 }}
              columns={columns}
              summary={() => {
                const total = (detailMemo?.items ?? []).reduce(
                  (s, it) => s + it.quantity * it.estimatedPrice, 0
                )
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5} align="right">
                      <span style={{ fontSize: 12, color: '#64748b' }}>Total Est. Amount</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <span style={{ fontWeight: 500, color: '#1e40af' }}>
                        {total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )
              }}
            />
          </div>

          <div style={{ padding: 16, borderTop: '0.5px solid #dbeafe' }}>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              block
              disabled={!detailMemo}
              onClick={() => {
                if (detailMemo) {
                  onSelect(detailMemo)
                  setView('list')
                }
              }}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}
            >
              Use this Memo
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default MemoSidebarPanel
