import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Space, Tooltip, Modal, Input, message,
} from 'antd'
import {
  CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { ROUTES } from '@/config/routes'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

interface MemoItem {
  id: string
  memoNo: string
  title: string
  requestedBy: string
  department?: string
  projectCode?: string
  totalAmount: number
  createdAt: string
  status: string
}

const MemoApprovalPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<MemoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectId, setRejectId] = useState<string>('')
  const [rejectReason, setRejectReason] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/memo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { status: 'PENDING_APPROVAL', page_size: 100 },
      })
      const raw = Array.isArray(res.data)
        ? res.data
        : res.data?.data?.data ?? res.data?.data ?? []
      setData(raw.map((m: any) => ({
        id:          String(m.id),
        memoNo:      m.memo_no           ?? m.memoNo        ?? '',
        title:       m.title             ?? '',
        requestedBy: m.requested_by_name ?? m.requestedBy   ?? '',
        department:  m.department,
        projectCode: m.project_code       ?? m.projectCode,
        totalAmount: m.total_amount      ?? m.totalAmount   ?? 0,
        createdAt:   m.created_at        ?? m.createdAt     ?? '',
        status:      m.status,
      })))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    try {
      await axios.post(
        `${BASE_URL}/memo/${id}/approve`,
        { action: 'APPROVE', comments: 'Approved' },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      message.success('Memo approved successfully')
      fetchData()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Approval failed')
    } finally {
      setActionLoading(null)
    }
  }

  const openRejectModal = (id: string) => {
    setRejectId(id)
    setRejectReason('')
    setRejectModal(true)
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      message.warning('Please provide a reason for rejection')
      return
    }
    setActionLoading(rejectId)
    try {
      await axios.post(
        `${BASE_URL}/memo/${rejectId}/approve`,
        { action: 'REJECT', comments: rejectReason },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ) 
      message.success('Memo rejected')
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
      title: 'Memo No.',
      dataIndex: 'memoNo',
      key: 'memoNo',
      render: (memoNo: string, record: MemoItem) => (
        <a
          style={{ color: '#2563eb', fontWeight: 600 }}
          onClick={() => navigate(`/memo/${record.id}/approval-detail`)}
        >
          {memoNo}
        </a>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Requested By',
      dataIndex: 'requestedBy',
      key: 'requestedBy',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (val?: string) => val || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'Project Code',
      dataIndex: 'projectCode',
      key: 'projectCode',
      render: (val?: string) => val || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'มูลค่ารวม',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (val: number) =>
        (val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: any, record: MemoItem) => (
        <Space>
          <Tooltip title="View detail">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/memo/${record.id}/approval-detail`)}
            />
          </Tooltip>
          <Tooltip title="Reject">
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              loading={actionLoading === record.id}
              onClick={() => openRejectModal(record.id)}
            />
          </Tooltip>
          <Tooltip title="Approve">
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              loading={actionLoading === record.id}
              onClick={() => handleApprove(record.id)}
              style={{ background: '#22c55e', borderColor: '#22c55e' }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Memo Approval"
        subtitle="Review and approve pending memo requests"
        breadcrumbs={[{ title: 'Home' }, { title: 'Memo Approval' }]}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Refresh
          </Button>
        }
      />

      <Card
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}
      >
        {data.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: '#FFFBEB',
            border: '0.5px solid #FDE68A',
            borderRadius: 10,
            padding: '12px 20px',
            marginBottom: 16,
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}>
              {data.length}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#92400E' }}>
                รายการรออนุมัติ
              </div>
              <div style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>
                กดปุ่ม <strong>✓</strong> เพื่ออนุมัติ หรือกด <strong>View</strong> เพื่อดูรายละเอียดก่อนดำเนินการ
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
        title="Reject Memo"
        open={rejectModal}
        onOk={handleReject}
        onCancel={() => setRejectModal(false)}
        okText="Confirm Reject"
        cancelText="Cancel"
        okButtonProps={{ danger: true, loading: !!actionLoading }}
      >
        <div style={{ marginBottom: 8, fontSize: 13, color: '#374151' }}>
          Reason for rejection <span style={{ color: '#ef4444' }}>*</span>
        </div>
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Enter reason..."
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  )
}

export default MemoApprovalPage
