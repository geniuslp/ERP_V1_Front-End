import React, { useEffect, useState } from 'react'
import { Card, Table, Descriptions, Form, InputNumber, DatePicker, Select, Input, Switch, Button, Space, message } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import axios from 'axios'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { financeService } from '@/services/financeService'
import POStatusBadges from '@/components/po/POStatusBadge'
import WOStatusBadge from '@/components/workOrder/WOStatusBadge'
import type { FinanceDocType, FinancePaymentListItem, FinancePaymentLogEntry } from '@/types/finance'
import type { POStatus } from '@/types/po'
import type { WOStatus } from '@/types/workOrder'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const thb = (n: number) => (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface UserOption { value: number; label: string }

const FinancePaymentDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { docType, docId } = useParams<{ docType: FinanceDocType; docId: string }>()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  // Passed from FinancePaymentsPage's row click so the doc info renders
  // instantly without an extra round trip — GET /finance/payments has no
  // single-doc variant, only the paginated list, so a direct deep-link
  // (no nav state) falls back to re-fetching the whole list and locating
  // this id client-side (see fetchDoc below).
  const [docItem, setDocItem] = useState<FinancePaymentListItem | null>(
    (location.state as any)?.docItem ?? null,
  )
  const [docLoading, setDocLoading] = useState(false)

  const [log, setLog] = useState<FinancePaymentLogEntry[]>([])
  const [logLoading, setLogLoading] = useState(false)

  const [users, setUsers] = useState<UserOption[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  const [isReversal, setIsReversal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const fetchDoc = async () => {
    if (!docType || !docId) return
    setDocLoading(true)
    try {
      const result = await financeService.list(accessToken, { doc_type: docType, page: 1, page_size: 1000 })
      const found = result.items.find((it) => String(it.id) === String(docId))
      if (found) setDocItem(found)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลเอกสารไม่สำเร็จ')
    } finally {
      setDocLoading(false)
    }
  }

  const fetchLog = async () => {
    if (!docType || !docId) return
    setLogLoading(true)
    try {
      const items = await financeService.getLog(accessToken, docType, docId)
      setLog(items)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดประวัติการจ่ายเงินไม่สำเร็จ')
    } finally {
      setLogLoading(false)
    }
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/users/allUser`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
      setUsers(list.map((u: any) => ({ value: u.id, label: u.full_name ?? u.fullName ?? u.username })))
    } catch {
      message.error('โหลดรายชื่อผู้ใช้ไม่สำเร็จ')
    } finally {
      setUsersLoading(false)
    }
  }

  useEffect(() => {
    if (!docItem) fetchDoc()
    fetchLog()
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType, docId])

  const paidAmount = docItem?.paid_amount ?? log.filter((l) => l.reverses_id == null).reduce((s, l) => s + l.amount_paid, 0)
  const remaining = docItem?.remaining_to_pay ?? Math.max((docItem?.net_amount ?? 0) - paidAmount, 0)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (!docType || !docId) return
      setSubmitting(true)
      await financeService.recordPayment(accessToken, {
        doc_type: docType,
        doc_id: Number(docId),
        amount_paid: isReversal ? -Math.abs(values.amount_paid) : values.amount_paid,
        paid_date: values.paid_date ? values.paid_date.format('YYYY-MM-DD') : undefined,
        paid_by: values.paid_by,
        remark: values.remark || undefined,
        reverses_id: isReversal ? values.reverses_id : undefined,
      })
      message.success('บันทึกการจ่ายเงินสำเร็จ')
      form.resetFields()
      setIsReversal(false)
      fetchLog()
      fetchDoc()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.response?.data?.message || err?.message || 'บันทึกการจ่ายเงินไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  const logColumns: ColumnsType<FinancePaymentLogEntry> = [
    {
      title: 'วันที่จ่าย',
      dataIndex: 'paid_date',
      key: 'paid_date',
      render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'จำนวนเงิน',
      dataIndex: 'amount_paid',
      key: 'amount_paid',
      align: 'right',
      render: (v: number) => (
        <span style={v < 0 ? { color: '#dc2626', fontStyle: 'italic', fontWeight: 600 } : { fontWeight: 600 }}>
          {v < 0 ? `(${thb(Math.abs(v))})` : thb(v)}
        </span>
      ),
    },
    { title: 'ผู้จ่ายเงิน', dataIndex: 'paid_by_name', key: 'paid_by_name', render: (v?: string) => v || '—' },
    { title: 'หมายเหตุ', dataIndex: 'remark', key: 'remark', render: (v?: string) => v || '—' },
    {
      title: '',
      key: 'reversal-tag',
      render: (_: unknown, r: FinancePaymentLogEntry) =>
        r.amount_paid < 0 ? (
          <span style={{ color: '#dc2626', fontStyle: 'italic', fontSize: 12 }}>รายการยกเลิก (Reversal)</span>
        ) : null,
    },
  ]

  const reversalOptions = log
    .filter((l) => l.amount_paid > 0)
    .map((l) => ({
      value: l.id,
      label: `${dayjs(l.paid_date).format('DD/MM/YYYY')} — ${thb(l.amount_paid)} บาท (${l.paid_by_name})`,
    }))

  return (
    <div>
      <PageHeader
        title={`รายละเอียดการจ่ายเงิน — ${docItem?.doc_no ?? docId ?? ''}`}
        subtitle={docType === 'PO' ? 'ใบสั่งซื้อ (PO)' : 'ใบสั่งงาน (WO)'}
        breadcrumbs={[{ title: 'Home' }, { title: 'การเงิน' }, { title: 'การจ่ายเงิน' }, { title: docItem?.doc_no ?? '' }]}
      />

      <Card style={{ ...cardStyle, marginBottom: 20 }} loading={docLoading}>
        <Descriptions column={4} bordered size="small">
          <Descriptions.Item label="เลขที่เอกสาร">{docItem?.doc_no ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="โครงการ">{docItem?.project_code ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="มูลค่าสุทธิ">{docItem ? thb(docItem.net_amount) : '—'}</Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            {docItem
              ? docType === 'PO'
                ? <POStatusBadges status={docItem.status as POStatus} />
                : <WOStatusBadge status={docItem.status as WOStatus} />
              : '—'}
          </Descriptions.Item>
        </Descriptions>

        <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
          <div style={{ flex: 1, padding: 16, background: '#f0fdf4', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>จ่ายแล้ว</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{thb(paidAmount)} บาท</div>
          </div>
          <div style={{ flex: 1, padding: 16, background: remaining > 0 ? '#fffbeb' : '#f0fdf4', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>คงเหลือต้องจ่าย</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: remaining > 0 ? '#d97706' : '#16a34a' }}>{thb(remaining)} บาท</div>
          </div>
        </div>
      </Card>

      <Card title="ประวัติการจ่ายเงิน" style={{ ...cardStyle, marginBottom: 20 }}>
        <Table
          rowKey="id"
          loading={logLoading}
          columns={logColumns}
          dataSource={log}
          pagination={false}
          locale={{ emptyText: 'ยังไม่มีประวัติการจ่ายเงิน' }}
        />
      </Card>

      <Card title="บันทึกการจ่ายเงินใหม่" style={cardStyle}>
        <Form form={form} layout="vertical" initialValues={{ paid_date: dayjs() }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Form.Item
              name="amount_paid"
              label="จำนวนเงิน"
              rules={[{ required: true, message: 'กรุณากรอกจำนวนเงิน' }]}
              style={{ width: 220 }}
            >
              <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} formatter={(v) => `${v}`} />
            </Form.Item>
            <Form.Item name="paid_date" label="วันที่จ่าย" style={{ width: 200 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item
              name="paid_by"
              label="ผู้จ่ายเงิน"
              rules={[{ required: true, message: 'กรุณาเลือกผู้จ่ายเงิน' }]}
              style={{ width: 240 }}
            >
              <Select
                loading={usersLoading}
                showSearch
                optionFilterProp="label"
                options={users}
                placeholder="เลือกผู้จ่ายเงิน"
              />
            </Form.Item>
            <Form.Item name="remark" label="หมายเหตุ" style={{ flex: 1, minWidth: 200 }}>
              <Input placeholder="หมายเหตุ (ถ้ามี)" />
            </Form.Item>
          </div>

          <Form.Item label="เป็นรายการยกเลิกรายการที่มีอยู่ (Reversal)">
            <Switch checked={isReversal} onChange={setIsReversal} />
          </Form.Item>

          {isReversal && (
            <Form.Item
              name="reverses_id"
              label="ยกเลิกรายการ"
              rules={[{ required: isReversal, message: 'กรุณาเลือกรายการที่ต้องการยกเลิก' }]}
              style={{ maxWidth: 420 }}
            >
              <Select options={reversalOptions} placeholder="เลือกรายการที่จ่ายไว้ก่อนหน้า" />
            </Form.Item>
          )}

          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={handleSubmit}
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
            >
              บันทึกการจ่ายเงิน
            </Button>
            <Button onClick={() => navigate('/finance/payments')}>กลับไปรายการ</Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}

export default FinancePaymentDetailPage
