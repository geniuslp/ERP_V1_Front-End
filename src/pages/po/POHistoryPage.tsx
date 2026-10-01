import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, message, Tag, Typography, Tooltip, Popconfirm, Select } from 'antd'
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import type { POListItem } from '@/types/po'
import { poApprovalService } from '@/services/poApprovalService'
import POStatusBadges from '@/components/po/POStatusBadge'
import { formatPoNoWithRevision } from '@/utils/poNo'
import EditApprovedButton from '@/pages/po/components/EditApprovedButton'
import { ROW_TINT_CLASS } from '@/constants/rowTint'
import { ORDER_TYPE_LABEL, ORDER_TYPE_OPTIONS, isOhOrderType } from '@/constants/orderTypes'

// Same convention as POStatusPage.tsx — edit is gated by the create page's
// own menu code, not a history-specific one.
const MENU_CODE = 'MENU_PO_CREATE'
const BASE_URL = (import.meta as any).env?.VITE_API_URL
const { Text } = Typography

// Row tint — mapping unchanged, only the shared palette (src/index.css's
// .row-tint-* classes, see src/constants/rowTint.ts) changed. Order matters:
// the first matching rule wins when a PO could match more than one (e.g. a
// PARTIALLY_RECEIVED PO that is also PENDING_REAPPROVAL). No legend/label text
// on screen, background tint only, same approach as MemoListPage.tsx / PRHistoryPage.tsx.
const getRowClassName = (record: POListItem): string => {
  if (record.status_receive === 'PARTIALLY_RECEIVED') return ROW_TINT_CLASS.orange
  if (record.status === 'PENDING_APPROVAL' || record.status === 'PENDING_REAPPROVAL') {
    return ROW_TINT_CLASS.gray
  }
  if (record.status_receive === 'RECEIVED') return ROW_TINT_CLASS.green
  return ''
}

const PROJECT_COLUMN_DEFAULT_WIDTH = 140
const SUPPLIER_COLUMN_DEFAULT_WIDTH = 160
const ACTION_COLUMN_DEFAULT_WIDTH = 220
const PO_DATE_COLUMN_DEFAULT_WIDTH = 120
const APPROVED_AT_COLUMN_DEFAULT_WIDTH = 150
const EXPECTED_DATE_COLUMN_DEFAULT_WIDTH = 120
const APPROVED_BY_COLUMN_DEFAULT_WIDTH = 140

// Same react-resizable pattern as POStatusPage.tsx / PRStatusPage.tsx / PRHistoryPage.tsx —
// only columns that pass width/onResize via onHeaderCell get a drag handle; every
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

const POHistoryPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [items, setItems] = useState<POListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [orderTypeFilter, setOrderTypeFilter] = useState<string | undefined>(undefined)

  // Resizable widths for "โครงการ" / "ผู้ขาย" — same pattern as POStatusPage.tsx,
  // not persisted (resets on refresh).
  const [projectColWidth, setProjectColWidth] = useState(PROJECT_COLUMN_DEFAULT_WIDTH)
  const [supplierColWidth, setSupplierColWidth] = useState(SUPPLIER_COLUMN_DEFAULT_WIDTH)
  const handleProjectColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setProjectColWidth(data.size.width)
  }
  const handleSupplierColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setSupplierColWidth(data.size.width)
  }
  const [actionColWidth, setActionColWidth] = useState(ACTION_COLUMN_DEFAULT_WIDTH)
  const handleActionColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setActionColWidth(data.size.width)
  }
  const [poDateColWidth, setPoDateColWidth] = useState(PO_DATE_COLUMN_DEFAULT_WIDTH)
  const handlePoDateColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setPoDateColWidth(data.size.width)
  }
  const [approvedAtColWidth, setApprovedAtColWidth] = useState(APPROVED_AT_COLUMN_DEFAULT_WIDTH)
  const handleApprovedAtColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setApprovedAtColWidth(data.size.width)
  }
  const [expectedDateColWidth, setExpectedDateColWidth] = useState(EXPECTED_DATE_COLUMN_DEFAULT_WIDTH)
  const handleExpectedDateColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setExpectedDateColWidth(data.size.width)
  }
  const [approvedByColWidth, setApprovedByColWidth] = useState(APPROVED_BY_COLUMN_DEFAULT_WIDTH)
  const handleApprovedByColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setApprovedByColWidth(data.size.width)
  }

  const fetchData = async (p = page, l = limit) => {
    setLoading(true)
    try {
      const res = await poApprovalService.getList(accessToken, { page: p, page_size: l, order_type: orderTypeFilter })
      const data = res.data.data
      setItems(Array.isArray(data.data) ? data.data : [])
      setTotal(data.total ?? 0)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(page, limit) }, [page, limit, orderTypeFilter])

  const handleDelete = async (poId: number) => {
    try {
      await axios.delete(`${BASE_URL}/po/${poId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('ลบใบสั่งซื้อสำเร็จ')
      // Stay on the current page after refresh, unless the deleted row was the
      // last one on this page — then step back one page (which refetches via
      // the [page, limit] effect above).
      if (items.length === 1 && page > 1) {
        setPage(page - 1)
      } else {
        fetchData(page, limit)
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'ลบใบสั่งซื้อไม่สำเร็จ')
    }
  }

  const columns: ColumnsType<POListItem> = [
    {
      title: 'เลขที่ PO',
      dataIndex: 'po_no',
      key: 'po_no',
      render: (v: string, record) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/po/approval/${record.po_id}`)}>
          {formatPoNoWithRevision(v, record.revision_round)}
        </a>
      ),
    },
    {
      title: 'เลข PR',
      key: 'pr_nos',
      width: 130,
      ellipsis: true,
      render: (_: unknown, r) => {
        const v = r.pr_nos?.join(', ') || '—'
        return (
          <Tooltip title={v}>
            <span>{v}</span>
          </Tooltip>
        )
      },
    },
    {
      title: 'ผู้ขาย',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: supplierColWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        width: supplierColWidth,
        onResize: handleSupplierColResize,
      }),
    },
    {
      // On-screen display convention (per PR/PO/Memo consistency pass): "{code} {name}",
      // a single space, no dash — the dash format is reserved for print pages only.
      title: 'โครงการ',
      key: 'project_code',
      width: projectColWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        width: projectColWidth,
        onResize: handleProjectColResize,
      }),
      render: (_: unknown, r) => {
        const label = [r.project_code, r.project_name].filter(Boolean).join(' ')
        return label ? (
          <Tooltip title={label}>
            <span>{label}</span>
          </Tooltip>
        ) : '-'
      },
    },
    {
      // Confirmed against the live API response: GET /po (list) returns the
      // job classification as `job_code` (e.g. "MP"), not `job_names` — the
      // previous job_names-based render always showed "-" because that field
      // is never populated by the backend. Display-only: show just the short
      // code, not the full "CODE - Name" label (JOB_TYPES.label is formatted
      // that way) — split on " - " defensively in case job_code itself ever
      // comes back combined, and take only the code part before it. Same
      // implementation as POStatusPage.tsx's "งาน" column, for consistency.
      title: 'งาน',
      dataIndex: 'job_code',
      key: 'job_code',
      width: 90,
      align: 'center',
      render: (v?: string) => {
        if (!v) return <Text type="secondary">-</Text>
        const code = v.split(' - ')[0].trim()
        return (
          <Tag color="geekblue" style={{ margin: 0, fontSize: 13 }}>
            {code}
          </Tag>
        )
      },
    },
    {
      title: 'ประเภทการสั่งซื้อ',
      dataIndex: 'order_type',
      key: 'order_type',
      width: 150,
      render: (v?: string) =>
        v ? <Tag color="blue" style={{ margin: 0 }}>{ORDER_TYPE_LABEL[v] ?? v}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (_v: unknown, r) => <POStatusBadges status={r.status} statusReceive={r.status_receive} orderType={r.order_type} />,
    },
    {
      // total_amount - discount_amount = after-discount, before VAT/WHT.
      // net_amount already bakes in VAT/WHT — same fix as POStatusPage, kept
      // consistent across both pages since they read the same GET /po response.
      title: 'มูลค่า (หลังหักส่วนลด)',
      key: 'amount_after_discount',
      align: 'right',
      render: (_: unknown, r) =>
        `${(r.total_amount - (r.discount_amount ?? 0)).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
    },
    {
      title: 'แก้ไขล่าสุดโดย',
      key: 'last_edited_by',
      render: (_: unknown, r) => {
        const name =
          r.updated_by_name && r.updated_by_name !== r.created_by_name
            ? r.updated_by_name
            : r.created_by_name
        return name || '-'
      },
    },
    {
      title: 'วันที่เปิด PO',
      dataIndex: 'po_date',
      key: 'po_date',
      width: poDateColWidth,
      onHeaderCell: () => ({
        width: poDateColWidth,
        onResize: handlePoDateColResize,
      }),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    {
      // approved_at — nullable ISO timestamp of the latest APPROVE action from
      // approval_log (GET /po list, confirmed present). Date + time, not just date.
      title: 'วันที่อนุมัติ PO',
      dataIndex: 'approved_at',
      key: 'approved_at',
      width: approvedAtColWidth,
      onHeaderCell: () => ({
        width: approvedAtColWidth,
        onResize: handleApprovedAtColResize,
      }),
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—',
    },
    {
      title: 'กำหนดส่งของ',
      dataIndex: 'expected_date',
      key: 'expected_date',
      width: expectedDateColWidth,
      onHeaderCell: () => ({
        width: expectedDateColWidth,
        onResize: handleExpectedDateColResize,
      }),
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'ผู้อนุมัติ',
      dataIndex: 'approved_by_name',
      key: 'approved_by_name',
      width: approvedByColWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        width: approvedByColWidth,
        onResize: handleApprovedByColResize,
      }),
      render: (v: string | null) => v || '—',
    },
    {
      title: 'หมายเหตุ PO',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 180,
      ellipsis: true,
      render: (v: string | null | undefined) => (
        <Tooltip title={v || undefined}>
          <span>{v || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: 'จัดการ',
      key: 'action',
      width: actionColWidth,
      onHeaderCell: () => ({
        width: actionColWidth,
        onResize: handleActionColResize,
      }),
      render: (_: unknown, record) => (
        <Space>
          <Tooltip title="ดูรายละเอียด">
            <Button
              icon={<EyeOutlined />}
              size="small"
              onClick={() => navigate(`/po/approval/${record.po_id}`)}
            />
          </Tooltip>
          {(record.status === 'DRAFT' || record.status === 'PENDING_APPROVAL') && (
            <Tooltip title="แก้ไข">
              <PermissionButton
                menuCode={MENU_CODE}
                action="edit"
                icon={<EditOutlined />}
                size="small"
                onClick={() => navigate(`/po/${record.po_id}/edit`)}
              />
            </Tooltip>
          )}
          {record.status === 'DRAFT' && (record.status_receive === 'NOT_SENT' || isOhOrderType(record.order_type)) && (
            <Popconfirm
              title="ต้องการลบเอกสารนี้ใช่หรือไม่"
              okText="ลบ"
              cancelText="ยกเลิก"
              onConfirm={() => handleDelete(record.po_id)}
            >
              <Tooltip title="ลบ">
                <PermissionButton
                  menuCode={MENU_CODE}
                  action="delete"
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                />
              </Tooltip>
            </Popconfirm>
          )}
          {/* Same reasoning as POStatusPage.tsx — record.can_edit_approved is
              never actually set by GET /po (list), so check status + the
              1-year window directly off record.created_at instead. */}
          {(record.status === 'APPROVED' || record.status === 'PENDING_REAPPROVAL') &&
            (record.created_at
              ? Date.now() - new Date(record.created_at).getTime() < 365 * 24 * 60 * 60 * 1000
              : false) && (
              <EditApprovedButton poId={record.po_id} poNo={record.po_no} menuCode={MENU_CODE} size="small" />
            )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ประวัติใบสั่งซื้อ"
        subtitle="ประวัติ PO ที่ดำเนินการเสร็จสิ้นแล้ว"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบสั่งซื้อ' }, { title: 'ประวัติ' }]}
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
          rowKey="po_id"
          loading={loading}
          dataSource={items}
          columns={columns}
          components={{ header: { cell: ResizableTitle } }}
          rowClassName={(record) => getRowClassName(record)}
          size="small"
          scroll={{ x: 2350 }}
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

export default POHistoryPage
