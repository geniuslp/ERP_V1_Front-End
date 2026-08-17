import React, { useEffect, useState } from 'react'
import { Card, Descriptions, Table, Tag, Timeline, Button, Modal, message, Spin } from 'antd'
import { ExclamationCircleFilled } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { stockTransferService } from '@/services/stockTransfer.service'
import {
  STOCK_TRANSFER_STATUS_COLOR, STOCK_TRANSFER_STATUS_LABEL,
} from '@/types/stockTransfer'
import type { StockTransferDetail, StockTransferType } from '@/types/stockTransfer'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const timelineColor = (status: string) =>
  status === 'CONFIRMED' ? 'green' : status === 'CANCELLED' ? 'gray' : 'blue'

interface Props {
  transferType: StockTransferType
  menuCode: string
  breadcrumbLabel: string
  listPath: string
  fromLabel: string
  toLabel: string
}

// Confirm/Cancel are gated by menuCode+action='write' (same mechanism as the rest of this
// app's PermissionButton usage — see MaterialRequisitionDetailPage). A true per-warehouse
// permission check (from_warehouse for WH_TO_PROJECT, to_warehouse for WH_TO_WH, per the
// original spec) isn't supported by the existing permission-tree mechanism in this
// codebase, which is menu-code scoped, not location-scoped — flagging this as a known gap
// rather than silently pretending it's enforced.
const StockTransferDetailView: React.FC<Props> = ({ transferType, menuCode, breadcrumbLabel, listPath, fromLabel, toLabel }) => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<StockTransferDetail | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchDetail = async () => {
    if (!accessToken || !id) return
    setLoading(true)
    try {
      const result = await stockTransferService.get(accessToken, id, transferType)
      setDetail(result)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDetail() }, [id])

  const handleConfirm = () => {
    Modal.confirm({
      title: 'ยืนยันการเช็คของแล้ว',
      icon: <ExclamationCircleFilled style={{ color: '#d97706' }} />,
      content: 'ระบบจะตัด stock ทันที ไม่สามารถแก้ไขย้อนหลังได้ ยืนยันการดำเนินการหรือไม่?',
      okText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      onOk: async () => {
        if (!accessToken || !id) return
        setActionLoading(true)
        try {
          await stockTransferService.confirm(accessToken, id, transferType)
          message.success('ยืนยันการเบิก/ย้ายสำเร็จ')
          fetchDetail()
        } catch (err: any) {
          // 409 insufficient-stock responses are expected to name the offending mat_code
          // in the error message — surface it directly rather than a generic toast.
          const errMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ยืนยันไม่สำเร็จ'
          message.error(errMsg, 6)
        } finally {
          setActionLoading(false)
        }
      },
    })
  }

  const handleCancel = () => {
    Modal.confirm({
      title: 'ยกเลิกเอกสารนี้?',
      icon: <ExclamationCircleFilled style={{ color: '#dc2626' }} />,
      content: 'เอกสารนี้จะถูกยกเลิก ไม่สามารถกู้คืนได้',
      okText: 'ยกเลิกเอกสาร',
      okType: 'danger',
      cancelText: 'ปิด',
      onOk: async () => {
        if (!accessToken || !id) return
        setActionLoading(true)
        try {
          await stockTransferService.cancel(accessToken, id, transferType)
          message.success('ยกเลิกเอกสารสำเร็จ')
          fetchDetail()
        } catch (err: any) {
          message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ยกเลิกไม่สำเร็จ')
        } finally {
          setActionLoading(false)
        }
      },
    })
  }

  const lineColumns = [
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'ชื่อวัสดุ', dataIndex: 'item_name', key: 'item_name', ellipsis: true },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 90 },
    { title: 'จำนวนที่เบิก', dataIndex: 'qty_requested', key: 'qty_requested', align: 'right' as const },
    ...(detail && detail.status !== 'DRAFT'
      ? [{
          title: 'จำนวนที่ยืนยัน', dataIndex: 'qty_confirmed', key: 'qty_confirmed', align: 'right' as const,
          render: (v?: number) => (v ?? v === 0 ? v : '—'),
        }]
      : []),
    { title: 'หมายเหตุ', dataIndex: 'remarks', key: 'remarks', render: (v?: string) => v || '—' },
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
    return <div style={{ padding: 24 }}>ไม่พบเอกสาร</div>
  }

  const fromValue = detail.from_warehouse_name || detail.from_warehouse_code || detail.from_project_name || detail.from_project_code || '—'
  const toValue = detail.to_warehouse_name || detail.to_warehouse_code || detail.to_project_name || detail.to_project_code || '—'

  return (
    <div>
      <PageHeader
        title={detail.transfer_no}
        subtitle={STOCK_TRANSFER_STATUS_LABEL[detail.status] || detail.status}
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: breadcrumbLabel }, { title: detail.transfer_no }]}
        extra={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => navigate(listPath)}>กลับ</Button>
            {detail.status === 'DRAFT' && (
              <>
                <PermissionButton menuCode={menuCode} action="write" type="primary" loading={actionLoading} onClick={handleConfirm}>
                  ยืนยัน
                </PermissionButton>
                <PermissionButton menuCode={menuCode} action="write" danger loading={actionLoading} onClick={handleCancel}>
                  ยกเลิก
                </PermissionButton>
              </>
            )}
          </div>
        }
      />

      <Card
        title="ข้อมูลทั่วไป"
        style={cardStyle}
        extra={detail.is_stock_house ? (
          <Tag color="blue">Stock House — ตู้ {detail.container_no}</Tag>
        ) : undefined}
      >
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="เลขที่เอกสาร">{detail.transfer_no}</Descriptions.Item>
          <Descriptions.Item label="วันที่">{dayjs(detail.transfer_date).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label={fromLabel}>{fromValue}</Descriptions.Item>
          <Descriptions.Item label={toLabel}>{toValue}</Descriptions.Item>
          <Descriptions.Item label="ผู้ขอ">{detail.requested_by_name}</Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            <Tag color={STOCK_TRANSFER_STATUS_COLOR[detail.status]}>{STOCK_TRANSFER_STATUS_LABEL[detail.status] || detail.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="ผู้ตรวจสอบ">{detail.checked_by_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="วันที่ตรวจสอบ">
            {detail.checked_at ? dayjs(detail.checked_at).format('DD/MM/YYYY HH:mm') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="วัตถุประสงค์ / หมายเหตุ" span={2}>{detail.purpose || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="รายการวัสดุ" style={cardStyle}>
        <Table
          rowKey="item_id"
          dataSource={detail.lines}
          columns={lineColumns}
          pagination={false}
          locale={{ emptyText: 'ไม่มีรายการ' }}
        />
      </Card>

      <Card title="ประวัติ" style={cardStyle}>
        <Timeline>
          {(detail.status_log || []).map((log, i) => (
            <Timeline.Item key={i} color={timelineColor(log.to_status)}>
              <div><b>{STOCK_TRANSFER_STATUS_LABEL[log.to_status] || log.to_status}</b> — {log.changed_by_name}</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>{dayjs(log.changed_at).format('DD/MM/YYYY HH:mm')}</div>
              {log.remarks && <div>{log.remarks}</div>}
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>
    </div>
  )
}

export default StockTransferDetailView
