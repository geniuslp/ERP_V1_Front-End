import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Descriptions, Table, Button, Space, Alert, Empty, message, Modal, Input } from 'antd'
import { ArrowLeftOutlined, EditOutlined, StopOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import StatusBadge from '@/components/common/StatusBadge'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { usePermissionContext } from '@/contexts/PermissionContext'
import { useApprovalPermission } from '@/hooks/useApprovalPermission'
import { pettyCashService } from '@/services/pettyCashService'
import type { PettyCashRequisition } from '@/types/pettyCash'

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

const APPROVAL_MENU_CODE = 'MENU_PETTY_CASH_APPROVAL'

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PettyCashDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const user = useAppSelector((s) => s.auth.user)
  const { can } = usePermissionContext()

  const [pc, setPc] = useState<PettyCashRequisition | null>(null)
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // Assigned-approver check is identity-based (mirrors PO/Memo) — the
  // MENU_PETTY_CASH_APPROVAL.can_write permission check below is ADDITIVE to
  // this, not a substitute: both must pass before Approve/Reject render.
  const { isAssignedApprover, loading: approvalStatusLoading } = useApprovalPermission('PETTY_CASH', pc?.status === 'PENDING_APPROVAL' ? id : undefined)

  const fetchPc = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await pettyCashService.get(accessToken, id)
      setPc(data)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลใบเบิกเงินสดย่อยไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPc() }, [id])

  const isOwner = pc && user && String(pc.requested_by) === String(user.id)
  const canEditDoc = isOwner && (pc?.status === 'DRAFT' || pc?.status === 'REJECTED') && can('MENU_PETTY_CASH_CREATE', 'update')
  const canDeleteDoc = isOwner && pc?.status === 'DRAFT'
  const canApproveHere = isAssignedApprover && can(APPROVAL_MENU_CODE, 'write')

  const handleDelete = () => {
    if (!pc) return
    Modal.confirm({
      title: 'ยืนยันการลบใบเบิกเงินสดย่อย',
      content: `ต้องการลบใบเบิกเงินสดย่อย ${pc.pc_no} ใช่หรือไม่`,
      okText: 'ยืนยันลบ',
      okButtonProps: { danger: true },
      cancelText: 'ปิด',
      onOk: async () => {
        try {
          await pettyCashService.remove(accessToken, pc.id)
          message.success('ลบใบเบิกเงินสดย่อยสำเร็จ')
          navigate('/petty-cash')
        } catch (err: any) {
          message.error(err?.response?.data?.message || err?.message || 'ลบไม่สำเร็จ')
        }
      },
    })
  }

  const handleSubmit = () => {
    if (!pc) return
    Modal.confirm({
      title: 'ยืนยันการส่งอนุมัติ',
      content: `ต้องการส่งใบเบิกเงินสดย่อย ${pc.pc_no} เพื่อขออนุมัติใช่หรือไม่`,
      okText: 'ส่งอนุมัติ',
      cancelText: 'ปิด',
      onOk: async () => {
        try {
          await pettyCashService.submit(accessToken, pc.id, pc.approver_id)
          message.success('ส่งอนุมัติเรียบร้อย')
          fetchPc()
        } catch (err: any) {
          message.error(err?.response?.data?.message || err?.message || 'ส่งอนุมัติไม่สำเร็จ')
        }
      },
    })
  }

  const handleApprove = async () => {
    if (!pc) return
    setActing(true)
    try {
      await pettyCashService.approve(accessToken, pc.id, 'Approved')
      message.success('อนุมัติเรียบร้อย')
      fetchPc()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'อนุมัติไม่สำเร็จ')
    } finally {
      setActing(false)
    }
  }

  const handleReject = async () => {
    if (!pc) return
    if (!rejectReason.trim()) {
      message.error('กรุณาระบุเหตุผลในการปฏิเสธ')
      return
    }
    setActing(true)
    try {
      await pettyCashService.reject(accessToken, pc.id, rejectReason)
      message.success('ปฏิเสธเรียบร้อย')
      setRejectModal(false)
      setRejectReason('')
      fetchPc()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'ปฏิเสธไม่สำเร็จ')
    } finally {
      setActing(false)
    }
  }

  const columns = [
    { title: '#', key: 'no', width: 48, align: 'center' as const, render: (_: any, __: any, idx: number) => idx + 1 },
    {
      title: 'โครงการ',
      key: 'project',
      width: 150,
      render: (_: unknown, r: any) => r.project_name || r.project_code || '-',
    },
    {
      title: 'รหัสวัสดุ / รายการ',
      key: 'mat',
      render: (_: unknown, r: any) => (
        <div>
          <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.mat_code}</span>
          <div style={{ fontSize: 13 }}>{r.item_name}</div>
        </div>
      ),
    },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 80, align: 'center' as const },
    {
      title: 'Stock อ้างอิง',
      dataIndex: 'stock_on_hand',
      key: 'stock_on_hand',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <span style={{ fontSize: 12, color: '#93c5fd' }}>{v?.toLocaleString('th-TH') ?? 0}</span>,
    },
    { title: 'จำนวน', dataIndex: 'qty', key: 'qty', width: 90, align: 'right' as const },
    { title: 'ราคา/หน่วย', dataIndex: 'unit_price', key: 'unit_price', width: 110, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'มูลค่าสุทธิ/แถว', dataIndex: 'line_net', key: 'line_net', width: 120, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'รายละเอียด', dataIndex: 'description', key: 'description', render: (v?: string) => v || '—' },
  ]

  if (!pc && !loading) {
    return (
      <div>
        <PageHeader title="เบิกเงินสดย่อย" breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'เบิกเงินสดย่อย' }]} />
        <Card style={cardStyle}><Empty description="ไม่พบใบเบิกเงินสดย่อย" /></Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={pc?.pc_no ?? '...'}
        subtitle={pc?.purpose ?? undefined}
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'เบิกเงินสดย่อย' }, { title: pc?.pc_no ?? '' }]}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/petty-cash')}>กลับ</Button>
            {canEditDoc && (
              <Button icon={<EditOutlined />} onClick={() => navigate(`/petty-cash/${pc!.id}/edit`)}>แก้ไข</Button>
            )}
          </Space>
        }
      />

      {pc?.status === 'DRAFT' && <Alert type="info" showIcon message="ร่าง — ยังไม่ได้ส่งขออนุมัติ" style={{ marginBottom: 16, borderRadius: 8 }} />}
      {pc?.status === 'PENDING_APPROVAL' && <Alert type="warning" showIcon message="รอการอนุมัติ" style={{ marginBottom: 16, borderRadius: 8 }} />}
      {pc?.status === 'APPROVED' && <Alert type="success" showIcon message="อนุมัติแล้ว" style={{ marginBottom: 16, borderRadius: 8 }} />}
      {pc?.status === 'REJECTED' && <Alert type="error" showIcon message="ถูกปฏิเสธ — กรุณาแก้ไขแล้วส่งใหม่" style={{ marginBottom: 16, borderRadius: 8 }} />}
      {pc?.status === 'CANCELLED' && <Alert type="error" showIcon message="ยกเลิกแล้ว" style={{ marginBottom: 16, borderRadius: 8 }} />}

      <Card title={<span style={cardTitleStyle}>ข้อมูลทั่วไป</span>} style={{ ...cardStyle, marginBottom: 16 }} loading={loading}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="เลขที่"><strong style={{ color: '#2563eb' }}>{pc?.pc_no}</strong></Descriptions.Item>
          <Descriptions.Item label="วันที่">{pc?.pc_date ? dayjs(pc.pc_date).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
          <Descriptions.Item label="โครงการ">
            {pc?.project_codes && pc.project_codes.length > 0 ? pc.project_codes.join(', ') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="สถานะ">{pc && <StatusBadge status={pc.status} />}</Descriptions.Item>
          <Descriptions.Item label="ผู้ขอเบิก">{pc?.requested_by_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="ผู้อนุมัติ">{pc?.approver_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="วัตถุประสงค์" span={2}>{pc?.purpose || '—'}</Descriptions.Item>
          <Descriptions.Item label="หมายเหตุ" span={2}>{pc?.remarks || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<span style={cardTitleStyle}>รายการ</span>} style={{ ...cardStyle, marginBottom: 16 }} loading={loading}>
        <Table rowKey="id" columns={columns} dataSource={pc?.lines ?? []} pagination={false} size="small" scroll={{ x: 900 }} />
      </Card>

      <Card title={<span style={cardTitleStyle}>สรุปยอด</span>} style={{ ...cardStyle, marginBottom: 16 }} loading={loading}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>ยอดรวมก่อนลด</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>฿ {fmt(pc?.total_amount ?? 0)}</span>
            </div>
            {pc?.use_discount && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>ส่วนลด</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>- ฿ {fmt(pc.discount_amount)}</span>
              </div>
            )}
            {pc?.use_vat && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>VAT</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#ca8a04' }}>+ ฿ {fmt(pc.vat_amount)}</span>
              </div>
            )}
            {pc?.use_wht && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>WHT</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#dc2626' }}>- ฿ {fmt(pc.wht_amount)}</span>
              </div>
            )}
            <div style={{ borderTop: '0.5px solid #dbeafe', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>ยอดรวมสุทธิ</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>฿ {fmt(pc?.net_amount ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* TODO(backend gap): petty_cash_status_log has no dedicated GET endpoint yet
            (unlike GRN/requisition/stock-transfer's /history routes) — an approval
            history timeline can be added here once one exists. */}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            {canDeleteDoc && (
              <Button danger icon={<StopOutlined />} onClick={handleDelete}>ลบ</Button>
            )}
            {(pc?.status === 'DRAFT' || pc?.status === 'REJECTED') && isOwner && (
              <PermissionButton menuCode="MENU_PETTY_CASH_CREATE" action={pc.status === 'DRAFT' ? 'write' : 'update'} type="primary" onClick={handleSubmit}>
                ส่งอนุมัติ
              </PermissionButton>
            )}
            {pc?.status === 'PENDING_APPROVAL' && canApproveHere && (
              <>
                <Button danger icon={<CloseOutlined />} loading={acting} onClick={() => setRejectModal(true)}>ปฏิเสธ</Button>
                <Button type="primary" icon={<CheckOutlined />} loading={acting} onClick={handleApprove} style={{ background: '#22c55e', borderColor: '#22c55e' }}>
                  อนุมัติ
                </Button>
              </>
            )}
            {pc?.status === 'PENDING_APPROVAL' && !canApproveHere && !approvalStatusLoading && isAssignedApprover && (
              <span style={{ fontSize: 12, color: '#9ca3af' }}>คุณไม่มีสิทธิ์ (permission matrix) ในการอนุมัติเอกสารนี้</span>
            )}
          </Space>
        </div>
      </Card>

      <Modal
        title="ปฏิเสธใบเบิกเงินสดย่อย"
        open={rejectModal}
        onOk={handleReject}
        onCancel={() => { setRejectModal(false); setRejectReason('') }}
        okText="ยืนยันปฏิเสธ"
        cancelText="ยกเลิก"
        okButtonProps={{ danger: true, loading: acting }}
      >
        <div style={{ marginBottom: 8, fontSize: 13, color: '#374151' }}>
          เหตุผลในการปฏิเสธ <span style={{ color: '#ef4444' }}>*</span>
        </div>
        <Input.TextArea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={500} showCount />
      </Modal>
    </div>
  )
}

export default PettyCashDetailPage
