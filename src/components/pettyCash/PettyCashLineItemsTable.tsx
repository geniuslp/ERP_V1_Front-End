import React, { useEffect, useRef, useState } from 'react'
import { Table, Button, InputNumber, Input, Space, Tooltip, Select, Tag, message } from 'antd'
import { DeleteOutlined, InfoCircleOutlined, SearchOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useAppSelector } from '@/store'
import { calcDisc } from '@/utils/poCalc'
import MaterialPickerModal from '@/components/common/MaterialPickerModal'
import CostCodeSelectionModal, { type CostCodeItem } from '@/components/common/CostCodeSelectionModal'
import type { Material } from '@/types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

export interface PettyCashLineRow {
  key: string
  no: number
  project_code: string | null
  mat_code: string
  item_name: string
  unit: string
  stock_on_hand: number
  qty: number
  unit_price: number
  discount: number
  disc_type: 'pct' | 'amt'
  wht_rate: number | null
  cost_subgroup_id: number | null
  cost_subgroup_display: string
  description: string
  remarks: string
}

interface Props {
  items: PettyCashLineRow[]
  onChange: (items: PettyCashLineRow[]) => void
  useDisc: boolean
  discType: 'pct' | 'amt'
  useVat: boolean
  useWht: boolean
}

const PettyCashLineItemsTable: React.FC<Props> = ({ items, onChange, useDisc, discType, useVat, useWht }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([])
  const [materialModalKey, setMaterialModalKey] = useState<string | null>(null)
  const [costCodeModalKey, setCostCodeModalKey] = useState<string | null>(null)
  const refetchToken = useRef(0)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/master/projects`, { headers: { Authorization: `Bearer ${accessToken}` } })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setProjects(list.map((p: any) => ({
          value: p.project_code,
          label: p.project_code ? `${p.project_code} — ${p.project_name ?? ''}` : (p.project_name ?? String(p.id)),
        })))
      } catch {
        setProjects([])
      }
    }
    fetchProjects()
  }, [accessToken])

  const renumber = (rows: PettyCashLineRow[]) => rows.map((r, idx) => ({ ...r, no: idx + 1 }))

  const updateItem = (key: string, patch: Partial<PettyCashLineRow>) => {
    onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  const removeItem = (key: string) => {
    onChange(renumber(items.filter((i) => i.key !== key)))
  }

  const addRow = () => {
    const newRow: PettyCashLineRow = {
      key: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      no: 0,
      project_code: null,
      mat_code: '',
      item_name: '',
      unit: '',
      stock_on_hand: 0,
      qty: 1,
      unit_price: 0,
      discount: 0,
      disc_type: discType,
      wht_rate: useWht ? 3 : null,
      cost_subgroup_id: null,
      cost_subgroup_display: '',
      description: '',
      remarks: '',
    }
    onChange(renumber([...items, newRow]))
  }

  // Re-scopes an already-picked material's reference stock to the row's new
  // project — never silently leaves the old project's stock number on screen.
  const handleProjectChange = async (key: string, projectCode: string) => {
    const row = items.find((i) => i.key === key)
    updateItem(key, { project_code: projectCode })
    if (!row?.mat_code) return

    const myToken = ++refetchToken.current
    try {
      const res = await axios.get(`${BASE_URL}/master/allMaterial`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { q: row.mat_code, project_code: projectCode, limit: 1 },
      })
      if (myToken !== refetchToken.current) return // stale — a newer change superseded this
      const list: any[] = Array.isArray(res.data) ? res.data : res.data?.data ?? []
      const match = list.find((m) => m.mat_code === row.mat_code)
      updateItem(key, { stock_on_hand: match?.stock_on_hand ?? 0 })
      message.warning(`เปลี่ยนโครงการของแถวนี้แล้ว — กรุณาตรวจสอบว่าวัสดุ "${row.mat_code}" ยังถูกต้องสำหรับโครงการใหม่`)
    } catch {
      updateItem(key, { stock_on_hand: 0 })
    }
  }

  const handleMaterialConfirm = (materials: Material[]) => {
    if (!materialModalKey || materials.length === 0) return
    const m = materials[0] as any
    updateItem(materialModalKey, {
      mat_code: m.mat_code,
      item_name: m.mat_name_th,
      unit: m.unit_name,
      stock_on_hand: m.stock_on_hand ?? 0,
      cost_subgroup_id: m.cost_subgroup_id ?? null,
      cost_subgroup_display: m.cost_subgroup_id
        ? [m.cost_code, m.cost_subgroup_name].filter(Boolean).join(' — ')
        : '',
    })
    setMaterialModalKey(null)
  }

  const handleCostCodeSelect = (item: CostCodeItem) => {
    if (!costCodeModalKey) return
    updateItem(costCodeModalKey, {
      cost_subgroup_id: item.subgroupId,
      cost_subgroup_display: `${item.subgroupCode} — ${item.subgroupName}`,
    })
    setCostCodeModalKey(null)
  }

  const taxColumns: any[] = []

  if (useDisc) {
    taxColumns.push({
      title: 'ส่วนลด',
      key: 'disc',
      width: 140,
      align: 'center' as const,
      render: (_: unknown, r: PettyCashLineRow) => (
        <Space.Compact style={{ width: '100%' }}>
          <InputNumber
            size="small"
            min={0}
            max={r.disc_type === 'pct' ? 100 : undefined}
            value={r.discount}
            style={{ width: '60%' }}
            onChange={(v) => updateItem(r.key, { discount: v ?? 0 })}
          />
          <Select
            size="small"
            value={r.disc_type}
            style={{ width: '40%' }}
            options={[{ label: '%', value: 'pct' }, { label: '฿', value: 'amt' }]}
            onChange={(v) => updateItem(r.key, { disc_type: v, discount: 0 })}
          />
        </Space.Compact>
      ),
    })
  }

  if (useVat) {
    taxColumns.push({
      title: 'VAT 7%',
      key: 'vat',
      width: 84,
      align: 'right' as const,
      render: (_: unknown, r: PettyCashLineRow) => {
        const lineAmt = r.qty * r.unit_price
        const discAmt = useDisc ? calcDisc(lineAmt, r.discount, r.disc_type) : 0
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
      render: (_: unknown, r: PettyCashLineRow) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={r.wht_rate ?? 3}
          options={[{ label: '1%', value: 1 }, { label: '3%', value: 3 }, { label: '5%', value: 5 }]}
          onChange={(v) => updateItem(r.key, { wht_rate: v as number })}
        />
      ),
    })
    taxColumns.push({
      title: 'WHT (฿)',
      key: 'wht_amt',
      width: 84,
      align: 'right' as const,
      render: (_: unknown, r: PettyCashLineRow) => {
        const lineAmt = r.qty * r.unit_price
        const discAmt = useDisc ? calcDisc(lineAmt, r.discount, r.disc_type) : 0
        const wht = (lineAmt - discAmt) * ((r.wht_rate ?? 3) / 100)
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
      render: (_: unknown, r: PettyCashLineRow) => {
        const lineAmt = r.qty * r.unit_price
        const discAmt = useDisc ? calcDisc(lineAmt, r.discount, r.disc_type) : 0
        const afterDisc = lineAmt - discAmt
        const vat = useVat ? afterDisc * 0.07 : 0
        const wht = useWht ? afterDisc * ((r.wht_rate ?? 3) / 100) : 0
        const net = afterDisc + vat - wht
        return <span style={{ fontWeight: 500, color: '#1e40af' }}>{net.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
      },
    })
  }

  const columns = [
    { title: 'No.', dataIndex: 'no', width: 48, align: 'center' as const },
    {
      title: 'โครงการ',
      key: 'project_code',
      width: 200,
      render: (_: unknown, r: PettyCashLineRow) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          placeholder="เลือกโครงการ"
          showSearch
          status={r.project_code ? undefined : 'error'}
          options={projects}
          value={r.project_code ?? undefined}
          filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          onChange={(v) => handleProjectChange(r.key, v)}
        />
      ),
    },
    {
      title: 'รหัสวัสดุ / รายการ',
      key: 'mat',
      render: (_: unknown, r: PettyCashLineRow) => (
        <div>
          {r.mat_code ? (
            <>
              <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.mat_code}</span>
              <div style={{ fontSize: 13 }}>{r.item_name}</div>
            </>
          ) : (
            <span style={{ color: '#9ca3af', fontSize: 13 }}>ยังไม่ได้เลือกวัสดุ</span>
          )}
          <Button
            size="small"
            icon={<SearchOutlined />}
            disabled={!r.project_code}
            style={{ marginTop: 4 }}
            onClick={() => setMaterialModalKey(r.key)}
          >
            {r.mat_code ? 'เปลี่ยนวัสดุ' : 'เลือกวัสดุ'}
          </Button>
        </div>
      ),
    },
    { title: 'หน่วย', dataIndex: 'unit', width: 80, align: 'center' as const },
    {
      title: (
        <Space size={4}>
          <span>Stock อ้างอิง</span>
          <Tooltip title="ยอดคงเหลือที่โครงการ ณ ปัจจุบัน — ไม่ตัด stock เมื่อบันทึกเอกสารนี้">
            <InfoCircleOutlined style={{ color: '#93c5fd' }} />
          </Tooltip>
        </Space>
      ),
      key: 'stock_on_hand',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, r: PettyCashLineRow) => (
        <span style={{ fontSize: 12, color: '#93c5fd' }}>{r.stock_on_hand.toLocaleString('th-TH')}</span>
      ),
    },
    {
      title: 'Cost code',
      key: 'cost_code',
      width: 190,
      render: (_: unknown, r: PettyCashLineRow) => (
        <Button size="small" style={{ width: '100%', textAlign: 'left' }} onClick={() => setCostCodeModalKey(r.key)}>
          {r.cost_subgroup_display || <span style={{ color: '#9ca3af' }}>เลือก Cost Code</span>}
        </Button>
      ),
    },
    {
      title: 'จำนวน',
      key: 'qty',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, r: PettyCashLineRow) => (
        <InputNumber
          size="small"
          min={0}
          status={r.qty > 0 ? undefined : 'error'}
          value={r.qty}
          style={{ width: '100%' }}
          onChange={(v) => updateItem(r.key, { qty: v ?? 0 })}
        />
      ),
    },
    {
      title: 'ราคา/หน่วย',
      key: 'unit_price',
      width: 120,
      align: 'center' as const,
      render: (_: unknown, r: PettyCashLineRow) => (
        <InputNumber
          size="small"
          min={0}
          value={r.unit_price}
          style={{ width: '100%' }}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateItem(r.key, { unit_price: v ?? 0 })}
        />
      ),
    },
    {
      title: 'มูลค่า',
      key: 'amount',
      width: 110,
      align: 'right' as const,
      render: (_: unknown, r: PettyCashLineRow) => (r.qty * r.unit_price).toLocaleString('th-TH'),
    },
    ...taxColumns,
    {
      title: 'รายละเอียด',
      key: 'description',
      width: 160,
      render: (_: unknown, r: PettyCashLineRow) => (
        <Input
          size="small"
          value={r.description}
          placeholder="รายละเอียด"
          onChange={(e) => updateItem(r.key, { description: e.target.value })}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 48,
      align: 'center' as const,
      render: (_: unknown, r: PettyCashLineRow) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeItem(r.key)} />
      ),
    },
  ]

  const currentRow = items.find((i) => i.key === materialModalKey)

  return (
    <div>
      <Table
        rowKey="key"
        dataSource={items}
        columns={columns}
        pagination={false}
        size="small"
        scroll={{ x: 1250 }}
        locale={{ emptyText: 'ยังไม่มีรายการ — กด "เพิ่มแถว" เพื่อเริ่มต้น' }}
      />

      <div style={{ marginTop: 12 }}>
        <Button onClick={addRow}>เพิ่มแถว</Button>
      </div>

      <MaterialPickerModal
        open={materialModalKey !== null}
        onClose={() => setMaterialModalKey(null)}
        onConfirm={handleMaterialConfirm}
        projectCode={currentRow?.project_code ?? undefined}
      />

      <CostCodeSelectionModal
        open={costCodeModalKey !== null}
        onClose={() => setCostCodeModalKey(null)}
        onSelect={handleCostCodeSelect}
      />
    </div>
  )
}

export default PettyCashLineItemsTable
