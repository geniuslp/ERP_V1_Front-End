import React, { useState, useEffect } from 'react'
import {
  Button, Descriptions, Table, Tag, Alert, Spin,
  Modal, Form, Input, Popconfirm, message, Space,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { useAppSelector } from '@/store'
import type { PODetail, PODetailResponse, POLine, POStatus } from '@/types/po'
import { poApprovalService } from '@/services/poApprovalService'

// TODO: enable when permission system is ready
// const canAct = isManager && po.status === 'PENDING_APPROVAL'
// const canCancel = isManager && po.status === 'APPROVED'

const statusTag = (status: POStatus) => {
  const map: Record<POStatus, { color: string; label: string }> = {
    DRAFT: { color: 'default', label: 'แบบร่าง' },
    PENDING_APPROVAL: { color: 'processing', label: 'รออนุมัติ' },
    APPROVED: { color: 'success', label: 'อนุมัติแล้ว' },
    REJECTED: { color: 'error', label: 'ไม่อนุมัติ' },
    CANCELLED: { color: 'warning', label: 'ยกเลิก' },
  }
  const s = map[status] ?? { color: 'default', label: status }
  return <Tag color={s.color}>{s.label}</Tag>
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  padding: 24,
  marginBottom: 16,
}

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

  const canAct = po?.status === 'PENDING_APPROVAL'
  const canCancel = po?.status === 'APPROVED'

  const lineColumns: ColumnsType<POLine> = [
    {
      title: 'ลำดับ',
      dataIndex: 'line_no',
      key: 'line_no',
      width: 70,
      align: 'center',
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
          <div>{r.spec_description ?? '—'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{r.brand_name ?? ''}</div>
        </div>
      ),
    },
    {
      title: 'จำนวนสั่ง',
      key: 'qty_ordered',
      width: 120,
      align: 'right',
      render: (_: unknown, r: POLine) =>
        `${r.qty_ordered.toLocaleString()} ${r.unit_name ?? ''}`,
    },
    {
      title: 'ราคา/หน่วย',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      align: 'right',
      render: (v: number) => v.toLocaleString('th-TH'),
    },
    {
      title: 'มูลค่า',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right',
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
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1e3a8a' }}>{po.po_no}</span>
          {statusTag(po.status)}
        </Space>

        <Space>
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
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={approving}
                  style={{ background: '#22c55e', borderColor: '#22c55e' }}
                >
                  อนุมัติ
                </Button>
              </Popconfirm>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => setRejectOpen(true)}
              >
                ไม่อนุมัติ
              </Button>
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
              <Button
                icon={<StopOutlined />}
                loading={cancelling}
                style={{ borderColor: '#d97706', color: '#d97706' }}
              >
                ยกเลิก PO
              </Button>
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
          <Descriptions.Item label="เลข PO">{po.po_no}</Descriptions.Item>
          <Descriptions.Item label="วันที่">{po.po_date?.slice(0, 10) ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="สถานะ">{statusTag(po.status)}</Descriptions.Item>
          <Descriptions.Item label="Supplier">{po.supplier_name}</Descriptions.Item>
          <Descriptions.Item label="รหัส Supplier">{po.supplier_code}</Descriptions.Item>
          <Descriptions.Item label="เงื่อนไขการชำระ">{po.payment_terms ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="ที่อยู่จัดส่ง" span={2}>{po.delivery_address ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="คลัง">{po.warehouse_code ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="สกุลเงิน">{po.currency}</Descriptions.Item>
          <Descriptions.Item label="มูลค่ารวม" contentStyle={{ textAlign: 'right' }}>
            {po.total_amount.toLocaleString('th-TH')}
          </Descriptions.Item>
          <Descriptions.Item label="ภาษี VAT" contentStyle={{ textAlign: 'right' }}>
            {po.vat_amount.toLocaleString('th-TH')}
          </Descriptions.Item>
          <Descriptions.Item label="มูลค่าสุทธิ" contentStyle={{ textAlign: 'right', fontWeight: 700 }}>
            {po.net_amount.toLocaleString('th-TH')}
          </Descriptions.Item>
          <Descriptions.Item label="วันที่ต้องการ">{po.expected_date?.slice(0, 10) ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="ผู้สร้าง">{po.created_by_name}</Descriptions.Item>
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
    </div>
  )
}

export default POApprovalDetailPage
