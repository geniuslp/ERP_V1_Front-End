import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Select, Button, Space, Tabs, Tag, Tooltip, message } from 'antd'
import { SearchOutlined, ReloadOutlined, DollarOutlined, FileTextOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { financeService, isRecordPaymentBlocked, RECORD_PAYMENT_BLOCKED_TIP } from '@/services/financeService'
import FinanceProjectsCell from '@/components/finance/FinanceProjectsCell'
import type { FinanceDocType, FinancePaymentListItem, ReceivingStatus } from '@/types/finance'

// Same map+Tag convention as POStatusBadge.tsx's approvalMap/receiveMap —
// distinct from POReceiveStatus (status_receive, NOT_SENT/SENT/PARTIALLY_
// RECEIVED/RECEIVED) since this is a different, live-computed enum coming
// from GET /finance/payments specifically.
const receivingStatusMap: Record<ReceivingStatus, { color: string; label: string }> = {
  FULLY_RECEIVED: { color: 'success', label: 'รับครบแล้ว' },
  PARTIALLY_RECEIVED: { color: 'gold', label: 'รับบางส่วน' },
  NOT_RECEIVED: { color: 'default', label: 'ยังไม่ได้รับ' },
}

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

// Document approval status only (sent as the `status` query param); payment progress is separate.
const STATUS_OPTIONS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'PENDING_APPROVAL', label: 'รออนุมัติ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
]

const DOC_NO_COL_DEFAULT_WIDTH = 150
const PROJECT_COL_DEFAULT_WIDTH = 320
const NET_AMOUNT_COL_DEFAULT_WIDTH = 170
const RECEIVING_COL_DEFAULT_WIDTH = 130
const PAID_COL_DEFAULT_WIDTH = 150
const REMAINING_COL_DEFAULT_WIDTH = 180
const ACTION_COL_WIDTH = 190

// Same local react-resizable pattern as PRHistoryPage.tsx / POHistoryPage.tsx —
// only columns that pass width/onResize via onHeaderCell get a drag handle.
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

const thb = (n: number) => (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const FinancePaymentsPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [docType, setDocType] = useState<FinanceDocType>('PO')
  const [data, setData] = useState<FinancePaymentListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [projectCode, setProjectCode] = useState('')
  const [status, setStatus] = useState('')

  // Resizable widths — not persisted, reset on refresh.
  const [docNoColWidth, setDocNoColWidth] = useState(DOC_NO_COL_DEFAULT_WIDTH)
  const [projectColWidth, setProjectColWidth] = useState(PROJECT_COL_DEFAULT_WIDTH)
  const [netAmountColWidth, setNetAmountColWidth] = useState(NET_AMOUNT_COL_DEFAULT_WIDTH)
  const [receivingColWidth, setReceivingColWidth] = useState(RECEIVING_COL_DEFAULT_WIDTH)
  const [paidColWidth, setPaidColWidth] = useState(PAID_COL_DEFAULT_WIDTH)
  const [remainingColWidth, setRemainingColWidth] = useState(REMAINING_COL_DEFAULT_WIDTH)
  const handleResize =
    (set: (w: number) => void) => (_e: React.SyntheticEvent, data: ResizeCallbackData) => set(data.size.width)

  const fetchList = async (nextPage = page, type = docType) => {
    setLoading(true)
    try {
      const result = await financeService.list(accessToken, {
        doc_type: type,
        project_code: projectCode || undefined,
        status: status || undefined,
        page: nextPage,
        page_size: pageSize,
      })
      setData(result.items)
      setTotal(result.total)
      setPage(nextPage)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList(1, docType) }, [docType])

  const handleReset = () => {
    setProjectCode('')
    setStatus('')
    fetchList(1, docType)
  }

  const handleTabChange = (key: string) => {
    const type = key as FinanceDocType
    setDocType(type)
    setProjectCode('')
    setStatus('')
  }

  const columns: ColumnsType<FinancePaymentListItem> = [
    {
      title: docType === 'PO' ? 'เลขที่ PO' : docType === 'PC' ? 'เลขที่เงินสดย่อย' : 'เลขที่ WO',
      dataIndex: 'doc_no',
      key: 'doc_no',
      width: docNoColWidth,
      onHeaderCell: () => ({ width: docNoColWidth, onResize: handleResize(setDocNoColWidth) }),
      render: (v: string, r) => (
      <>
        <a
          style={{ color: '#2563eb', fontWeight: 600 }}
          onClick={() => navigate(`/finance/payments/${r.doc_type}/${r.id}`, { state: { docItem: r } })}
        >
          {v}
        </a>
        {r.doc_type === 'PC' && (
          <Tooltip title="เปิดเอกสารเงินสดย่อย">
            <FileTextOutlined
              style={{ marginLeft: 8, color: '#64748b', cursor: 'pointer' }}
              onClick={() => navigate(`/petty-cash/${r.id}`)}
            />
          </Tooltip>
        )}
      </>
      ),
    },
    {
      title: 'โครงการ',
      dataIndex: 'project_code',
      key: 'project_code',
      width: projectColWidth,
      ellipsis: true,
      onHeaderCell: () => ({ width: projectColWidth, onResize: handleResize(setProjectColWidth) }),
      render: (_: unknown, r) => <FinanceProjectsCell item={r} />,
    },
    {
      title: 'มูลค่าสุทธิ',
      dataIndex: 'net_amount',
      key: 'net_amount',
      width: netAmountColWidth,
      onHeaderCell: () => ({ width: netAmountColWidth, onResize: handleResize(setNetAmountColWidth) }),
      align: 'right',
      render: (v: number) => <span style={{ whiteSpace: 'nowrap' }}>{thb(v)} บาท</span>,
    },
    {
      title: 'สถานะรับของ',
      dataIndex: 'receivingStatus',
      key: 'receivingStatus',
      width: receivingColWidth,
      onHeaderCell: () => ({ width: receivingColWidth, onResize: handleResize(setReceivingColWidth) }),
      render: (v: ReceivingStatus | null) => {
        // null for every WO row (and any PO row the backend hasn't computed
        // this for yet) — show a dash rather than a badge.
        if (!v) return <span style={{ color: '#9ca3af' }}>—</span>
        const s = receivingStatusMap[v] ?? { color: 'default', label: v }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: 'จ่ายแล้ว',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: paidColWidth,
      onHeaderCell: () => ({ width: paidColWidth, onResize: handleResize(setPaidColWidth) }),
      align: 'right',
      render: (v: number) => <span style={{ whiteSpace: 'nowrap' }}>{thb(v)} บาท</span>,
    },
    {
      title: 'คงเหลือต้องจ่าย',
      dataIndex: 'remaining_to_pay',
      key: 'remaining_to_pay',
      width: remainingColWidth,
      onHeaderCell: () => ({ width: remainingColWidth, onResize: handleResize(setRemainingColWidth) }),
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: v > 0 ? '#d97706' : '#16a34a', whiteSpace: 'nowrap' }}>{thb(v)} บาท</span>
      ),
    },
    {
      title: '',
      key: 'action',
      width: ACTION_COL_WIDTH,
      render: (_: unknown, r: FinancePaymentListItem) => {
        const blocked = isRecordPaymentBlocked(r)
        const btn = (
          <Button
            size="small"
            type="primary"
            icon={<DollarOutlined />}
            disabled={blocked}
            onClick={() => navigate(`/finance/payments/${r.doc_type}/${r.id}`, { state: { docItem: r } })}
          >
            บันทึกการจ่ายเงิน
          </Button>
        )
        // A disabled button swallows mouse events, so the tooltip sits on a wrapper.
        return blocked ? (
          <Tooltip title={RECORD_PAYMENT_BLOCKED_TIP}><span style={{ display: 'inline-block' }}>{btn}</span></Tooltip>
        ) : btn
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="การเงิน — ติดตามการจ่ายเงิน"
        subtitle="ติดตามสถานะการจ่ายเงินของ PO, WO และเงินสดย่อย"
        breadcrumbs={[{ title: 'Home' }, { title: 'การเงิน' }, { title: 'การจ่ายเงิน' }]}
      />

      <Card style={cardStyle}>
        <Tabs
          activeKey={docType}
          onChange={handleTabChange}
          items={[
            { key: 'PO', label: 'ใบสั่งซื้อ (PO)' },
            { key: 'WO', label: 'ใบสั่งงาน (WO)' },
            { key: 'PC', label: 'เงินสดย่อย' },
          ]}
        />

        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="โครงการ"
            value={projectCode}
            onChange={(e) => setProjectCode(e.target.value)}
            onPressEnter={() => fetchList(1)}
            style={{ width: 180 }}
            allowClear
          />
          <Select value={status} onChange={setStatus} style={{ width: 200 }} options={STATUS_OPTIONS} />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchList(1)}>ค้นหา</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>ล้างตัวกรอง</Button>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          components={{ header: { cell: ResizableTitle } }}
          scroll={{
            x:
              docNoColWidth + projectColWidth + netAmountColWidth +
              receivingColWidth + paidColWidth + remainingColWidth + ACTION_COL_WIDTH,
          }}
          dataSource={data}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: (p) => fetchList(p),
          }}
          locale={{ emptyText: 'ไม่พบรายการ' }}
        />
      </Card>
    </div>
  )
}

export default FinancePaymentsPage
