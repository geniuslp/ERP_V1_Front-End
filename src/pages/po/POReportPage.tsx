import React, { useEffect, useState } from 'react'
import { Card, Select, DatePicker, Button, Space, Row, Col, Table, Empty, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { HistoryOutlined, InboxOutlined, SearchOutlined, ReloadOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import axios from 'axios'
import type { Dayjs } from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { useProjectOptions } from '@/hooks/useProjectOptions'
import { useJobTypes } from '@/hooks/useJobTypeNames'
import { POApprovalStatusTag, poApprovalStatusLabel } from '@/components/po/POStatusBadge'
import POReportPrint from './POReportPrint'
import { formatMoney } from '@/utils/formatMoney'
import { formatCostCodeDisplay } from '@/utils/costCode'
import type { POStatus } from '@/types/po'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

type ReportKey = 'HISTORY' | 'PENDING_RECEIPT'

const REPORTS: { key: ReportKey; title: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'HISTORY', title: 'รายงานประวัติใบสั่ง', desc: 'ค้นประวัติใบสั่งซื้อ (PO ทุกสถานะ) ตามโครงการ ระบบ (Job) ร้านค้า และช่วงวันที่', icon: <HistoryOutlined /> },
  { key: 'PENDING_RECEIPT', title: 'รายการค้างรับสินค้า', desc: 'ค้นรายการที่ยังรับสินค้าไม่ครบตามโครงการ Job และช่วงวันที่', icon: <InboxOutlined /> },
]

interface SupplierOption { value: number; label: string }

interface HistoryLine {
  line_no: number
  job_code: string | null
  cost_code: string | null
  mat_code: string | null
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
 *  - รายงานประวัติใบสั่ง: โครงการ (บังคับ), ระบบ (Job), ร้านค้า, ช่วงวันที่ (start - end) — PO ทุกสถานะ
 *  - รายการค้างรับสินค้า: โครงการ (บังคับ), ระบบ (Job), ช่วงวันที่ (start - end)
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

  // Set once the user tried to run without a project, so the field shows its error until one is chosen.
  const [projectError, setProjectError] = useState(false)

  const [result, setResult] = useState<{ groups: HistoryGroup[]; grandTotal: number } | null>(null)
  const [loading, setLoading] = useState(false)
  // The project the shown result was run for (heading line of the report).
  const [shownProject, setShownProject] = useState('ทั้งหมด')
  // The conditions the shown result was run with ("โครงการ : …", "ระบบ (Job) : …" …) — used by the exports.
  const [shownConditions, setShownConditions] = useState<string[]>([])
  const [printing, setPrinting] = useState(false)

  const reset = () => {
    setProjectCode(undefined)
    setSupplierId(undefined)
    setJobCode(undefined)
    setRange(null)
    setResult(null)
    setProjectError(false)
  }

  const runReport = async () => {
    if (!report) return
    if (!projectCode) {
      setProjectError(true)
      message.warning('กรุณาเลือกโครงการก่อนแสดงรายงาน')
      return
    }
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/po-report/${report === 'HISTORY' ? 'history' : 'pending-receipt'}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          project_code: projectCode,
          supplier_id: report === 'HISTORY' ? supplierId || undefined : undefined,
          job_code: jobCode || undefined,
          date_from: range?.[0] ? range[0].format('YYYY-MM-DD') : undefined,
          date_to: range?.[1] ? range[1].format('YYYY-MM-DD') : undefined,
        },
      })
      const d = res.data?.data
      const groups: HistoryGroup[] = d?.groups ?? []
      setResult({ groups, grandTotal: Number(d?.grand_total ?? 0) })
      const projectLabel = projects.find((p) => p.value === projectCode)?.label ?? projectCode
      setShownProject(projectLabel)
      const jobLabel = jobCode ? jobTypes.find((j) => j.job_code === jobCode) : undefined
      const conds = [`โครงการ : ${projectLabel}`]
      // Only conditions the user actually set are listed ("ทั้งหมด" lines are left out).
      if (report === 'HISTORY' && supplierId) conds.push(`ร้านค้า : ${suppliers.find((x) => x.value === supplierId)?.label ?? supplierId}`)
      if (jobCode) conds.push(`ระบบ (Job) : ${jobLabel ? `${jobLabel.job_code} ${jobLabel.job_name}` : jobCode}`)
      if (range?.[0] && range?.[1]) conds.push(`วันที่ : ${range[0].format('DD/MM/YYYY')} - ${range[1].format('DD/MM/YYYY')}`)
      setShownConditions(conds)
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.response?.data?.error || 'โหลดรายงานไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  // Description is one line (ellipsis). Its column is sized from the longest description shown (~8px per
  // character) plus 20% spare room before Qty, clamped so the table stays sensible.
  const descWidth = (() => {
    const longest = Math.max(0, ...(result?.groups ?? []).flatMap((g) => g.lines.map((l) => (l.description ?? '').length)))
    return Math.min(Math.max(Math.ceil((longest * 8) / 0.8), 220), 560)
  })()

  const reportTitle = report === 'HISTORY' ? 'รายงานประวัติใบสั่ง' : 'รายการค้างรับสินค้า'

  const exportExcel = async () => {
    if (!result || result.groups.length === 0) return
    const pending = report === 'PENDING_RECEIPT'
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Report')
    const head = ['No.', 'Job', 'Cost Code', 'MatCode', 'Description', pending ? 'Qty (ค้างรับ)' : 'Qty', 'Unit', 'Unit/Price', pending ? 'Amount ค้างรับ (Exc. VAT)' : 'Amount (Exc. VAT)', 'Remark']
    ws.columns = [6, 8, 14, 20, 48, 12, 10, 14, 22, 30].map((width) => ({ width }))
    const LAST = head.length
    const thin = { style: 'thin' as const, color: { argb: 'FF888888' } }
    const border = { top: thin, left: thin, bottom: thin, right: thin }
    const MONEY = '#,##0.00'

    ws.addRow([reportTitle]).font = { bold: true, size: 14, color: { argb: 'FF0F2D5E' } }
    shownConditions.forEach((c) => ws.addRow([c]))
    ws.addRow([])

    const merged = (text: string, fill: string) => {
      const row = ws.addRow([text])
      ws.mergeCells(row.number, 1, row.number, LAST)
      for (let c = 1; c <= LAST; c++) {
        const cell = row.getCell(c)
        cell.border = border
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      }
      row.getCell(1).font = { bold: true }
      return row
    }
    const totalRow = (label: string, amount: number) => {
      const row = ws.addRow([label])
      ws.mergeCells(row.number, 1, row.number, 8)
      row.getCell(1).alignment = { horizontal: 'right' }
      row.getCell(9).value = amount
      row.getCell(9).numFmt = MONEY
      for (let c = 1; c <= LAST; c++) {
        row.getCell(c).border = border
        row.getCell(c).font = { bold: true }
      }
    }

    result.groups.forEach((g) => {
      merged(`ชื่อร้านค้า ${g.supplier_name ?? '-'}     PO ${g.po_no}     สถานะ ${poApprovalStatusLabel(g.status)}`, 'FFEFF6FF')
      const hr = ws.addRow(head)
      hr.eachCell((cell) => {
        cell.border = border
        cell.font = { bold: true }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      })
      g.lines.forEach((l, i) => {
        const r = ws.addRow([
          i + 1, l.job_code ?? '', l.cost_code ? formatCostCodeDisplay(l.cost_code) : '', l.mat_code ?? '', l.description,
          Number(l.qty), l.unit_name ?? '', Number(l.unit_price ?? 0), Number(l.amount ?? 0), l.remarks ?? '',
        ])
        r.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.border = border
          cell.alignment = { vertical: 'top', horizontal: col === 1 ? 'center' : undefined, wrapText: col === 5 || col === 10 }
        })
        r.getCell(6).numFmt = '#,##0.####'
        r.getCell(8).numFmt = '#,##0.00##'
        r.getCell(9).numFmt = MONEY
      })
      totalRow('รวม', g.subtotal)
      ws.addRow([])
    })
    totalRow('รวมทั้งสิ้น', result.grandTotal)

    const buf = await wb.xlsx.writeBuffer()
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${pending ? 'PO_PendingReceipt' : 'PO_History'}_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const groupRows = (g: HistoryGroup): HistoryRow[] => [
    ...g.lines.map((l, i): HistoryRow => ({ key: `l${g.po_id}-${i}`, kind: 'line', no: i + 1, line: l })),
    { key: `s${g.po_id}`, kind: 'subtotal', amount: g.subtotal },
  ]

  // Subtotal / grand-total rows merge the first 7 columns (No. … Unit/Price) into one label cell.
  const historyColumns: ColumnsType<HistoryRow> = [
    {
      title: 'No.', key: 'no', width: 70,
      onCell: (r) => (r.kind === 'subtotal' || r.kind === 'grand' ? { colSpan: 7 } : {}),
      render: (_, r) => {
        if (r.kind === 'line') return r.no
        return r.kind === 'grand' ? <b>รวมทั้งสิ้น</b> : null
      },
    },
    {
      title: 'Job', key: 'job', width: 70,
      onCell: (r) => (r.kind === 'line' ? {} : { colSpan: 0 }),
      render: (_, r) => (r.kind === 'line' ? r.line.job_code ?? '-' : null),
    },
    {
      title: 'Cost Code', key: 'cost_code', width: 120,
      onCell: (r) => (r.kind === 'line' ? {} : { colSpan: 0 }),
      render: (_, r) => (r.kind === 'line' ? (r.line.cost_code ? formatCostCodeDisplay(r.line.cost_code) : '-') : null),
    },
    {
      title: 'MatCode', key: 'mat_code', width: 150,
      onCell: (r) => (r.kind === 'line' ? {} : { colSpan: 0 }),
      render: (_, r) => (r.kind === 'line' ? (r.line.mat_code ? <span style={{ fontFamily: 'monospace' }}>{r.line.mat_code}</span> : '-') : null),
    },
    {
      title: 'Description', key: 'desc', width: descWidth, ellipsis: true,
      onCell: (r) => (r.kind === 'line' ? {} : { colSpan: 0 }),
      render: (_, r) => (r.kind === 'line' ? <span title={r.line.description}>{r.line.description}</span> : null),
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
      title: 'Remark', key: 'remark',
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
            <Col span={24}>
              <div style={{ maxWidth: 520 }}>
              <div style={{ marginBottom: 4, color: '#374151' }}><span style={{ color: '#dc2626' }}>* </span>โครงการ</div>
              <Select
                showSearch
                allowClear
                style={{ width: '100%' }}
                placeholder="เลือกโครงการ"
                status={projectError && !projectCode ? 'error' : undefined}
                loading={projectsLoading}
                optionFilterProp="label"
                value={projectCode}
                onChange={(v) => { setProjectCode(v); if (v) setProjectError(false) }}
                options={projects}
              />
              {projectError && !projectCode && (
                <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>กรุณาเลือกโครงการ</div>
              )}
            </div>
            </Col>

            {report === 'HISTORY' && (
              <Col span={24}>
              <div style={{ maxWidth: 520 }}>
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
              </div>
            </Col>
            )}

            <Col span={24}>
              <div style={{ maxWidth: 520 }}>
                <div style={{ marginBottom: 4, color: '#374151' }}>ระบบ (Job)</div>
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
            </div>
            </Col>

            <Col span={24}>
              <div style={{ maxWidth: 520 }}>
              <div style={{ marginBottom: 4, color: '#374151' }}>วันที่ (เริ่มต้น - สิ้นสุด)</div>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                value={range as any}
                onChange={(v) => setRange(v as any)}
              />
            </div>
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
          {result.groups.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Space>
                <Button type="primary" icon={<FileExcelOutlined />} onClick={exportExcel}>Export Excel</Button>
                <Button type="primary" icon={<FilePdfOutlined />} onClick={() => setPrinting(true)}>Export PDF</Button>
              </Space>
            </div>
          )}
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
                scroll={{ x: 1170 }}
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
              scroll={{ x: 1170 }}
            />
          )}
        </Card>
      )}

      {printing && result && (
        <POReportPrint
          onDone={() => setPrinting(false)}
          data={{
            title: reportTitle,
            conditions: shownConditions,
            pending: report === 'PENDING_RECEIPT',
            groups: result.groups,
            grandTotal: result.grandTotal,
          }}
        />
      )}
    </div>
  )
}

export default POReportPage
