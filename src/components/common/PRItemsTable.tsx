import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Input, InputNumber, Select, Space, message } from 'antd'
import { PlusOutlined, SearchOutlined, DeleteOutlined, PrinterOutlined, RollbackOutlined } from '@ant-design/icons'
import MaterialPickerModal from '@/components/common/MaterialPickerModal'
import type { Material } from '@/types'

interface PRItem {
  key: string
  no: number
  code: string
  description: string
  qtyPR: number
  qtyStock: number
  unit: string
  remark: string
}

const unitOptions = [
  { value: 'Ea', label: 'Ea' },
  { value: 'ชิ้น', label: 'ชิ้น' },
  { value: 'กล่อง', label: 'กล่อง' },
  { value: 'ชุด', label: 'ชุด' },
  { value: 'kg', label: 'kg' },
  { value: 'L', label: 'L' },
]

interface PRItemsTableProps {
  readonly?: boolean
  onBack?: () => void
  onItemsChange?: (items: { mat_code: string; qty_requested: number }[]) => void
}

const PRItemsTable: React.FC<PRItemsTableProps> = ({ readonly = false, onBack, onItemsChange }) => {
  const [items, setItems] = useState<PRItem[]>([])

  useEffect(() => {
    onItemsChange?.(items.map((i) => ({ mat_code: i.code, qty_requested: i.qtyPR })))
  }, [items])
  const [remark, setRemark] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const addItem = () => {
    const no = items.length + 1
    setItems((prev) => [
      ...prev,
      {
        key: `${Date.now()}`,
        no,
        code: '',
        description: '',
        qtyPR: 1,
        qtyStock: 0,
        unit: 'Ea',
        remark: '',
      },
    ])
  }

  const updateItem = (key: string, field: keyof PRItem, value: string | number) => {
  setItems((prev) => {
    const next = prev.map((i) => (i.key === key ? { ...i, [field]: value } : i))
    console.log('items after update:', next)
    return next
  })
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
        qtyStock: 0,
        unit: m.unit_name || 'Ea',
        remark: '',
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
