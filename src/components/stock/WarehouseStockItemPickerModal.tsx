import React, { useEffect, useRef, useState } from 'react'
import { Modal, Table, Input, Button, Space, message } from 'antd'
import axios from 'axios'
import { useAppSelector } from '@/store'
import type { StockTransferLine } from '@/types/stockTransfer'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

interface MaterialSearchRow {
  mat_code: string
  mat_name: string
  unit: string
  qty_on_hand: number
}

const PAGE_SIZE = 10

interface Props {
  open: boolean
  warehouseCode: string
  excludeMatCodes: string[]
  onClose: () => void
  onConfirm: (lines: StockTransferLine[]) => void
}

// Scoped to a single warehouse via `warehouse_code`, unlike MaterialPickerModal which
// browses the full material catalog with no stock awareness. Calls the confirmed
// `GET /materials/search?q=&warehouse_code=` endpoint (same one PR's item picker uses,
// extended with `warehouse_code` — an INNER JOIN against stock_item, so results are
// already limited to materials with stock at this warehouse, each carrying its real
// qty_on_hand). Response is a flat array in `data`, no pagination envelope, so paging
// here is client-side over the full result set for a given search term.
const WarehouseStockItemPickerModal: React.FC<Props> = ({ open, warehouseCode, excludeMatCodes, onClose, onConfirm }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [data, setData] = useState<MaterialSearchRow[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [selectedRows, setSelectedRows] = useState<MaterialSearchRow[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setDebouncedSearch('')
    setPage(1)
    setData([])
    setSelectedKeys([])
    setSelectedRows([])
  }, [open])

  // Re-fetches (and drops any stale rows) whenever the warehouse changes, so switching
  // "คลังต้นทาง" never leaves results from the previous warehouse on screen. `q` is
  // required by the backend (it's a search endpoint, not a "list all" one) — skip the
  // call entirely on an empty/whitespace-only term instead of sending a request that
  // would come back empty/erroring anyway.
  const trimmedSearch = debouncedSearch.trim()
  useEffect(() => {
    if (!open || !warehouseCode || !trimmedSearch) {
      setData([])
      return
    }
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/materials/search`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { q: trimmedSearch, warehouse_code: warehouseCode },
        })
        const list = Array.isArray(res.data?.data) ? res.data.data : []
        const rows: MaterialSearchRow[] = list
          .map((m: any) => ({
            mat_code: m.mat_code,
            mat_name: m.mat_name,
            unit: m.unit,
            qty_on_hand: Number(m.qty_on_hand ?? 0),
          }))
          .filter((r: MaterialSearchRow) => !excludeMatCodes.includes(r.mat_code))
        setData(rows)
        setPage(1)
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลสต็อกในคลังไม่สำเร็จ')
        setData([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [open, warehouseCode, trimmedSearch, accessToken])

  const handleConfirm = () => {
    onConfirm(selectedRows.map((r) => ({
      mat_code: r.mat_code,
      item_name: r.mat_name,
      unit: r.unit,
      qty_on_hand: r.qty_on_hand,
      qty_requested: 1,
      remarks: '',
    })))
    onClose()
  }

  const columns = [
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', width: 140 },
    { title: 'ชื่อวัสดุ', dataIndex: 'mat_name', ellipsis: true },
    { title: 'หน่วย', dataIndex: 'unit', width: 90, align: 'center' as const },
    {
      title: 'คงเหลือ', dataIndex: 'qty_on_hand', width: 100, align: 'right' as const,
      render: (v: number) => v.toLocaleString(),
    },
  ]

  return (
    <Modal
      title={<span style={{ color: '#1e3a8a', fontWeight: 700 }}>เลือกรายการวัสดุ (คงเหลือในคลัง {warehouseCode})</span>}
      open={open}
      onCancel={onClose}
      width={760}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: 13 }}>
            เลือกแล้ว <span style={{ color: '#1e3a8a', fontWeight: 600 }}>{selectedRows.length}</span> รายการ
          </span>
          <Space>
            <Button onClick={onClose}>ยกเลิก</Button>
            <Button type="primary" disabled={selectedRows.length === 0} onClick={handleConfirm}>
              ยืนยัน ({selectedRows.length})
            </Button>
          </Space>
        </div>
      }
    >
      <Input.Search
        placeholder="พิมพ์อย่างน้อย 1 ตัวอักษร เพื่อค้นหารหัสวัสดุ / ชื่อวัสดุ"
        allowClear
        value={search}
        style={{ marginBottom: 12 }}
        onSearch={(val) => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          setSearch(val)
          setDebouncedSearch(val)
        }}
        onChange={(e) => {
          const val = e.target.value
          setSearch(val)
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300)
        }}
      />
      {!trimmedSearch && !loading && (
        <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>
          พิมพ์คำค้นหาเพื่อดูรายการวัสดุที่มีสต็อกในคลังนี้
        </div>
      )}
      <Table
        rowKey="mat_code"
        loading={loading}
        dataSource={data}
        columns={columns}
        size="small"
        scroll={{ y: 300 }}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys, rows) => { setSelectedKeys(keys); setSelectedRows(rows) },
        }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: data.length,
          showSizeChanger: false,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
          onChange: (p) => setPage(p),
        }}
        locale={{ emptyText: 'ไม่พบวัสดุที่มีสต็อกในคลังนี้' }}
      />
    </Modal>
  )
}

export default WarehouseStockItemPickerModal
