import React, { useEffect, useMemo, useState } from 'react'
import { Card, Table, Button, Space, Select, Segmented, DatePicker, message } from 'antd'
import { PrinterOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { useProjectOptions } from '@/hooks/useProjectOptions'
import { pettyCashService } from '@/services/pettyCashService'
import type { PettyCashRequisition } from '@/types/pettyCash'
import { formatMoney } from '@/utils/formatMoney'
import PettyCashCoverPrint, { buildCoverData, type CoverData } from './PettyCashCoverPrint'

// 4.2 สร้างใบปะหน้าเงินสดย่อย: tick APPROVED petty cash documents (any project / branch), then print a cover
// page (A4 landscape) listing every line of the ticked documents. Print only — nothing is saved.

const { RangePicker } = DatePicker
const num = (v: unknown) => Number(v ?? 0) || 0
const cardStyle: React.CSSProperties = { borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }

type PayFilter = 'UNPAID' | 'PAID' | 'ALL'

const PettyCashCoverPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const user = useAppSelector((s) => s.auth.user)

  const [items, setItems] = useState<PettyCashRequisition[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [projectFilter, setProjectFilter] = useState<string | undefined>()
  const [payFilter, setPayFilter] = useState<PayFilter>('UNPAID')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)

  // Ticked documents, kept across pages / filters (row data is needed for the same-project rule).
  const [selected, setSelected] = useState<Record<number, PettyCashRequisition>>({})
  const [printing, setPrinting] = useState(false)
  const [printData, setPrintData] = useState<CoverData | null>(null)

  const { projects: projectRows } = useProjectOptions({ include_closed: true, include_inactive: true })
  const projectOptions = useMemo(
    () => projectRows.map((p) => ({ value: p.project_code, label: `${p.project_code} ${p.project_name ?? ''}` })),
    [projectRows],
  )

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await pettyCashService.list(accessToken, {
        status: 'APPROVED',
        project_code: projectFilter || undefined,
        payment_status: payFilter === 'ALL' ? undefined : payFilter,
        date_from: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
        date_to: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
        page,
        page_size: pageSize,
      })
      setItems(res.data)
      setTotal(res.total)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [page, pageSize, projectFilter, payFilter, dateRange])

  const projectOf = (r: PettyCashRequisition) => r.project_display_code ?? r.project_code ?? r.project_codes?.[0] ?? ''
  const selectedList = Object.values(selected)
  const selectedBranches = [...new Set(selectedList.map((r) => r.branch_code).filter(Boolean))]

  const handlePrint = async () => {
    if (selectedList.length === 0) return
    setPrinting(true)
    try {
      const ordered = selectedList.slice().sort((a, b) => a.pc_no.localeCompare(b.pc_no))
      const docs = await Promise.all(ordered.map((r) => pettyCashService.get(accessToken, r.id)))
      setPrintData(buildCoverData(docs, user?.username || user?.full_name || ''))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดรายละเอียดใบเบิกไม่สำเร็จ')
      setPrinting(false)
    }
  }

  const columns: ColumnsType<PettyCashRequisition> = [
    { title: 'No.', key: 'no', width: 60, align: 'center', render: (_v, _r, i) => (page - 1) * pageSize + i + 1 },
    { title: 'No Petty Cash', dataIndex: 'pc_no', key: 'pc_no', width: 160 },
    { title: 'สาขา', dataIndex: 'branch_code', key: 'branch', width: 90, align: 'center', render: (v) => v || '-' },
    {
      title: 'Project', key: 'project', width: 260, ellipsis: true,
      render: (_v, r) => `${projectOf(r)} ${r.project_display_name ?? r.project_name ?? ''}`.trim() || '-',
    },
    {
      title: 'Supplier', dataIndex: 'supplier_names', key: 'supplier', width: 220, ellipsis: true,
      render: (v) => (Array.isArray(v) ? v.join(', ') : v) || '-',
    },
    {
      title: 'Net Price', key: 'net_price', width: 130, align: 'right',
      render: (_v, r) => formatMoney(num(r.net_value) + num(r.wht_total)),
    },
    { title: 'WHT', key: 'wht', width: 110, align: 'right', render: (_v, r) => (num(r.wht_total) > 0 ? formatMoney(num(r.wht_total)) : '-') },
    { title: 'Amount', key: 'amount', width: 130, align: 'right', render: (_v, r) => formatMoney(num(r.net_value)) },
    { title: 'Date', dataIndex: 'pc_date', key: 'date', width: 110, align: 'center', render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-') },
    {
      title: 'สถานะการจ่าย', dataIndex: 'payment_status', key: 'pay', width: 120, align: 'center',
      render: (v) => (v === 'PAID' ? 'Paid' : v === 'PARTIAL' ? 'จ่ายบางส่วน' : 'ยังไม่จ่าย'),
    },
  ]

  const selectedTotal = selectedList.reduce((s, r) => s + num(r.net_value), 0)

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="สร้างใบปะหน้าเงินสดย่อย"
        subtitle="ติ๊กเลือกใบเบิกเงินสดย่อยที่อนุมัติแล้ว แล้วพิมพ์ใบปะหน้า"
      />

      <Card style={{ ...cardStyle, marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
        <Space wrap size={12}>
          <Select
            allowClear showSearch placeholder="ทุกโครงการ" style={{ width: 320 }}
            value={projectFilter} options={projectOptions} optionFilterProp="label"
            onChange={(v) => { setProjectFilter(v); setPage(1) }}
          />
          <Segmented<PayFilter>
            value={payFilter}
            options={[{ label: 'ยังไม่จ่าย', value: 'UNPAID' }, { label: 'Paid', value: 'PAID' }, { label: 'ทั้งหมด', value: 'ALL' }]}
            onChange={(v) => { setPayFilter(v); setPage(1) }}
          />
          <RangePicker
            format="DD/MM/YYYY" value={dateRange}
            onChange={(v) => { setDateRange(v && v[0] && v[1] ? [v[0], v[1]] : null); setPage(1) }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>รีเฟรช</Button>
        </Space>
      </Card>

      <Card style={cardStyle} styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ color: '#374151' }}>
            เลือกแล้ว {selectedList.length} ใบ
            {selectedBranches.length > 0 && <> · สาขา {selectedBranches.join(', ')}</>}
            {selectedList.length > 0 && <> · รวม {formatMoney(selectedTotal)} บาท</>}
          </span>
          <Space>
            {selectedList.length > 0 && <Button onClick={() => setSelected({})}>ล้างที่เลือก</Button>}
            <Button
              type="primary" icon={<PrinterOutlined />} loading={printing}
              disabled={selectedList.length === 0} onClick={handlePrint}
            >
              พิมพ์ใบปะหน้า
            </Button>
          </Space>
        </div>
        <Table<PettyCashRequisition>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={items}
          columns={columns}
          scroll={{ x: 1390 }}
          rowSelection={{
            selectedRowKeys: selectedList.map((r) => r.id),
            preserveSelectedRowKeys: true,
            hideSelectAll: true,
            onSelect: (r, checked) =>
              setSelected((prev) => {
                const next = { ...prev }
                if (checked) next[r.id] = r
                else delete next[r.id]
                return next
              }),
          }}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
        />
      </Card>

      {printData && (
        <PettyCashCoverPrint
          data={printData}
          onReady={() => {
            window.print()
            setPrintData(null)
            setPrinting(false)
          }}
        />
      )}
    </div>
  )
}

export default PettyCashCoverPage
