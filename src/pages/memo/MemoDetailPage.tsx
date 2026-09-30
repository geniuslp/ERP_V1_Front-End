import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card, Descriptions, Table, Button, Space, Alert, Empty, message, Modal, Input,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, StopOutlined,
  CheckOutlined, CloseOutlined, PrinterOutlined,
} from '@ant-design/icons'
import { PaperClipOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import MemoStatusBadge from './components/MemoStatusBadge'
import { ROUTES } from '@/config/routes'
import { useAppSelector } from '@/store'
import { resolveFileUrl } from '@/utils/fileUrl'
import MemoPrint, { type MemoData } from './MemoPrint'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

// Kept in sync manually with MemoCreateEditPage.tsx's own copy — memo.department
// is a plain varchar with no backing lookup table, so there's no API to fetch
// the full label from.
const DEPARTMENT_OPTIONS = [
  { value: 'HO', label: 'HO — สำนักงานใหญ่' },
  { value: 'FAC-S', label: 'FAC-S — ศาลายา' },
  { value: 'FAC-P', label: 'FAC-P — ปราจีนบุรี' },
  { value: 'BO', label: 'BO — สำนักงานบางบ่อ' },
]

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#1e40af',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

interface MemoLineItem {
  id: number
  lineNo: number
  description: string
  unit: string
  quantity: number
  remark?: string
}

// Memo is a source document (not one that aggregates attachments from linked
// docs like PO's {memo, pr, po} keyed shape) — backend returns a flat array
// under "attachments", omitted entirely (not []) when there are none.
interface MemoAttachmentFile {
  file_path: string
  file_name: string
  file_size: number
  file_type: string
  uploaded_by?: string
  uploaded_at?: string
}

interface MemoDetail {
  id: string
  memoNo: string
  title: string
  status: string
  requestedBy: string
  requestedById: number
  approverName?: string
  department?: string
  deliveryLocation?: string
  // "กำหนดส่งของหน้างาน" — required/target date for on-site delivery, distinct
  // from createdAt (the document's own creation date), same distinction as
  // PR's requiredDate vs prDate.
  siteDeliveryDate?: string
  projectName?: string
  note?: string
  createdAt: string
  // GET /memo/:id's requester_signature/approval_signature — both null unless
  // the memo is past DRAFT (requester) / actually APPROVED (approver).
  requesterSignature: { fullName: string; signatureDataUrl: string } | null
  approvalSignature: { fullName: string; signatureDataUrl: string; approvedAt: string | null } | null
  lines: MemoLineItem[]
  attachments?: MemoAttachmentFile[]
}

const formatFileSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`

// Matches POApprovalDetailPage.tsx's local AttachmentSection style (plain-div
// section, not a Card) — that component isn't exported/reusable across files,
// so this is a local copy sized for Memo's flat attachments array.
const AttachmentSection: React.FC<{ title: string; items: MemoAttachmentFile[] }> = ({ title, items }) => (
  <div style={{ ...cardStyle, padding: 24, marginBottom: 16, background: '#fff' }}>
    <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', marginBottom: 12 }}>
      {title}
    </div>
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      {items.map((a, idx) => (
        <div
          key={idx}
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
              href={resolveFileUrl(a.file_path)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: '#1e40af' }}
              className="attachment-filename-link"
            >
              {a.file_name}
            </a>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{formatFileSize(a.file_size)}</span>
          </Space>
        </div>
      ))}
    </Space>
  </div>
)

const mapMemo = (raw: any): MemoDetail => {
  const lines = (raw.lines ?? raw.items ?? []).map((l: any) => ({
    id:          l.id,
    lineNo:      l.line_no     ?? 0,
    description: l.description ?? '',
    unit:        l.unit        ?? '',
    quantity:    l.quantity    ?? 0,
    remark:      l.remark,
  }))

  return {
    id:            String(raw.id),
    memoNo:        raw.memo_no        ?? '',
    title:         raw.title          ?? '',
    status:        raw.status         ?? 'DRAFT',
    requestedBy:   raw.requested_by_name ?? '',
    requestedById: raw.requested_by   ?? 0,
    approverName:  raw.approver_name ?? raw.approverName,
    department:    raw.department,
    deliveryLocation: raw.delivery_location,
    // ⚠️ Unconfirmed whether GET /memo/:id actually returns this field yet —
    // mapped defensively here (undefined if absent); verify against a live
    // response before relying on it populating in the print layout.
    siteDeliveryDate: raw.site_delivery_date,
    projectName:   raw.project_code,
    note:          raw.note,
    createdAt:     raw.created_at     ?? '',
    requesterSignature: raw.requester_signature ? {
      fullName:         raw.requester_signature.full_name ?? '',
      signatureDataUrl: raw.requester_signature.signature_data_url ?? '',
    } : null,
    approvalSignature: raw.approval_signature ? {
      fullName:         raw.approval_signature.full_name ?? '',
      signatureDataUrl: raw.approval_signature.signature_data_url ?? '',
      approvedAt:       raw.approval_signature.approved_at ?? null,
    } : null,
    lines,
    attachments:   raw.attachments,
  }
}

interface MemoDetailPageProps {
  showApproveActions?: boolean
}

const MemoDetailPage: React.FC<MemoDetailPageProps> = ({ showApproveActions = false }) => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const user = useAppSelector((s) => s.auth.user)
  const [memo, setMemo] = useState<MemoDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [canApprove, setCanApprove] = useState(false)
  const [approvalStatusLoading, setApprovalStatusLoading] = useState(false)
  const [cancelModal, setCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [printData, setPrintData] = useState<MemoData | null>(null)
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/master/projects`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const raw = Array.isArray(res.data)
          ? res.data
          : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setProjects(list.map((p: any) => ({
          value: p.project_code,
          label: p.project_code
            ? `${p.project_code} — ${p.project_name ?? p.name ?? ''}`
            : (p.project_name ?? p.name ?? String(p.id)),
        })))
      } catch {
        // Non-critical — print falls back to the raw project_code if this fails.
      }
    }
    fetchProjects()
  }, [])

  const fetchMemo = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/memo/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const raw = res.data?.data ?? res.data
      setMemo(mapMemo(raw))
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลใบบันทึกขอซื้อ (Memo) ไม่สำเร็จ'
      )
    } finally {
      setLoading(false)
    }
  }

  const fetchApprovalStatus = async () => {
    if (!showApproveActions || !id) return
    setApprovalStatusLoading(true)
    try {
      const res = await axios.get(
        `${BASE_URL}/approval-request/MEMO/${id}/my-status`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = res.data?.data ?? res.data
      setCanApprove(Boolean(data?.is_assigned_approver))
    } catch {
      setCanApprove(false)
    } finally {
      setApprovalStatusLoading(false)
    }
  }

  useEffect(() => {
    fetchMemo()
  }, [id])

  useEffect(() => {
    fetchApprovalStatus()
  }, [id, showApproveActions])

  const handleCancel = () => {
    if (!memo) return
    Modal.confirm({
      title: 'ยืนยันการยกเลิกใบบันทึกขอซื้อ (Memo)',
      content: `ต้องการยกเลิกใบบันทึกขอซื้อ (Memo) ${memo.memoNo} ใช่หรือไม่`,
      okText: 'ยืนยันยกเลิก',
      cancelText: 'ปิด',
      onOk: async () => {
        try {
          await axios.patch(`${BASE_URL}/memo/${memo.id}/cancel`, {}, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          message.success('ยกเลิกใบบันทึกขอซื้อ (Memo) สำเร็จ')
          fetchMemo()
        } catch (err: any) {
          message.error(
            err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ยกเลิกใบบันทึกขอซื้อ (Memo) ไม่สำเร็จ'
          )
        }
      },
    })
  }

  const handleApprovalAction = async (action: 'APPROVE' | 'REJECT', comments?: string) => {
    setApproving(true)
    try {
      await axios.post(
        `${BASE_URL}/memo/${id}/approve`,
        { action, comments: comments || (action === 'APPROVE' ? 'Approved' : '') },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      message.success(action === 'APPROVE' ? 'Memo approved' : 'Memo rejected')
      fetchMemo()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Action failed')
    } finally {
      setApproving(false)
      setRejectModal(false)
    }
  }

  const handleCancelApproval = async () => {
    setApproving(true)
    try {
      await axios.patch(
        `${BASE_URL}/memo/${id}/cancel`,
        { comments: cancelReason || 'Cancelled by approver' },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      message.success('ยกเลิกใบบันทึกขอซื้อ (Memo) สำเร็จ')
      setCancelModal(false)
      setCancelReason('')
      fetchMemo()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'ยกเลิกไม่สำเร็จ')
    } finally {
      setApproving(false)
    }
  }

  // No separate print-data endpoint for Memo (same as PR) — everything the print
  // layout needs is already in the detail response this page loaded, so build
  // MemoData straight from `memo` instead of an extra call.
  const handlePrint = () => {
    if (!memo) return
    const projectLabel = projects.find((p) => p.value === memo.projectName)?.label ?? memo.projectName ?? ''
    const departmentLabel = DEPARTMENT_OPTIONS.find((d) => d.value === memo.department)?.label ?? memo.department ?? ''
    setPrintData({
      memoNo: memo.memoNo,
      title: memo.title,
      department: departmentLabel,
      projectName: projectLabel,
      requestedBy: memo.requestedBy,
      note: memo.note ?? '',
      siteDeliveryDate: memo.siteDeliveryDate ? dayjs(memo.siteDeliveryDate).format('DD/MM/YYYY') : '',
      deliveryLocation: memo.deliveryLocation ?? '',
      createdAt: memo.createdAt ? dayjs(memo.createdAt).format('DD/MM/YYYY') : '',
      approverName: memo.approverName ?? '',
      requesterSignature: memo.requesterSignature,
      approvalSignature: memo.approvalSignature ? {
        ...memo.approvalSignature,
        approvedAt: memo.approvalSignature.approvedAt
          ? dayjs(memo.approvalSignature.approvedAt).format('DD/MM/YYYY')
          : undefined,
      } : null,
      status: memo.status,
      items: memo.lines.map((l) => ({
        no: String(l.lineNo),
        desc: l.description,
        qty: l.quantity,
        unit: l.unit,
        remark: l.remark ?? '',
      })),
    })
  }

  const isOwner   = memo && user && String(memo.requestedById) === String(user.id)
  const canEdit   = memo && ['DRAFT', 'REJECTED', 'PENDING_APPROVAL'].includes(String(memo.status).toUpperCase()) && isOwner

  const columns = [
    { title: '#', key: 'no', align: 'center' as const, render: (_: any, __: any, idx: number) => idx + 1, width: 50 },
    {
      title: 'รายการ',
      dataIndex: 'description',
      key: 'description',
      align: 'center' as const,
      render: (desc: string) => <div style={{ textAlign: 'left' }}>{desc}</div>,
    },
    { title: 'จำนวน', dataIndex: 'quantity', key: 'quantity', align: 'right' as const, width: 90 },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit', align: 'center' as const, width: 80 },
    {
      title: 'หมายเหตุ',
      dataIndex: 'remark',
      key: 'remark',
      align: 'center' as const,
      render: (remark?: string) => (
        <div style={{ textAlign: 'left' }}>
          {remark || <span style={{ color: '#9ca3af' }}>—</span>}
        </div>
      ),
    },
  ]

  if (!memo && !loading) {
    return (
      <div>
        <PageHeader title="ใบบันทึกขอซื้อ (Memo)" breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบบันทึกขอซื้อ (Memo)' }]} />
        <Card style={cardStyle}>
          <Empty description="ไม่พบใบบันทึกขอซื้อ (Memo)" />
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={memo?.memoNo ?? '...'}
        subtitle={memo?.title}
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบบันทึกขอซื้อ (Memo)' }, { title: memo?.memoNo ?? '' }]}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(ROUTES.MEMO.LIST)}>
              กลับ
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              พิมพ์
            </Button>
            {canEdit && (
              <Button icon={<EditOutlined />} onClick={() => navigate(ROUTES.MEMO.EDIT.replace(':id', memo!.id))}>
                แก้ไข
              </Button>
            )}
          </Space>
        }
      />

      {memo?.status === 'DRAFT' && (
        <Alert type="info" showIcon message="ร่าง — ยังไม่ได้ส่งขออนุมัติ" style={{ marginBottom: 16, borderRadius: 8 }} />
      )}
      {memo?.status === 'PENDING_APPROVAL' && (
        <Alert type="warning" showIcon message="รอการอนุมัติจาก Senior PM" style={{ marginBottom: 16, borderRadius: 8 }} />
      )}
      {memo?.status === 'APPROVED' && (
        <Alert type="success" showIcon message="อนุมัติแล้ว — สามารถสร้างใบสั่งซื้อได้" style={{ marginBottom: 16, borderRadius: 8 }} />
      )}
      {memo?.status === 'REJECTED' && (
        <Alert type="error" showIcon message="ถูกปฏิเสธ — กรุณาแก้ไขแล้วส่งใหม่" style={{ marginBottom: 16, borderRadius: 8 }} />
      )}
      {memo?.status === 'CANCELLED' && (
        <Alert type="error" showIcon message="ยกเลิกแล้ว" style={{ marginBottom: 16, borderRadius: 8 }} />
      )}

      <Card title={<span style={cardTitleStyle}>ข้อมูลทั่วไป</span>} style={{ ...cardStyle, marginBottom: 16 }} loading={loading}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="เลขที่ใบบันทึกขอซื้อ (Memo)">
            <strong style={{ color: '#2563eb' }}>{memo?.memoNo}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="วันที่">
            {memo?.createdAt ? dayjs(memo.createdAt).format('DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="ผู้สร้าง">{memo?.requestedBy || '—'}</Descriptions.Item>
          <Descriptions.Item label="ผู้อนุมัติ">{memo?.approverName || '—'}</Descriptions.Item>
          <Descriptions.Item label="หน่วยงาน">{memo?.department || '—'}</Descriptions.Item>
          <Descriptions.Item label="สถานที่ส่งของ">{memo?.deliveryLocation || '—'}</Descriptions.Item>
          <Descriptions.Item label="โครงการ">
            {memo?.projectName
              ? (projects.find((p) => p.value === memo.projectName)?.label.replace(' — ', ' ') ?? memo.projectName)
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            {memo && <MemoStatusBadge status={memo.status} />}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<span style={cardTitleStyle}>รายการวัสดุ/บริการ</span>} style={{ ...cardStyle, marginBottom: 16 }} loading={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={memo?.lines ?? []}
          pagination={false}
          scroll={{ x: 700 }}
        />

        {memo?.note && (
          <div style={{
            background: '#f0f5ff',
            borderRadius: 8,
            padding: 12,
            marginTop: 16,
            fontSize: 13,
            color: '#374151',
            lineHeight: 1.6,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
              หมายเหตุ
            </div>
            {memo.note}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            {(memo?.status === 'DRAFT' || memo?.status === 'draft' || memo?.status === 'pending_po') && isOwner && (
              <Button danger icon={<StopOutlined />} onClick={handleCancel}>
                ยกเลิกใบบันทึกขอซื้อ (Memo)
              </Button>
            )}
            {memo?.status === 'PENDING_APPROVAL' && showApproveActions && canApprove && (
              <>
                <Button
                  danger
                  icon={<StopOutlined />}
                  loading={approving}
                  onClick={() => setCancelModal(true)}
                >
                  Cancel
                </Button>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  loading={approving}
                  onClick={() => setRejectModal(true)}
                >
                  Reject
                </Button>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={approving}
                  onClick={() => handleApprovalAction('APPROVE')}
                  style={{ background: '#22c55e', borderColor: '#22c55e' }}
                >
                  Approve
                </Button>
              </>
            )}
            {memo?.status === 'PENDING_APPROVAL' && showApproveActions && !canApprove && !approvalStatusLoading && (
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                คุณไม่มีสิทธิ์อนุมัติเอกสารนี้
              </span>
            )}
          </Space>
        </div>
      </Card>

      {memo?.attachments && memo.attachments.length > 0 && (
        <AttachmentSection title="ไฟล์แนบ" items={memo.attachments} />
      )}

      {showApproveActions && (
        <Modal
          title="Reject Memo"
          open={rejectModal}
          onOk={() => handleApprovalAction('REJECT', rejectReason)}
          onCancel={() => { setRejectModal(false); setRejectReason('') }}
          okText="Confirm Reject"
          cancelText="Cancel"
          okButtonProps={{ danger: true, loading: approving }}
        >
          <div style={{ marginBottom: 8, fontSize: 13, color: '#374151' }}>
            Reason for rejection <span style={{ color: '#ef4444' }}>*</span>
          </div>
          <Input.TextArea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejection..."
            maxLength={500}
            showCount
          />
        </Modal>
      )}

      {showApproveActions && (
        <Modal
          title="Cancel Memo"
          open={cancelModal}
          onOk={handleCancelApproval}
          onCancel={() => { setCancelModal(false); setCancelReason('') }}
          okText="Confirm Cancel"
          cancelText="Close"
          okButtonProps={{ danger: true, loading: approving }}
        >
          <div style={{ marginBottom: 8, fontSize: 13, color: '#374151' }}>
            Reason (optional)
          </div>
          <Input.TextArea
            rows={4}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter reason for cancelling..."
            maxLength={500}
            showCount
          />
        </Modal>
      )}

      {printData && (
        <MemoPrint
          data={printData}
          onReady={() => {
            window.print()
            setPrintData(null)
          }}
        />
      )}
    </div>
  )
}

export default MemoDetailPage
