import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Card, Table, Button, Input, InputNumber, Space, message, Spin, Switch, Tooltip, Badge, Modal } from 'antd'
import { PlusOutlined, SearchOutlined, DeleteOutlined, CloseCircleFilled, FileTextOutlined } from '@ant-design/icons'
import ConfirmDeleteButton from '@/components/common/ConfirmDeleteButton'
import axios from 'axios'
import MaterialPickerModal from '@/components/common/MaterialPickerModal'
import CostCodeSelectionModal, { type CostCodeItem } from '@/components/common/CostCodeSelectionModal'
import type { Material, PROrderType } from '@/types'
import { isOhOrderType } from '@/constants/orderTypes'
import { useAppSelector } from '@/store'
import { isExemptMatCode } from '@/utils/matCode'
import { formatItemLabel } from '@/utils/itemLabel'
import { formatCostCodeDisplay } from '@/utils/costCode'
import { missingCostRowProps } from '@/utils/validateCostCode'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

// Re-exported for existing importers — canonical definition moved to
// src/utils/itemLabel.ts so non-component files (e.g. PRDetailPage.tsx) can
// import it without pulling in a component module.
export { formatItemLabel }

interface PRItem {
  key: string
  no: number
  code: string
  description: string
  spec: string
  qtyPR: number
  qtyStock: number
  unit: string
  remark: string
  costSubgroupId: number | null
  costCodeLabel: string | null
  // true only for lines seeded from an existing PR's initialItems (edit mode).
  // Locks mat_code in place — changing the material requires deleting this
  // line and adding a new one. Cost code stays editable on existing lines.
  isExisting?: boolean
  // Whether this line should be filled from central stock first (default) or
  // always ordered in full regardless of stock on hand.
  deductStock: boolean
  // Memo line this PR line takes (null/undefined for manual lines and for PRs
  // created before line-level Memo linking). Reference text is display-only.
  memoLineId?: number | null
  memoLineNo?: number | null
  memoLineDescription?: string | null
  memoLineUnit?: string | null
  // Quantity prefilled from the Memo line — used only to detect a user-edited quantity.
  memoLineQty?: number | null
}

interface InitialPRItem {
  mat_code: string
  mat_name?: string
  unit_name?: string
  spec_name?: string
  brand_name?: string
  qty_requested: number
  qty_to_order: number
  cost_subgroup_id: number | null
  cost_code_label?: string | null
  deduct_stock?: boolean
  remarks?: string | null
  memo_line_id?: number | null
  memo_line_no?: number | null
  memo_line_description?: string | null
}

interface PRItemsTableProps {
  readonly?: boolean
  onItemsChange?: (items: { mat_code: string; qty_requested: number; qty_to_order: number; cost_subgroup_id: number | null; deductStock: boolean; remarks: string; memo_line_id: number | null }[]) => void
  // Edit mode: seed the table from an existing PR's lines. Only applied once
  // per array identity — the parent should set this from its own fetch effect
  // exactly once, not recompute it on every render.
  initialItems?: InitialPRItem[]
  // Remarks textarea near the line items — lifted to the parent (PRCreatePage)
  // so it can be included in the submit payload instead of living as dead
  // local state here.
  remark?: string
  onRemarkChange?: (value: string) => void
  // Document-level "ประเภท Job" value (PR header field, e.g. 'MS', 'G') — passed
  // down so the CostCode picker can filter its options to that job type.
  jobTypeCode?: string
  // Document-level "ประเภทการสั่งซื้อ" (PR header field: 'stock' | 'cost') —
  // used to pick the OH-only cost-code list. Cost Code is editable on
  // existing lines for every order type; mat_code stays locked on them.
  orderType?: PROrderType
  // Set by the parent after a failed submit: rows with no cost code are tinted
  // red. Never set for draft saves.
  highlightMissingCost?: boolean
}

// Exposed to the parent (PRCreatePage) so its own action bar can trigger a
// print using this table's current line items — the parent no longer renders
// its own copy of the print button, but this table alone doesn't have access
// to the header fields needed to assemble full print data.
// A Memo line handed over by MemoSidebarPanel ("Use selected items").
export interface MemoLineInput {
  id: number
  line_no: number
  description: string
  unit: string
  quantity: number
}

export interface PRItemsTableHandle {
  getPrintItems: () => {
    mat_code: string
    description: string
    unit: string
    qty_requested: number
    cost_code_label: string | null
    remark: string
  }[]
  // Drops every line's cost code (used when the order type switches between
  // the OH group and stock/cost — see OrderTypeSelect).
  clearCostCodes: () => void
  // Memo-derived lines (memo_line_id set) — manual lines are never counted/removed.
  hasMemoLines: () => boolean
  removeMemoLines: () => void
  // Append one Memo-derived line per Memo line (mat_code left empty).
  addMemoLines: (lines: MemoLineInput[]) => void
  // Remove Memo-derived lines by memo_line id (confirms first if a material was already chosen).
  removeMemoLinesByIds: (ids: number[]) => void
}

const PRItemsTable = forwardRef<PRItemsTableHandle, PRItemsTableProps>(({
  readonly = false, onItemsChange, initialItems, remark = '', onRemarkChange, jobTypeCode, orderType, highlightMissingCost = false,
}, ref) => {
  const [items, setItems] = useState<PRItem[]>([])

  useImperativeHandle(ref, () => ({
    getPrintItems: () => items.map((i) => ({
      mat_code: i.code,
      description: formatItemLabel(i.description, i.spec),
      unit: i.unit,
      qty_requested: i.qtyPR,
      cost_code_label: i.costCodeLabel,
      remark: i.remark,
    })),
    clearCostCodes: () => setItems((prev) => prev.map((i) => ({ ...i, costSubgroupId: null, costCodeLabel: null }))),
    hasMemoLines: () => items.some((i) => i.memoLineId != null),
    removeMemoLines: () => setItems((prev) => prev.filter((i) => i.memoLineId == null).map((i, idx) => ({ ...i, no: idx + 1 }))),
    addMemoLines: (lines) => {
      setItems((prev) => {
        const have = new Set(prev.filter((i) => i.memoLineId != null).map((i) => i.memoLineId as number))
        const added: PRItem[] = lines.filter((l) => !have.has(l.id)).map((l) => ({
          key: `memo-${l.id}-${Date.now()}`,
          no: 0,
          code: '',
          description: '',
          spec: '',
          qtyPR: Number(l.quantity) > 0 ? Number(l.quantity) : 1,
          qtyStock: Number(l.quantity) > 0 ? Number(l.quantity) : 1,
          unit: '',
          remark: '',
          costSubgroupId: null,
          costCodeLabel: null,
          deductStock: true,
          memoLineId: l.id,
          memoLineNo: l.line_no,
          memoLineDescription: l.description,
          memoLineUnit: l.unit,
          memoLineQty: Number(l.quantity) > 0 ? Number(l.quantity) : 1,
        }))
        return [...prev, ...added].map((i, idx) => ({ ...i, no: idx + 1 }))
      })
    },
    removeMemoLinesByIds: (ids) => {
      const idSet = new Set(ids)
      const doRemove = () => setItems((prev) => prev.filter((i) => !(i.memoLineId != null && idSet.has(i.memoLineId))).map((i, idx) => ({ ...i, no: idx + 1 })))
      const withMaterial = items.filter((i) => i.memoLineId != null && idSet.has(i.memoLineId)
        && (i.code || (i.memoLineQty != null && i.qtyPR !== i.memoLineQty)))
      if (withMaterial.length > 0) {
        Modal.confirm({
          title: 'ยืนยันการเอารายการออก',
          content: `มี ${withMaterial.length} รายการที่เลือกวัสดุหรือแก้ไขจำนวนไว้แล้ว จะถูกลบออกจาก PR`,
          okText: 'ยืนยัน',
          cancelText: 'ยกเลิก',
          onOk: doRemove,
        })
      } else {
        doRemove()
      }
    },
  }), [items])

  // OH order types: cost code picker loads only the OH list, and existing
  // lines stay editable (their old non-OH cost code is cleared on type switch).
  const isOh = isOhOrderType(orderType)

  useEffect(() => {
    if (!initialItems || initialItems.length === 0) return
    setItems(
      initialItems.map((it, idx) => ({
        key: `edit-${idx}-${it.mat_code}`,
        no: idx + 1,
        code: it.mat_code,
        description: formatItemLabel(it.mat_name, it.spec_name, it.brand_name),
        spec: '',
        qtyPR: it.qty_requested,
        qtyStock: it.qty_to_order,
        unit: it.unit_name || 'Ea',
        remark: it.remarks ?? '',
        costSubgroupId: it.cost_subgroup_id,
        costCodeLabel: it.cost_code_label ?? null,
        isExisting: true,
        deductStock: it.deduct_stock ?? true,
        memoLineId: it.memo_line_id ?? null,
        memoLineNo: it.memo_line_no ?? null,
        memoLineDescription: it.memo_line_description ?? null,
      }))
    )
  }, [initialItems])

  // Job type is a single document-level field (PR header), used only to filter
  // the CostCode picker's *options* (see jobTypeCode prop above / the modal
  // below) when the user is choosing a new cost code. Changing job type must
  // never clear a line's already-selected cost code — that's the user's call
  // to make via the CostCode button/select, not something this table imposes.

  useEffect(() => {
    onItemsChange?.(items.map((i) => ({
      mat_code: i.code,
      qty_requested: i.qtyPR,
      qty_to_order: i.qtyStock,
      cost_subgroup_id: i.costSubgroupId,
      deductStock: i.deductStock,
      remarks: i.remark,
      memo_line_id: i.memoLineId ?? null,
    })))
  }, [items])
  const [pickerOpen, setPickerOpen] = useState(false)
  // key of a Memo-derived row whose material is being picked (single-row picker)
  const [rowPickerKey, setRowPickerKey] = useState<string | null>(null)
  // key of the row whose Description/รายละเอียด textarea is expanded — same
  // expandable-row pattern as POItemsTable's renderDescription.
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }
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
          // Missing/null qty stays absent (unknown), never coerced to 0.
          if (r.qty != null) map[r.mat_code] = Number(r.qty)
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

  // deductStock is only ever changed by the user's switch or by loading a
  // saved value — never by stock lookup results. The backend reserves
  // min(requested, stock), so a true flag on a zero-stock line is harmless.

  // Zero-stock rule, derived from current row state (never a one-time snapshot):
  // a row with a material whose looked-up stock is 0 — or has no stock row at all
  // (the lookup omits null qty, and the picker lists every active material) — is
  // treated as stock 0 once the lookup has finished. Display only: deductStock
  // and the payload are untouched.
  const isZeroStock = (r: PRItem) => !!r.code && !stockLoading && (stockMap[r.code] ?? 0) <= 0

  const addItem = () => {
    const no = items.length + 1
    setItems((prev) => [
      ...prev,
      {
        key: `${Date.now()}`,
        no,
        code: '',
        description: '',
        spec: '',
        // qtyStock (qty_to_order) defaults to match qtyPR (qty_requested): assume
        // nothing is covered by stock until the user checks stockMap and lowers it.
        // shortfall = qty_requested - qty_to_order, so leaving this at 0 would
        // silently tell the backend "fully covered by stock, order nothing."
        qtyPR: 1,
        qtyStock: 1,
        // Blank until a material is actually picked — don't show a unit value
        // that hasn't been confirmed by a real material selection.
        unit: '',
        remark: '',
        costSubgroupId: null,
        costCodeLabel: null,
        deductStock: true,
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
      // Display-only — "code — name" convention (MaterialPage's SectionPill,
      // CostCodePage's cascading dropdowns), paired with the most specific
      // (leaf/subgroup) name. The actual submitted value stays costSubgroupId,
      // untouched by this label.
      costCodeLabel: item.subgroupName ? `${item.costCode} — ${item.subgroupName}` : item.costCode,
    } : i)))
  }

  const toggleDeductStock = (key: string, value: boolean) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, deductStock: value } : i)))
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

  // Single-row material pick for a Memo-derived line (uses the first selection).
  const handleRowMaterialConfirm = (materials: Material[]) => {
    const key = rowPickerKey
    setRowPickerKey(null)
    const m = materials[0]
    if (!key || !m) return
    if (materials.length > 1) message.info('เลือกได้ 1 วัสดุต่อรายการ — ใช้รายการแรกที่เลือก')
    if (!isExemptMatCode(m.mat_code) && items.some((i) => i.key !== key && i.code === m.mat_code)) {
      message.warning('วัสดุนี้มีอยู่ในรายการอื่นแล้ว')
      return
    }
    setItems((prev) => prev.map((i) => (i.key === key ? {
      ...i,
      code: m.mat_code,
      description: formatItemLabel(m.mat_name_th, m.spec_description, m.brand_name),
      spec: '',
      unit: m.unit_name || 'Ea',
    } : i)))
  }

  const handleMaterialConfirm = (materials: Material[]) => {
    const existingCodes = new Set(items.map((i) => i.code).filter(Boolean))
    // x## codes (e.g. x01, x02) are exempt from the duplicate check — always
    // allowed through even if already present in the list.
    const toAdd = materials.filter((m) => isExemptMatCode(m.mat_code) || !existingCodes.has(m.mat_code))
    if (toAdd.length < materials.length) {
      message.warning(`ข้ามรายการที่มีอยู่แล้ว ${materials.length - toAdd.length} รายการ`)
    }
    if (toAdd.length === 0) return
    setItems((prev) => {
      // Fill existing blank rows (e.g. one just added via "เพิ่มรายการใหม่") first,
      // in order, before creating new rows — otherwise picking a material always
      // appends a fresh row and leaves the blank one untouched.
      let materialIdx = 0
      const filled = prev.map((item) => {
        if (item.code || materialIdx >= toAdd.length) return item
        const m = toAdd[materialIdx]
        materialIdx += 1
        return {
          ...item,
          code: m.mat_code,
          description: formatItemLabel(m.mat_name_th, m.spec_description, m.brand_name),
          spec: '',
          unit: m.unit_name || 'Ea',
        }
      })
      const remaining = toAdd.slice(materialIdx)

      const newRows: PRItem[] = remaining.map((m) => ({
        key: `${Date.now()}-${m.mat_code}-${Math.random().toString(36).slice(2)}`,
        no: 0,
        code: m.mat_code,
        description: formatItemLabel(m.mat_name_th, m.spec_description, m.brand_name),
        spec: '',
        qtyPR: 1,
        qtyStock: 1,
        unit: m.unit_name || 'Ea',
        remark: '',
        costSubgroupId: null,
        costCodeLabel: null,
        deductStock: true,
      }))
      const combined = [...filled, ...newRows]
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
      title: 'Cost Code',
      dataIndex: 'costSubgroupId',
      width: 200,
      align: 'center' as const,
      render: (_: unknown, r: PRItem) =>
        readonly ? (
          <span style={{ fontSize: 13 }}>{r.costCodeLabel ? formatCostCodeDisplay(r.costCodeLabel) : '-'}</span>
        ) : (
          <Space size={4} style={{ width: '100%' }}>
            <Button
              size="small"
              danger={highlightMissingCost && r.costSubgroupId == null}
              style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              disabled={!r.code}
              onClick={() => setCostCodeModalRowKey(r.key)}
              title={r.costCodeLabel ? formatCostCodeDisplay(r.costCodeLabel) : undefined}
            >
              {r.code ? (r.costCodeLabel ? formatCostCodeDisplay(r.costCodeLabel) : 'เลือก Cost Code') : 'เลือกวัสดุก่อน'}
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
    {
      title: 'Code',
      dataIndex: 'code',
      width: 140,
      render: (_: unknown, r: PRItem) => {
        if (readonly || r.isExisting) return <span style={{ fontSize: 13 }}>{r.code}</span>
        if (r.memoLineId != null) {
          return (
            <Space.Compact style={{ width: '100%' }}>
              <Input size="small" value={r.code} placeholder="เลือกวัสดุ" readOnly onClick={() => setRowPickerKey(r.key)} />
              <Button size="small" icon={<SearchOutlined />} onClick={() => setRowPickerKey(r.key)} />
            </Space.Compact>
          )
        }
        // Inline-only warning (never blocks typing) for a manually-entered
        // mat_code that duplicates another row's — x## codes are exempt and
        // never flagged, matching handleMaterialConfirm's dedupe exemption.
        const isDuplicate = !!r.code && !isExemptMatCode(r.code) &&
          items.some((other) => other.key !== r.key && other.code === r.code)
        return (
          <div>
            <Input
              size="small"
              value={r.code}
              placeholder="รหัสสินค้า"
              status={isDuplicate ? 'warning' : undefined}
              onChange={(e) => updateItem(r.key, 'code', e.target.value)}
            />
            {isDuplicate && (
              <div style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>รหัสซ้ำกับรายการอื่น</div>
            )}
          </div>
        )
      },
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
            : <span style={{ color: '#dc2626', fontSize: 12 }}>ไม่พบใน stock (0)</span>
        }
        if (qty === 0) {
          return <span style={{ color: '#dc2626', fontWeight: 500 }}>0 <span style={{ fontSize: 12 }}>(ไม่มีสต็อก)</span></span>
        }
        return <span style={{ color: '#16a34a', fontWeight: 500 }}>{qty.toLocaleString('th-TH')}</span>
      },
    },
    {
      title: 'หน่วย',
      dataIndex: 'unit',
      width: 90,
      align: 'center' as const,
      // Always read-only — mirrors the selected material's unit_name and can
      // never be edited by the user (see handleMaterialConfirm / initialItems seeding).
      render: (_: unknown, r: PRItem) => <span style={{ fontSize: 13 }}>{r.unit || '-'}</span>,
    },
    {
      title: (
        <Tooltip title="ปิด = สั่งซื้อเต็มจำนวนเสมอ ไม่หักจากของที่มีอยู่ในคลัง">
          <span>ตัดสต็อก</span>
        </Tooltip>
      ),
      key: 'deduct_stock',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, r: PRItem) =>
        readonly ? (
          <span style={{ fontSize: 13, fontWeight: 600, color: r.deductStock ? '#16a34a' : '#dc2626' }}>
            {r.deductStock ? 'ใช่' : 'ไม่'}
          </span>
        ) : (
          <Switch
            size="small"
            checked={r.deductStock}
            disabled={!r.code}
            onChange={(checked) => toggleDeductStock(r.key, checked)}
            style={{ backgroundColor: r.deductStock && !isZeroStock(r) ? '#16a34a' : '#dc2626' }}
          />
        ),
    },

    ...(!readonly
      ? [
          {
            title: '',
            width: 72,
            align: 'center' as const,
            render: (_: unknown, r: PRItem) => {
              const hasRemark = !!(r.remark && r.remark.trim())
              const expanded = expandedKeys.includes(r.key)
              return (
                <Space size={0}>
                  <Tooltip title={hasRemark ? 'มีรายละเอียด — คลิกเพื่อดู/แก้ไข' : 'เพิ่มรายละเอียด'}>
                    <Badge dot={hasRemark} offset={[-2, 2]}>
                      <Button
                        type="text"
                        size="small"
                        aria-expanded={expanded}
                        aria-controls={`pr-item-desc-${r.key}`}
                        icon={<FileTextOutlined />}
                        style={{ color: hasRemark ? '#2563eb' : undefined }}
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
      : []),
  ]

  const renderRemark = (r: PRItem) => (
    <div id={`pr-item-desc-${r.key}`} style={{ padding: '4px 8px' }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>รายละเอียด / Description</div>
      <Input.TextArea
        autoFocus
        value={r.remark ?? ''}
        placeholder="เพิ่มรายละเอียดสำหรับรายการนี้..."
        autoSize={{ minRows: 2 }}
        maxLength={1000}
        showCount
        onChange={(e) => updateItem(r.key, 'remark', e.target.value)}
      />
    </div>
  )

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
        onRow={(r) => missingCostRowProps(highlightMissingCost, r.costSubgroupId == null)}
        style={{ marginBottom: items.length > 0 ? 16 : 0 }}
        expandable={!readonly ? {
          expandedRowKeys: expandedKeys,
          showExpandColumn: false,
          expandedRowRender: renderRemark,
        } : undefined}
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
            onChange={(e) => onRemarkChange?.(e.target.value)}
            style={{ borderRadius: 8, fontSize: 13 }}
          />
        </div>
      )}

      <MaterialPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handleMaterialConfirm}
        showStockLookup={false}
        hasCostSubgroup
      />

      <MaterialPickerModal
        open={rowPickerKey !== null}
        onClose={() => setRowPickerKey(null)}
        onConfirm={handleRowMaterialConfirm}
        showStockLookup={false}
        hasCostSubgroup
      />

      <CostCodeSelectionModal
        open={costCodeModalRowKey !== null}
        onClose={() => setCostCodeModalRowKey(null)}
        onSelect={(item) => {
          if (costCodeModalRowKey) handleCostCodeSelect(costCodeModalRowKey, item)
        }}
        jobTypeCode={jobTypeCode}
        ohOnly={isOh}
      />

      {/* Print/Back buttons moved to PRCreatePage's action bar (merged into the
          same row as บันทึกร่าง/ส่งใบขอซื้อ) — still driven by this table's
          items via the getPrintItems ref handle above. */}
      {readonly && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <span style={{ fontSize: 12, color: '#cc0000' }}>
            * ไม่สามารถแก้ไขข้อมูลได้ สถานะคำร้องขอซื้อ ถูกอนุมัติหรือปิดแล้ว
          </span>
        </div>
      )}
    </Card>
  )
})

export default PRItemsTable
