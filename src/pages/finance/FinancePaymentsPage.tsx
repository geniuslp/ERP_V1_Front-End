import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Select, Button, Space, Tabs, message } from 'antd'
import { SearchOutlined, ReloadOutlined, DollarOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { financeService } from '@/services/financeService'
import POStatusBadges from '@/components/po/POStatusBadge'
import WOStatusBadge from '@/components/workOrder/WOStatusBadge'
import type { FinanceDocType, FinancePaymentListItem } from '@/types/finance'
import type { POStatus } from '@/types/po'
import type { WOStatus } from '@/types/workOrder'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const PO_STATUS_OPTIONS = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'DRAFT', label: 'แบบร่าง' },
  { value: 'PENDING_APPROVAL', label: 'รออนุมัติ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ไม่อนุมัติ' },
  { value: 'PENDING_REAPPROVAL', label: 'รออนุมัติอีกครั้ง' },
  { value: 'SENT', label: 'ส่งแล้ว' },
  { value: 'PARTIALLY_RECEIVED', label: 'รับสินค้าบางส่วน' },
  { value: 'RECEIVED', label: 'รับสินค้าแล้ว' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
]

const WO_STATUS_OPTIONS = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'DRAFT', label: 'แบบร่าง' },
  { value: 'PENDING_APPROVAL', label: 'รออนุมัติ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ไม่อนุมัติ' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
]

const thb = (n: number) => (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const FinancePaymentsPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [docType, setDocType] = useState<FinanceDocType>('PO')
  const [data, setData] = useState<FinancePaymentListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [projectCode, setProjectCode] = useState('')
  const [status, setStatus] = useState('')

  const statusOptions = docType === 'PO' ? PO_STATUS_OPTIONS : WO_STATUS_OPTIONS

  const fetchList = async (nextPage = page, type = docType) => {
    setLoading(true)
    try {
      const result = await financeService.list(accessToken, {
        doc_type: type,
        project_code: projectCode || undefined,
        status: status || undefined,
        page: nextPage,
        page_size: pageSize,
      })
      setData(result.items)
      setTotal(result.total)
      setPage(nextPage)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList(1, docType) }, [docType])

  const handleReset = () => {
    setProjectCode('')
    setStatus('')
    fetchList(1, docType)
  }

  const handleTabChange = (key: string) => {
    const type = key as FinanceDocType
    setDocType(type)
    setProjectCode('')
    setStatus('')
  }

  const columns: ColumnsType<FinancePaymentListItem> = [
    {
      title: docType === 'PO' ? 'เลขที่ PO' : 'เลขที่ WO',
      dataIndex: 'doc_no',
      key: 'doc_no',
      render: (v: string, r) => (
        <a
          style={{ color: '#2563eb', fontWeight: 600 }}
          onClick={() => navigate(`/finance/payments/${r.doc_type}/${r.id}`, { state: { docItem: r } })}
        >
          {v}
        </a>
      ),
    },
    { title: 'โครงการ', dataIndex: 'project_code', key: 'project_code', render: (v?: string) => v || '—' },
    {
      title: 'มูลค่าสุทธิ',
      dataIndex: 'net_amount',
      key: 'net_amount',
      align: 'right',
      render: (v: number) => thb(v),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) =>
        docType === 'PO' ? <POStatusBadges status={s as POStatus} /> : <WOStatusBadge status={s as WOStatus} />,
    },
    {
      title: 'จ่ายแล้ว',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      align: 'right',
      render: (v: number) => thb(v),
    },
    {
      title: 'คงเหลือต้องจ่าย',
      dataIndex: 'remaining_to_pay',
      key: 'remaining_to_pay',
      align: 'right',
      render: (v: number) => <span style={{ fontWeight: 600, color: v > 0 ? '#d97706' : '#16a34a' }}>{thb(v)}</span>,
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: FinancePaymentListItem) => (
        <Button
          size="small"
          type="primary"
          icon={<DollarOutlined />}
          onClick={() => navigate(`/finance/payments/${r.doc_type}/${r.id}`, { state: { docItem: r } })}
        >
          บันทึกการจ่ายเงิน
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="การเงิน — ติดตามการจ่ายเงิน"
        subtitle="ติดตามสถานะการจ่ายเงินของ PO และ WO"
        breadcrumbs={[{ title: 'Home' }, { title: 'การเงิน' }, { title: 'การจ่ายเงิน' }]}
      />

      <Card style={cardStyle}>
        <Tabs
          activeKey={docType}
          onChange={handleTabChange}
          items={[
            { key: 'PO', label: 'ใบสั่งซื้อ (PO)' },
            { key: 'WO', label: 'ใบสั่งงาน (WO)' },
          ]}
        />

        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="โครงการ"
            value={projectCode}
            onChange={(e) => setProjectCode(e.target.value)}
            onPressEnter={() => fetchList(1)}
            style={{ width: 180 }}
            allowClear
          />
          <Select value={status} onChange={setStatus} style={{ width: 200 }} options={statusOptions} />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchList(1)}>ค้นหา</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>ล้างตัวกรอง</Button>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: (p) => fetchList(p),
          }}
          locale={{ emptyText: 'ไม่พบรายการ' }}
        />
      </Card>
    </div>
  )
}

export default FinancePaymentsPage
