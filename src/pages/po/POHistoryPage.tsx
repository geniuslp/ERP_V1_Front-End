import React, { useEffect, useState } from 'react'
import { Card, Table, Button, message, Tag, Typography, Tooltip } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import type { POListItem } from '@/types/po'
import { poApprovalService } from '@/services/poApprovalService'
import POStatusBadges from '@/components/po/POStatusBadge'
import { formatPoNoWithRevision } from '@/utils/poNo'

const { Text } = Typography

const PROJECT_COLUMN_DEFAULT_WIDTH = 140
const SUPPLIER_COLUMN_DEFAULT_WIDTH = 160

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

  const fetchData = async (p = page, l = limit) => {
    setLoading(true)
    try {
      const res = await poApprovalService.getList(accessToken, { page: p, page_size: l })
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

  useEffect(() => { fetchData(page, limit) }, [page, limit])

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
      title: 'โครงการ',
      dataIndex: 'project_code',
      key: 'project_code',
      width: projectColWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        width: projectColWidth,
        onResize: handleProjectColResize,
      }),
      render: (v?: string) => v || '-',
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
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (_v: unknown, r) => <POStatusBadges status={r.status} statusReceive={r.status_receive} />,
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
      title: 'วันที่สั่ง',
      dataIndex: 'po_date',
      key: 'po_date',
      render: (v: string) => v?.slice(0, 10) ?? '-',
    },
    {
      title: 'กำหนดส่ง',
      dataIndex: 'expected_date',
      key: 'expected_date',
      render: (v: string | null) => v?.slice(0, 10) ?? '-',
    },
    // NOTE: GET /po's response (POListItem) has no closed/completed-date field —
    // same gap flagged for PRHistoryPage's "วันที่ปิด" column. Not invented here;
    // add this column once the backend actually returns such a field.
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
      title: '',
      key: 'action',
      render: (_: unknown, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          size="small"
          onClick={() => navigate(`/po/approval/${record.po_id}`)}
        >
          ดู
        </Button>
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
        <Table
          rowKey="po_id"
          loading={loading}
          dataSource={items}
          columns={columns}
          components={{ header: { cell: ResizableTitle } }}
          size="small"
          scroll={{ x: 1700 }}
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
