import React, { useCallback, useEffect, useState } from 'react'
import { Card, Table, Space, message, Input, Row, Col, Tag, Button, DatePicker, Select, Modal, Descriptions, Tooltip } from 'antd'
import { SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { Link } from 'react-router-dom'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import * as XLSX from 'xlsx'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { permissionMatrixService } from '@/services/permissionMatrix.service'
import { listPOs, exportPOs, getPODetail } from '@/services/poService'
import type { POListFilters } from '@/services/poService'
import type { POListItem, PODetail, POLine } from '@/types/po'

const { RangePicker } = DatePicker

const fmtMoney = (v?: number | null) =>
  v == null ? '-' : v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Pre-VAT amount after discount. GET /po returns total_amount as the pre-discount sum, so subtract.
const preVat = (r: POListItem) => (r.total_amount ?? 0) - (r.discount_amount ?? 0)

const creditText = (v: POListItem['credit']) => {
  if (v == null || v === '') return '-'
  return typeof v === 'number' ? `${v} วัน` : String(v)
}

// Row tint — keyed on payment_status; inline style via onRow (see DESIGN.md "Row tint").
type PayStatus = 'UNPAID' | 'PARTIAL' | 'PAID'
const PAY_STYLE: Record<PayStatus, { bg: string; border: string; tag: string; label: string; legend: string }> = {
  UNPAID: { bg: '#f5f5f5', border: '#8c8c8c', tag: 'default', label: 'ยังไม่จ่าย', legend: 'เทา = ยังไม่จ่าย' },
  PARTIAL: { bg: '#fffbe6', border: '#faad14', tag: 'warning', label: 'จ่ายบางส่วน', legend: 'เหลือง = จ่ายบางส่วน (ยังต้องจ่ายเพิ่ม)' },
  PAID: { bg: '#f6ffed', border: '#52c41a', tag: 'success', label: 'จ่ายครบ', legend: 'เขียว = จ่ายครบ' },
}
const payStatusOf = (r: POListItem): PayStatus => (r.payment_status as PayStatus) in PAY_STYLE ? (r.payment_status as PayStatus) : 'UNPAID'
const getRowStyle = (r: POListItem): React.CSSProperties => {
  const c = PAY_STYLE[payStatusOf(r)]
  return { background: c.bg, borderLeft: `3px solid ${c.border}` }
}

const RECEIVE_TAG: Record<string, { color: string; label: string }> = {
  RECEIVED: { color: 'success', label: 'รับครบ' },
  PARTIALLY_RECEIVED: { color: 'warning', label: 'รับบางส่วน' },
}

// Local ResizableTitle pattern (same as POHistoryPage.tsx) — no shared component.
interface ResizableTitleProps extends React.HTMLAttributes<HTMLElement> {
  onResize?: (e: React.SyntheticEvent, data: ResizeCallbackData) => void
  width?: number
}

const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResize, width, ...restProps } = props
  if (!width || !onResize) return <th {...restProps} />
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[60, 0]}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', right: -5, bottom: 0, top: 0, width: 10, cursor: 'col-resize', zIndex: 1 }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative' }} />
    </Resizable>
  )
}

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  no: 60, po_no: 150, pr_nos: 160, supplier_name: 200, pre_vat: 130,
  net_amount: 130, credit: 100, project: 220, pay_status: 160, receive_status: 120, remarks: 200,
}

interface DeptOption {
  value: string
  label: string
}

const POLineItemsPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [items, setItems] = useState<POListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [deptOptions, setDeptOptions] = useState<DeptOption[]>([])
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS)
  const handleColResize = (key: string) => (_e: React.SyntheticEvent, data: ResizeCallbackData) =>
    setColWidths((w) => ({ ...w, [key]: data.size.width }))

  // Uncommitted inputs vs applied filters: typing doesn't refetch, only "ค้นหา"/"ล้าง" commits.
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [deptInput, setDeptInput] = useState<string | undefined>(undefined)
  const [searchInput, setSearchInput] = useState('')
  const [paymentInput, setPaymentInput] = useState<POListFilters['payment_status']>(undefined)
  const [filters, setFilters] = useState<POListFilters>({})

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<PODetail | null>(null)

  useEffect(() => {
    permissionMatrixService
      .getDepartments(accessToken)
      .then((list) =>
        setDeptOptions(
          list
            .filter((d) => d.is_active !== false)
            .map((d) => ({ value: d.dept_code, label: d.dept_name ? `${d.dept_code} — ${d.dept_name}` : d.dept_code })),
        ),
      )
      .catch(() => message.error('โหลดรายชื่อแผนกไม่สำเร็จ'))
  }, [accessToken])

  const errText = (err: any, fallback: string) =>
    err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback

  const fetchData = useCallback(async (p: number, l: number, f: POListFilters) => {
    setLoading(true)
    try {
      const data = await listPOs({ ...f, page: p, page_size: l })
      setItems(Array.isArray(data.data) ? data.data : [])
      setTotal(data.total ?? 0)
    } catch (err: any) {
      message.error(errText(err, 'โหลดข้อมูลไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(page, limit, filters) }, [page, limit, filters, fetchData])

  const handleSearch = () => {
    setPage(1)
    setFilters({
      date_from: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
      date_to: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      dept_code: deptInput,
      search: searchInput.trim() || undefined,
      payment_status: paymentInput,
    })
  }

  const handleClear = () => {
    setDateRange(null)
    setDeptInput(undefined)
    setSearchInput('')
    setPaymentInput(undefined)
    setPage(1)
    setFilters({})
  }

  const openDetail = async (r: POListItem) => {
    setDetail(null)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      setDetail(await getPODetail(r.po_id))
    } catch (err: any) {
      message.error(errText(err, 'โหลดรายการสินค้าไม่สำเร็จ'))
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const rows = await exportPOs(filters)
      if (rows.length === 0) {
        message.info('ไม่มีข้อมูลให้ส่งออก')
        return
      }
      const sheetRows = rows.map((r) => ({
        'เลขที่ PO': r.po_no,
        'วันที่': r.po_date?.slice(0, 10) ?? '',
        'เลขที่ PR': (r.pr_nos ?? []).join(', '),
        'ผู้ขาย': r.supplier_name ?? '',
        'ยอดก่อน VAT': preVat(r),
        'ยอดสุทธิ': r.net_amount ?? 0,
        'เครดิต': r.credit == null ? '' : typeof r.credit === 'number' ? `${r.credit} วัน` : r.credit,
        'โครงการ': r.project_code ? (r.project_name ? `${r.project_code} - ${r.project_name}` : r.project_code) : '',
        'หมายเหตุ': r.remarks ?? '',
        'สถานะ': r.status,
        'สถานะจ่าย': PAY_STYLE[payStatusOf(r)].label,
        'สถานะรับของ': r.status_receive ?? '',
      }))
      const ws = XLSX.utils.json_to_sheet(sheetRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'PO')
      const t = new Date()
      const dateStr = [t.getFullYear(), String(t.getMonth() + 1).padStart(2, '0'), String(t.getDate()).padStart(2, '0')].join('-')
      XLSX.writeFile(wb, `รายการ_PO_${dateStr}.xlsx`)
    } catch (err: any) {
      message.error(errText(err, 'ส่งออกข้อมูลไม่สำเร็จ'))
    } finally {
      setExporting(false)
    }
  }

  const resizable = (key: string) => ({
    width: colWidths[key],
    onHeaderCell: () => ({ width: colWidths[key], onResize: handleColResize(key) }),
  })

  const columns: ColumnsType<POListItem> = [
    {
      title: 'No',
      key: 'no',
      align: 'center',
      ...resizable('no'),
      render: (_: unknown, __: POListItem, idx: number) => (page - 1) * limit + idx + 1,
    },
    {
      title: 'PO',
      dataIndex: 'po_no',
      key: 'po_no',
      ...resizable('po_no'),
      render: (v: string, r) => (
        <Link
          to={`/po/approval/${r.po_id}`}
          style={{ color: '#2563eb', fontWeight: 600 }}
          onClick={(e) => e.stopPropagation()}
        >
          {v}
          {(r.revision_round ?? 0) > 0 ? ` #R${r.revision_round}` : ''}
        </Link>
      ),
    },
    {
      title: 'PR',
      dataIndex: 'pr_nos',
      key: 'pr_nos',
      ellipsis: true,
      ...resizable('pr_nos'),
      render: (v: string[] | undefined, r) => {
        // Prefer pr_refs; fall back to pr_nos paired by index with pr_ids (same order on GET /po).
        const refs = r.pr_refs?.length
          ? r.pr_refs
          : (v ?? []).map((no, i) => ({ pr_id: r.pr_ids?.[i] as number | undefined, pr_no: no }))
        if (refs.length === 0) return '—'
        return refs.map((ref, i) => (
          <React.Fragment key={`${ref.pr_no}-${i}`}>
            {i > 0 && ', '}
            {ref.pr_id != null ? (
              <Link to={`/pr/${ref.pr_id}`} style={{ color: '#2563eb', fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>
                {ref.pr_no}
              </Link>
            ) : (
              ref.pr_no
            )}
          </React.Fragment>
        ))
      },
    },
    {
      title: 'ชื่อร้านค้า',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      ellipsis: true,
      ...resizable('supplier_name'),
      render: (v?: string | null) => v || '—',
    },
    {
      title: 'ยอดก่อน VAT',
      dataIndex: 'total_amount',
      key: 'pre_vat',
      align: 'right',
      ...resizable('pre_vat'),
      render: (v?: number) => fmtMoney(v),
    },
    {
      title: 'ยอดรวม VAT',
      dataIndex: 'net_amount',
      key: 'net_amount',
      align: 'right',
      ...resizable('net_amount'),
      render: (v?: number) => fmtMoney(v),
    },
    {
      title: 'เครดิต',
      dataIndex: 'credit',
      key: 'credit',
      ...resizable('credit'),
      render: (v: POListItem['credit']) => creditText(v),
    },
    {
      // On-screen convention: "{code} {name}", single space, no dash.
      title: 'โครงการ',
      key: 'project',
      ellipsis: true,
      ...resizable('project'),
      render: (_: unknown, r) => [r.project_code, r.project_name].filter(Boolean).join(' ') || '—',
    },
    {
      title: 'สถานะจ่าย',
      key: 'pay_status',
      ...resizable('pay_status'),
      render: (_: unknown, r) => {
        const st = payStatusOf(r)
        return (
          <Tag color={PAY_STYLE[st].tag} style={{ margin: 0 }}>
            {PAY_STYLE[st].label}
            {st === 'PARTIAL' ? ` ${fmtMoney(r.paid_amount ?? 0)} / ${fmtMoney(r.net_amount ?? 0)}` : ''}
          </Tag>
        )
      },
    },
    {
      title: 'สถานะรับของ',
      key: 'receive_status',
      ...resizable('receive_status'),
      render: (_: unknown, r) => {
        const t = RECEIVE_TAG[r.status_receive ?? '']
        return <Tag color={t?.color ?? 'default'} style={{ margin: 0 }}>{t?.label ?? 'ยังไม่รับ'}</Tag>
      },
    },
    {
      title: 'หมายเหตุ',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      ...resizable('remarks'),
      render: (v?: string | null) => (
        <Tooltip title={v || undefined}>
          <span>{v || '—'}</span>
        </Tooltip>
      ),
    },
  ]

  const lineColumns: ColumnsType<POLine> = [
    { title: '#', dataIndex: 'line_no', key: 'line_no', width: 50 },
    { title: 'รหัสสินค้า', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'ชื่อสินค้า', dataIndex: 'mat_name', key: 'mat_name', render: (v?: string) => v || '-' },
    { title: 'สเปค', key: 'spec', render: (_: unknown, l) => l.spec_name ?? l.spec ?? '-' },
    { title: 'หน่วย', dataIndex: 'unit_name', key: 'unit_name', render: (v?: string) => v || '-' },
    { title: 'จำนวนสั่ง', dataIndex: 'qty_ordered', key: 'qty_ordered', align: 'right', render: (v: number) => v?.toLocaleString('th-TH') },
    { title: 'รับแล้ว', dataIndex: 'qty_received', key: 'qty_received', align: 'right', render: (v?: number) => v?.toLocaleString('th-TH') ?? '-' },
    { title: 'ราคา/หน่วย', dataIndex: 'unit_price', key: 'unit_price', align: 'right', render: (v: number) => fmtMoney(v) },
    { title: 'มูลค่า', dataIndex: 'amount', key: 'amount', align: 'right', render: (v: number) => fmtMoney(v) },
    {
      title: 'Cost Code',
      key: 'cost_code',
      render: (_: unknown, l) => {
        const code = l.cost_code_full ?? l.cost_code
        return code ? (l.cost_subgroup_name ? `${code} - ${l.cost_subgroup_name}` : code) : '-'
      },
    },
    { title: 'หมายเหตุ', dataIndex: 'remarks', key: 'remarks', render: (v?: string) => v || '-' },
    {
      title: '',
      dataIndex: 'status',
      key: 'status',
      width: 70,
      render: (v: string) => (v === 'CANCELLED' ? <Tag color="warning" style={{ margin: 0 }}>ยกเลิก</Tag> : null),
    },
  ]

  return (
    <div>
      <PageHeader
        title="รายการ PO"
        subtitle="รายการใบสั่งซื้อทั้งหมด (คลิกที่แถวเพื่อดูรายการสินค้า)"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบสั่งซื้อ' }, { title: 'รายการ PO' }]}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)', marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <RangePicker
              value={dateRange as any}
              onChange={(v) => setDateRange(v as [Dayjs | null, Dayjs | null] | null)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              placeholder="แผนกผู้ขอซื้อ"
              value={deptInput}
              onChange={(v) => setDeptInput(v)}
              options={deptOptions}
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              placeholder="สถานะจ่าย"
              value={paymentInput}
              onChange={(v) => setPaymentInput(v)}
              allowClear
              options={[
                { value: 'UNPAID', label: 'ยังไม่จ่าย' },
                { value: 'PARTIAL', label: 'จ่ายบางส่วน' },
                { value: 'PAID', label: 'จ่ายครบ' },
              ]}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={10}>
            <Input
              placeholder="ค้นหาเลขที่ PO หรือ PR"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
        </Row>
        <Row justify="end" style={{ marginTop: 16 }}>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
              ส่งออก Excel
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleClear}>
              ล้างค่า
            </Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={loading}>
              ค้นหา
            </Button>
          </Space>
        </Row>
      </Card>

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Space size={20} wrap style={{ marginBottom: 12, fontSize: 12 }}>
          {(Object.keys(PAY_STYLE) as PayStatus[]).map((k) => (
            <span key={k}>
              <span style={{ display: 'inline-block', width: 12, height: 12, background: PAY_STYLE[k].bg, borderLeft: `3px solid ${PAY_STYLE[k].border}`, marginRight: 6, verticalAlign: 'middle' }} />
              {PAY_STYLE[k].legend}
            </span>
          ))}
        </Space>
        <Table
          rowKey="po_id"
          loading={loading}
          dataSource={items}
          columns={columns}
          components={{ header: { cell: ResizableTitle } }}
          size="middle"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'ไม่พบข้อมูล' }}
          onRow={(r) => ({ onClick: () => openDetail(r), style: { cursor: 'pointer', ...getRowStyle(r) } })}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (p, l) => { setPage(p); setLimit(l) },
          }}
        />
      </Card>

      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={1200}
        title={detail ? `รายการสินค้า — ${detail.po_no}` : 'รายการสินค้า'}
        destroyOnClose
      >
        {detail && (
          <Descriptions size="small" column={{ xs: 1, md: 3 }} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="ผู้ขาย">{detail.supplier_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="วันที่">{detail.po_date?.slice(0, 10) ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="ยอดสุทธิ">{fmtMoney(detail.net_amount)}</Descriptions.Item>
          </Descriptions>
        )}
        <Table
          rowKey={(l) => `${l.line_no}-${l.mat_code}`}
          loading={detailLoading}
          dataSource={detail?.lines ?? []}
          columns={lineColumns}
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'ไม่พบรายการสินค้า' }}
        />
      </Modal>
    </div>
  )
}

export default POLineItemsPage
