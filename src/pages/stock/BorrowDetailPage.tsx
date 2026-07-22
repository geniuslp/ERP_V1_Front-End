import React, { useEffect, useState } from 'react'
import {
  Card, Descriptions, Table, Button, Space, Alert, Modal, Input,
  message, Tag,
} from 'antd'
import { CheckOutlined, CloseOutlined, SendOutlined, QrcodeOutlined, RollbackOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import BorrowStatusBadge from '@/components/stock/BorrowStatusBadge'
import { useAppSelector } from '@/store'
import { mockBorrowRequests } from '@/utils/mockStockData'
import type { BorrowRequest, BorrowLine } from '@/types/stock'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const BorrowDetailPage: React.FC<{ showApproveActions?: boolean }> = ({ showApproveActions }) => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const canApprove = showApproveActions || searchParams.get('approve') === 'true'
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const user = useAppSelector((s) => s.auth.user)

  const [data, setData] = useState<BorrowRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [scanModal, setScanModal] = useState<'receive' | 'return' | null>(null)
  const [scanValue, setScanValue] = useState('')
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/stock/borrow/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const raw = res.data?.data ?? res.data
      setData(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null)
    } catch {
      const mock = mockBorrowRequests.find((b) => b.id === Number(id))
      setData(mock ?? null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  const handleAction = async (action: string, payload?: any) => {
    setActionLoading(true)
    try {
      await axios.post(`${BASE_URL}/stock/borrow/${id}/${action}`, payload ?? {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success(`${action} successful`)
      fetchData()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleScan = () => {
    if (!scanValue.trim()) return
    message.success(`Scanned: ${scanValue}`)
    setScanValue('')
  }

  const lineColumns = [
    { title: '#', dataIndex: 'lineNo', key: 'lineNo', width: 50 },
    { title: 'Item', dataIndex: 'itemName', key: 'itemName' },
    { title: 'Location', dataIndex: 'locationName', key: 'locationName' },
    { title: 'Qty Req.', dataIndex: 'qtyRequested', key: 'qtyRequested', align: 'right' as const },
    { title: 'Qty Approved', dataIndex: 'qtyApproved', key: 'qtyApproved', align: 'right' as const, render: (v?: number) => v ?? '—' },
    { title: 'Qty Borrowed', dataIndex: 'qtyBorrowed', key: 'qtyBorrowed', align: 'right' as const, render: (v?: number) => v ?? '—' },
    { title: 'Qty Returned', dataIndex: 'qtyReturned', key: 'qtyReturned', align: 'right' as const, render: (v?: number) => v ?? '—' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
  ]

  if (!data && !loading) return <div style={{ padding: 24 }}>Borrow request not found.</div>

  return (
    <div>
      <PageHeader
        title={data?.borrowNo ?? 'Loading...'}
        subtitle={data ? data.status : undefined}
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'Borrow & Return', href: '/stock/borrow' }, { title: data?.borrowNo ?? id ?? '' }]}
      />

      {data?.status === 'DRAFT' && (
        <Alert type="info" message="This request is in Draft. Submit to send for approval." style={{ marginBottom: 16 }} />
      )}
      {data?.status === 'PENDING_APPROVAL' && (
        <Alert type="warning" message="Waiting for approval." style={{ marginBottom: 16 }} />
      )}
      {data?.status === 'APPROVED' && (
        <Alert type="success" message="Approved. Click 'Receive Items' to record borrowing." style={{ marginBottom: 16 }} />
      )}
      {data?.status === 'BORROWED' && (
        <Alert type="warning" message="Items are currently borrowed. Return when done." style={{ marginBottom: 16 }} />
      )}
      {data?.status === 'RETURNED' && (
        <Alert type="success" message="All items returned." style={{ marginBottom: 16 }} />
      )}

      <Card title="General Information" style={cardStyle} loading={loading}>
        {data && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Borrow No">{data.borrowNo}</Descriptions.Item>
            <Descriptions.Item label="Status"><BorrowStatusBadge status={data.status} /></Descriptions.Item>
            <Descriptions.Item label="Requested By">{data.requestedBy}</Descriptions.Item>
            <Descriptions.Item label="Approved By">{data.approvedBy || '—'}</Descriptions.Item>
            <Descriptions.Item label="Purpose" span={2}>{data.purpose}</Descriptions.Item>
            <Descriptions.Item label="Borrow Date">{data.borrowDate ? dayjs(data.borrowDate).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Expected Return">{data.expectedReturnDate ? dayjs(data.expectedReturnDate).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Actual Return">{data.actualReturnDate ? dayjs(data.actualReturnDate).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Created At">{data.createdAt ? dayjs(data.createdAt).format('DD/MM/YYYY HH:mm') : '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card title="Line Items" style={cardStyle} loading={loading}>
        <Table
          rowKey="id"
          dataSource={Array.isArray(data?.lines) ? data.lines : []}
          columns={lineColumns}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No items' }}
        />
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={() => navigate('/stock/borrow')}>Back</Button>
        {data?.status === 'DRAFT' && (
          <Button type="primary" icon={<SendOutlined />} loading={actionLoading} onClick={() => handleAction('submit')}
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none' }}>
            Submit
          </Button>
        )}
        {data?.status === 'APPROVED' && (
          <Button type="primary" icon={<QrcodeOutlined />} onClick={() => { setScanModal('receive') }}>
            Receive Items
          </Button>
        )}
        {data?.status === 'BORROWED' && (
          <Button icon={<RollbackOutlined />} onClick={() => { setScanModal('return') }}>
            Return Items
          </Button>
        )}
        {canApprove && data?.status === 'PENDING_APPROVAL' && (
          <>
            <Button danger icon={<CloseOutlined />} loading={actionLoading} onClick={() => { setRejectReason(''); setRejectModal(true) }}>
              Reject
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={actionLoading}
              onClick={() => handleAction('approve', { action: 'APPROVE' })}
              style={{ background: '#22c55e', borderColor: '#22c55e' }}
            >
              Approve
            </Button>
          </>
        )}
      </div>

      <Modal
        title={scanModal === 'receive' ? 'Scan QR to Receive Items' : 'Scan QR to Return Items'}
        open={!!scanModal}
        onCancel={() => { setScanModal(null); setScanValue('') }}
        onOk={() => {
          handleAction(scanModal === 'receive' ? 'receive' : 'return', {})
          setScanModal(null)
        }}
        okText="Confirm"
      >
        <Input
          prefix={<QrcodeOutlined />}
          placeholder="Scan QR Code..."
          value={scanValue}
          onChange={(e) => setScanValue(e.target.value)}
          onPressEnter={handleScan}
          style={{ marginTop: 8 }}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
          Scan each item's QR code to confirm {scanModal === 'receive' ? 'receipt' : 'return'}. Press Enter after each scan.
        </div>
      </Modal>

      <Modal
        title="Reject Borrow Request"
        open={rejectModal}
        onOk={() => { handleAction('approve', { action: 'REJECT', comments: rejectReason }); setRejectModal(false) }}
        onCancel={() => setRejectModal(false)}
        okText="Confirm Reject"
        okButtonProps={{ danger: true, loading: actionLoading }}
      >
        <div style={{ marginBottom: 8, fontSize: 13 }}>Reason <span style={{ color: '#ef4444' }}>*</span></div>
        <Input.TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
      </Modal>
    </div>
  )
}

export default BorrowDetailPage
