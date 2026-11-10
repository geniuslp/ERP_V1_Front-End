import { BLOCK_CARD_STYLE } from '@/constants/blockStyle'
import FormattedNote from '@/components/common/FormattedNote'
import React, { useState, useEffect } from 'react'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import {
  Button, Descriptions, Table, Alert, Spin,
  Modal, Form, Input, Popconfirm, message, Space, Grid,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  PrinterOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { handleApprovalForbidden } from '@/utils/approvalAccess'
import type { ColumnsType } from 'antd/es/table'
import { resolveFileUrl } from '@/utils/fileUrl'
import { useAppSelector } from '@/store'
import type { PODetail, PODetailResponse, POLine, POAttachment } from '@/types/po'
import { JOB_TYPES } from '@/constants/jobTypes'
import { ORDER_TYPE_LABEL } from '@/constants/orderTypes'
import { poApprovalService } from '@/services/poApprovalService'
import PermissionButton from '@/components/common/PermissionButton'
import EditApprovedButton from './components/EditApprovedButton'
import PurchaseOrderPrint, { type POData } from './PurchaseOrderPrint'
import PrintErrorBoundary from '@/components/common/PrintErrorBoundary'
import POStatusBadges from '@/components/po/POStatusBadge'
import { formatPoNoWithRevision } from '@/utils/poNo'
import { sumLineAmtDiscounts } from '@/utils/poCalc'
import { formatItemLabel } from '@/utils/itemLabel'
import { PaperClipOutlined } from '@ant-design/icons'
import { formatCostCodeDisplay } from '@/utils/costCode'


const { useBreakpoint } = Grid

const MENU_CODE = 'MENU_PO_STATUS'

// TODO: enable when permission system is ready
// const canAct = isManager && po.status === 'PENDING_APPROVAL'
// const canCancel = isManager && po.status === 'APPROVED'

const cardStyle: React.CSSProperties = {
  ...BLOCK_CARD_STYLE,
  background: '#fff',
  padding: 24,
  marginBottom: 16,
}

// Same local react-resizable pattern as POHistoryPage.tsx: only header cells that receive
// width + onResize (via onHeaderCell) get a drag handle.
interface ResizableTitleProps extends React.HTMLAttributes<HTMLElement> {
  onResize?: (e: React.SyntheticEvent, data: ResizeCallbackData) => void
  width?: number
}
const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResize, width, ...restProps } = props
  if (!width || !onResize) return <th {...restProps} />
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[60, 0]}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', right: -5, bottom: 0, top: 0, width: 10, cursor: 'col-resize', zIndex: 1 }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative' }} />
    </Resizable>
  )
}

const LINE_COL_DEFAULTS: Record<string, number> = {
  line_no: 70, cost_code: 260, mat_code: 150, mat_name: 340,
  qty_ordered: 120, unit_price: 130, amount: 150, remarks: 200,
}

// "FS01101 — Stock": the display Cost Code plus the cost subgroup name when the API sent one.
const costCodeLabel = (r: { cost_code?: string | null; cost_name?: string | null; cost_subgroup_name?: string | null }) => {
  const code = r.cost_code ? formatCostCodeDisplay(r.cost_code) : ''
  const name = (r.cost_name || r.cost_subgroup_name || '').trim()
  return name ? `${code} — ${name}` : code
}

const formatSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`

// Shared row/empty-state layout for the three attachment sections below —
// matches the page's existing plain-div section style (not an AntD Card,
// unlike PRDetailPage), so it's local to this file rather than a new
// cross-page component.
const AttachmentSection: React.FC<{ title: string; items: POAttachment[]; compact?: boolean }> = ({ title, items, compact }) => (
  <div style={compact ? { ...cardStyle, padding: 12 } : cardStyle}>
    <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', marginBottom: 12 }}>
      {title}
    </div>
    {items.length === 0 ? (
      <div style={{ color: '#9ca3af', fontSize: 13 }}>ไม่มีไฟล์แนบ</div>
    ) : (
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {items.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              border: '0.5px solid #e5e7eb',
              borderRadius: 8,
            }}
          >
            <Space style={{ minWidth: 0 }} wrap>
              <PaperClipOutlined style={{ color: '#2563eb' }} />
              <a
                href={resolveFileUrl(a.file_path)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, color: '#1e40af', overflowWrap: 'anywhere' }}
                className="attachment-filename-link"
              >
                {a.file_name}
              </a>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{formatSize(a.file_size)}</span>
            </Space>
          </div>
        ))}
      </Space>
    )}
  </div>
)

const POApprovalDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // Phone layout (iPhone Pro Max is 430px wide): same breakpoint rule as PageHeader / AppLayout.
  const isMobile = useBreakpoint().md === false
  const pageCard: React.CSSProperties = isMobile ? { ...cardStyle, padding: 12 } : cardStyle
  // Set only by the approval list's links; requester/history/print entries open this page without it.
  const forApproval = new URLSearchParams(useLocation().search).get('for_approval') === 'true'
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [loading, setLoading] = useState(false)
  const [po, setPo] = useState<PODetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [approving, setApproving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectForm] = Form.useForm()
  const [printData, setPrintData] = useState<POData | null>(null)
  const [printing, setPrinting] = useState(false)

  const fetchDetail = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await poApprovalService.getDetail(accessToken, id, { forApproval })
      setPo(res.data.data)
    } catch (err: any) {
      if (forApproval && handleApprovalForbidden(err)) {
        navigate('/po/approval', { replace: true })
      } else if (err?.response?.status === 404) {
        setNotFound(true)
      } else {
        message.error(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            'โหลดข้อมูลไม่สำเร็จ',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
  }, [id])

  const handleApprove = async () => {
    if (!id) return
    setApproving(true)
    try {
      await poApprovalService.approve(accessToken, id)
      message.success('อนุมัติ PO สำเร็จ')
      fetchDetail()
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'อนุมัติไม่สำเร็จ',
      )
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    try {
      const values = await rejectForm.validateFields()
      if (!id) return
      setRejecting(true)
      try {
        await poApprovalService.reject(accessToken, id, values.reason)
        message.success('ไม่อนุมัติ PO เรียบร้อย')
        setRejectOpen(false)
        rejectForm.resetFields()
        fetchDetail()
      } catch (err: any) {
        message.error(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            'ดำเนินการไม่สำเร็จ',
        )
      } finally {
        setRejecting(false)
      }
    } catch {
      // form validation failed — antd shows inline errors
    }
  }

  const handleCancel = async () => {
    if (!id) return
    setCancelling(true)
    try {
      await poApprovalService.cancel(accessToken, id)
      message.success('ยกเลิก PO เรียบร้อย')
      fetchDetail()
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'ยกเลิกไม่สำเร็จ',
      )
    } finally {
      setCancelling(false)
    }
  }

  const handlePrint = async () => {
    if (!id) return
    setPrinting(true)
    try {
      const res = await poApprovalService.getPrintData(accessToken, id)
      // Watermark trust source: the print-data endpoint's own status field
      // isn't guaranteed present, but `po.status` (this page's own fetched
      // detail) is already known-good — merge it in explicitly.
      setPrintData({ ...res.data.data, status: po?.status })
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'โหลดข้อมูลสำหรับพิมพ์ไม่สำเร็จ',
      )
    } finally {
      setPrinting(false)
    }
  }

  // Backend allows approve/reject from both PENDING_APPROVAL (first approval)
  // and PENDING_REAPPROVAL (an APPROVED PO edited via edit-approved and
  // resent) — see po_approval.go's status guard on Approve/Reject.
  const canAct = po?.status === 'PENDING_APPROVAL' || po?.status === 'PENDING_REAPPROVAL'
  const canCancel = po?.status === 'APPROVED'

  // po.can_edit_approved (po.go:488, `CanEditApproved = status=="APPROVED" &&
  // age<1yr`) is only ever computed true for APPROVED — the backend was
  // never updated to also compute it for PENDING_REAPPROVAL, even though
  // PUT /po/:id/edit-approved itself already accepts both statuses (same
  // handler, po.go:1573/1576 — also enforces the identical 1-year window).
  // Mirror that window here on the frontend instead of relying on a backend
  // flag that doesn't cover this status, rather than showing an edit button
  // that would just 400 past a year.
  const withinEditApprovedWindow = po?.created_at
    ? Date.now() - new Date(po.created_at).getTime() < 365 * 24 * 60 * 60 * 1000
    : false
  const canEditApprovedNow =
    Boolean(po?.can_edit_approved) ||
    (po?.status === 'PENDING_REAPPROVAL' && withinEditApprovedWindow)

  const [colW, setColW] = useState<Record<string, number>>({})
  const rz = (key: string) => {
    const width = colW[key] ?? LINE_COL_DEFAULTS[key]
    return {
      width,
      onHeaderCell: () => ({
        width,
        onResize: (_e: React.SyntheticEvent, d: ResizeCallbackData) =>
          setColW((prev) => ({ ...prev, [key]: Math.max(60, d.size.width) })),
      }),
    }
  }

  const lineColumns: ColumnsType<POLine> = [
    {
      title: 'ลำดับ',
      dataIndex: 'line_no',
      key: 'line_no',
      ...rz('line_no'),
    },
    {
      title: 'Cost Code',
      key: 'cost_code',
      ...rz('cost_code'),
      render: (_: unknown, r: POLine) =>
        r.cost_code ? <span>{costCodeLabel(r)}</span> : <span style={{ color: '#9ca3af' }}>-</span>,
    },
    {
      title: 'รหัสวัสดุ',
      dataIndex: 'mat_code',
      key: 'mat_code',
      ...rz('mat_code'),
      render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'ชื่อวัสดุ',
      key: 'mat_name',
      ...rz('mat_name'),
      render: (_: unknown, r: POLine) => (
        <div>
          <div>{formatItemLabel(r.mat_name, r.spec, r.brand_name) || '—'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {[r.group_name, r.subgroup_name].filter(Boolean).join(' › ')}
          </div>
        </div>
      ),
    },
    {
      title: 'จำนวนสั่ง',
      key: 'qty_ordered',
      ...rz('qty_ordered'),
      render: (_: unknown, r: POLine) =>
        `${r.qty_ordered.toLocaleString()} ${r.unit_name ?? ''}`,
    },
    {
      title: 'ราคา/หน่วย',
      dataIndex: 'unit_price',
      key: 'unit_price',
      ...rz('unit_price'),
      render: (v: number) => `${v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
    },
    {
      title: 'มูลค่า',
      dataIndex: 'amount',
      key: 'amount',
      ...rz('amount'),
      render: (v: number) => `${v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
    },
    {
      title: 'หมายเหตุ',
      key: 'remarks',
      ...rz('remarks'),
      // The line's remark is saved in `description` (what the PO form's remark box sends); `remarks` is the older column.
      render: (_: unknown, r: POLine) => <FormattedNote value={r.description ?? r.remarks} empty="—" />,
    },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (notFound) {
    return (
      <Alert
        type="error"
        message="ไม่พบ PO"
        description="ไม่พบข้อมูลใบสั่งซื้อนี้ หรือถูกลบไปแล้ว"
        showIcon
        style={{ margin: 24 }}
        action={
          <Button type="primary" size="small" onClick={() => navigate(-1)}>
            กลับ
          </Button>
        }
      />
    )
  }

  if (!po) return null

  return (
    <div>
      {/* Top bar */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space wrap>
          <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            กลับ
          </Button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1e3a8a' }}>
            {formatPoNoWithRevision(po.po_no, po.revision_round)}
          </span>
          <POStatusBadges status={po.status} statusReceive={po.status_receive} orderType={po.order_type} />
        </Space>

        <Space wrap style={isMobile ? { width: '100%' } : undefined}>
          <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrint}>
            พิมพ์
          </Button>
          {(po.status === 'DRAFT' || po.status === 'PENDING_APPROVAL') && (
            <PermissionButton
              menuCode={MENU_CODE}
              action="edit"
              icon={<EditOutlined />}
              onClick={() => navigate(`/po/${po.po_id}/edit`)}
            >
              แก้ไข
            </PermissionButton>
          )}
          {canEditApprovedNow && (
            <EditApprovedButton poId={po.po_id} poNo={po.po_no} menuCode={MENU_CODE} showLabel />
          )}
          {canAct && (
            <>
              <Popconfirm
                title="ยืนยันการอนุมัติ"
                description={`อนุมัติ PO ${po.po_no} ใช่หรือไม่?`}
                onConfirm={handleApprove}
                okText="อนุมัติ"
                cancelText="ยกเลิก"
                okButtonProps={{ style: { background: '#22c55e', borderColor: '#22c55e' } }}
              >
                <PermissionButton
                  action="approval"
                  docType="PO"
                  docId={po.po_id}
                  approvalAction="approve"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={approving}
                  style={{ background: '#22c55e', borderColor: '#22c55e' }}
                >
                  อนุมัติ
                </PermissionButton>
              </Popconfirm>
              <PermissionButton
                action="approval"
                docType="PO"
                docId={po.po_id}
                approvalAction="reject"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => setRejectOpen(true)}
              >
                ไม่อนุมัติ
              </PermissionButton>
            </>
          )}

          {canCancel && (
            <Popconfirm
              title="ยืนยันการยกเลิก"
              description={`ยกเลิก PO ${po.po_no} ใช่หรือไม่?`}
              onConfirm={handleCancel}
              okText="ยกเลิก PO"
              cancelText="ปิด"
              okButtonProps={{ danger: true }}
            >
              <PermissionButton
                menuCode={MENU_CODE}
                action="edit"
                icon={<StopOutlined />}
                loading={cancelling}
                style={{ borderColor: '#d97706', color: '#d97706' }}
              >
                ยกเลิก PO
              </PermissionButton>
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* Header details — exactly 5 rows, fixed 3-column grid (see per-item
          `span` below controlling row breaks: Descriptions wraps to a new row
          once a row's spans sum to `column`). PO no./PR ref./date/status live
          in the top bar above instead; currency/gross/VAT/net/ส่วนลด/WHT/คลัง
          are intentionally dropped from this block per product decision — they
          still appear in full on the printed PO (see PurchaseOrderPrint). */}
      <div style={pageCard}>
        <Descriptions
          bordered
          size="small"
          column={isMobile ? 1 : 3}
          labelStyle={isMobile ? { fontWeight: 600, width: 104, padding: '6px 8px', fontSize: 13 } : { fontWeight: 600, width: 140 }}
          contentStyle={{ overflowWrap: 'anywhere' }}
        >
          <Descriptions.Item label="โครงการ">
            {po.project_code || po.project_name
              ? `${po.project_code ?? ''}${po.project_code && po.project_name ? ' ' : ''}${po.project_name ?? ''}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="แผนก">
            {po.dept_code ? `${po.dept_code}${po.dept_name ? ` — ${po.dept_name}` : ''}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Job">
            {po.job_code ? (JOB_TYPES.find((jt) => jt.code === po.job_code)?.label ?? po.job_code) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="ประเภทการซื้อ">
            {po.order_type ? (ORDER_TYPE_LABEL[po.order_type] ?? po.order_type) : '-'}
          </Descriptions.Item>

          <Descriptions.Item label="ชื่อบริษัท" span={isMobile ? 1 : 2}>{po.supplier_name}</Descriptions.Item>
          <Descriptions.Item label="เงื่อนไข">{po.payment_terms ?? '-'}</Descriptions.Item>

          <Descriptions.Item label="ผู้รับของ">{po.receiver_name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="เบอร์โทร">{po.receiver_phone ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="สถานที่ส่ง">{po.location_text ?? '-'}</Descriptions.Item>

          <Descriptions.Item label="วันที่ส่ง">{po.expected_date?.slice(0, 10) ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="มูลค่าหักส่วนลด ก่อนหักภาษี" span={isMobile ? 1 : 2} contentStyle={{ textAlign: 'left' }}>
            {(() => {
              // Header discount (po.use_discount/discount_amount) is only one
              // source — a line can carry its own amt-type discount instead
              // (purchase_order_line.disc_type/discount). Same rollup
              // PurchaseOrderPrint.tsx's "Special Discount" summary uses, so
              // the two can't disagree.
              const headerDisc = po.use_discount ? po.discount_amount ?? 0 : 0
              const lineAmtDisc = sumLineAmtDiscounts(
                (po.lines ?? []).map((l) => ({
                  discType: l.disc_type,
                  disc: l.discount ?? 0,
                  qty: l.qty_ordered,
                  unitPrice: l.unit_price,
                })),
              )
              const afterDiscount = po.total_amount - (headerDisc + lineAmtDisc)
              return `${afterDiscount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
            })()}
          </Descriptions.Item>

          <Descriptions.Item
            label="หมายเหตุ"
            span={isMobile ? 1 : 3}
            contentStyle={po.status === 'REJECTED' ? { color: '#dc2626', fontWeight: 600 } : {}}
          >
            <FormattedNote value={po.remarks} empty="-" />
          </Descriptions.Item>
        </Descriptions>
      </div>

      {/* Line items */}
      <div style={pageCard}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', marginBottom: 12 }}>
          รายการสินค้า / วัสดุ
        </div>
        {isMobile ? (
          // Phone: one card per line instead of a 900px wide table.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(po.lines ?? []).length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>ไม่มีรายการ</div>}
            {(po.lines ?? []).map((r) => {
              const m2 = (v: number) => `${(v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
              return (
                <div key={r.line_no} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#64748b' }}>
                    <span>ลำดับ {r.line_no}</span>
                    <span>{r.cost_code ? costCodeLabel(r) : '-'}</span>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 4 }}>{r.mat_code}</div>
                  <div style={{ fontWeight: 600, marginTop: 2, overflowWrap: 'anywhere' }}>
                    {formatItemLabel(r.mat_name, r.spec, r.brand_name) || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {[r.group_name, r.subgroup_name].filter(Boolean).join(' › ')}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    {`${r.qty_ordered.toLocaleString()} ${r.unit_name ?? ''}`} × {m2(r.unit_price)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 2, fontWeight: 600 }}>
                    <span style={{ color: '#64748b', fontWeight: 400 }}>มูลค่า</span>
                    <span>{m2(r.amount)}</span>
                  </div>
                  {(r.description ?? r.remarks) && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}>
                      <FormattedNote value={r.description ?? r.remarks} empty="—" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <Table
            rowKey="id"
            dataSource={po.lines ?? []}
            columns={lineColumns}
            pagination={false}
            size="small"
            scroll={{ x: Object.keys(LINE_COL_DEFAULTS).reduce((a, k) => a + (colW[k] ?? LINE_COL_DEFAULTS[k]), 0) }}
            components={{ header: { cell: ResizableTitle } }}
            locale={{ emptyText: 'ไม่มีรายการ' }}
          />
        )}

        {/* Totals — same block as the line items, same rows as the PO create page's summary
            (ยอดรวมก่อนลด / ส่วนลด / VAT 7% / WHT / ยอดรวมสุทธิ). Uses the amounts stored on the PO. */}
        {(() => {
          const money = (v: number) => `฿ ${(v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          const headerDisc = po.use_discount ? po.discount_amount ?? 0 : 0
          const lineAmtDisc = sumLineAmtDiscounts(
            (po.lines ?? []).map((l) => ({ discType: l.disc_type, disc: l.discount ?? 0, qty: l.qty_ordered, unitPrice: l.unit_price })),
          )
          const totalDisc = headerDisc + lineAmtDisc
          const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', width: '100%', gap: isMobile ? 16 : 48 }
          return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: isMobile ? 0 : 260, width: isMobile ? '100%' : undefined }}>
                <div style={rowStyle}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>ยอดรวมก่อนลด</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{money(po.total_amount)}</span>
                </div>
                {(po.use_discount || totalDisc > 0) && (
                  <div style={rowStyle}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>ส่วนลด</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>- {money(totalDisc)}</span>
                  </div>
                )}
                {po.use_vat && (
                  <div style={rowStyle}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>VAT 7%</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#ca8a04' }}>+ {money(po.vat_amount)}</span>
                  </div>
                )}
                {po.use_wht && (
                  <div style={rowStyle}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>WHT</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#dc2626' }}>- {money(po.wht_amount ?? 0)}</span>
                  </div>
                )}
                <div style={{ ...rowStyle, borderTop: '0.5px solid #dbeafe', marginTop: 4, paddingTop: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>ยอดรวมสุทธิ</span>
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#1e40af' }}>{money(po.net_amount)}</span>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {po.attachments && 'memo' in po.attachments && (
        <AttachmentSection title="ไฟล์แนบจาก Memo" items={po.attachments.memo ?? []} compact={isMobile} />
      )}

      {po.attachments && 'pr' in po.attachments && (
        <AttachmentSection title="ไฟล์แนบจาก PR" items={po.attachments.pr ?? []} compact={isMobile} />
      )}

      {po.attachments && (
        <AttachmentSection title="ไฟล์แนบ PO" items={po.attachments.po ?? []} compact={isMobile} />
      )}

      {/* Reject modal */}
      <Modal
        open={rejectOpen}
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#dc2626' }} />
            <span>ไม่อนุมัติใบสั่งซื้อ</span>
          </Space>
        }
        onCancel={() => {
          setRejectOpen(false)
          rejectForm.resetFields()
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setRejectOpen(false)
              rejectForm.resetFields()
            }}
          >
            ยกเลิก
          </Button>,
          <Button key="submit" danger type="primary" loading={rejecting} onClick={handleReject}>
            ยืนยันไม่อนุมัติ
          </Button>,
        ]}
        destroyOnClose
      >
        <Alert
          type="warning"
          message={`กำลังไม่อนุมัติ PO: ${po.po_no}`}
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form autoComplete="off" form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="เหตุผลที่ไม่อนุมัติ"
            rules={[
              { required: true, message: 'กรุณาระบุเหตุผล' },
              { min: 5, message: 'เหตุผลต้องมีอย่างน้อย 5 ตัวอักษร' },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="ระบุเหตุผลที่ไม่อนุมัติ..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {printData && (
        <PrintErrorBoundary label={printData.poNo}>
          <PurchaseOrderPrint
            data={printData}
            onReady={() => {
              window.print()
              setPrintData(null)
            }}
          />
        </PrintErrorBoundary>
      )}
    </div>
  )
}

export default POApprovalDetailPage
