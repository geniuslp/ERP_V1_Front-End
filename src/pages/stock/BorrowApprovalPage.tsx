import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tooltip, Modal, Input, message } from 'antd'
import { CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import BorrowStatusBadge from '@/components/stock/BorrowStatusBadge'
import { useAppSelector } from '@/store'
import { mockBorrowRequests } from '@/utils/mockStockData'
import type { BorrowRequest } from '@/types/stock'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const BorrowApprovalPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<BorrowRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectId, setRejectId] = useState<number>(0)
  const [rejectReason, setRejectReason] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/stock/borrow`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { status: 'PENDING_APPROVAL', page_size: 100 },
      })
      const raw = Array.isArray(res.data) ? res.data : res.data?.data
      setData(Array.isArray(raw) ? raw : [])
    } catch {
      setData(mockBorrowRequests.filter((b) => b.status === 'PENDING_APPROVAL'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleApprove = async (id: number) => {
    setActionLoading(id)
    try {
      await axios.post(`${BASE_URL}/stock/borrow/${id}/approve`, { action: 'APPROVE' }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('Approved successfully')
      fetchData()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Approval failed')
    } finally {
      setActionLoading(null)
    }
  }

  const openRejectModal = (id: number) => {
    setRejectId(id)
    setRejectReason('')
    setRejectModal(true)
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { message.warning('Please provide a reason'); return }
    setActionLoading(rejectId)
    try {
      await axios.post(`${BASE_URL}/stock/borrow/${rejectId}/approve`, { action: 'REJECT', comments: rejectReason }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('Rejected')
      setRejectModal(false)
      fetchData()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Rejection failed')
    } finally {
      setActionLoading(null)
    }
  }

  const columns = [
    {
      title: 'Borrow No',
      dataIndex: 'borrowNo',
      key: 'borrowNo',
      render: (no: string, record: BorrowRequest) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/stock/borrow/${record.id}?approve=true`)}>
          {no}
        </a>
      ),
    },
    { title: 'Requested By', dataIndex: 'requestedBy', key: 'requestedBy' },
    { title: 'Purpose', dataIndex: 'purpose', key: 'purpose', ellipsis: true },
    {
      title: 'Borrow Date',
      dataIndex: 'borrowDate',
      key: 'borrowDate',
      render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: () => <BorrowStatusBadge status="PENDING_APPROVAL" />,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: any, record: BorrowRequest) => (
        <Space>
          <Tooltip title="View Detail">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/stock/borrow/${record.id}?approve=true`)} />
          </Tooltip>
          <Tooltip title="Reject">
            <Button size="small" danger icon={<CloseOutlined />} loading={actionLoading === record.id} onClick={() => openRejectModal(record.id)} />
          </Tooltip>
          <Tooltip title="Approve">
            <Button size="small" type="primary" icon={<CheckOutlined />} loading={actionLoading === record.id}
              onClick={() => handleApprove(record.id)} style={{ background: '#22c55e', borderColor: '#22c55e' }} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Borrow Approval"
        subtitle="Review and approve pending borrow requests"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'Borrow Approval' }]}
        extra={<Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>}
      />

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        {data.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            background: '#FFFBEB', border: '0.5px solid #FDE68A',
            borderRadius: 10, padding: '12px 20px', marginBottom: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: '#F59E0B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {data.length}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#92400E' }}>Pending Borrow Approval</div>
              <div style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>
                Click <strong>✓</strong> to approve or <strong>View</strong> for detail.
              </div>
            </div>
          </div>
        )}
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 10, showTotal: (t) => `Total ${t} items` }}
          locale={{ emptyText: 'No pending approvals' }}
        />
      </Card>

      <Modal
        title="Reject Borrow Request"
        open={rejectModal}
        onOk={handleReject}
        onCancel={() => setRejectModal(false)}
        okText="Confirm Reject"
        cancelText="Cancel"
        okButtonProps={{ danger: true, loading: !!actionLoading }}
      >
        <div style={{ marginBottom: 8, fontSize: 13, color: '#374151' }}>Reason <span style={{ color: '#ef4444' }}>*</span></div>
        <Input.TextArea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter reason..." maxLength={500} showCount />
      </Modal>
    </div>
  )
}

export default BorrowApprovalPage
