import { formatMoney } from '@/utils/formatMoney'
import React, { useEffect, useState } from 'react'
import { Table, Button, InputNumber, Input, Space, Tag, Tooltip, Badge, Select, Spin, Modal, DatePicker, Checkbox, message } from 'antd'
import ConfirmDeleteButton from '@/components/common/ConfirmDeleteButton'
import {
  SearchOutlined, DeleteOutlined, LinkOutlined, FileTextOutlined,
  CalculatorOutlined, LeftOutlined, RightOutlined, CloseCircleFilled, HistoryOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import axios from 'axios'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import TableScrollEnd from '@/components/common/TableScrollEnd'
import MaterialPickerModal from '@/components/common/MaterialPickerModal'
import CostCodeSelectionModal, { type CostCodeItem } from '@/components/common/CostCodeSelectionModal'
import type { Material } from '@/types'
import type { POLineItem } from '@/types/po'
import { useAppSelector } from '@/store'
import { calcDisc, calcSpecialAllocs, type SpecialDiscount } from '@/utils/poCalc'
import { formatItemLabel } from '@/utils/itemLabel'
import { formatCostCodeDisplay } from '@/utils/costCode'
import { missingCostRowProps } from '@/utils/validateCostCode'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

// Same local react-resizable pattern as POStatusPage.tsx / PRHistoryPage.tsx — no
// shared component, so copied locally for this modal's table.
// Compact body cell for the PO lines table: tighter padding + 12px text.
const CompactCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = (props) => (
  <td {...props} style={{ ...props.style, padding: '4px 8px', fontSize: 12 }} />
)

interface ResizableTitleProps extends React.HTMLAttributes<HTMLElement> {
  onResize?: (e: React.SyntheticEvent, data: ResizeCallbackData) => void
  width?: number
}

const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResize, width, ...restProps } = props
  if (!width || !onResize) {
    return <th {...restProps} />
  }
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[60, 0]}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: -5,
            bottom: 0,
            top: 0,
            width: 10,
            cursor: 'col-resize',
            zIndex: 1,
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative' }} />
    </Resizable>
  )
}

interface PriceHistoryRow {
  mat_code: string
  mat_name: string
  spec_name: string | null
  brand_name?: string | null
  supplier_name: string | null
  project_code?: string | null
  project_name?: string | null
  po_date: string
  unit_price: number
  qty_ordered?: number | null
  unit_name?: string | null
  remarks?: string | null
  po_no: string
}

// GET /master/materials/:code/price-history — confirmed live backend endpoint
// (page/limit params, PaginatedResponse shape, already sorted po_date DESC).
const PriceHistoryModal: React.FC<{ matCode: string | null; onClose: () => void }> = ({ matCode, onClose }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [rows, setRows] = useState<PriceHistoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [range, setRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const pageSize = 50

  const rangePresets: { label: string; value: [dayjs.Dayjs, dayjs.Dayjs] }[] = [
    { label: '3 เดือน', value: [dayjs().subtract(3, 'month'), dayjs()] },
    { label: '6 เดือน', value: [dayjs().subtract(6, 'month'), dayjs()] },
    { label: '1 ปี', value: [dayjs().subtract(1, 'year'), dayjs()] },
  ]

  const [unitColWidth, setUnitColWidth] = useState(90)
  const [remarkColWidth, setRemarkColWidth] = useState(260)
  const handleUnitColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => setUnitColWidth(data.size.width)
  const handleRemarkColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => setRemarkColWidth(data.size.width)
  const [matCodeColWidth, setMatCodeColWidth] = useState(150)
  const [nameColWidth, setNameColWidth] = useState(300)
  const [supplierColWidth, setSupplierColWidth] = useState(226)
  const [projectColWidth, setProjectColWidth] = useState(240)
  const [dateColWidth, setDateColWidth] = useState(150)
  const [qtyColWidth, setQtyColWidth] = useState(110)
  const [priceColWidth, setPriceColWidth] = useState(150)
  const handleMatCodeColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => setMatCodeColWidth(data.size.width)
  const handleNameColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => setNameColWidth(data.size.width)
  const handleSupplierColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => setSupplierColWidth(data.size.width)
  const handleProjectColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => setProjectColWidth(data.size.width)
  const handleDateColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => setDateColWidth(data.size.width)
  const handleQtyColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => setQtyColWidth(data.size.width)
  const handlePriceColResize =(_e: React.SyntheticEvent, data: ResizeCallbackData) => setPriceColWidth(data.size.width)

  useEffect(() => {
    if (!matCode) return
    setPage(1)
    setRange(null)
  }, [matCode])

  useEffect(() => {
    if (!matCode) return
    const fetchHistory = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/materials/${encodeURIComponent(matCode)}/price-history`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            page,
            limit: pageSize,
            date_from: range?.[0] ? range[0].format('YYYY-MM-DD') : undefined,
            date_to: range?.[1] ? range[1].format('YYYY-MM-DD') : undefined,
          },
        })
        const body = res.data?.data ?? res.data
        setRows(Array.isArray(body?.data) ? body.data : [])
        setTotal(body?.total ?? 0)
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดราคาที่เคยซื้อไม่สำเร็จ')
        setRows([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [matCode, page, range, accessToken])

  const handleRangeChange = (v: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    setRange(v)
    setPage(1)
  }

  return (
    <Modal
      title="ราคาที่เคยซื้อล่าสุด"
      open={!!matCode}
      onCancel={onClose}
      footer={<Button onClick={onClose}>ปิด</Button>}
      width={2048}
      style={{ maxWidth: '95vw' }}
      destroyOnClose
    >
      <div style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker
          value={range as any}
          onChange={(v) => handleRangeChange(v as any)}
          format="DD/MM/YYYY"
          placeholder={['วันเริ่ม', 'วันสิ้นสุด']}
          allowClear
          presets={rangePresets}
        />
      </div>
      <TableScrollEnd alwaysShow>
      <Table
        rowKey={(r: PriceHistoryRow) => `${r.po_no}-${r.po_date}`}
        loading={loading}
        dataSource={rows}
        size="small"
        components={{ header: { cell: ResizableTitle } }}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            // PO that bought the item at that time (replaces the material-code column).
            title: 'เลขที่ PO',
            dataIndex: 'po_no',
            width: matCodeColWidth,
            onHeaderCell: () => ({ width: matCodeColWidth, onResize: handleMatCodeColResize }),
          },
          {
            // Item name + SpecName on one line, single-space-joined, no dash —
            // same display rule as PRPrint.tsx's ItemRow.
            title: 'รายการ',
            key: 'mat_name',
            ellipsis: true,
            width: nameColWidth,
            onHeaderCell: () => ({ width: nameColWidth, onResize: handleNameColResize }),
            render: (_: unknown, r: PriceHistoryRow) =>
              formatItemLabel(r.mat_name, r.spec_name, r.brand_name),
          },
          {
            title: 'ร้านค้า',
            dataIndex: 'supplier_name',
            width: supplierColWidth,
            onHeaderCell: () => ({ width: supplierColWidth, onResize: handleSupplierColResize }),
            render: (v: string | null) => v || <span style={{ color: '#9ca3af' }}>—</span>,
          },
          {
            // "{project_code} {project_name}", single space, no dash (on-screen project display rule).
            title: 'โครงการ',
            key: 'project',
            width: projectColWidth,
            onHeaderCell: () => ({ width: projectColWidth, onResize: handleProjectColResize }),
            render: (_: unknown, r: PriceHistoryRow) => {
              const text = [r.project_code, r.project_name].filter(Boolean).join(' ')
              return (
                <div
                  title={text || undefined}
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: text ? undefined : '#9ca3af' }}
                >
                  {text || '-'}
                </div>
              )
            },
          },
          {
            title: 'วันที่',
            dataIndex: 'po_date',
            width: dateColWidth,
            align: 'center' as const,
            onHeaderCell: () => ({ width: dateColWidth, onResize: handleDateColResize }),
            render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
          },
          {
            // Quantity ordered on that PO line — a count, so shown as-is (no forced .00).
            title: 'จำนวน',
            dataIndex: 'qty_ordered',
            width: qtyColWidth,
            align: 'right' as const,
            onHeaderCell: () => ({ width: qtyColWidth, onResize: handleQtyColResize }),
            render: (v: number | null | undefined) =>
              v == null ? '—' : Number(v).toLocaleString('th-TH', { maximumFractionDigits: 4 }),
          },
          {
            title: 'หน่วย',
            dataIndex: 'unit_name',
            width: unitColWidth,
            align: 'center' as const,
            onHeaderCell: () => ({ width: unitColWidth, onResize: handleUnitColResize }),
            render: (v: string | null | undefined) => v || <span style={{ color: '#9ca3af' }}>—</span>,
          },
          {
            title: 'ราคา/หน่วย',
            dataIndex: 'unit_price',
            width: priceColWidth,
            align: 'right' as const,
            onHeaderCell: () => ({ width: priceColWidth, onResize: handlePriceColResize }),
            render: (v: number) => v.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
          },
          {
            title: 'หมายเหตุ',
            dataIndex: 'remarks',
            ellipsis: true,
            width: remarkColWidth,
            onHeaderCell: () => ({ width: remarkColWidth, onResize: handleRemarkColResize }),
            render: (v: string | null | undefined) => v || <span style={{ color: '#9ca3af' }}>—</span>,
          },
        ]}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
        locale={{ emptyText: range ? 'ไม่พบประวัติการซื้อในช่วงเวลานี้' : 'ไม่พบประวัติการซื้อ' }}
      />
      </TableScrollEnd>
    </Modal>
  )
}

interface POItemsTableProps {
  items: POLineItem[]
  onChange: (items: POLineItem[]) => void
  taxOpen?: boolean
  onTaxToggle?: () => void
  useDisc?: boolean
  discType?: 'pct' | 'amt'
  useVat?: boolean
  useWht?: boolean
  // Document-level "ประเภท Job" value (PO header field) — passed down so the
  // CostCode picker can filter its options, same as PRItemsTable's jobTypeCode.
  // PO's job_code is header-level (one per PO), so every line shares this
  // same filter context.
  jobTypeCode?: string
  // OH order types: Cost Code picker loads only GET /master/cost-code/full?scope=oh.
  ohOnly?: boolean
  // Set by the parent after a failed submit: rows with no cost code are tinted
  // red. Never set for draft saves.
  highlightMissingCost?: boolean
  // Special Discount (end-of-bill, step 2): shown under the table. onSpecialDiscChange omitted = read-only.
  specialDisc?: SpecialDiscount
  onSpecialDiscChange?: (sp: SpecialDiscount) => void
  // ส่วนลดที่ 2 column (its own checkbox in the tax panel).
  useDisc2?: boolean
  // ส่วนลดที่ 3 column (its own checkbox in the tax panel).
  useDisc3?: boolean
  // VAT total typed by hand (null = calculated 7%). onVatManualChange omitted = read-only.
  vatManual?: number | null
  onVatManualChange?: (v: number | null) => void
}

const POItemsTable: React.FC<POItemsTableProps> = ({
  items, onChange,
  taxOpen, onTaxToggle,
  useDisc = false, discType = 'pct',
  useVat = false,
  useWht = false,
  jobTypeCode,
  ohOnly = false,
  highlightMissingCost = false,
  specialDisc = { type: 'amt', value: 0, avg: false },
  onSpecialDiscChange,
  useDisc2 = false,
  useDisc3 = false,
  vatManual = null,
  onVatManualChange,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  // key of the row whose Cost Code selection modal is open; null = closed
  const [costCodeModalRowKey, setCostCodeModalRowKey] = useState<string | null>(null)
  const [priceHistoryMatCode, setPriceHistoryMatCode] = useState<string | null>(null)
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  const [stockLoading, setStockLoading] = useState(false)

  useEffect(() => {
    const codes = Array.from(new Set(items.map((i) => i.mat_code).filter(Boolean)))
    if (codes.length === 0) {
      setStockMap({})
      return
    }
    const fetchStock = async () => {
      setStockLoading(true)
      try {
        const res = await axios.post(
          `${BASE_URL}/stock/inventory/batch-lookup`,
          { codes },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        const raw = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        const map: Record<string, number> = {}
        list.forEach((r: any) => {
          map[r.mat_code] = r.qty ?? 0
        })
        setStockMap(map)
      } catch {
        setStockMap({})
      } finally {
        setStockLoading(false)
      }
    }
    fetchStock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.mat_code).join(',')])

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  const renumber = (rows: POLineItem[]) => rows.map((r, idx) => ({ ...r, no: idx + 1 }))

  const updateItem = (key: string, field: keyof POLineItem, value: string | number | null) => {
    onChange(items.map((i) => {
      if (i.key !== key) return i
      const updated = { ...i, [field]: value }
      // mat_code cleared → drop any Cost Code selection, same guard as PRItemsTable.
      if (field === 'mat_code' && !value) {
        updated.cost_subgroup_id = null
        updated.cost_code_label = null
      }
      return updated
    }))
  }

  const removeItem = (key: string) => {
    onChange(renumber(items.filter((i) => i.key !== key)))
  }

  const handleCostCodeSelect = (key: string, item: CostCodeItem) => {
    onChange(items.map((i) => (i.key === key ? {
      ...i,
      cost_subgroup_id: item.subgroupId,
      // Display-only — same "code — name" convention as PRItemsTable.
      cost_code_label: item.subgroupName ? `${item.costCode} — ${item.subgroupName}` : item.costCode,
    } : i)))
  }

  const clearCostCode = (key: string) => {
    onChange(items.map((i) => (i.key === key ? { ...i, cost_subgroup_id: null, cost_code_label: null } : i)))
  }

  const handleMaterialConfirm = (materials: Material[]) => {
    const existingCodes = new Set(items.map((i) => i.mat_code))
    const toAdd = materials.filter((m) => !existingCodes.has(m.mat_code))
    if (toAdd.length === 0) return
    const newRows: POLineItem[] = toAdd.map((m) => ({
      key: `new-${Date.now()}-${m.mat_code}-${Math.random().toString(36).slice(2)}`,
      no: 0,
      pr_line_id: null,
      mat_code: m.mat_code,
      mat_name: m.mat_name_th,
      unit_name: m.unit_name || 'Ea',
      spec: m.spec_description ?? '',
      brand_name: m.brand_name ?? '',
      qty: 1,
      unit_price: 0,
      is_from_pr: false,
      disc_type: discType, // default จาก global setting
    }))
    onChange(renumber([...items, ...newRows]))
  }

  // Line discount (round 1), ส่วนลด 2 (round 2, % of what round 1 left — mirrors erp-api po_calc.go) and
  // this line's equal share of the Special Discount (ลดท้ายบิล).
  const lineDiscOf = (r: POLineItem) =>
    useDisc ? calcDisc(r.qty * r.unit_price, r.disc ?? 0, r.disc_type ?? discType) : 0
  const disc2Only = (r: POLineItem) =>
    useDisc2 && r.disc2 ? Math.round((r.qty * r.unit_price - lineDiscOf(r)) * r.disc2) / 100 : 0
  const disc3Only = (r: POLineItem) =>
    useDisc3 && r.disc3 ? Math.round((r.qty * r.unit_price - lineDiscOf(r) - disc2Only(r)) * r.disc3) / 100 : 0
  // ส่วนลดที่ 2 + 3 in baht (each sequential, same as erp-api po_calc.go stepAmt).
  const disc2Of = (r: POLineItem) => disc2Only(r) + disc3Only(r)
  const spCalc = calcSpecialAllocs(items.map((r) => r.qty * r.unit_price - lineDiscOf(r) - disc2Of(r)), specialDisc)
  const allocOf = (r: POLineItem) => spCalc.allocs[items.findIndex((i) => i.key === r.key)] ?? 0
  const showAvgInLines = specialDisc.avg && spCalc.special > 0

  const taxColumns: any[] = []

  if (useDisc || showAvgInLines) {
    taxColumns.push({
      title: 'ส่วนลด',
      key: 'disc',
      width: 140,
      align: 'center' as const,
      onHeaderCell: () => ({ style: { background: '#f0fdf4', color: '#166534' } }),
      onCell: () => ({ style: { background: '#f0fdf4' } }),
      render: (_: unknown, r: POLineItem) => {
        // ใช้ disc_type ของ row นั้นๆ ถ้าไม่มีใช้ global discType
        const rowDiscType: 'pct' | 'amt' = r.disc_type ?? discType
        const alloc = showAvgInLines ? allocOf(r) : 0
        const allocNote = alloc > 0 && (
          <div style={{ fontSize: 11, color: '#7c3aed', textAlign: 'right' }}>
            + Special {formatMoney(alloc)}
          </div>
        )
        if (!useDisc) return allocNote || null
        return (
          <>
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              size="small"
              min={0}
              max={rowDiscType === 'pct' ? 100 : undefined}
              value={r.disc ?? 0}
              style={{ width: '60%' }}
              onChange={(v) => updateItem(r.key, 'disc', v ?? 0)}
            />
            <Select
              size="small"
              value={rowDiscType}
              style={{ width: '40%' }}
              options={[
                { label: '%', value: 'pct' },
                { label: '฿', value: 'amt' },
              ]}
              onChange={(v) =>
                // Switching this row's unit reinterprets its raw `disc` number
                // under the new unit if left alone (e.g. 500 baht silently read
                // as 500%) — reset to 0 so the user re-enters under the new unit.
                onChange(
                  items.map((i) =>
                    i.key === r.key ? { ...i, disc_type: v, disc: 0 } : i,
                  ),
                )
              }
            />
          </Space.Compact>
          {allocNote}
          </>
        )
      },
    })
  }

  if (useDisc2) {
    taxColumns.push({
      title: 'ส่วนลดที่ 2',
      key: 'disc2',
      width: 110,
      align: 'center' as const,
      onHeaderCell: () => ({ style: { background: '#f0fdf4', color: '#166534' } }),
      onCell: () => ({ style: { background: '#f0fdf4' } }),
      render: (_: unknown, r: POLineItem) => (
        <>
          <InputNumber
            size="small"
            min={0}
            max={100}
            value={r.disc2 ?? 0}
            addonAfter="%"
            style={{ width: '100%' }}
            onChange={(v) => updateItem(r.key, 'disc2', v ?? 0)}
          />
        </>
      ),
    })
  }

  if (useDisc3) {
    taxColumns.push({
      title: 'ส่วนลดที่ 3',
      key: 'disc3',
      width: 110,
      align: 'center' as const,
      onHeaderCell: () => ({ style: { background: '#f0fdf4', color: '#166534' } }),
      onCell: () => ({ style: { background: '#f0fdf4' } }),
      render: (_: unknown, r: POLineItem) => (
        <>
          <InputNumber
            size="small"
            min={0}
            max={100}
            value={r.disc3 ?? 0}
            addonAfter="%"
            style={{ width: '100%' }}
            onChange={(v) => updateItem(r.key, 'disc3', v ?? 0)}
          />
        </>
      ),
    })
  }

  if (useVat) {
    taxColumns.push({
      title: 'VAT 7%',
      key: 'vat',
      width: 84,
      align: 'right' as const,
      onHeaderCell: () => ({ style: { background: '#fefce8', color: '#854d0e' } }),
      render: (_: unknown, r: POLineItem) => {
        const rowDiscType: 'pct' | 'amt' = r.disc_type ?? discType
        const lineAmt = r.qty * r.unit_price
        const discAmt = useDisc ? calcDisc(lineAmt, r.disc ?? 0, rowDiscType) : 0
        const vat = (lineAmt - discAmt - disc2Of(r) - (showAvgInLines ? allocOf(r) : 0)) * 0.07
        return (
          <span style={{ color: '#ca8a04', fontSize: 12 }}>
            +{vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
        )
      },
    })
  }

  if (useWht) {
    taxColumns.push({
      title: 'WHT %',
      key: 'wht_rate',
      width: 80,
      align: 'center' as const,
      onHeaderCell: () => ({ style: { background: '#fef2f2', color: '#991b1b' } }),
      render: (_: unknown, r: POLineItem) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={r.wht_rate ?? 3}
          options={[
            { label: '1%', value: 1 },
            { label: '3%', value: 3 },
            { label: '5%', value: 5 },
          ]}
          onChange={(v) => updateItem(r.key, 'wht_rate', v as number)}
        />
      ),
    })

    taxColumns.push({
      title: 'WHT (฿)',
      key: 'wht_amt',
      width: 84,
      align: 'right' as const,
      onHeaderCell: () => ({ style: { background: '#fef2f2', color: '#991b1b' } }),
      render: (_: unknown, r: POLineItem) => {
        const rowDiscType: 'pct' | 'amt' = r.disc_type ?? discType
        const lineAmt = r.qty * r.unit_price
        const discAmt = useDisc ? calcDisc(lineAmt, r.disc ?? 0, rowDiscType) : 0
        const rate = (r.wht_rate ?? 3) / 100
        const wht = (lineAmt - discAmt - disc2Of(r) - (showAvgInLines ? allocOf(r) : 0)) * rate
        return (
          <span style={{ color: '#dc2626', fontSize: 12 }}>
            -{wht.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
        )
      },
    })
  }

  if (useDisc || useDisc2 || useDisc3 || useVat || useWht || spCalc.special > 0) {
    taxColumns.push({
      title: 'สุทธิ/แถว',
      key: 'net',
      width: 96,
      align: 'right' as const,
      render: (_: unknown, r: POLineItem) => {
        const rowDiscType: 'pct' | 'amt' = r.disc_type ?? discType
        const lineAmt = r.qty * r.unit_price
        const discAmt = useDisc ? calcDisc(lineAmt, r.disc ?? 0, rowDiscType) : 0
        const afterDisc = lineAmt - discAmt - disc2Of(r) - (showAvgInLines ? allocOf(r) : 0)
        const vat = useVat ? afterDisc * 0.07 : 0
        const wht = useWht ? afterDisc * ((r.wht_rate ?? 3) / 100) : 0
        const net = afterDisc + vat - wht
        return (
          <span style={{ fontWeight: 500, color: '#1e40af' }}>
            {net.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
        )
      },
    })
  }

  const [colWidths, setColWidths] = useState<Record<string, number>>({})

  const columns = [
    {
      title: 'No.',
      dataIndex: 'no',
      width: 44,
      align: 'center' as const,
      render: (v: number) => <span style={{ fontSize: 13, color: '#374151' }}>{v}</span>,
    },
    {
      title: 'Cost Code',
      key: 'cost_subgroup_id',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, r: POLineItem) => {
        // cost_code_label is stored as "CODE — Name" (see handleCostCodeSelect
        // / POCreatePage.tsx's edit-load and PR-prefill paths) — the field
        // itself should show only the code; the full label stays as the
        // hover tooltip, and CostCodeSelectionModal (a searchable table, not
        // a Select) still lets users search by description independently.
        const codeOnly = r.cost_code_label ? formatCostCodeDisplay(r.cost_code_label.split(' — ')[0]) : undefined
        return (
          <Space size={4} style={{ width: '100%' }}>
            <Button
              size="small"
              danger={highlightMissingCost && r.cost_subgroup_id == null}
              style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              disabled={!r.mat_code}
              onClick={() => setCostCodeModalRowKey(r.key)}
              title={r.cost_code_label ? formatCostCodeDisplay(r.cost_code_label) : undefined}
            >
              {r.mat_code ? (codeOnly ?? 'เลือก Cost Code') : 'เลือกวัสดุก่อน'}
            </Button>
            {r.cost_code_label && (
              <Button
                size="small"
                type="text"
                icon={<CloseCircleFilled style={{ color: '#9ca3af' }} />}
                onClick={() => clearCostCode(r.key)}
              />
            )}
          </Space>
        )
      },
    },
    {
      title: 'รหัสวัสดุ',
      dataIndex: 'mat_code',
      width: 110,
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</span>
      ),
    },
    {
      title: 'รายการ',
      dataIndex: 'mat_name',
      width: 480,
      render: (_: unknown, r: POLineItem) => (
        <Space size={6}>
          {r.is_from_pr && (
            <Tooltip title="รายการจาก PR">
              <Tag icon={<LinkOutlined />} color="blue" style={{ margin: 0 }} />
            </Tooltip>
          )}
          <span style={{ fontSize: 13 }}>{formatItemLabel(r.mat_name, r.spec, r.brand_name)}</span>
        </Space>
      ),
    },
    {
      title: 'จำนวน',
      dataIndex: 'qty',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, r: POLineItem) => {
        const max = r.pr_qty_remaining
        const overMax = max != null && r.qty > max
        const qtyInput = (
          <InputNumber
            size="small"
            min={0}
            max={max}
            status={r.qty > 0 && !overMax ? undefined : 'error'}
            value={r.qty}
            style={{ width: '100%' }}
            onChange={(v) => updateItem(r.key, 'qty', v ?? 0)}
          />
        )
        return max != null ? (
          <Tooltip title={`คงเหลือที่สั่งได้: ${max}`}>{qtyInput}</Tooltip>
        ) : qtyInput
      },
    },
    {
      title: 'หน่วย',
      dataIndex: 'unit_name',
      width: 60,
      align: 'center' as const,
      render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'ราคา/หน่วย',
      dataIndex: 'unit_price',
      width: 168,
      align: 'center' as const,
      render: (_: unknown, r: POLineItem) => (
        <Space.Compact style={{ width: '100%' }}>
          <InputNumber
            size="small"
            min={0}
            status={r.unit_price > 0 ? undefined : 'error'}
            value={r.unit_price}
            style={{ width: '100%' }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            onChange={(v) => updateItem(r.key, 'unit_price', v ?? 0)}
          />
          <Tooltip title="ดูราคาที่เคยซื้อล่าสุด">
            <Button
              size="small"
              icon={<HistoryOutlined />}
              disabled={!r.mat_code}
              onClick={() => setPriceHistoryMatCode(r.mat_code)}
            />
          </Tooltip>
        </Space.Compact>
      ),
    },
    {
      title: 'มูลค่า',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, r: POLineItem) => (
        <span style={{ fontSize: 13 }}>{formatMoney(r.qty * r.unit_price)}</span>
      ),
    },
    {
      title: 'คงเหลือ',
      key: 'stock_qty',
      width: 80,
      align: 'right' as const,
      render: (_: any, record: any) => {
        if (!record.mat_code) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        const qty = stockMap[record.mat_code]
        if (qty === undefined) {
          return stockLoading
            ? <Spin size="small" />
            : <span style={{ color: '#9ca3af', fontSize: 12 }}>ไม่พบใน stock</span>
        }
        const color = qty <= 0 ? '#dc2626' : qty < record.qty ? '#d97706' : '#16a34a'
        return <span style={{ color, fontWeight: 500 }}>{qty.toLocaleString('th-TH')}</span>
      },
    },
    ...taxColumns,
    {
      title: '',
      key: 'action',
      width: 72,
      align: 'center' as const,
      render: (_: unknown, r: POLineItem) => {
        const hasDesc = !!(r.description && r.description.trim())
        const expanded = expandedKeys.includes(r.key)
        return (
          <Space size={0}>
            <Tooltip title={hasDesc ? 'มีรายละเอียด — คลิกเพื่อดู/แก้ไข' : 'เพิ่มรายละเอียด'}>
              <Badge dot={hasDesc} offset={[-2, 2]}>
                <Button
                  type="text"
                  size="small"
                  aria-expanded={expanded}
                  aria-controls={`po-item-desc-${r.key}`}
                  icon={<FileTextOutlined />}
                  style={{ color: hasDesc ? '#2563eb' : undefined }}
                  onClick={() => toggleExpand(r.key)}
                />
              </Badge>
            </Tooltip>
            <ConfirmDeleteButton type="text" size="small" onConfirm={() => removeItem(r.key)} />
          </Space>
        )
      },
    },
  ]

  const colId = (c: any): string => String(c.key ?? c.dataIndex ?? '')
  const taxColIds = new Set(taxColumns.map(colId))
  const isFixedCol = (c: any) => colId(c) === 'no' || colId(c) === 'action' || taxColIds.has(colId(c))
  const resizableColumns = columns.map((c: any) => {
    const id = colId(c)
    const width = colWidths[id] ?? c.width
    if (isFixedCol(c)) return c
    return {
      ...c,
      width,
      onHeaderCell: () => ({
        width,
        style: { padding: '6px 8px', fontSize: 12 },
        onResize: (_: React.SyntheticEvent, d: ResizeCallbackData) =>
          setColWidths((prev) => ({ ...prev, [id]: Math.max(60, d.size.width) })),
      }),
    }
  })
  const scrollX = resizableColumns.reduce((s: number, c: any) => s + (typeof c.width === 'number' ? c.width : 100), 0)

  const renderDescription = (r: POLineItem) => (
    <div id={`po-item-desc-${r.key}`} style={{ padding: '4px 8px' }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>รายละเอียด / Description</div>
      <Input.TextArea
        autoFocus
        value={r.description ?? ''}
        placeholder="เพิ่มรายละเอียดสำหรับรายการนี้..."
        autoSize={{ minRows: 2 }}
        maxLength={3000}
        showCount
        onChange={(e) => updateItem(r.key, 'description', e.target.value)}
      />
    </div>
  )

  const baseColCount = columns.length - taxColumns.length - 1

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button
          icon={<CalculatorOutlined />}
          type={taxOpen ? 'primary' : 'default'}
          onClick={onTaxToggle}
          size="small"
        >
          ภาษี / ส่วนลด {taxOpen ? <LeftOutlined /> : <RightOutlined />}
        </Button>
      </div>

      <Table
        rowKey="key"
        dataSource={items}
        columns={resizableColumns}
        components={{ header: { cell: ResizableTitle }, body: { cell: CompactCell } }}
        pagination={false}
        size="small"
        locale={{ emptyText: 'ยังไม่มีรายการ — เลือก PR หรือค้นหาวัสดุเพื่อเริ่มต้น' }}
        scroll={{ x: scrollX }}
        onRow={(r) => missingCostRowProps(highlightMissingCost, r.cost_subgroup_id == null)}
        expandable={{
          expandedRowKeys: expandedKeys,
          showExpandColumn: false,
          expandedRowRender: renderDescription,
        }}
        summary={() => {
          let subtotal = 0, totalDisc = 0, totalDisc2 = 0, totalDisc3 = 0, totalVat = 0, totalWht = 0

          items.forEach((r) => {
            const lineAmt = r.qty * r.unit_price
            subtotal += lineAmt
            const d = lineDiscOf(r)
            const d2 = disc2Of(r)
            const af = lineAmt - d - d2 - allocOf(r)
            totalDisc += d
            totalDisc2 += disc2Only(r)
            totalDisc3 += disc3Only(r)
            totalVat += useVat ? af * 0.07 : 0
            totalWht += useWht ? af * ((r.wht_rate ?? 3) / 100) : 0
          })
          // Averaged: the special amount sits inside the line discounts; otherwise its own row.
          if (showAvgInLines) totalDisc += spCalc.special
          const specialRow = !specialDisc.avg ? spCalc.special : 0
          // A hand-typed VAT replaces the calculated total (per-line VAT column stays calculated).
          const calcVat = Math.round(totalVat * 100) / 100
          const vatUsed = useVat && vatManual != null ? vatManual : totalVat
          const net = subtotal - totalDisc - totalDisc2 - totalDisc3 - specialRow + vatUsed - totalWht
          const totalColSpan = baseColCount + 1 + taxColumns.length + 1

          return (
            <Table.Summary fixed="bottom">
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={totalColSpan} align="right">
                  <div style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 4,
                    minWidth: 260,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>ยอดรวมก่อนลด</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>
                        ฿ {subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {(useDisc || showAvgInLines) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>ส่วนลด{showAvgInLines ? ' (รวม Special เฉลี่ย)' : ''}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>
                          - ฿ {totalDisc.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {totalDisc2 > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>ส่วนลดที่ 2</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>
                          - ฿ {formatMoney(totalDisc2)}
                        </span>
                      </div>
                    )}
                    {totalDisc3 > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>ส่วนลดที่ 3</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>
                          - ฿ {formatMoney(totalDisc3)}
                        </span>
                      </div>
                    )}

                    {(onSpecialDiscChange || spCalc.special > 0) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 12 }}>
                        <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>Special Discount</span>
                        {onSpecialDiscChange ? (
                          <Space size={8} align="center">
                            <Space.Compact>
                              <InputNumber
                                size="small"
                                min={0}
                                max={specialDisc.type === 'pct' ? 100 : undefined}
                                precision={2}
                                placeholder="0.00"
                                value={specialDisc.value || null}
                                style={{ width: 110 }}
                                onChange={(v) => onSpecialDiscChange({ ...specialDisc, value: Number(v ?? 0) })}
                              />
                              <Select
                                size="small"
                                value={specialDisc.type}
                                style={{ width: 56 }}
                                options={[{ label: '%', value: 'pct' }, { label: '฿', value: 'amt' }]}
                                onChange={(v) => onSpecialDiscChange({ ...specialDisc, type: v, value: 0 })}
                              />
                            </Space.Compact>
                            <Checkbox
                              checked={specialDisc.avg}
                              onChange={(e) => onSpecialDiscChange({ ...specialDisc, avg: e.target.checked })}
                            >
                              <span style={{ fontSize: 12 }}>Average</span>
                            </Checkbox>
                          </Space>
                        ) : (
                          <span style={{ fontSize: 12 }}>{specialDisc.avg ? 'เฉลี่ยลงทุกรายการ' : ''}</span>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#7c3aed', whiteSpace: 'nowrap' }}>
                          {specialRow > 0 ? '- ฿ ' + formatMoney(specialRow) : spCalc.special > 0 ? '(' + formatMoney(spCalc.special) + ')' : ''}
                        </span>
                      </div>
                    )}
                    {spCalc.error && (
                      <div style={{ fontSize: 11, color: '#dc2626', textAlign: 'right', width: '100%' }}>{spCalc.error}</div>
                    )}

                    {useVat && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 12 }}>
                        <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>VAT 7%</span>
                        {onVatManualChange ? (
                          <Space size={6} align="center">
                            {vatManual != null && Math.abs(vatManual - calcVat) >= 0.005 && (
                              <Tooltip title="ใช้ยอดที่คำนวณอัตโนมัติ">
                                <Button type="link" size="small" style={{ fontSize: 11, padding: 0 }} onClick={() => onVatManualChange(null)}>
                                  (คำนวณ ฿ {formatMoney(calcVat)})
                                </Button>
                              </Tooltip>
                            )}
                            <InputNumber
                              size="small"
                              min={0}
                              precision={2}
                              placeholder="0.00"
                              value={vatManual ?? calcVat}
                              style={{ width: 130, color: '#ca8a04' }}
                              formatter={(v) => (v == null || `${v}` === '' ? '' : `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
                              parser={(v) => (v ?? '').replace(/,/g, '') as unknown as number}
                              onChange={(v) => {
                                if (v == null) return onVatManualChange(null)
                                const n = Math.round(Number(v) * 100) / 100
                                // typing back the calculated amount = automatic again
                                onVatManualChange(Math.abs(n - calcVat) < 0.005 ? null : n)
                              }}
                            />
                          </Space>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#ca8a04' }}>
                            + ฿ {formatMoney(vatUsed)}
                          </span>
                        )}
                      </div>
                    )}

                    {useWht && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>WHT</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#dc2626' }}>
                          - ฿ {totalWht.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div style={{
                      borderTop: '0.5px solid #dbeafe',
                      width: '100%',
                      marginTop: 4,
                      paddingTop: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 48,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>ยอดรวมสุทธิ</span>
                      <span style={{ fontSize: 15, fontWeight: 500, color: '#1e40af' }}>
                        ฿ {net.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )
        }}
      />

      <div style={{ marginTop: 12 }}>
        <Button icon={<SearchOutlined />} size="small" onClick={() => setPickerOpen(true)}>
          เลือกจากรายการวัสดุ
        </Button>
      </div>

      <MaterialPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handleMaterialConfirm}
        showStockLookup
        hasCostSubgroup
        compact
      />

      <CostCodeSelectionModal
        open={costCodeModalRowKey !== null}
        onClose={() => setCostCodeModalRowKey(null)}
        onSelect={(item) => {
          if (costCodeModalRowKey) handleCostCodeSelect(costCodeModalRowKey, item)
        }}
        jobTypeCode={jobTypeCode}
        ohOnly={ohOnly}
      />

      <PriceHistoryModal matCode={priceHistoryMatCode} onClose={() => setPriceHistoryMatCode(null)} />
    </div>
  )
}

export default POItemsTable