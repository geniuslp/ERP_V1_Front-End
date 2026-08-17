import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card, Descriptions, Table, Button, Space, Alert, Empty, message, Modal, Input,
} from 'antd'
import {
  ArrowLeftOutlined, PrinterOutlined, EditOutlined, StopOutlined,
  CheckOutlined, CloseOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import MemoStatusBadge from './components/MemoStatusBadge'
import { ROUTES } from '@/config/routes'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

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
  projectName?: string
  note?: string
  createdAt: string
  lines: MemoLineItem[]
}

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
    projectName:   raw.project_code,
    note:          raw.note,
    createdAt:     raw.created_at     ?? '',
    lines,
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

  const isOwner   = memo && user && String(memo.requestedById) === String(user.id)
  const canEdit   = memo && (memo.status === 'DRAFT' || memo.status === 'draft') && isOwner

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
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
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
          <Descriptions.Item label="โครงการ">{memo?.projectName || '—'}</Descriptions.Item>
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



    </div>
  )
}

export default MemoDetailPage
