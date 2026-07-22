import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Select, Switch, Space, Button, message } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import StockStatusTag from '@/components/stock/StockStatusTag'
import { useAppSelector } from '@/store'
import { mockInventory, mockStockItems } from '@/utils/mockStockData'
import type { StockInventory } from '@/types/stock'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const StockInventoryPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<StockInventory[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [warehouseCode, setWarehouseCode] = useState<string | undefined>()
  const [lowStockOnly, setLowStockOnly] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/stock/inventory`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { search: search || undefined, warehouse_code: warehouseCode, low_stock_only: lowStockOnly || undefined },
      })
      const raw = Array.isArray(res.data) ? res.data : res.data?.data
      setData(Array.isArray(raw) ? raw : [])
    } catch {
      let filtered = mockInventory
      if (search) filtered = filtered.filter((i) => i.itemCode.includes(search) || i.itemName.toLowerCase().includes(search.toLowerCase()))
      if (warehouseCode) filtered = filtered.filter((i) => i.warehouseCode === warehouseCode)
      if (lowStockOnly) {
        filtered = filtered.filter((inv) => {
          const item = mockStockItems.find((s) => s.id === inv.itemId)
          return inv.qtyOnHand <= (item?.minQty ?? 0)
        })
      }
      setData(filtered)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setSearch('')
    setWarehouseCode(undefined)
    setLowStockOnly(false)
  }

  useEffect(() => { fetchData() }, [search, warehouseCode, lowStockOnly])

  const getMinQty = (itemId: number) => mockStockItems.find((s) => s.id === itemId)?.minQty ?? 0

  const columns = [
    { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode' },
    { title: 'Item Name', dataIndex: 'itemName', key: 'itemName', ellipsis: true },
    { title: 'Location', dataIndex: 'locationName', key: 'locationName' },
    { title: 'Qty On Hand', dataIndex: 'qtyOnHand', key: 'qtyOnHand', align: 'right' as const },
    { title: 'Reserved', dataIndex: 'qtyReserved', key: 'qtyReserved', align: 'right' as const },
    { title: 'Available', dataIndex: 'qtyAvailable', key: 'qtyAvailable', align: 'right' as const },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: StockInventory) => (
        <StockStatusTag qty={record.qtyOnHand} minQty={getMinQty(record.itemId)} />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Inventory Balance"
        subtitle="View current stock levels per location"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'Inventory' }]}
      />
      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search item code / name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="Warehouse"
            value={warehouseCode}
            onChange={setWarehouseCode}
            allowClear
            style={{ width: 150 }}
            options={[
              { value: 'WH-A', label: 'Warehouse A' },
              { value: 'WH-B', label: 'Warehouse B' },
            ]}
          />
          <Space>
            <span style={{ fontSize: 13, color: '#374151' }}>Low Stock Only</span>
            <Switch checked={lowStockOnly} onChange={setLowStockOnly} />
          </Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>Search</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>Reset</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 20, showTotal: (t) => `Total ${t} items` }}
          locale={{ emptyText: 'No inventory data' }}
        />
      </Card>
    </div>
  )
}

export default StockInventoryPage
