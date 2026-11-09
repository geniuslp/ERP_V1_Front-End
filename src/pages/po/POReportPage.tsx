import React, { useEffect, useState } from 'react'
import { Card, Select, DatePicker, Button, Space, Row, Col, Table, Empty, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { HistoryOutlined, InboxOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import axios from 'axios'
import type { Dayjs } from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { useProjectOptions } from '@/hooks/useProjectOptions'
import { useJobTypes } from '@/hooks/useJobTypeNames'
import { POApprovalStatusTag } from '@/components/po/POStatusBadge'
import { formatMoney } from '@/utils/formatMoney'
import type { POStatus } from '@/types/po'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

type ReportKey = 'HISTORY' | 'PENDING_RECEIPT'

const REPORTS: { key: ReportKey; title: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'HISTORY', title: 'รายงานประวัติใบสั่ง', desc: 'ค้นประวัติใบสั่งซื้อตามโครงการ ร้านค้า และช่วงวันที่', icon: <HistoryOutlined /> },
  { key: 'PENDING_RECEIPT', title: 'รายการค้างรับสินค้า', desc: 'ค้นรายการที่ยังรับสินค้าไม่ครบตามโครงการ Job และช่วงวันที่', icon: <InboxOutlined /> },
]

interface SupplierOption { value: number; label: string }

interface HistoryLine {
  line_no: number
  job_code: string | null
  description: string
  qty: number
  unit_name: string | null
  unit_price: number
  amount: number
  remarks: string | null
}
interface HistoryGroup {
  po_id: number
  po_no: string
  status: POStatus
  supplier_name: string | null
  subtotal: number
  lines: HistoryLine[]
}

// One table per PO (its ร้านค้า / เลข PO / สถานะ sit above the column header): lines + a subtotal row; grand total at the end.
type HistoryRow =
  | { key: string; kind: 'line'; no: number; line: HistoryLine }
  | { key: string; kind: 'subtotal'; amount: number }
  | { key: string; kind: 'grand'; amount: number }

const unitPrice = (n: number) => (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

/**
 * รายงานการสั่งซื้อ (PO/WO > รายงาน). Pick a report first (same card-pick idea as the IC pages), then its filters:
 *  - รายงานประวัติใบสั่ง: โครงการ, ร้านค้า, ช่วงวันที่ (start - end)
 *  - รายการค้างรับสินค้า: โครงการ, Job, ช่วงวันที่ (start - end)
 * Both show the same grouped table (ร้านค้า + เลข PO band, lines, subtotal, grand total); the pending report lists
 * only approved POs' lines not yet received through IC, with the outstanding qty / amount.
 */
const POReportPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [report, setReport] = useState<ReportKey | null>(null)

  const [projectCode, setProjectCode] = useState<string | undefined>()
  const [supplierId, setSupplierId] = useState<number | undefined>()
  const [jobCode, setJobCode] = useState<string | undefined>()
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)

  const { options: projects, loading: projectsLoading } = useProjectOptions({})
  const jobTypes = useJobTypes()

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  useEffect(() => {
    if (!accessToken) return
    setSuppliersLoading(true)
    axios
      .get(`${BASE_URL}/master/suppliers`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setSuppliers(list.map((s: any) => ({ value: s.id, label: s.supplier_name })))
      })
      .catch(() => message.error('โหลดรายชื่อร้านค้าไม่สำเร็จ'))
      .finally(() => setSuppliersLoading(false))
  }, [accessToken])

  const [result, setResult] = useState<{ groups: HistoryGroup[]; grandTotal: number } | null>(null)
  const [loading, setLoading] = useState(false)
  // The project the shown result was run for (heading line of the report).
  const [shownProject, setShownProject] = useState('ทั้งหมด')

  const reset = () => {
    setProjectCode(undefined)
    setSupplierId(undefined)
    setJobCode(undefined)
    setRange(null)
    setResult(null)
  }

  const runReport = async () => {
    if (!report) return
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/po-report/${report === 'HISTORY' ? 'history' : 'pending-receipt'}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          project_code: projectCode || undefined,
          supplier_id: report === 'HISTORY' ? supplierId || undefined : undefined,
          job_code: report === 'PENDING_RECEIPT' ? jobCode || undefined : undefined,
          date_from: range?.[0] ? range[0].format('YYYY-MM-DD') : undefined,
          date_to: range?.[1] ? range[1].format('YYYY-MM-DD') : undefined,
        },
      })
      const d = res.data?.data
      const groups: HistoryGroup[] = d?.groups ?? []
      setResult({ groups, grandTotal: Number(d?.grand_total ?? 0) })
      setShownProject(projectCode ? (projects.find((p) => p.value === projectCode)?.label ?? projectCode) : 'ทั้งหมด')
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.response?.data?.error || 'โหลดรายงานไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  const groupRows = (g: HistoryGroup): HistoryRow[] => [
    ...g.lines.map((l, i): HistoryRow => ({ key: `l${g.po_id}-${i}`, kind: 'line', no: i + 1, line: l })),
    { key: `s${g.po_id}`, kind: 'subtotal', amount: g.subtotal },
  ]

  const historyColumns: ColumnsType<HistoryRow> = [
    {
      title: 'No.', key: 'no', width: 70,
      onCell: (r) => (r.kind === 'subtotal' || r.kind === 'grand' ? { colSpan: 5 } : {}),
      render: (_, r) => {
        if (r.kind === 'line') return r.no
        return r.kind === 'grand' ? <b>รวมทั้งสิ้น</b> : null
      },
    },
    {
      title: 'Job', key: 'job', width: 80,
      onCell: (r) => (r.kind === 'line' ? {} : { colSpan: 0 }),
      render: (_, r) => (r.kind === 'line' ? r.line.job_code ?? '-' : null),
    },
    {
      title: 'Description', key: 'desc',
      onCell: (r) => (r.kind === 'line' ? {} : { colSpan: 0 }),
      render: (_, r) => (r.kind === 'line' ? r.line.description : null),
    },
    {
      title: report === 'PENDING_RECEIPT' ? 'Qty (ค้างรับ)' : 'Qty', key: 'qty', width: 120,
      onCell: (r) => (r.kind === 'line' ? {} : { colSpan: 0 }),
      render: (_, r) => (r.kind === 'line' ? `${Number(r.line.qty).toLocaleString()} ${r.line.unit_name ?? ''}` : null),
    },
    {
      title: 'Unit/Price', key: 'price', width: 130, align: 'right',
      onCell: (r) => (r.kind === 'line' ? {} : { colSpan: 0 }),
      render: (_, r) => (r.kind === 'line' ? unitPrice(r.line.unit_price) : null),
    },
    {
      title: report === 'PENDING_RECEIPT' ? 'Amount ค้างรับ (Exc. VAT)' : 'Amount (Exc. VAT)', key: 'amount', width: 170, align: 'right',
      render: (_, r) => {
        if (r.kind === 'line') return formatMoney(r.line.amount)
        if (r.kind === 'subtotal' || r.kind === 'grand') return <b style={{ borderTop: '1px solid #9ca3af' }}>{formatMoney(r.amount)}</b>
        return null
      },
    },
    {
      title: 'Remark', key: 'remark', width: 220,
      render: (_, r) => (r.kind === 'line' ? r.line.remarks ?? '' : null),
    },
  ]

  const pick = (key: ReportKey) => {
    setReport(key)
    reset()
  }

  const current = REPORTS.find((r) => r.key === report)

  return (
    <div>
      <PageHeader
        title="รายงานการสั่งซื้อ"
        subtitle="เลือกรายงานที่ต้องการ แล้วกำหนดเงื่อนไข"
        breadcrumbs={[{ title: 'Home' }, { title: 'PO/WO' }, { title: 'รายงานการสั่งซื้อ' }]}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {REPORTS.map((r) => {
          const active = r.key === report
          return (
            <Col key={r.key} xs={24} md={12}>
              <Card
                hoverable
                onClick={() => pick(r.key)}
                style={{
                  ...cardStyle,
                  cursor: 'pointer',
                  outline: active ? '2px solid #1d4ed8' : 'none',
                }}
              >
                <Space align="start" size={16}>
                  <span style={{ fontSize: 28, color: active ? '#1d4ed8' : '#64748b' }}>{r.icon}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#0f2d5e' }}>{r.title}</div>
                    <div style={{ color: '#64748b', marginTop: 4 }}>{r.desc}</div>
                  </div>
                </Space>
              </Card>
            </Col>
          )
        })}
      </Row>

      {current && (
        <Card title={current.title} style={cardStyle}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <div style={{ marginBottom: 4, color: '#374151' }}>โครงการ</div>
              <Select
                showSearch
                allowClear
                style={{ width: '100%' }}
                placeholder="ทั้งหมด"
                loading={projectsLoading}
                optionFilterProp="label"
                value={projectCode}
                onChange={setProjectCode}
                options={projects}
              />
            </Col>

            {report === 'HISTORY' && (
              <Col xs={24} md={8}>
                <div style={{ marginBottom: 4, color: '#374151' }}>ร้านค้า</div>
                <Select
                  showSearch
                  allowClear
                  style={{ width: '100%' }}
                  placeholder="ทั้งหมด"
                  loading={suppliersLoading}
                  optionFilterProp="label"
                  value={supplierId}
                  onChange={setSupplierId}
                  options={suppliers}
                />
              </Col>
            )}

            {report === 'PENDING_RECEIPT' && (
              <Col xs={24} md={8}>
                <div style={{ marginBottom: 4, color: '#374151' }}>Job</div>
                <Select
                  showSearch
                  allowClear
                  style={{ width: '100%' }}
                  placeholder="ทั้งหมด"
                  optionFilterProp="label"
                  value={jobCode}
                  onChange={setJobCode}
                  options={jobTypes.map((j) => ({ value: j.job_code, label: `${j.job_code} ${j.job_name}` }))}
                />
              </Col>
            )}

            <Col xs={24} md={8}>
              <div style={{ marginBottom: 4, color: '#374151' }}>วันที่ (เริ่มต้น - สิ้นสุด)</div>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                value={range as any}
                onChange={(v) => setRange(v as any)}
              />
            </Col>
          </Row>

          <Space style={{ marginTop: 20 }}>
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={runReport}>แสดงรายงาน</Button>
            <Button icon={<ReloadOutlined />} onClick={reset}>ล้างเงื่อนไข</Button>
          </Space>
        </Card>
      )}

      {report && result && (
        <Card style={{ ...cardStyle, marginTop: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#0f2d5e', marginBottom: 12 }}>
            {report === 'HISTORY' ? 'ประวัติการสั่งซื้อ' : 'รายการค้างรับสินค้า'} : โครงการ {shownProject}
          </div>
          {result.groups.length === 0 && (
            <Empty description={report === 'HISTORY' ? 'ไม่พบใบสั่งซื้อตามเงื่อนไขที่เลือก' : 'ไม่มีรายการค้างรับตามเงื่อนไขที่เลือก'} />
          )}
          {result.groups.map((g) => (
            <div key={g.po_id} style={{ marginBottom: 20 }}>
              {/* ร้านค้า / เลข PO / สถานะ sit above this PO's column header */}
              <div style={{ background: '#eff6ff', padding: '8px 12px', borderRadius: '8px 8px 0 0', border: '1px solid #f0f0f0', borderBottom: 'none' }}>
                <Space size={24} wrap>
                  <span><b>ชื่อร้านค้า</b> {g.supplier_name ?? '—'}</span>
                  <span><b>PO</b> {g.po_no}</span>
                  <POApprovalStatusTag status={g.status} />
                </Space>
              </div>
              <Table<HistoryRow>
                rowKey="key"
                size="small"
                bordered
                pagination={false}
                dataSource={groupRows(g)}
                columns={historyColumns}
                tableLayout="fixed"
                scroll={{ x: 900 }}
              />
            </div>
          ))}
          {result.groups.length > 0 && (
            <Table<HistoryRow>
              rowKey="key"
              size="small"
              bordered
              showHeader={false}
              pagination={false}
              dataSource={[{ key: 'grand', kind: 'grand', amount: result.grandTotal }]}
              columns={historyColumns}
              tableLayout="fixed"
              scroll={{ x: 900 }}
            />
          )}
        </Card>
      )}
    </div>
  )
}

export default POReportPage
