import React, { useEffect, useState } from 'react'
import { Card, Descriptions, Table, Tag, Timeline, Button, Modal, Input, InputNumber, message, Spin } from 'antd'
import axios from 'axios'
import dayjs from 'dayjs'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import {
  REQUISITION_STATUS_COLOR, REQUISITION_STATUS_LABEL,
} from '@/types/requisition'
import type { RequisitionDetail, RequisitionLine } from '@/types/requisition'

const BASE_URL = (import.meta as any).env?.VITE_API_URL
const MENU_CODE = 'MENU_STOCK_REQUISITION'
const APPROVAL_MENU_CODE = 'MENU_STOCK_REQUISITION_APPROVAL'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const matTypeColor: Record<string, string> = {
  RETURNABLE: 'blue',
  CONSUMABLE: 'orange',
}

const timelineColor = (status: string) =>
  status === 'APPROVED' ? 'green' : status === 'REJECTED' ? 'red' : 'blue'

const MaterialRequisitionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<RequisitionDetail | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [approveLines, setApproveLines] = useState<RequisitionLine[]>([])
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectRemarks, setRejectRemarks] = useState('')

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/borrow/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      setDetail(res.data?.data ?? null)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลใบขอเบิกไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDetail() }, [id])

  const handleSubmit = async () => {
    setActionLoading(true)
    try {
      await axios.post(`${BASE_URL}/borrow/${id}/submit`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('ส่งอนุมัติสำเร็จ')
      fetchDetail()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'ส่งอนุมัติไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }

  const openApproveModal = () => {
    if (!detail) return
    setApproveLines(detail.lines.map((l) => ({ ...l, qty_approved: l.qty_approved ?? l.qty_requested })))
    setApproveModalOpen(true)
  }

  const updateApproveQty = (stockItemId: number, val: number | null) => {
    setApproveLines((prev) => prev.map((l) => (l.stock_item_id === stockItemId ? { ...l, qty_approved: val ?? 0 } : l)))
  }

  const handleApprove = async () => {
    setActionLoading(true)
    try {
      await axios.post(
        `${BASE_URL}/borrow/${id}/approve`,
        {
          lines: approveLines.map((l) => ({ borrow_line_id: l.borrow_line_id, qty_approved: l.qty_approved })),
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      message.success('อนุมัติสำเร็จ')
      setApproveModalOpen(false)
      fetchDetail()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'อนุมัติไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectRemarks.trim()) {
      message.warning('กรุณาระบุเหตุผล')
      return
    }
    setActionLoading(true)
    try {
      await axios.post(
        `${BASE_URL}/borrow/${id}/reject`,
        { remarks: rejectRemarks },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      message.success('ปฏิเสธใบขอเบิกสำเร็จ')
      setRejectModalOpen(false)
      setRejectRemarks('')
      fetchDetail()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'ปฏิเสธไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }

  const lineColumns = [
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'ชื่อวัสดุ', dataIndex: 'item_name', key: 'item_name', ellipsis: true },
    {
      title: 'ประเภท',
      dataIndex: 'mat_type',
      key: 'mat_type',
      render: (v: string) => <Tag color={matTypeColor[v]}>{v}</Tag>,
    },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit' },
    { title: 'จำนวนขอ', dataIndex: 'qty_requested', key: 'qty_requested', align: 'right' as const },
    {
      title: 'จำนวนอนุมัติ',
      dataIndex: 'qty_approved',
      key: 'qty_approved',
      align: 'right' as const,
      render: (v?: number) => (v ?? v === 0 ? v : '—'),
    },
  ]

  if (loading) {
    return (
      <div>
        <Card style={cardStyle}>
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        </Card>
      </div>
    )
  }

  if (!detail) {
    return <div style={{ padding: 24 }}>ไม่พบใบขอเบิก</div>
  }

  return (
    <div>
      <PageHeader
        title={detail.borrow_no}
        subtitle={REQUISITION_STATUS_LABEL[detail.status] || detail.status}
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'ใบขอเบิก' }, { title: detail.borrow_no }]}
        extra={<Button onClick={() => navigate('/stock/requisition')}>กลับ</Button>}
      />

      <Card title="ข้อมูลใบขอเบิก" style={cardStyle}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="เลขใบขอเบิก">{detail.borrow_no}</Descriptions.Item>
          <Descriptions.Item label="วันที่ขอ">{dayjs(detail.borrow_date).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label="ผู้ขอเบิก">{detail.borrower_name}</Descriptions.Item>
          <Descriptions.Item label="คลัง">{detail.warehouse_code}</Descriptions.Item>
          <Descriptions.Item label="วันที่ต้องคืน">
            {detail.expected_return ? dayjs(detail.expected_return).format('DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="วัตถุประสงค์">{detail.purpose || '—'}</Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            <Tag color={REQUISITION_STATUS_COLOR[detail.status]}>{REQUISITION_STATUS_LABEL[detail.status] || detail.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="ผู้อนุมัติ">{detail.approved_by_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="วันที่อนุมัติ">
            {detail.approved_at ? dayjs(detail.approved_at).format('DD/MM/YYYY HH:mm') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="หมายเหตุ">{detail.remarks || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="รายการวัสดุ" style={cardStyle}>
        <Table
          rowKey="stock_item_id"
          dataSource={detail.lines}
          columns={lineColumns}
          pagination={false}
          locale={{ emptyText: 'ไม่มีรายการ' }}
        />
      </Card>

      <Card title="ประวัติสถานะ" style={cardStyle}>
        <Timeline>
          {(detail.status_log || []).map((log, i) => (
            <Timeline.Item key={i} color={timelineColor(log.to_status)}>
              <div><b>{REQUISITION_STATUS_LABEL[log.to_status] || log.to_status}</b> — {log.changed_by_name}</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>{dayjs(log.changed_at).format('DD/MM/YYYY HH:mm')}</div>
              {log.remarks && <div>{log.remarks}</div>}
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {detail.status === 'DRAFT' && (
          <>
            <PermissionButton menuCode={MENU_CODE} action="write" onClick={() => navigate(`/stock/requisition/${id}/edit`)}>
              แก้ไข
            </PermissionButton>
            <PermissionButton menuCode={MENU_CODE} action="write" type="primary" loading={actionLoading} onClick={handleSubmit}>
              ส่งอนุมัติ
            </PermissionButton>
          </>
        )}

        {detail.status === 'REJECTED' && (
          <PermissionButton menuCode={MENU_CODE} action="write" onClick={() => navigate(`/stock/requisition/${id}/edit`)}>
            แก้ไขและส่งใหม่
          </PermissionButton>
        )}

        {detail.status === 'PENDING_APPROVAL' && (
          <>
            <PermissionButton menuCode={APPROVAL_MENU_CODE} action="write" type="primary" onClick={openApproveModal}>
              อนุมัติ
            </PermissionButton>
            <PermissionButton menuCode={APPROVAL_MENU_CODE} action="write" danger onClick={() => setRejectModalOpen(true)}>
              ปฏิเสธ
            </PermissionButton>
          </>
        )}
      </div>

      <Modal
        title="อนุมัติใบขอเบิก"
        open={approveModalOpen}
        onCancel={() => setApproveModalOpen(false)}
        onOk={handleApprove}
        okText="ยืนยันอนุมัติ"
        okType="primary"
        confirmLoading={actionLoading}
        width={640}
      >
        <p>ระบุจำนวนที่อนุมัติต่อรายการ (ค่าเริ่มต้น = จำนวนที่ขอ)</p>
        <Table
          rowKey="stock_item_id"
          dataSource={approveLines}
          pagination={false}
          columns={[
            { title: 'ชื่อวัสดุ', dataIndex: 'item_name' },
            { title: 'ขอ', dataIndex: 'qty_requested', align: 'right' as const },
            { title: 'คงเหลือ', dataIndex: 'current_qty', align: 'right' as const, render: (v?: number) => (v ?? 0).toLocaleString() },
            {
              title: 'อนุมัติ',
              key: 'qty_approved',
              render: (_: unknown, record: RequisitionLine) => (
                <InputNumber
                  min={0}
                  max={record.current_qty}
                  value={record.qty_approved}
                  onChange={(v) => updateApproveQty(record.stock_item_id, v)}
                />
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title="ปฏิเสธใบขอเบิก"
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        onOk={handleReject}
        okText="ยืนยันปฏิเสธ"
        okType="danger"
        confirmLoading={actionLoading}
      >
        <p>กรุณาระบุเหตุผล</p>
        <Input.TextArea rows={3} value={rejectRemarks} onChange={(e) => setRejectRemarks(e.target.value)} />
      </Modal>
    </div>
  )
}

export default MaterialRequisitionDetailPage
