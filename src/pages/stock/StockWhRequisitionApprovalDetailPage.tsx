import React, { useEffect, useState } from 'react'
import { Card, Descriptions, Tag, Button, Modal, message, Spin, Checkbox, Progress, Tooltip, Empty } from 'antd'
import { ExclamationCircleFilled } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { stockTransferService } from '@/services/stockTransfer.service'
import type { StockTransferDetail, StockTransferLine } from '@/types/stockTransfer'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const LIST_PATH = '/stock/wh-requisition-approval'
const MENU_CODE = 'MENU_WH_REQUISITION_APPROVAL'

const lineKey = (line: StockTransferLine) => line.transfer_line_id ?? line.item_id ?? line.mat_code

// Client-side-only checklist — deliberately not persisted to the backend. It exists purely so
// the reviewer has to explicitly acknowledge each physical line before Confirm unlocks; the
// actual confirm/cancel calls below are identical to StockTransferDetailView's.
const StockWhRequisitionApprovalDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<StockTransferDetail | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [checkedLines, setCheckedLines] = useState<Set<string | number>>(new Set())

  const fetchDetail = async () => {
    if (!accessToken || !id) return
    setLoading(true)
    try {
      const result = await stockTransferService.get(accessToken, id, 'WH_TO_PROJECT')
      setDetail(result)
      setCheckedLines(new Set())
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDetail() }, [id])

  const toggleLineChecked = (key: string | number, checked: boolean) => {
    setCheckedLines((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const lines = detail?.lines || []
  const allChecked = lines.length > 0 && checkedLines.size === lines.length

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
          await stockTransferService.confirm(accessToken, id, 'WH_TO_PROJECT')
          message.success('ยืนยันการเบิกสำเร็จ')
          navigate(LIST_PATH)
        } catch (err: any) {
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
          await stockTransferService.cancel(accessToken, id, 'WH_TO_PROJECT')
          message.success('ยกเลิกเอกสารสำเร็จ')
          navigate(LIST_PATH)
        } catch (err: any) {
          message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ยกเลิกไม่สำเร็จ')
        } finally {
          setActionLoading(false)
        }
      },
    })
  }

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

  const projectValue = detail.to_project_name || detail.to_project_code || '—'
  const warehouseValue = detail.from_warehouse_name || detail.from_warehouse_code || '—'
  const isDraft = detail.status === 'DRAFT'

  return (
    <div>
      <PageHeader
        title={detail.transfer_no}
        subtitle="ตรวจสอบ/อนุมัติใบเบิก"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'ตรวจสอบ/อนุมัติใบเบิก' }, { title: detail.transfer_no }]}
        extra={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => navigate(LIST_PATH)}>กลับ</Button>
            {isDraft && (
              <>
                <Tooltip title={allChecked ? '' : 'กรุณาตรวจสอบครบทุกรายการก่อนยืนยัน'}>
                  <PermissionButton
                    menuCode={MENU_CODE}
                    action="write"
                    type="primary"
                    loading={actionLoading}
                    disabled={!allChecked}
                    onClick={handleConfirm}
                  >
                    ยืนยัน
                  </PermissionButton>
                </Tooltip>
                <PermissionButton menuCode={MENU_CODE} action="write" danger loading={actionLoading} onClick={handleCancel}>
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
          <Descriptions.Item label="คลัง">{warehouseValue}</Descriptions.Item>
          <Descriptions.Item label="โครงการ">{projectValue}</Descriptions.Item>
          <Descriptions.Item label="ผู้ขอ">{detail.requested_by_name}</Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            <Tag color={isDraft ? 'gold' : detail.status === 'CONFIRMED' ? 'green' : 'default'}>
              {isDraft ? 'รอตรวจสอบ' : detail.status === 'CONFIRMED' ? 'ยืนยันแล้ว' : 'ยกเลิก'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="วัตถุประสงค์ / หมายเหตุ" span={2}>{detail.purpose || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="รายการวัสดุ" style={cardStyle}>
        {lines.length === 0 ? (
          <Empty description="ไม่มีรายการ" />
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <Progress
                percent={Math.round((checkedLines.size / lines.length) * 100)}
                format={() => `ตรวจแล้ว ${checkedLines.size}/${lines.length} รายการ`}
                status={allChecked ? 'success' : 'active'}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {lines.map((line) => {
                const key = lineKey(line)
                return (
                  <div
                    key={key}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 8,
                      background: checkedLines.has(key) ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${checkedLines.has(key) ? '#bbf7d0' : '#e2e8f0'}`,
                    }}
                  >
                    <Checkbox
                      checked={checkedLines.has(key)}
                      disabled={!isDraft}
                      onChange={(e) => toggleLineChecked(key, e.target.checked)}
                    >
                      <div>
                        <div style={{ fontWeight: 500 }}>{line.item_name} — {line.qty_requested} {line.unit}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{line.mat_code}</div>
                      </div>
                    </Checkbox>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

export default StockWhRequisitionApprovalDetailPage
