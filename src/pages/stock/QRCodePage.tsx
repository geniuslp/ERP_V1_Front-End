import React, { useEffect, useRef, useState } from 'react'
import { Card, Table, Button, Input, Space, Checkbox, message, Tooltip } from 'antd'
import { PrinterOutlined, DownloadOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { QRCodeSVG } from 'qrcode.react'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { mockStockItems } from '@/utils/mockStockData'
import type { StockItem } from '@/types/stock'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const QRCodePage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/stock/items`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { search: search || undefined, is_active: true },
      })
      const raw = Array.isArray(res.data) ? res.data : res.data?.data
      setData(Array.isArray(raw) ? raw : [])
    } catch {
      let filtered = mockStockItems.filter((s) => s.isActive)
      if (search) filtered = filtered.filter((s) => s.itemCode.includes(search) || s.itemName.toLowerCase().includes(search.toLowerCase()))
      setData(filtered)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [search])

  const downloadQR = (itemCode: string) => {
    const svg = document.getElementById(`qr-${itemCode}`)
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    canvas.width = 120
    canvas.height = 120
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      const link = document.createElement('a')
      link.download = `QR-${itemCode}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`
  }

  const printSelected = () => {
    if (selectedKeys.length === 0) { message.warning('Select items to print'); return }
    const selectedItems = data.filter((d) => selectedKeys.includes(d.id))
    const printContent = selectedItems.map((item) => {
      const svg = document.getElementById(`qr-${item.itemCode}`)
      if (!svg) return ''
      const svgData = btoa(new XMLSerializer().serializeToString(svg))
      return `
        <div style="display:inline-block;text-align:center;padding:12px;border:1px solid #e5e7eb;margin:8px;border-radius:8px;">
          <img src="data:image/svg+xml;base64,${svgData}" width="120" height="120" />
          <div style="font-size:12px;font-weight:600;margin-top:4px;">${item.itemCode}</div>
          <div style="font-size:10px;color:#6b7280;">${item.itemName}</div>
        </div>
      `
    }).join('')
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><body style="font-family:sans-serif;">${printContent}</body></html>`)
    win.document.close()
    win.print()
  }

  const columns = [
    {
      title: '',
      key: 'select',
      width: 40,
      render: (_: any, record: StockItem) => (
        <Checkbox
          checked={selectedKeys.includes(record.id)}
          onChange={(e) => {
            setSelectedKeys((prev) => e.target.checked ? [...prev, record.id] : prev.filter((k) => k !== record.id))
          }}
        />
      ),
    },
    { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode' },
    { title: 'Item Name', dataIndex: 'itemName', key: 'itemName', ellipsis: true },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
    {
      title: 'QR Preview',
      key: 'qr',
      render: (_: any, record: StockItem) => (
        <QRCodeSVG id={`qr-${record.itemCode}`} value={record.itemCode} size={80} level="M" />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: StockItem) => (
        <Space>
          <Tooltip title="Download PNG">
            <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadQR(record.itemCode)} />
          </Tooltip>
          <Tooltip title="Print">
            <Button
              size="small"
              icon={<PrinterOutlined />}
              onClick={() => {
                setSelectedKeys([record.id])
                setTimeout(printSelected, 100)
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="QR Code Generator"
        subtitle="Generate and print QR codes for stock items"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'QR Code' }]}
      />
      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search item"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>Search</Button>
          <Button icon={<ReloadOutlined />} onClick={() => setSearch('')}>Reset</Button>
          <Button
            icon={<PrinterOutlined />}
            onClick={printSelected}
            disabled={selectedKeys.length === 0}
          >
            Print Selected ({selectedKeys.length})
          </Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 20, showTotal: (t) => `Total ${t} items` }}
          locale={{ emptyText: 'No items' }}
        />
      </Card>
    </div>
  )
}

export default QRCodePage
