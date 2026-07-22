import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Input, InputNumber, Select, Space, message, Spin } from 'antd'
import { PlusOutlined, SearchOutlined, DeleteOutlined, PrinterOutlined, RollbackOutlined, CloseCircleFilled } from '@ant-design/icons'
import axios from 'axios'
import MaterialPickerModal from '@/components/common/MaterialPickerModal'
import CostCodeSelectionModal, { type CostCodeItem } from '@/components/common/CostCodeSelectionModal'
import type { Material } from '@/types'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

interface PRItem {
  key: string
  no: number
  code: string
  description: string
  qtyPR: number
  qtyStock: number
  unit: string
  remark: string
  costSubgroupId: number | null
  costCodeLabel: string | null
}

const unitOptions = [
  { value: 'Ea', label: 'Ea' },
  { value: 'ชิ้น', label: 'ชิ้น' },
  { value: 'กล่อง', label: 'กล่อง' },
  { value: 'ชุด', label: 'ชุด' },
  { value: 'kg', label: 'kg' },
  { value: 'L', label: 'L' },
]

interface InitialPRItem {
  mat_code: string
  mat_name?: string
  unit_name?: string
  qty_requested: number
  qty_to_order: number
  cost_subgroup_id: number | null
  cost_code_label?: string | null
}

interface PRItemsTableProps {
  readonly?: boolean
  onBack?: () => void
  onItemsChange?: (items: { mat_code: string; qty_requested: number; qty_to_order: number; cost_subgroup_id: number | null }[]) => void
  // Edit mode: seed the table from an existing PR's lines. Only applied once
  // per array identity — the parent should set this from its own fetch effect
  // exactly once, not recompute it on every render.
  initialItems?: InitialPRItem[]
}

const PRItemsTable: React.FC<PRItemsTableProps> = ({ readonly = false, onBack, onItemsChange, initialItems }) => {
  const [items, setItems] = useState<PRItem[]>([])

  useEffect(() => {
    if (!initialItems || initialItems.length === 0) return
    setItems(
      initialItems.map((it, idx) => ({
        key: `edit-${idx}-${it.mat_code}`,
        no: idx + 1,
        code: it.mat_code,
        description: it.mat_name ?? '',
        qtyPR: it.qty_requested,
        qtyStock: it.qty_to_order,
        unit: it.unit_name || 'Ea',
        remark: '',
        costSubgroupId: it.cost_subgroup_id,
        costCodeLabel: it.cost_code_label ?? null,
      }))
    )
  }, [initialItems])

  useEffect(() => {
    onItemsChange?.(items.map((i) => ({
      mat_code: i.code,
      qty_requested: i.qtyPR,
      qty_to_order: i.qtyStock,
      cost_subgroup_id: i.costSubgroupId,
    })))
  }, [items])
  const [remark, setRemark] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  const [stockLoading, setStockLoading] = useState(false)
  // key of the row whose Cost Code selection modal is open; null = closed
  const [costCodeModalRowKey, setCostCodeModalRowKey] = useState<string | null>(null)

  useEffect(() => {
    const codes = Array.from(new Set(items.map((i: any) => i.code).filter(Boolean)))
    if (codes.length === 0) {
      setStockMap({})
      return
    }
    const fetchStock = async () => {
      setStockLoading(true)
      try {
        const res = await axios.post(
          BASE_URL + '/stock/inventory/batch-lookup',
          { codes },
          { headers: { Authorization: 'Bearer ' + accessToken } }
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
  }, [items.map((i: any) => i.code).join(',')])

  const addItem = () => {
    const no = items.length + 1
    setItems((prev) => [
      ...prev,
      {
        key: `${Date.now()}`,
        no,
        code: '',
        description: '',
        // qtyStock (qty_to_order) defaults to match qtyPR (qty_requested): assume
        // nothing is covered by stock until the user checks stockMap and lowers it.
        // shortfall = qty_requested - qty_to_order, so leaving this at 0 would
        // silently tell the backend "fully covered by stock, order nothing."
        qtyPR: 1,
        qtyStock: 1,
        unit: 'Ea',
        remark: '',
        costSubgroupId: null,
        costCodeLabel: null,
      },
    ])
  }

  const updateItem = (key: string, field: keyof PRItem, value: string | number | null) => {
  setItems((prev) => {
    const next = prev.map((i) => {
      if (i.key !== key) return i
      const updated = { ...i, [field]: value }
      // mat_code cleared → Cost Code becomes disabled again; drop any selection so a
      // stale cost_subgroup_id never rides along with an empty mat_code line.
      if (field === 'code' && !value) {
        updated.costSubgroupId = null
        updated.costCodeLabel = null
      }
      return updated
    })
    console.log('items after update:', next)
    return next
  })
}

  const handleCostCodeSelect = (key: string, item: CostCodeItem) => {
    setItems((prev) => prev.map((i) => (i.key === key ? {
      ...i,
      costSubgroupId: item.subgroupId,
      costCodeLabel: `${item.costCode} — ${item.subgroupName}`,
    } : i)))
  }

  const clearCostCode = (key: string) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, costSubgroupId: null, costCodeLabel: null } : i)))
  }

  const removeItem = (key: string) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.key !== key)
      return filtered.map((i, idx) => ({ ...i, no: idx + 1 }))
    })
  }

  const handleMaterialConfirm = (materials: Material[]) => {
    const existingCodes = new Set(items.map((i) => i.code))
    const toAdd = materials.filter((m) => !existingCodes.has(m.mat_code))
    if (toAdd.length < materials.length) {
      message.warning(`ข้ามรายการที่มีอยู่แล้ว ${materials.length - toAdd.length} รายการ`)
    }
    if (toAdd.length === 0) return
    setItems((prev) => {
      const newRows: PRItem[] = toAdd.map((m) => ({
        key: `${Date.now()}-${m.mat_code}-${Math.random().toString(36).slice(2)}`,
        no: 0,
        code: m.mat_code,
        description: m.mat_name_th,
        qtyPR: 1,
        qtyStock: 1,
        unit: m.unit_name || 'Ea',
        remark: '',
        costSubgroupId: null,
        costCodeLabel: null,
      }))
      const combined = [...prev, ...newRows]
      return combined.map((i, idx) => ({ ...i, no: idx + 1 }))
    })
  }

  const columns = [
    {
      title: 'No.',
      dataIndex: 'no',
      width: 52,
      align: 'center' as const,
      render: (_: unknown, r: PRItem) => (
        <span style={{ fontSize: 13, color: '#374151' }}>{r.no}</span>
      ),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      width: 120,
      render: (_: unknown, r: PRItem) =>
        readonly ? (
          <span style={{ fontSize: 13 }}>{r.code}</span>
        ) : (
          <Input
            size="small"
            value={r.code}
            placeholder="รหัสสินค้า"
            onChange={(e) => updateItem(r.key, 'code', e.target.value)}
          />
        ),
    },
    {
      title: 'รายการ',
      dataIndex: 'description',
      align: 'center' as const,
      render: (_: unknown, r: PRItem) =>
        readonly ? (
          <span style={{ fontSize: 13 }}>{r.description}</span>
        ) : (
          <Input
            size="small"
            value={r.description}
            placeholder="ระบุรายการสินค้า/บริการ"
            onChange={(e) => updateItem(r.key, 'description', e.target.value)}
          />
        ),
    },
    {
      title: (
        <div style={{ textAlign: 'center' }}>
          <div>จำนวนสั่ง</div>
          <div style={{ fontWeight: 400, fontSize: 11, color: '#6b7280' }}>(PR)</div>
        </div>
      ),
      dataIndex: 'qtyPR',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, r: PRItem) =>
        readonly ? (
          <span style={{ fontSize: 13 }}>{r.qtyPR}</span>
        ) : (
          <InputNumber
            size="small"
            min={1}
            value={r.qtyPR}
            style={{ width: '100%' }}
            onChange={(v) => updateItem(r.key, 'qtyPR', v || 1)}
          />
        ),
    },
    {
      title: 'คงเหลือใน Stock',
      key: 'stock_available',
      width: 110,
      align: 'right' as const,
      render: (_: any, record: PRItem) => {
        if (!record.code) return <span style={{ color: '#9ca3af' }}>—</span>
        const qty = stockMap[record.code]
        if (qty === undefined) {
          return stockLoading
            ? <Spin size="small" />
            : <span style={{ color: '#9ca3af', fontSize: 12 }}>ไม่พบใน stock</span>
        }
        const color = qty <= 0 ? '#dc2626' : '#16a34a'
        return <span style={{ color, fontWeight: 500 }}>{qty.toLocaleString('th-TH')}</span>
      },
    },
    {
      title: (
        <div style={{ textAlign: 'center' }}>
          <div>จำนวนขอ</div>
          <div style={{ fontWeight: 400, fontSize: 11, color: '#6b7280' }}>ซื้อ(Stock)</div>
        </div>
      ),
      dataIndex: 'qtyStock',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, r: PRItem) =>
        readonly ? (
          <span style={{ fontSize: 13 }}>{r.qtyStock}</span>
        ) : (
          <InputNumber
            size="small"
            min={0}
            value={r.qtyStock}
            style={{ width: '100%' }}
            onChange={(v) => updateItem(r.key, 'qtyStock', v || 0)}
          />
        ),
    },
    {
      title: 'หน่วย',
      dataIndex: 'unit',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, r: PRItem) =>
        readonly ? (
          <span style={{ fontSize: 13 }}>{r.unit}</span>
        ) : (
          <Select
            size="small"
            value={r.unit}
            style={{ width: '100%' }}
            options={unitOptions}
            onChange={(v) => updateItem(r.key, 'unit', v)}
          />
        ),
    },
    {
      title: 'Cost Code',
      dataIndex: 'costSubgroupId',
      width: 200,
      align: 'center' as const,
      render: (_: unknown, r: PRItem) =>
        readonly ? (
          <span style={{ fontSize: 13 }}>{r.costCodeLabel ?? '-'}</span>
        ) : (
          <Space size={4} style={{ width: '100%' }}>
            <Button
              size="small"
              style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              disabled={!r.code}
              onClick={() => setCostCodeModalRowKey(r.key)}
              title={r.costCodeLabel ?? undefined}
            >
              {r.code ? (r.costCodeLabel ?? 'เลือก Cost Code') : 'เลือกวัสดุก่อน'}
            </Button>
            {r.costCodeLabel && (
              <Button
                size="small"
                type="text"
                icon={<CloseCircleFilled style={{ color: '#9ca3af' }} />}
                onClick={() => clearCostCode(r.key)}
              />
            )}
          </Space>
        ),
    },

    ...(!readonly
      ? [
          {
            title: '',
            width: 40,
            align: 'center' as const,
            render: (_: unknown, r: PRItem) => (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => removeItem(r.key)}
              />
            ),
          },
        ]
      : []),
  ]

  const cardStyle: React.CSSProperties = {
    borderRadius: 12,
    border: 'none',
    boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
    marginTop: 16,
  }

  return (
    <Card
      style={cardStyle}
      title={
        <div style={{ textAlign: 'center', color: '#1e3a8a', fontWeight: 700, fontSize: 15 }}>
          เลือกรายการ วัสดุและบริการ
        </div>
      }
      extra={
        !readonly && (
          <Space>
            <Button
              icon={<PlusOutlined />}
              size="small"
              onClick={addItem}
              style={{ borderColor: '#2563eb', color: '#2563eb' }}
            >
              เพิ่มรายการใหม่
            </Button>
            <Button
              icon={<SearchOutlined />}
              size="small"
              onClick={() => setPickerOpen(true)}
            >
              เลือกจากรายการวัสดุ
            </Button>
          </Space>
        )
      }
    >
      <Table
        dataSource={items}
        columns={columns}
        pagination={false}
        size="small"
        locale={{ emptyText: 'ยังไม่มีรายการ — กด "เพิ่มรายการใหม่" เพื่อเริ่มต้น' }}
        scroll={{ x: 700 }}
        style={{ marginBottom: items.length > 0 ? 16 : 0 }}
      />

      {/* Remark textarea */}
      {!readonly && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: '#cc0000', fontWeight: 600, marginBottom: 4 }}>
            หมายเหตุ :
          </div>
          <Input.TextArea
            rows={3}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            style={{ borderRadius: 8, fontSize: 13 }}
          />
        </div>
      )}

      <MaterialPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handleMaterialConfirm}
        showStockLookup={false}
      />

      <CostCodeSelectionModal
        open={costCodeModalRowKey !== null}
        onClose={() => setCostCodeModalRowKey(null)}
        onSelect={(item) => {
          if (costCodeModalRowKey) handleCostCodeSelect(costCodeModalRowKey, item)
        }}
      />

      {/* Bottom actions */}
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space wrap>
          <Button icon={<PrinterOutlined />} onClick={() => message.info('พิมพ์เอกสาร')}>
            พิมพ์
          </Button>
          <Button icon={<RollbackOutlined />} onClick={onBack}>
            กลับหน้าหลัก
          </Button>
        </Space>

        {readonly && (
          <span style={{ fontSize: 12, color: '#cc0000', alignSelf: 'center' }}>
            * ไม่สามารถแก้ไขข้อมูลได้ สถานะคำร้องขอซื้อ ถูกอนุมัติหรือปิดแล้ว
          </span>
        )}
      </div>
    </Card>
  )
}

export default PRItemsTable
