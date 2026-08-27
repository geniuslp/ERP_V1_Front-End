import React, { useEffect, useState } from 'react'
import { Table, Button, InputNumber, Input, Space, Tag, Tooltip, Badge, Select, Spin } from 'antd'
import {
  SearchOutlined, DeleteOutlined, LinkOutlined, FileTextOutlined,
  CalculatorOutlined, LeftOutlined, RightOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import MaterialPickerModal from '@/components/common/MaterialPickerModal'
import type { Material } from '@/types'
import type { POLineItem } from '@/types/po'
import { useAppSelector } from '@/store'
import { calcDisc } from '@/utils/poCalc'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

interface POItemsTableProps {
  items: POLineItem[]
  onChange: (items: POLineItem[]) => void
  taxOpen?: boolean
  onTaxToggle?: () => void
  useDisc?: boolean
  discType?: 'pct' | 'amt'
  useVat?: boolean
  useWht?: boolean
}

const POItemsTable: React.FC<POItemsTableProps> = ({
  items, onChange,
  taxOpen, onTaxToggle,
  useDisc = false, discType = 'pct',
  useVat = false,
  useWht = false,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
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
    onChange(items.map((i) => (i.key === key ? { ...i, [field]: value } : i)))
  }

  const removeItem = (key: string) => {
    onChange(renumber(items.filter((i) => i.key !== key)))
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
      qty: 1,
      unit_price: 0,
      is_from_pr: false,
      disc_type: discType, // default จาก global setting
    }))
    onChange(renumber([...items, ...newRows]))
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
      render: (_: unknown, r: POLineItem) => {
        // ใช้ disc_type ของ row นั้นๆ ถ้าไม่มีใช้ global discType
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
      render: (_: unknown, r: POLineItem) => {
        const rowDiscType: 'pct' | 'amt' = r.disc_type ?? discType
        const lineAmt = r.qty * r.unit_price
        const discAmt = useDisc ? calcDisc(lineAmt, r.disc ?? 0, rowDiscType) : 0
        const vat = (lineAmt - discAmt) * 0.07
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
        const wht = (lineAmt - discAmt) * rate
        return (
          <span style={{ color: '#dc2626', fontSize: 12 }}>
            -{wht.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
        )
      },
    })
  }

  if (useDisc || useVat || useWht) {
    taxColumns.push({
      title: 'สุทธิ/แถว',
      key: 'net',
      width: 96,
      align: 'right' as const,
      render: (_: unknown, r: POLineItem) => {
        const rowDiscType: 'pct' | 'amt' = r.disc_type ?? discType
        const lineAmt = r.qty * r.unit_price
        const discAmt = useDisc ? calcDisc(lineAmt, r.disc ?? 0, rowDiscType) : 0
        const afterDisc = lineAmt - discAmt
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

  const columns = [
    {
      title: 'No.',
      dataIndex: 'no',
      width: 52,
      align: 'center' as const,
      render: (v: number) => <span style={{ fontSize: 13, color: '#374151' }}>{v}</span>,
    },
    {
      title: 'รหัสวัสดุ',
      dataIndex: 'mat_code',
      width: 130,
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</span>
      ),
    },
    {
      title: 'คงเหลือ',
      key: 'stock_qty',
      width: 90,
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
    {
      title: 'รายการ',
      dataIndex: 'mat_name',
      render: (_: unknown, r: POLineItem) => (
        <Space size={6}>
          {r.is_from_pr && (
            <Tooltip title="รายการจาก PR">
              <Tag icon={<LinkOutlined />} color="blue" style={{ margin: 0 }} />
            </Tooltip>
          )}
          <span style={{ fontSize: 13 }}>{r.mat_name}</span>
        </Space>
      ),
    },
    {
      title: 'หน่วย',
      dataIndex: 'unit_name',
      width: 90,
      align: 'center' as const,
      render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'จำนวน',
      dataIndex: 'qty',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, r: POLineItem) => {
        const max = r.pr_qty_remaining
        const overMax = max != null && r.qty > max
        return (
          <div>
            <InputNumber
              size="small"
              min={0}
              max={max}
              status={r.qty > 0 && !overMax ? undefined : 'error'}
              value={r.qty}
              style={{ width: '100%' }}
              onChange={(v) => updateItem(r.key, 'qty', v ?? 0)}
            />
            {max != null && (
              <div style={{ fontSize: 11, color: overMax ? '#dc2626' : '#9ca3af', marginTop: 2 }}>
                คงเหลือที่สั่งได้: {max}
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: 'ราคา/หน่วย',
      dataIndex: 'unit_price',
      width: 130,
      align: 'center' as const,
      render: (_: unknown, r: POLineItem) => (
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
      render: (_: unknown, r: POLineItem) => (
        <span style={{ fontSize: 13 }}>{(r.qty * r.unit_price).toLocaleString('th-TH')}</span>
      ),
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
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => removeItem(r.key)}
            />
          </Space>
        )
      },
    },
  ]

  const renderDescription = (r: POLineItem) => (
    <div id={`po-item-desc-${r.key}`} style={{ padding: '4px 8px' }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>รายละเอียด / Description</div>
      <Input.TextArea
        autoFocus
        value={r.description ?? ''}
        placeholder="เพิ่มรายละเอียดสำหรับรายการนี้..."
        autoSize={{ minRows: 2 }}
        maxLength={1000}
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
        columns={columns}
        pagination={false}
        size="small"
        locale={{ emptyText: 'ยังไม่มีรายการ — เลือก PR หรือค้นหาวัสดุเพื่อเริ่มต้น' }}
        scroll={{ x: 800 }}
        expandable={{
          expandedRowKeys: expandedKeys,
          showExpandColumn: false,
          expandedRowRender: renderDescription,
        }}
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

                    {useDisc && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>ส่วนลด</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>
                          - ฿ {totalDisc.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {useVat && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 48 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>VAT 7%</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#ca8a04' }}>
                          + ฿ {totalVat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
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
      />
    </div>
  )
}

export default POItemsTable