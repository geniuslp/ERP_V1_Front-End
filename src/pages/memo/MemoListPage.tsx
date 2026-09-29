import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Select, DatePicker, Button, Space, Tooltip, Popconfirm, message } from 'antd'
import {
  SearchOutlined, ReloadOutlined, EyeOutlined,
  EditOutlined, FileAddOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import PageHeader from '@/components/common/PageHeader'
import { ROUTES } from '@/config/routes'
import { useAppSelector } from '@/store'
import type { Memo, MemoStatus } from '@/types'
import { ROW_TINT_CLASS } from '@/constants/rowTint'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

// Row tint by status — mapping unchanged, only the shared palette (src/index.css's
// .row-tint-* classes, see src/constants/rowTint.ts) changed. Only the 3 statuses
// below get a tint; DRAFT/CANCELLED are left plain. "Rejected" also covers a
// would-be "partial" bucket since Memo has no such status in the real DB enum
// (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED only).
const ROW_TINT_CATEGORY: Record<string, string> = {
  PENDING_APPROVAL: ROW_TINT_CLASS.gray,
  APPROVED:         ROW_TINT_CLASS.green,
  REJECTED:         ROW_TINT_CLASS.red,
}
const getRowClassName = (status?: string): string => ROW_TINT_CATEGORY[status ?? ''] ?? ''

const MEMO_NO_COLUMN_DEFAULT_WIDTH = 180
const TITLE_COLUMN_DEFAULT_WIDTH = 280
const PROJECT_COLUMN_DEFAULT_WIDTH = 240
const REQUESTED_BY_COLUMN_DEFAULT_WIDTH = 140
const APPROVER_COLUMN_DEFAULT_WIDTH = 140
const APPROVED_AT_COLUMN_DEFAULT_WIDTH = 150
const CREATED_AT_COLUMN_DEFAULT_WIDTH = 120
const ACTIONS_COLUMN_DEFAULT_WIDTH = 140

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

const mapMemo = (m: any): Memo => ({
  ...m,
  id:           String(m.id),
  memoNo:       m.memo_no         ?? m.memoNo        ?? '',
  title:        m.title           ?? '',
  requestedBy:  m.requested_by_name ?? m.requestedBy ?? '',
  approverName: m.approver_name     ?? m.approverName ?? undefined,
  projectCode:  m.project_code    ?? m.projectCode    ?? undefined,
  projectName:  m.project_name    ?? m.projectName    ?? undefined,
  supplierName: m.supplier_code   ?? m.supplier_name ?? m.supplierName  ?? undefined,
  status:       m.status          ?? 'DRAFT',
  createdAt:    m.created_at      ?? m.createdAt     ?? '',
  updatedAt:    m.updated_at      ?? m.updatedAt     ?? '',
  approvedAt:   m.approved_at     ?? m.approvedAt    ?? null,
})

const MemoListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<Memo[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<MemoStatus | undefined>(undefined)
  const [range, setRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)

  // Resizable widths for "เลขที่ Memo" / "หัวข้อ / เรื่อง" / "โครงการ" — same
  // pattern as POStatusPage.tsx / PRStatusPage.tsx, not persisted (resets on refresh).
  const [memoNoColWidth, setMemoNoColWidth] = useState(MEMO_NO_COLUMN_DEFAULT_WIDTH)
  const [titleColWidth, setTitleColWidth] = useState(TITLE_COLUMN_DEFAULT_WIDTH)
  const [projectColWidth, setProjectColWidth] = useState(PROJECT_COLUMN_DEFAULT_WIDTH)
  const [requestedByColWidth, setRequestedByColWidth] = useState(REQUESTED_BY_COLUMN_DEFAULT_WIDTH)
  const [approverColWidth, setApproverColWidth] = useState(APPROVER_COLUMN_DEFAULT_WIDTH)
  const [approvedAtColWidth, setApprovedAtColWidth] = useState(APPROVED_AT_COLUMN_DEFAULT_WIDTH)
  const [createdAtColWidth, setCreatedAtColWidth] = useState(CREATED_AT_COLUMN_DEFAULT_WIDTH)
  const [actionsColWidth, setActionsColWidth] = useState(ACTIONS_COLUMN_DEFAULT_WIDTH)
  const handleMemoNoColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setMemoNoColWidth(data.size.width)
  }
  const handleTitleColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setTitleColWidth(data.size.width)
  }
  const handleProjectColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setProjectColWidth(data.size.width)
  }
  const handleRequestedByColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setRequestedByColWidth(data.size.width)
  }
  const handleApproverColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setApproverColWidth(data.size.width)
  }
  const handleApprovedAtColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setApprovedAtColWidth(data.size.width)
  }
  const handleCreatedAtColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setCreatedAtColWidth(data.size.width)
  }
  const handleActionsColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setActionsColWidth(data.size.width)
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/memo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          search: search || undefined,
          status:  status  || undefined,
          date_from: range?.[0] ? range[0].format('YYYY-MM-DD') : undefined,
          date_to:   range?.[1] ? range[1].format('YYYY-MM-DD') : undefined,
        },
      })
      // backend returns { success, data: { data: [...], total, page, ... } }
      const raw = Array.isArray(res.data)
        ? res.data
        : res.data?.data?.data ?? res.data?.data ?? []
      const list = Array.isArray(raw) ? raw : []
      setData(list.map(mapMemo))
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'โหลดข้อมูลใบบันทึกขอซื้อ (Memo) ไม่สำเร็จ'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${BASE_URL}/memo/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('ลบใบบันทึกขอซื้อ (Memo) สำเร็จ')
      fetchData()
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'ลบใบบันทึกขอซื้อ (Memo) ไม่สำเร็จ'
      )
    }
  }

  const handleReset = () => {
    setSearch('')
    setStatus(undefined)
    setRange(null)
  }

  useEffect(() => {
    fetchData()
  }, [search, status, range])

  const columns = [
    {
      title: 'เลขที่ใบบันทึกขอซื้อ (Memo)',
      dataIndex: 'memoNo',
      key: 'memoNo',
      width: memoNoColWidth,
      onHeaderCell: () => ({
        width: memoNoColWidth,
        onResize: handleMemoNoColResize,
      }),
      render: (memoNo: string, record: Memo) => (
        <a
          style={{ color: '#2563eb', fontWeight: 600 }}
          onClick={() => navigate(ROUTES.MEMO.DETAIL.replace(':id', record.id))}
        >
          {memoNo}
        </a>
      ),
    },
    {
      title: 'หัวข้อ / เรื่อง',
      dataIndex: 'title',
      key: 'title',
      width: titleColWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        width: titleColWidth,
        onResize: handleTitleColResize,
      }),
    },
    {
      title: 'โครงการ',
      key: 'projectName',
      width: projectColWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        width: projectColWidth,
        onResize: handleProjectColResize,
      }),
      // On-screen display convention (per PR/PO/Memo consistency pass): "{code} {name}",
      // a single space, no dash — the dash format is reserved for print pages only.
      render: (_: unknown, record: Memo) => {
        const label = [record.projectCode, record.projectName].filter(Boolean).join(' ')
        return label || <span style={{ color: '#9ca3af' }}>—</span>
      },
    },
    {
      title: 'ผู้สร้าง',
      dataIndex: 'requestedBy',
      key: 'requestedBy',
      width: requestedByColWidth,
      onHeaderCell: () => ({
        width: requestedByColWidth,
        onResize: handleRequestedByColResize,
      }),
    },
    {
      title: 'ผู้อนุมัติ',
      dataIndex: 'approverName',
      key: 'approverName',
      width: approverColWidth,
      onHeaderCell: () => ({
        width: approverColWidth,
        onResize: handleApproverColResize,
      }),
      render: (val?: string) => val || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'วันที่อนุมัติ',
      dataIndex: 'approvedAt',
      key: 'approvedAt',
      width: approvedAtColWidth,
      onHeaderCell: () => ({
        width: approvedAtColWidth,
        onResize: handleApprovedAtColResize,
      }),
      render: (val?: string | null) => val ? dayjs(val).format('DD/MM/YYYY HH:mm') : '—',
    },
    {
      title: 'วันที่สร้าง',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: createdAtColWidth,
      onHeaderCell: () => ({
        width: createdAtColWidth,
        onResize: handleCreatedAtColResize,
      }),
      render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'จัดการ',
      key: 'actions',
      width: actionsColWidth,
      onHeaderCell: () => ({
        width: actionsColWidth,
        onResize: handleActionsColResize,
      }),
      render: (_: any, record: Memo) => (
        <Space>
          <Tooltip title="ดู">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(ROUTES.MEMO.DETAIL.replace(':id', record.id))}
            />
          </Tooltip>
          <Tooltip title="แก้ไข">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(ROUTES.MEMO.EDIT.replace(':id', record.id))}
            />
          </Tooltip>
          {(record.status === 'PENDING_PO' || record.status === 'pending_po') && (
            <Tooltip title="สร้าง PO">
              <Button
                size="small"
                icon={<FileAddOutlined />}
                onClick={() =>
                  navigate(ROUTES.PO.CREATE, { state: { fromMemoId: record.id, memo: record } })
                }
              />
            </Tooltip>
          )}
          <Popconfirm
            title="ยืนยันการลบใบบันทึกขอซื้อ (Memo) นี้?"
            okText="ลบ"
            cancelText="ยกเลิก"
            disabled={record.status === 'PO_CREATED' || record.status === 'po_created'}
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip
              title={
                record.status === 'PO_CREATED' || record.status === 'po_created'
                  ? 'สร้าง PO แล้ว ไม่สามารถลบได้'
                  : 'ลบ'
              }
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={record.status === 'PO_CREATED' || record.status === 'po_created'}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ตรวจสอบสถานะ Memo"
        subtitle="ติดตามสถานะใบบันทึกขอซื้อ (Memo) ทั้งหมด"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบบันทึกขอซื้อ (Memo)' }, { title: 'ตรวจสอบสถานะ' }]}
      />

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, width: '100%', flexWrap: 'wrap' }}>
          <Input
            placeholder="ค้นหาเลขที่/หัวข้อ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="สถานะ"
            value={status}
            onChange={setStatus}
            allowClear
            style={{ width: 180 }}
            options={[
              { value: 'DRAFT',            label: 'ร่าง' },
              { value: 'PENDING_APPROVAL', label: 'รอการอนุมัติ' },
              { value: 'APPROVED',         label: 'อนุมัติแล้ว' },
              { value: 'REJECTED',         label: 'ถูกปฏิเสธ' },
              { value: 'CANCELLED',        label: 'ยกเลิก' },
            ]}
          />
          <DatePicker.RangePicker
            value={range as any}
            onChange={(v) => setRange(v as any)}
            format="DD/MM/YYYY"
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>
            ค้นหา
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            รีเซต
          </Button>
        </Space>

        <Space size={16} style={{ marginBottom: 12 }}>
          <Space size={6}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: '#e5e7eb', border: '1px solid #8c8c8c', display: 'inline-block' }} />
            <span style={{ fontSize: 13, color: '#595959' }}>รออนุมัติ</span>
          </Space>
          <Space size={6}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: '#d9f7be', border: '1px solid #52c41a', display: 'inline-block' }} />
            <span style={{ fontSize: 13, color: '#595959' }}>อนุมัติแล้ว</span>
          </Space>
          <Space size={6}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: '#ffccc7', border: '1px solid #f5222d', display: 'inline-block' }} />
            <span style={{ fontSize: 13, color: '#595959' }}>ถูกปฏิเสธ</span>
          </Space>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          components={{ header: { cell: ResizableTitle } }}
          dataSource={data}
          scroll={{ x: 1300 }}
          rowClassName={(record) => getRowClassName(record.status)}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `ทั้งหมด ${total} รายการ`,
          }}
          locale={{ emptyText: 'ไม่พบข้อมูลใบบันทึกขอซื้อ (Memo)' }}
        />
      </Card>
    </div>
  )
}

export default MemoListPage