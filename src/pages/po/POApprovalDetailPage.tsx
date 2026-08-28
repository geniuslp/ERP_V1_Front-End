import React, { useState, useEffect } from 'react'
import {
  Button, Descriptions, Table, Alert, Spin,
  Modal, Form, Input, Popconfirm, message, Space,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  PrinterOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { useAppSelector } from '@/store'
import type { PODetail, PODetailResponse, POLine, POAttachment } from '@/types/po'
import { PO_WORK_TYPE_LABEL } from '@/types/po'
import { poApprovalService } from '@/services/poApprovalService'
import PermissionButton from '@/components/common/PermissionButton'
import EditApprovedButton from './components/EditApprovedButton'
import PurchaseOrderPrint, { type POData } from './PurchaseOrderPrint'
import PrintErrorBoundary from '@/components/common/PrintErrorBoundary'
import POStatusBadges from '@/components/po/POStatusBadge'
import { formatPoNoWithRevision } from '@/utils/poNo'
import { PaperClipOutlined } from '@ant-design/icons'


const MENU_CODE = 'MENU_PO_STATUS'

// TODO: enable when permission system is ready
// const canAct = isManager && po.status === 'PENDING_APPROVAL'
// const canCancel = isManager && po.status === 'APPROVED'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  padding: 24,
  marginBottom: 16,
}

const formatSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`

// Shared row/empty-state layout for the three attachment sections below —
// matches the page's existing plain-div section style (not an AntD Card,
// unlike PRDetailPage), so it's local to this file rather than a new
// cross-page component.
const AttachmentSection: React.FC<{ title: string; items: POAttachment[] }> = ({ title, items }) => (
  <div style={cardStyle}>
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
            <Space>
              <PaperClipOutlined style={{ color: '#2563eb' }} />
              <a
                href={a.file_path}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, color: '#1e40af' }}
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
      const res = await poApprovalService.getDetail(accessToken, id)
      setPo(res.data.data)
    } catch (err: any) {
      if (err?.response?.status === 404) {
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

  const lineColumns: ColumnsType<POLine> = [
    {
      title: 'ลำดับ',
      dataIndex: 'line_no',
      key: 'line_no',
      width: 70,
    },
    {
      title: 'รหัสวัสดุ',
      dataIndex: 'mat_code',
      key: 'mat_code',
      width: 130,
      render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'ชื่อวัสดุ',
      key: 'mat_name',
      render: (_: unknown, r: POLine) => (
        <div>
          <div>{r.mat_name ?? '—'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {[r.group_name, r.subgroup_name].filter(Boolean).join(' › ')}
          </div>
        </div>
      ),
    },
    {
      title: 'Spec / Brand',
      key: 'spec_brand',
      render: (_: unknown, r: POLine) => (
        <div>
          <div>{r.spec ?? '—'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{r.brand ?? ''}</div>
        </div>
      ),
    },
    {
      title: 'จำนวนสั่ง',
      key: 'qty_ordered',
      width: 120,
      render: (_: unknown, r: POLine) =>
        `${r.qty_ordered.toLocaleString()} ${r.unit_name ?? ''}`,
    },
    {
      title: 'ราคา/หน่วย',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      render: (v: number) => v.toLocaleString('th-TH'),
    },
    {
      title: 'มูลค่า',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      render: (v: number) => v.toLocaleString('th-TH'),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 110,
    },
    {
      title: 'หมายเหตุ',
      dataIndex: 'remarks',
      key: 'remarks',
      render: (v: string | undefined) => v ?? '—',
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
          <Button size="small" onClick={() => navigate(-1)}>
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
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            กลับ
          </Button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1e3a8a' }}>
            {formatPoNoWithRevision(po.po_no, po.revision_round)}
          </span>
          <POStatusBadges status={po.status} statusReceive={po.status_receive} />
        </Space>

        <Space>
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
            <EditApprovedButton poId={po.po_id} poNo={po.po_no} menuCode={MENU_CODE} />
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

      {/* Header details */}
      <div style={cardStyle}>
        <Descriptions
          bordered
          size="small"
          column={{ xs: 1, sm: 2, lg: 3 }}
          labelStyle={{ fontWeight: 600, width: 140 }}
        >
          <Descriptions.Item label="เลข PO">{formatPoNoWithRevision(po.po_no, po.revision_round)}</Descriptions.Item>
          <Descriptions.Item label="เลข PR อ้างอิง">
            {po.pr_id ? (
              <a onClick={() => navigate(`/pr/${po.pr_id}`)}>{po.pr_no ?? `PR #${po.pr_id}`}</a>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="วันที่">{po.po_date?.slice(0, 10) ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            <POStatusBadges status={po.status} statusReceive={po.status_receive} />
          </Descriptions.Item>
          <Descriptions.Item label="Supplier">{po.supplier_name}</Descriptions.Item>
          <Descriptions.Item label="รหัส Supplier">{po.supplier_id}</Descriptions.Item>
          <Descriptions.Item label="ประเภทการสั่งซื้อ">
            {po.order_type === 'cost' ? 'โครงการ (Cost)' : po.order_type === 'stock' ? 'คลังสินค้า (Stock)' : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="ประเภทงาน">
            {po.work_type ? (PO_WORK_TYPE_LABEL[po.work_type] ?? po.work_type) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="เงื่อนไขการชำระ">{po.payment_terms ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="ที่อยู่จัดส่ง" span={2}>{po.location_text ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="คลัง">{po.warehouse_code ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="สกุลเงิน">{po.currency}</Descriptions.Item>
          <Descriptions.Item label="มูลค่ารวม" contentStyle={{ textAlign: 'left' }}>
            {po.total_amount.toLocaleString('th-TH')}
          </Descriptions.Item>
          <Descriptions.Item label="ภาษี VAT" contentStyle={{ textAlign: 'left' }}>
            {po.vat_amount.toLocaleString('th-TH')}
          </Descriptions.Item>
          <Descriptions.Item label="มูลค่าสุทธิ" contentStyle={{ textAlign: 'left', fontWeight: 700 }}>
            {po.net_amount.toLocaleString('th-TH')}
          </Descriptions.Item>
          <Descriptions.Item label="ส่วนลด">
            {po.use_discount ? `${po.discount_amount} (${po.discount_type})` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="ภาษีหัก ณ ที่จ่าย">
            {po.use_wht ? po.wht_amount : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="วันที่ต้องการ">{po.expected_date?.slice(0, 10) ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="ผู้สร้าง">{po.created_by_name}</Descriptions.Item>
          {/* Supplier contact fields (office_phone/sales_person/contact_email/contact_phone)
              are live-joined from the supplier master but intentionally screen-hidden here —
              they still appear in full on the printed PO (see POPrint). */}
          <Descriptions.Item
            label="หมายเหตุ"
            span={3}
            contentStyle={po.status === 'REJECTED' ? { color: '#dc2626', fontWeight: 600 } : {}}
          >
            {po.remarks ?? '-'}
          </Descriptions.Item>
        </Descriptions>
      </div>

      {/* Line items */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', marginBottom: 12 }}>
          รายการสินค้า / วัสดุ
        </div>
        <Table
          rowKey="id"
          dataSource={po.lines ?? []}
          columns={lineColumns}
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
          locale={{ emptyText: 'ไม่มีรายการ' }}
        />
      </div>

      {po.attachments && 'memo' in po.attachments && (
        <AttachmentSection title="ไฟล์แนบจาก Memo" items={po.attachments.memo ?? []} />
      )}

      {po.attachments && 'pr' in po.attachments && (
        <AttachmentSection title="ไฟล์แนบจาก PR" items={po.attachments.pr ?? []} />
      )}

      {po.attachments && (
        <AttachmentSection title="ไฟล์แนบ PO" items={po.attachments.po ?? []} />
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
        <Form form={rejectForm} layout="vertical">
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
