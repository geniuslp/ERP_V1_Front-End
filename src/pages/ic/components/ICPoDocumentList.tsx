import React, { useEffect, useState } from 'react'
import { Table, Button, Spin, Space, Tag, Tooltip, Typography, Popconfirm, message } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import { useAppSelector } from '@/store'
import { icActionButtonProps } from '@/pages/ic/utils/actionButtonStyle'
import ICDocTypeTag from './ICDocTypeTag'
import ICPoInfoStrip from './ICPoInfoStrip'

const { Text } = Typography

const BASE_URL = (import.meta as any).env?.VITE_API_URL
const DATE_FORMAT = 'YYYY-MM-DD'

// One row of GET /ic/pos/:poId/documents (receives and returns together, newest first).
export interface ICPoDocRow {
  doc_type: 'RECEIVE' | 'RETURN' | string
  id: number
  doc_no?: string | null
  created_at: string
  created_by_name?: string | null
  line_count: number
  total_qty?: number | null
  /** Receive rows: which reference the API picked for ref_no / ref_date (rule lives on the backend). */
  ref_kind?: 'TAX_INVOICE' | 'TEMP_DELIVERY' | string | null
  ref_no?: string | null
  ref_date?: string | null
  tax_invoice_no?: string | null
  tax_invoice_date?: string | null
  due_date?: string | null
  return_date?: string | null
  deletable?: boolean
}

const extractRows = (payload: any): ICPoDocRow[] => {
  if (Array.isArray(payload)) return payload
  const list = payload?.documents ?? payload?.items
  return Array.isArray(list) ? list : []
}

const formatQty = (value: number) =>
  value.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const fmtDate = (v?: string | null) => (v ? dayjs(v).format(DATE_FORMAT) : '-')

interface Props {
  poId: number | null
  /** Which modal this is: only the create button and the remaining-qty text differ. */
  mode: 'receive' | 'return'
  /** Change this value to re-fetch the list (e.g. after creating / deleting a document). */
  refreshToken?: unknown
  remainingText: string
  canCreate: boolean
  createTooltip?: string
  onCreate: () => void
  /** Extra spinner (e.g. the modal's own remaining-qty request). */
  loadingExtra?: boolean
  fallbackPoNo?: string | null
  fallbackProject?: string | null
  /** Click on a receive row. Omit to make receive rows non-clickable. */
  onOpenReceive?: (row: ICPoDocRow) => void
  onOpenReturn: (row: ICPoDocRow) => void
  /** Receive rows only, when the API marks them deletable. */
  onDeleteReceive?: (row: ICPoDocRow) => void
}

/** The list shared by "ใบรับของ - PO" and "ใบคืนของ - PO": identical table in both modes. */
const ICPoDocumentList: React.FC<Props> = ({
  poId, mode, refreshToken, remainingText, canCreate, createTooltip, onCreate, loadingExtra,
  fallbackPoNo, fallbackProject, onOpenReceive, onOpenReturn, onDeleteReceive,
}) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [rows, setRows] = useState<ICPoDocRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!poId) return
    let cancelled = false
    setLoading(true)
    axios
      .get(`${BASE_URL}/ic/pos/${poId}/documents`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => { if (!cancelled) setRows(extractRows(res.data?.data ?? res.data)) })
      .catch((err) => {
        if (!cancelled) message.error(err?.response?.data?.message || err?.message || 'โหลดรายการเอกสารไม่สำเร็จ')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId, refreshToken])

  const isReceive = (r: ICPoDocRow) => r.doc_type !== 'RETURN'

  const columns = [
    {
      title: 'เลขที่เอกสาร',
      key: 'doc_no',
      render: (_: unknown, r: ICPoDocRow) => (
        <Space size={6}>
          <span>{r.doc_no || '-'}</span>
          <ICDocTypeTag docType={r.doc_type} />
        </Space>
      ),
    },
    {
      title: 'เลขที่ใบกำกับภาษี',
      key: 'tax_invoice_no',
      render: (_: unknown, r: ICPoDocRow) => {
        if (!isReceive(r) || !r.ref_no) return '-'
        return (
          <Space size={6}>
            <span>{r.ref_no}</span>
            {r.ref_kind === 'TEMP_DELIVERY' && (
              <Tag style={{ margin: 0, fontSize: 11, color: '#6b7280', background: '#f3f4f6', borderColor: '#e5e7eb' }}>
                ใบส่งของชั่วคราว
              </Tag>
            )}
          </Space>
        )
      },
    },
    {
      title: 'วันที่เอกสาร',
      key: 'doc_date',
      render: (_: unknown, r: ICPoDocRow) => fmtDate(isReceive(r) ? r.ref_date : r.return_date),
    },
    {
      title: 'วันครบกำหนด',
      key: 'due_date',
      render: (_: unknown, r: ICPoDocRow) => (isReceive(r) ? fmtDate(r.due_date) : '-'),
    },
    {
      title: 'วันที่สร้าง',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'ผู้สร้าง',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      render: (v: string | null | undefined) => v || '-',
    },
    {
      title: 'จำนวนรายการ',
      dataIndex: 'line_count',
      key: 'line_count',
      align: 'right' as const,
    },
    {
      title: 'จำนวน',
      key: 'total_qty',
      align: 'right' as const,
      render: (_: unknown, r: ICPoDocRow) => {
        if (r.total_qty == null) return '-'
        return isReceive(r) ? (
          <span style={{ color: '#16a34a', fontWeight: 600 }}>+{formatQty(r.total_qty)}</span>
        ) : (
          <span style={{ color: '#dc2626', fontWeight: 600 }}>−{formatQty(Math.abs(r.total_qty))}</span>
        )
      },
    },
    ...(onDeleteReceive
      ? [{
          title: '',
          key: 'action',
          width: 60,
          align: 'center' as const,
          render: (_: unknown, r: ICPoDocRow) =>
            isReceive(r) && r.deletable ? (
              <Popconfirm
                title="ลบใบรับนี้?"
                okText="ลบ"
                cancelText="ยกเลิก"
                onConfirm={(e) => { e?.stopPropagation(); onDeleteReceive(r) }}
                onCancel={(e) => e?.stopPropagation()}
              >
                <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
              </Popconfirm>
            ) : null,
        }]
      : []),
  ]

  return (
    <Spin spinning={loading || !!loadingExtra}>
      <ICPoInfoStrip poId={poId} fallbackPoNo={fallbackPoNo} fallbackProject={fallbackProject} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text type="secondary">{remainingText}</Text>
        <Tooltip title={!canCreate ? createTooltip : undefined}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canCreate}
            onClick={onCreate}
            {...icActionButtonProps(mode, !canCreate)}
          >
            {mode === 'receive' ? 'สร้างใบรับใหม่' : 'สร้างใบคืนใหม่'}
          </Button>
        </Tooltip>
      </div>
      <Table
        rowKey={(r) => `${r.doc_type}-${r.id}`}
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: 'ยังไม่มีเอกสารรับ/คืนของ PO นี้' }}
        onRow={(record) => {
          const receive = isReceive(record)
          const clickable = receive ? !!onOpenReceive : true
          return {
            onClick: () => {
              if (receive) onOpenReceive?.(record)
              else onOpenReturn(record)
            },
            // Return rows get a light amber tint so the direction is visible at a glance.
            style: { cursor: clickable ? 'pointer' : 'default', backgroundColor: receive ? undefined : '#fffbeb' },
          }
        }}
      />
    </Spin>
  )
}

export default ICPoDocumentList
