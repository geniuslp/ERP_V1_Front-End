import React, { useState, useEffect } from 'react'
import {
  Button, Descriptions, Table, Tag, Alert, Spin,
  Modal, Form, Input, Popconfirm, message, Space,
} from 'antd'
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import axios from 'axios'
import { useAppSelector } from '@/store'
import type { PRDetail, PRDetailResponse, PRLine, PRAttachment, PRStatus } from '@/types/pr'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const statusTag = (status: PRStatus) => {
  const map: Record<PRStatus, { color: string; label: string }> = {
    PENDING_APPROVAL: { color: 'processing', label: 'รออนุมัติ' },
    APPROVED: { color: 'success', label: 'อนุมัติแล้ว' },
    REJECTED: { color: 'error', label: 'ไม่อนุมัติ' },
    DRAFT: { color: 'default', label: 'แบบร่าง' },
    CANCELLED: { color: 'warning', label: 'ยกเลิก' },
  }
  const s = map[status] ?? { color: 'default', label: status }
  return <Tag color={s.color}>{s.label}</Tag>
}

const formatSize = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1048576
    ? `${(b / 1024).toFixed(1)} KB`
    : `${(b / 1048576).toFixed(1)} MB`

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  padding: 24,
  marginBottom: 16,
}

const PRApprovalDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  // TODO: enable when permission system is ready
  // const userDept = useAppSelector((s) => s.auth.user?.department)
  // const isSeniorPM = userDept === 'Senior Project Mgr'

  const [loading, setLoading] = useState(false)
  const [pr, setPr] = useState<PRDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [approving, setApproving] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectForm] = Form.useForm()

  const fetchDetail = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await axios.get<PRDetailResponse>(`${BASE_URL}/pr/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      setPr(res.data.data)
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true)
      } else {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ',
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
      await axios.put(`${BASE_URL}/pr/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('อนุมัติ PR สำเร็จ')
      fetchDetail()
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'อนุมัติไม่สำเร็จ',
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
        await axios.put(`${BASE_URL}/pr/${id}/reject`, { reason: values.reason }, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('ไม่อนุมัติ PR เรียบร้อย')
        setRejectOpen(false)
        rejectForm.resetFields()
        fetchDetail()
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ดำเนินการไม่สำเร็จ',
        )
      } finally {
        setRejecting(false)
      }
    } catch {
      // form validation failed — antd shows inline errors
    }
  }

  // TODO: enable when permission system is ready
  // const canAct = isSeniorPM && pr?.status === 'PENDING_APPROVAL'
  const canAct = pr?.status === 'PENDING_APPROVAL'

  const lineColumns: ColumnsType<PRLine> = [
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
      render: (_: unknown, r: PRLine) => (
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
      render: (_: unknown, r: PRLine) => (
        <div>
          <div>{r.spec_name ?? '—'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{r.brand_name ?? ''}</div>
        </div>
      ),
    },
    {
      title: 'จำนวนขอ',
      dataIndex: 'qty_requested',
      key: 'qty_requested',
      width: 110,
      align: 'right',
      render: (v: number, r: PRLine) => `${v.toLocaleString()} ${r.unit_name ?? ''}`,
    },
    {
      title: 'จำนวนสั่ง',
      dataIndex: 'qty_to_order',
      key: 'qty_to_order',
      width: 110,
      align: 'right',
      render: (v: number, r: PRLine) => `${v.toLocaleString()} ${r.unit_name ?? ''}`,
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

  const attachColumns: ColumnsType<PRAttachment> = [
    {
      title: 'ชื่อไฟล์',
      dataIndex: 'file_name',
      render: (name: string, r: PRAttachment) => (
        <a href={r.file_path} target="_blank" rel="noopener noreferrer">
          {name}
        </a>
      ),
    },
    {
      title: 'ขนาด',
      dataIndex: 'file_size',
      width: 100,
      render: (v: number) => formatSize(v),
    },
    {
      title: 'วันที่อัปโหลด',
      dataIndex: 'uploaded_at',
      width: 160,
      render: (v: string) => v?.slice(0, 16) ?? '-',
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
        message="ไม่พบ PR"
        description="ไม่พบข้อมูลใบขอซื้อนี้ หรือถูกลบไปแล้ว"
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

  if (!pr) return null

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
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1e3a8a' }}>{pr.pr_no}</span>
          {statusTag(pr.status)}
        </Space>

        {canAct && (
          <Space>
            <Popconfirm
              title="ยืนยันการอนุมัติ"
              description={`อนุมัติ PR ${pr.pr_no} ใช่หรือไม่?`}
              onConfirm={handleApprove}
              okText="อนุมัติ"
              cancelText="ยกเลิก"
              okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
            >
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={approving}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
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
          </Space>
        )}

      </div>

      {/* Header details */}
      <div style={cardStyle}>
        <Descriptions
          bordered
          size="small"
          column={{ xs: 1, sm: 2, lg: 3 }}
          labelStyle={{ fontWeight: 600, width: 130 }}
        >
          <Descriptions.Item label="เลข PR">{pr.pr_no}</Descriptions.Item>
          <Descriptions.Item label="วันที่">{pr.pr_date?.slice(0, 10) ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="สถานะ">{statusTag(pr.status)}</Descriptions.Item>
          <Descriptions.Item label="ผู้ขอซื้อ">{pr.requested_by}</Descriptions.Item>
          <Descriptions.Item label="ผู้อนุมัติ">{pr.approver_name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Location">{pr.location_code ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Project">{pr.project_code ?? '-'}</Descriptions.Item>
          <Descriptions.Item
            label="หมายเหตุ"
            span={3}
            contentStyle={pr.status === 'REJECTED' ? { color: '#dc2626', fontWeight: 600 } : {}}
          >
            {pr.remarks ?? '-'}
          </Descriptions.Item>
        </Descriptions>
      </div>

      {/* Line items */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', marginBottom: 12 }}>
          รายการวัสดุ
        </div>
        <Table
          rowKey="id"
          dataSource={pr.lines ?? []}
          columns={lineColumns}
          pagination={false}
          size="small"
          scroll={{ x: 500 }}
          locale={{ emptyText: 'ไม่มีรายการ' }}
        />
      </div>

      {/* Attachments */}
      {(pr.attachments?.length ?? 0) > 0 && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', marginBottom: 12 }}>
            เอกสารแนบ
          </div>
          <Table
            rowKey="id"
            dataSource={pr.attachments}
            columns={attachColumns}
            pagination={false}
            size="small"
            scroll={{ x: 500 }}
          />
        </div>
      )}

      {/* Reject modal */}
      <Modal
        open={rejectOpen}
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#dc2626' }} />
            <span>ไม่อนุมัติใบขอซื้อ</span>
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
          message={`กำลังไม่อนุมัติ PR: ${pr.pr_no}`}
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

export default PRApprovalDetailPage
