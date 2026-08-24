import React, { useState } from 'react'
import { Table, Button, InputNumber, Input, Space, Select } from 'antd'
import { DeleteOutlined, PlusOutlined, CalculatorOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import CostCodeSelectionModal, { type CostCodeItem } from '@/components/common/CostCodeSelectionModal'
import { calcDisc } from '@/utils/poCalc'

// Row shape while editing — key/no/cost_code_label are frontend-only display
// concerns, stripped down to WorkOrderLine's submit shape by the caller.
export interface WOLineItem {
  key: string
  no: number
  cost_code: string
  cost_code_label?: string | null
  description?: string
  qty: number
  unit_price: number
  disc?: number
  disc_type?: 'pct' | 'amt'
  wht_rate?: 1 | 3 | 5 | null
}

interface WOItemsTableProps {
  items: WOLineItem[]
  onChange: (items: WOLineItem[]) => void
  taxOpen?: boolean
  onTaxToggle?: () => void
  useDisc?: boolean
  discType?: 'pct' | 'amt'
  useVat?: boolean
  useWht?: boolean
}

// Mirrors POItemsTable.tsx's structure/behavior (same editable-table +
// per-row tax columns + Table.Summary totals footer), with cost_code as the
// row identifier instead of mat_code. Differences from PO's table, both
// deliberate given cost codes have no stock/PR-link/bulk-material-picker
// concept: cost_code is picked per-row via the same CostCodeSelectionModal
// used elsewhere on this page (not a bulk multi-picker), and "add row" adds
// one blank row at a time rather than opening a bulk picker.
const WOItemsTable: React.FC<WOItemsTableProps> = ({
  items, onChange,
  taxOpen, onTaxToggle,
  useDisc = false, discType = 'pct',
  useVat = false,
  useWht = false,
}) => {
  const [costCodeModalRowKey, setCostCodeModalRowKey] = useState<string | null>(null)

  const renumber = (rows: WOLineItem[]) => rows.map((r, idx) => ({ ...r, no: idx + 1 }))

  const updateItem = (key: string, field: keyof WOLineItem, value: string | number | null) => {
    onChange(items.map((i) => (i.key === key ? { ...i, [field]: value } : i)))
  }

  const removeItem = (key: string) => {
    onChange(renumber(items.filter((i) => i.key !== key)))
  }

  const addRow = () => {
    const newRow: WOLineItem = {
      key: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      no: 0,
      cost_code: '',
      cost_code_label: null,
      description: '',
      qty: 1,
      unit_price: 0,
      disc_type: discType,
    }
    onChange(renumber([...items, newRow]))
  }

  const handleCostCodeSelect = (item: CostCodeItem) => {
    if (!costCodeModalRowKey) return
    onChange(items.map((i) => (
      i.key === costCodeModalRowKey
        ? { ...i, cost_code: item.costCode, cost_code_label: `${item.costCode} — ${item.subgroupName}` }
        : i
    )))
    setCostCodeModalRowKey(null)
  }

  const taxColumns: any[] = []

  if (useDisc) {
    taxColumns.push({
      title: 'ส่วนลด',
      key: 'disc',
      width: 140,
      align: 'center' as const,
      onHeaderCell: () => ({ style: { background: '#f0fdf4', color: '#166534' } }),
      onCell: () => ({ style: { background: '#f0fdf4' } }),
      render: (_: unknown, r: WOLineItem) => {
        const rowDiscType: 'pct' | 'amt' = r.disc_type ?? discType
        return (
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
                onChange(items.map((i) => (i.key === r.key ? { ...i, disc_type: v, disc: 0 } : i)))
              }
            />
          </Space.Compact>
        )
      },
    })
  }

  if (useVat) {
    taxColumns.push({
      title: 'VAT 7%',
      key: 'vat',
      width: 84,
      align: 'right' as const,
      onHeaderCell: () => ({ style: { background: '#fefce8', color: '#854d0e' } }),
      render: (_: unknown, r: WOLineItem) => {
        const rowDiscType: 'pct' | 'amt' = r.disc_type ?? discType
        const lineAmt = r.qty * r.unit_price
        const discAmt = useDisc ? calcDisc(lineAmt, r.disc ?? 0, rowDiscType) : 0
        const vat = (lineAmt - discAmt) * 0.07
        return <span style={{ color: '#ca8a04', fontSize: 12 }}>+{vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
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
      render: (_: unknown, r: WOLineItem) => (
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
      render: (_: unknown, r: WOLineItem) => {
        const rowDiscType: 'pct' | 'amt' = r.disc_type ?? discType
        const lineAmt = r.qty * r.unit_price
        const discAmt = useDisc ? calcDisc(lineAmt, r.disc ?? 0, rowDiscType) : 0
        const rate = (r.wht_rate ?? 3) / 100
        const wht = (lineAmt - discAmt) * rate
        return <span style={{ color: '#dc2626', fontSize: 12 }}>-{wht.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
      },
    })
  }

  if (useDisc || useVat || useWht) {
    taxColumns.push({
      title: 'สุทธิ/แถว',
      key: 'net',
      width: 96,
      align: 'right' as const,
      render: (_: unknown, r: WOLineItem) => {
        const rowDiscType: 'pct' | 'amt' = r.disc_type ?? discType
        const lineAmt = r.qty * r.unit_price
        const discAmt = useDisc ? calcDisc(lineAmt, r.disc ?? 0, rowDiscType) : 0
        const afterDisc = lineAmt - discAmt
        const vat = useVat ? afterDisc * 0.07 : 0
        const wht = useWht ? afterDisc * ((r.wht_rate ?? 3) / 100) : 0
        const net = afterDisc + vat - wht
        return <span style={{ fontWeight: 500, color: '#1e40af' }}>{net.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
      },
    })
  }

  const columns = [
    {
      title: 'No.',
      dataIndex: 'no',
      width: 52,
      align: 'center' as const,
      render: (v: number) => <span style={{ fontSize: 13, color: '#374151' }}>{v}</span>,
    },
    {
      title: 'Cost Code',
      key: 'cost_code',
      width: 220,
      render: (_: unknown, r: WOLineItem) => (
        <Button
          size="small"
          onClick={() => setCostCodeModalRowKey(r.key)}
          title={r.cost_code_label ?? undefined}
          style={{ width: '100%', textAlign: 'left' }}
        >
          {r.cost_code_label ?? 'เลือก Cost Code'}
        </Button>
      ),
    },
    {
      title: 'รายละเอียด',
      key: 'description',
      render: (_: unknown, r: WOLineItem) => (
        <Space size={6}>
          <Input
            size="small"
            value={r.description ?? ''}
            placeholder="รายละเอียด"
            onChange={(e) => updateItem(r.key, 'description', e.target.value)}
          />
        </Space>
      ),
    },
    {
      title: 'จำนวน',
      dataIndex: 'qty',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, r: WOLineItem) => (
        <InputNumber
          size="small"
          min={0}
          status={r.qty > 0 ? undefined : 'error'}
          value={r.qty}
          style={{ width: '100%' }}
          onChange={(v) => updateItem(r.key, 'qty', v ?? 0)}
        />
      ),
    },
    {
      title: 'ราคา/หน่วย',
      dataIndex: 'unit_price',
      width: 130,
      align: 'center' as const,
      render: (_: unknown, r: WOLineItem) => (
        <InputNumber
          size="small"
          min={0}
          status={r.unit_price > 0 ? undefined : 'error'}
          value={r.unit_price}
          style={{ width: '100%' }}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateItem(r.key, 'unit_price', v ?? 0)}
        />
      ),
    },
    {
      title: 'มูลค่า',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, r: WOLineItem) => (
        <span style={{ fontSize: 13 }}>{(r.qty * r.unit_price).toLocaleString('th-TH')}</span>
      ),
    },
    ...taxColumns,
    {
      title: '',
      key: 'action',
      width: 40,
      align: 'center' as const,
      render: (_: unknown, r: WOLineItem) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeItem(r.key)} />
      ),
    },
  ]

  const baseColCount = columns.length - taxColumns.length - 1

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button icon={<CalculatorOutlined />} type={taxOpen ? 'primary' : 'default'} onClick={onTaxToggle} size="small">
          ภาษี / ส่วนลด {taxOpen ? <LeftOutlined /> : <RightOutlined />}
        </Button>
      </div>

      <Table
        rowKey="key"
        dataSource={items}
        columns={columns}
        pagination={false}
        size="small"
        locale={{ emptyText: 'ยังไม่มีรายการ — กด "เพิ่มแถว" เพื่อเริ่มต้น' }}
        scroll={{ x: 700 }}
        summary={() => {
          let subtotal = 0, totalDisc = 0, totalVat = 0, totalWht = 0
          items.forEach((r) => {
            const rowDiscType: 'pct' | 'amt' = r.disc_type ?? discType
            const lineAmt = r.qty * r.unit_price
            subtotal += lineAmt
            const d = useDisc ? calcDisc(lineAmt, r.disc ?? 0, rowDiscType) : 0
            const af = lineAmt - d
            totalDisc += d
            totalVat += useVat ? af * 0.07 : 0
            totalWht += useWht ? af * ((r.wht_rate ?? 3) / 100) : 0
          })
          const net = subtotal - totalDisc + totalVat - totalWht
          const totalColSpan = baseColCount + 1 + taxColumns.length + 1

          return (
            <Table.Summary fixed="bottom">
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={totalColSpan} align="right">
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 260 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>ยอดรวมก่อนลด</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>฿ {subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {useDisc && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>ส่วนลด</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>- ฿ {totalDisc.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {useVat && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>VAT 7%</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#ca8a04' }}>+ ฿ {totalVat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {useWht && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>WHT</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#dc2626' }}>- ฿ {totalWht.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div style={{ borderTop: '0.5px solid #dbeafe', width: '100%', marginTop: 4, paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 48 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>ยอดรวมสุทธิ</span>
                      <span style={{ fontSize: 15, fontWeight: 500, color: '#1e40af' }}>฿ {net.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )
        }}
      />

      <div style={{ marginTop: 12 }}>
        <Button icon={<PlusOutlined />} size="small" onClick={addRow}>
          เพิ่มแถว
        </Button>
      </div>

      <CostCodeSelectionModal
        open={costCodeModalRowKey !== null}
        onClose={() => setCostCodeModalRowKey(null)}
        onSelect={handleCostCodeSelect}
      />
    </div>
  )
}

export default WOItemsTable
