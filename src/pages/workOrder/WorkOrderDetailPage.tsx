import React, { useEffect, useState } from 'react'
import { Card, Descriptions, Button, Modal, Form, Input, Space, message, Spin, Table } from 'antd'
import { EditOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { workOrderService } from '@/services/workOrderService'
import WOStatusBadge from '@/components/workOrder/WOStatusBadge'
import { WO_WORK_SYSTEM_LABEL } from '@/types/workOrder'
import type { WorkOrder, WorkOrderLine } from '@/types/workOrder'
import { calcDisc } from '@/utils/poCalc'

const MENU_CODE = 'MENU_WO_APPROVAL'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const money = (v?: number) => (v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })
const dateFmt = (v?: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—')

const WorkOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [loading, setLoading] = useState(false)
  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectForm] = Form.useForm()

  const fetchDetail = async () => {
    if (!id) return
    setLoading(true)
    try {
      const result = await workOrderService.get(accessToken, id)
      setWo(result)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDetail() }, [id])

  const handleApprove = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await workOrderService.approve(accessToken, id)
      message.success('อนุมัติหนังสือสั่งจ้างสำเร็จ')
      fetchDetail()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'อนุมัติไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    try {
      const values = await rejectForm.validateFields()
      if (!id) return
      setActionLoading(true)
      try {
        await workOrderService.reject(accessToken, id, values.reason)
        message.success('ไม่อนุมัติหนังสือสั่งจ้างเรียบร้อย')
        setRejectOpen(false)
        rejectForm.resetFields()
        fetchDetail()
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'ดำเนินการไม่สำเร็จ')
      } finally {
        setActionLoading(false)
      }
    } catch {
      // form validation failed — antd shows inline errors
    }
  }

  if (loading || !wo) {
    return (
      <Card style={cardStyle}>
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader
        title={wo.wo_no}
        subtitle="รายละเอียดหนังสือสั่งจ้าง"
        breadcrumbs={[{ title: 'Home' }, { title: 'Work Order' }, { title: wo.wo_no }]}
        extra={
          <Space>
            <Button onClick={() => navigate('/work-order/list')}>กลับ</Button>
            {wo.status === 'DRAFT' && (
              <PermissionButton menuCode="MENU_WO_CREATE" action="write" icon={<EditOutlined />} onClick={() => navigate(`/work-order/${wo.id}/edit`)}>
                แก้ไข
              </PermissionButton>
            )}
            {wo.status === 'PENDING_APPROVAL' && (
              <>
                <PermissionButton
                  menuCode={MENU_CODE}
                  action="write"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={actionLoading}
                  onClick={handleApprove}
                  style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none' }}
                >
                  อนุมัติ
                </PermissionButton>
                <PermissionButton
                  menuCode={MENU_CODE}
                  action="write"
                  danger
                  icon={<CloseCircleOutlined />}
                  loading={actionLoading}
                  onClick={() => setRejectOpen(true)}
                >
                  ไม่อนุมัติ
                </PermissionButton>
              </>
            )}
          </Space>
        }
      />

      <Card title="สถานะ" style={cardStyle}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="สถานะ"><WOStatusBadge status={wo.status} /></Descriptions.Item>
          <Descriptions.Item label="ผู้สร้าง">{wo.created_by_name || '—'}</Descriptions.Item>
          {wo.status !== 'DRAFT' && (
            <>
              <Descriptions.Item label="ผู้อนุมัติ">{wo.approver_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="วันที่อนุมัติ">{wo.approved_at ? dayjs(wo.approved_at).format('DD/MM/YYYY HH:mm') : '—'}</Descriptions.Item>
              {wo.status === 'REJECTED' && (
                <Descriptions.Item label="เหตุผลที่ไม่อนุมัติ" span={2}>{wo.rejected_reason || '—'}</Descriptions.Item>
              )}
            </>
          )}
        </Descriptions>
      </Card>

      <Card title="เอกสาร / ผู้ว่าจ้าง / ผู้รับจ้าง" style={cardStyle}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="เลขที่ WO">{wo.wo_no}</Descriptions.Item>
          <Descriptions.Item label="วันที่">{dateFmt(wo.wo_date)}</Descriptions.Item>
          <Descriptions.Item label="เลขที่อ้างอิง">{wo.ref_no || '—'}</Descriptions.Item>
          <Descriptions.Item label="ผู้ว่าจ้าง">{wo.employer_name}</Descriptions.Item>
          <Descriptions.Item label="ขอบเขตงาน / โครงการ" span={2}>{wo.project_scope_text || '—'}</Descriptions.Item>
          <Descriptions.Item label="ผู้รับจ้าง">{wo.supplier_name || wo.supplier_code}</Descriptions.Item>
          <Descriptions.Item label="ผู้ควบคุมงาน">{wo.contact_person || '—'}</Descriptions.Item>
          <Descriptions.Item label="ที่อยู่ผู้รับจ้าง">{wo.supplier_address || '—'}</Descriptions.Item>
          <Descriptions.Item label="โทรศัพท์">{wo.supplier_phone || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="ประเภทสัญญา / มูลค่า" style={cardStyle}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="ลักษณะสัญญา">{wo.contract_type === 'LABOR_ONLY' ? 'ค่าแรงอย่างเดียว' : 'ทั้งค่าแรงและค่าของ'}</Descriptions.Item>
          <Descriptions.Item label="งานระบบ">{WO_WORK_SYSTEM_LABEL[wo.work_system] || wo.work_system}</Descriptions.Item>
          <Descriptions.Item label="รายละเอียดสัญญา" span={2}>{wo.contract_description || '—'}</Descriptions.Item>
          <Descriptions.Item label="มูลค่าสัญญา">{money(wo.contract_amount)} บาท</Descriptions.Item>
          <Descriptions.Item label="VAT / หัก ณ ที่จ่าย">{wo.vat_rate}% / {wo.wht_rate}%</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="เงื่อนไขการจ่ายเงิน" style={cardStyle}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="เงินล่วงหน้า">{wo.advance_pct != null ? `${wo.advance_pct}%` : '—'}</Descriptions.Item>
          <Descriptions.Item label="จำนวนเงินล่วงหน้า">{wo.advance_amount != null ? money(wo.advance_amount) : '—'}</Descriptions.Item>
          <Descriptions.Item label="เงินประกันผลงาน">{wo.retention_pct != null ? `${wo.retention_pct}%` : '—'}</Descriptions.Item>
          <Descriptions.Item label="หักคืนเงินล่วงหน้า">{wo.advance_deduct_pct != null ? `${wo.advance_deduct_pct}%` : '—'}</Descriptions.Item>
          <Descriptions.Item label="หมายเหตุการจ่ายตามความคืบหน้า" span={2}>{wo.progress_payment_note || '—'}</Descriptions.Item>
          <Descriptions.Item label="รายการหักอื่นๆ" span={2}>{wo.other_deduction_note || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="ระยะเวลาสัญญา" style={cardStyle}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="วันที่เริ่มงาน">{dateFmt(wo.start_date)}</Descriptions.Item>
          <Descriptions.Item label="ระยะเวลา">{wo.duration_days != null ? `${wo.duration_days} วัน` : '—'}</Descriptions.Item>
          <Descriptions.Item label="วันที่สิ้นสุด">{dateFmt(wo.end_date)}</Descriptions.Item>
          <Descriptions.Item label="ค่าปรับ">{wo.penalty_pct_per_day != null ? `${wo.penalty_pct_per_day}% / วัน` : '—'}</Descriptions.Item>
          <Descriptions.Item label="ระยะเวลารับประกัน">{wo.warranty_years != null ? `${wo.warranty_years} ปี` : '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="รายการ Cost Code" style={cardStyle}>
        <Table
          rowKey={(_, i) => String(i)}
          dataSource={wo.lines ?? []}
          pagination={false}
          size="small"
          locale={{ emptyText: '—' }}
          columns={[
            { title: 'ลำดับ', dataIndex: 'line_no', width: 70 },
            { title: 'Cost Code', dataIndex: 'cost_code', width: 150, render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
            { title: 'รายละเอียด', dataIndex: 'description', render: (v?: string) => v || '—' },
            { title: 'จำนวน', dataIndex: 'qty', width: 90, align: 'center' as const },
            { title: 'ราคา/หน่วย', dataIndex: 'unit_price', width: 110, align: 'right' as const, render: (v: number) => money(v) },
            { title: 'มูลค่า', key: 'amount', width: 120, align: 'right' as const, render: (_: unknown, r: WorkOrderLine) => money(r.qty * r.unit_price) },
          ]}
          summary={() => {
            let subtotal = 0, totalDisc = 0, totalVat = 0, totalWht = 0
            ;(wo.lines ?? []).forEach((r) => {
              const rowDiscType = r.disc_type ?? 'pct'
              const lineAmt = r.qty * r.unit_price
              subtotal += lineAmt
              const d = wo.use_discount ? calcDisc(lineAmt, r.disc ?? 0, rowDiscType) : 0
              const af = lineAmt - d
              totalDisc += d
              totalVat += wo.use_vat ? af * 0.07 : 0
              totalWht += wo.use_wht ? af * ((r.wht_rate ?? 3) / 100) : 0
            })
            const net = subtotal - totalDisc + totalVat - totalWht
            return (
              <Table.Summary fixed="bottom">
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={6} align="right">
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 240 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>ยอดรวมก่อนลด</span>
                        <span style={{ fontSize: 12 }}>฿ {money(subtotal)}</span>
                      </div>
                      {wo.use_discount && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                          <span style={{ fontSize: 12, color: '#64748b' }}>ส่วนลด</span>
                          <span style={{ fontSize: 12, color: '#22c55e' }}>- ฿ {money(totalDisc)}</span>
                        </div>
                      )}
                      {wo.use_vat && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                          <span style={{ fontSize: 12, color: '#64748b' }}>VAT 7%</span>
                          <span style={{ fontSize: 12, color: '#ca8a04' }}>+ ฿ {money(totalVat)}</span>
                        </div>
                      )}
                      {wo.use_wht && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                          <span style={{ fontSize: 12, color: '#64748b' }}>WHT</span>
                          <span style={{ fontSize: 12, color: '#dc2626' }}>- ฿ {money(totalWht)}</span>
                        </div>
                      )}
                      <div style={{ borderTop: '0.5px solid #dbeafe', width: '100%', marginTop: 4, paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 48 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>ยอดรวมสุทธิ</span>
                        <span style={{ fontSize: 15, fontWeight: 500, color: '#1e40af' }}>฿ {money(net)}</span>
                      </div>
                    </div>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )
          }}
        />
      </Card>

      <Card title="อื่นๆ" style={cardStyle}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="เงื่อนไขอื่นๆ" span={2}>{wo.other_terms || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Modal
        title="ไม่อนุมัติหนังสือสั่งจ้าง"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={handleReject}
        confirmLoading={actionLoading}
        okText="ยืนยันไม่อนุมัติ"
        okButtonProps={{ danger: true }}
        cancelText="ยกเลิก"
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item label="เหตุผล" name="reason" rules={[{ required: true, message: 'กรุณาระบุเหตุผล' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default WorkOrderDetailPage
