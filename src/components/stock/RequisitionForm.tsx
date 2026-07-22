import React, { useEffect, useRef, useState } from 'react'
import { Card, Form, Input, DatePicker, Button, Table, Select, InputNumber, Tag, message, Spin } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import type { RequisitionDetail, RequisitionLine, StockItemOption } from '@/types/requisition'

const BASE_URL = (import.meta as any).env?.VITE_API_URL
const MENU_CODE = 'MENU_STOCK_REQUISITION'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const matTypeColor: Record<string, string> = {
  RETURNABLE: 'blue',
  CONSUMABLE: 'orange',
}

interface Props {
  mode: 'create' | 'edit'
  borrowId?: string
}

const RequisitionForm: React.FC<Props> = ({ mode, borrowId }) => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)

  const [warehouseCode, setWarehouseCode] = useState<string | undefined>()
  const [warehouseOptions, setWarehouseOptions] = useState<{ value: string; label: string }[]>([])
  const [purpose, setPurpose] = useState('')
  const [expectedReturn, setExpectedReturn] = useState<dayjs.Dayjs | null>(null)
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<RequisitionLine[]>([])

  const [stockOptions, setStockOptions] = useState<StockItemOption[]>([])
  const [stockFetching, setStockFetching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/warehouse`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = res.data?.data ?? []
        const opts = list.map((w: any) => ({ value: w.warehouse_code, label: w.warehouse_name ? `${w.warehouse_code} — ${w.warehouse_name}` : w.warehouse_code }))
        setWarehouseOptions(opts.length > 0 ? opts : [{ value: 'WH01', label: 'WH01' }])
      } catch {
        setWarehouseOptions([{ value: 'WH01', label: 'WH01' }])
      }
    }
    fetchWarehouses()
  }, [accessToken])

  useEffect(() => {
    if (mode !== 'edit' || !borrowId) return
    let cancelled = false
    const fetchDetail = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/borrow/${borrowId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const result: RequisitionDetail = res.data?.data
        if (cancelled) return
        if (result.status === 'APPROVED') {
          message.warning('ไม่สามารถแก้ไขใบที่อนุมัติแล้ว')
          navigate(`/stock/requisition/${borrowId}`)
          return
        }
        setWarehouseCode(result.warehouse_code)
        setPurpose(result.purpose || '')
        setExpectedReturn(result.expected_return ? dayjs(result.expected_return) : null)
        setRemarks(result.remarks || '')
        setLines(result.lines || [])
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลใบขอเบิกไม่สำเร็จ')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchDetail()
    return () => { cancelled = true }
  }, [mode, borrowId, accessToken, navigate])

  const handleStockSearch = (term: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = term.trim()
    if (!q) {
      setStockOptions([])
      return
    }
    setStockFetching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${BASE_URL}/stock-items`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { search: q },
        })
        setStockOptions(res.data?.data ?? [])
      } catch {
        setStockOptions([])
      } finally {
        setStockFetching(false)
      }
    }, 300)
  }

  const handleAddLine = (stockItemId: number) => {
    const item = stockOptions.find((s) => s.stock_item_id === stockItemId)
    if (!item) return
    if (lines.some((l) => l.stock_item_id === item.stock_item_id)) {
      message.warning('รายการนี้ถูกเพิ่มแล้ว')
      return
    }
    setLines((prev) => [
      ...prev,
      {
        stock_item_id: item.stock_item_id,
        mat_code: item.mat_code,
        item_name: item.item_name,
        mat_type: item.mat_type,
        unit: item.unit,
        qty_requested: 1,
        current_qty: item.current_qty,
      },
    ])
    setStockOptions([])
  }

  const removeLine = (stockItemId: number) => {
    setLines((prev) => prev.filter((l) => l.stock_item_id !== stockItemId))
  }

  const updateQty = (stockItemId: number, val: number | null) => {
    setLines((prev) => prev.map((l) => (l.stock_item_id === stockItemId ? { ...l, qty_requested: val ?? 1 } : l)))
  }

  const handleSave = async (submitMode: 'DRAFT' | 'SUBMIT') => {
    if (!warehouseCode) {
      message.warning('กรุณาเลือกคลัง')
      return
    }
    if (lines.length === 0) {
      message.warning('กรุณาเพิ่มรายการวัสดุอย่างน้อย 1 รายการ')
      return
    }
    if (lines.some((l) => l.qty_requested <= 0)) {
      message.warning('จำนวนที่ขอต้องมากกว่า 0')
      return
    }

    setSaving(true)
    try {
      const payload = {
        warehouse_code: warehouseCode,
        purpose,
        expected_return: expectedReturn ? expectedReturn.format('YYYY-MM-DD') : undefined,
        remarks: remarks || undefined,
        lines: lines.map((l) => ({
          stock_item_id: l.stock_item_id,
          mat_code: l.mat_code,
          qty_requested: l.qty_requested,
        })),
      }

      let id = borrowId
      if (mode === 'create') {
        const res = await axios.post(`${BASE_URL}/borrow`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        id = res.data?.data?.borrow_id
      } else {
        await axios.put(`${BASE_URL}/borrow/${borrowId}`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      }

      if (submitMode === 'SUBMIT' && id) {
        await axios.post(`${BASE_URL}/borrow/${id}/submit`, {}, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      }

      message.success(submitMode === 'DRAFT' ? 'บันทึกร่างสำเร็จ' : 'ส่งอนุมัติสำเร็จ')
      navigate(`/stock/requisition/${id}`)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: 'ลบ',
      key: 'delete',
      width: 50,
      render: (_: unknown, record: RequisitionLine) => (
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          disabled={lines.length <= 1}
          onClick={() => removeLine(record.stock_item_id)}
        />
      ),
    },
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'ชื่อวัสดุ', dataIndex: 'item_name', key: 'item_name', ellipsis: true },
    {
      title: 'ประเภท',
      dataIndex: 'mat_type',
      key: 'mat_type',
      render: (v: string) => <Tag color={matTypeColor[v]}>{v}</Tag>,
    },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit' },
    {
      title: 'คงเหลือ',
      dataIndex: 'current_qty',
      key: 'current_qty',
      align: 'right' as const,
      render: (v?: number) => (v ?? 0).toLocaleString(),
    },
    {
      title: 'จำนวนขอ',
      key: 'qty_requested',
      align: 'right' as const,
      render: (_: unknown, record: RequisitionLine) => (
        <InputNumber
          min={1}
          max={record.current_qty}
          value={record.qty_requested}
          onChange={(val) => updateQty(record.stock_item_id, val)}
          style={{ width: 100 }}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={mode === 'create' ? 'สร้างใบขอเบิก' : 'แก้ไขใบขอเบิก'}
        subtitle="ขอเบิกวัสดุจากคลัง"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'ใบขอเบิก' }, { title: mode === 'create' ? 'สร้าง' : 'แก้ไข' }]}
        extra={<Button onClick={() => navigate('/stock/requisition')}>ยกเลิก</Button>}
      />

      {loading ? (
        <Card style={cardStyle}>
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        </Card>
      ) : (
        <>
          <Card title="ข้อมูลทั่วไป" style={cardStyle}>
            <Form layout="vertical">
              <Form.Item label="คลัง" required>
                <Select
                  value={warehouseCode}
                  onChange={setWarehouseCode}
                  options={warehouseOptions}
                  style={{ width: 240 }}
                  placeholder="เลือกคลัง"
                />
              </Form.Item>
              <Form.Item label="วัตถุประสงค์" required>
                <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="ระบุวัตถุประสงค์" />
              </Form.Item>
              <Form.Item label="วันที่ต้องคืน">
                <DatePicker value={expectedReturn} onChange={setExpectedReturn} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item label="หมายเหตุ">
                <Input.TextArea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </Form.Item>
            </Form>
          </Card>

          <Card title="รายการวัสดุ" style={cardStyle}>
            <Select
              showSearch
              value={null}
              placeholder="ค้นหารหัสหรือชื่อวัสดุ"
              filterOption={false}
              onSearch={handleStockSearch}
              onSelect={(value: number | null) => { if (value != null) handleAddLine(value) }}
              style={{ width: 320, marginBottom: 16 }}
              notFoundContent={stockFetching ? <Spin size="small" /> : null}
              options={stockOptions.map((s) => ({
                value: s.stock_item_id,
                label: `${s.mat_code} — ${s.item_name}`,
              }))}
            />
            <Table
              rowKey="stock_item_id"
              dataSource={lines}
              columns={columns}
              pagination={false}
              locale={{ emptyText: 'ยังไม่มีรายการวัสดุ — ค้นหาเพื่อเพิ่ม' }}
            />
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => navigate('/stock/requisition')}>ยกเลิก</Button>
            <PermissionButton menuCode={MENU_CODE} action="write" loading={saving} onClick={() => handleSave('DRAFT')}>
              บันทึกร่าง
            </PermissionButton>
            <PermissionButton
              menuCode={MENU_CODE}
              action="write"
              type="primary"
              loading={saving}
              onClick={() => handleSave('SUBMIT')}
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
            >
              บันทึกและส่งอนุมัติ
            </PermissionButton>
          </div>
        </>
      )}
    </div>
  )
}

export default RequisitionForm
