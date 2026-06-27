import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card, Descriptions, Table, Button, Space, Alert, Empty, message, Modal, Input,
} from 'antd'
import {
  ArrowLeftOutlined, PrinterOutlined, EditOutlined, FileAddOutlined, StopOutlined,
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
  estimatedPrice: number
  lineAmount: number
  remark?: string
}

interface MemoDetail {
  id: string
  memoNo: string
  title: string
  status: string
  requestedBy: string
  requestedById: number
  department?: string
  projectName?: string
  note?: string
  totalAmount: number
  createdAt: string
  lines: MemoLineItem[]
}

const mapMemo = (raw: any): MemoDetail => {
  const lines = (raw.lines ?? raw.items ?? []).map((l: any) => ({
    id:             l.id,
    lineNo:         l.line_no         ?? 0,
    description:    l.description     ?? '',
    unit:           l.unit            ?? '',
    quantity:       l.quantity        ?? 0,
    estimatedPrice: l.estimated_price ?? 0,
    lineAmount:     l.line_amount     ?? (l.quantity ?? 0) * (l.estimated_price ?? 0),
    remark:         l.remark,
  }))

  const totalAmount = raw.total_amount
    ?? lines.reduce((sum: number, l: any) => sum + (l.lineAmount ?? 0), 0)

  return {
    id:            String(raw.id),
    memoNo:        raw.memo_no        ?? '',
    title:         raw.title          ?? '',
    status:        raw.status         ?? 'DRAFT',
    requestedBy:   raw.requested_by_name ?? '',
    requestedById: raw.requested_by   ?? 0,
    department:    raw.department,
    projectName:   raw.project_code,
    note:          raw.note,
    totalAmount,
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
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลใบบันทึกไม่สำเร็จ'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMemo() }, [id])

  const handleCancel = () => {
    if (!memo) return
    Modal.confirm({
      title: 'ยืนยันการยกเลิกใบบันทึก',
      content: `ต้องการยกเลิกใบบันทึก ${memo.memoNo} ใช่หรือไม่`,
      okText: 'ยืนยันยกเลิก',
      cancelText: 'ปิด',
      onOk: async () => {
        try {
          await axios.patch(`${BASE_URL}/memo/${memo.id}/cancel`, {}, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          message.success('ยกเลิกใบบันทึกสำเร็จ')
          fetchMemo()
        } catch (err: any) {
          message.error(
            err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ยกเลิกใบบันทึกไม่สำเร็จ'
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

  const isOwner   = memo && user && String(memo.requestedById) === String(user.id)
  const canEdit   = memo && (memo.status === 'DRAFT' || memo.status === 'draft') && isOwner
  const canCreatePO = memo && (memo.status === 'APPROVED' || memo.status === 'pending_po')

  const columns = [
    { title: '#', key: 'no', render: (_: any, __: any, idx: number) => idx + 1, width: 50 },
    {
      title: 'รายการ',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string, record: MemoLineItem) => (
        <div>
          <div>{desc}</div>
          {record.remark && <div style={{ fontSize: 12, color: '#9ca3af' }}>{record.remark}</div>}
        </div>
      ),
    },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 80 },
    { title: 'จำนวน', dataIndex: 'quantity', key: 'quantity', align: 'right' as const, width: 90 },
    {
      title: 'ราคา/หน่วย',
      dataIndex: 'estimatedPrice',
      key: 'estimatedPrice',
      align: 'right' as const,
      width: 110,
      render: (val: number) => (val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'รวม',
      dataIndex: 'lineAmount',
      key: 'lineAmount',
      align: 'right' as const,
      width: 120,
      render: (val: number, record: MemoLineItem) =>
        (val ?? record.quantity * record.estimatedPrice ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
  ]

  if (!memo && !loading) {
    return (
      <div>
        <PageHeader title="ใบบันทึก" breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบบันทึก' }]} />
        <Card style={cardStyle}>
          <Empty description="ไม่พบใบบันทึก" />
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={memo?.memoNo ?? '...'}
        subtitle={memo?.title}
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบบันทึก' }, { title: memo?.memoNo ?? '' }]}
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
            {canCreatePO && (
              <Button
                type="primary"
                icon={<FileAddOutlined />}
                onClick={() => navigate(ROUTES.PO.CREATE, { state: { fromMemoId: memo!.id, memo } })}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                }}
              >
                สร้างใบ PO จาก Memo นี้
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
          <Descriptions.Item label="เลขที่ใบบันทึก">
            <strong style={{ color: '#2563eb' }}>{memo?.memoNo}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="วันที่">
            {memo?.createdAt ? dayjs(memo.createdAt).format('DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="ผู้สร้าง">{memo?.requestedBy || '—'}</Descriptions.Item>
          <Descriptions.Item label="หน่วยงาน">{memo?.department || '—'}</Descriptions.Item>
          <Descriptions.Item label="โครงการ">{memo?.projectName || '—'}</Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            {memo && <MemoStatusBadge status={memo.status} />}
          </Descriptions.Item>
        </Descriptions>
        {memo?.note && (
          <div style={{ background: '#f0f5ff', borderRadius: 8, padding: 12, marginTop: 12, fontSize: 13 }}>
            {memo.note}
          </div>
        )}
      </Card>

      <Card title={<span style={cardTitleStyle}>รายการวัสดุ/บริการ</span>} style={{ ...cardStyle, marginBottom: 16 }} loading={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={memo?.lines ?? []}
          pagination={false}
          scroll={{ x: 700 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5} align="right">
                  <strong style={{ color: '#64748b', fontSize: 12 }}>มูลค่ารวม</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <strong style={{ color: '#1e40af' }}>
                    {(memo?.totalAmount ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            {(memo?.status === 'DRAFT' || memo?.status === 'draft' || memo?.status === 'pending_po') && isOwner && (
              <Button danger icon={<StopOutlined />} onClick={handleCancel}>
                ยกเลิกใบบันทึก
              </Button>
            )}
            {canCreatePO && (
              <Button
                type="primary"
                icon={<FileAddOutlined />}
                onClick={() => navigate(ROUTES.PO.CREATE, { state: { fromMemoId: memo!.id, memo } })}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                }}
              >
                สร้างใบ PO จาก Memo นี้
              </Button>
            )}
            {memo?.status === 'PENDING_APPROVAL' && showApproveActions && (
              <>
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
    </div>
  )
}

export default MemoDetailPage
