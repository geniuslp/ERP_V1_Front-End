import React, { useEffect, useRef, useState } from 'react'
import { Card, Table, Button, Space, Tooltip, Input, Select, Tag, Checkbox, Pagination, Popconfirm, message, Modal, Spin, Grid } from 'antd'
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, QrcodeOutlined, UploadOutlined,
  DownloadOutlined, PrinterOutlined, CloseCircleOutlined, CheckCircleFilled,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Html5Qrcode } from 'html5-qrcode'
import { QRCodeSVG } from 'qrcode.react'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'

const MENU_CODE = 'stock-items'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

type ApiItemType = 'RETURNABLE' | 'CONSUMABLE'

interface ApiStockItem {
  id: number
  mat_code: string
  item_name: string
  description: string | null
  category_id: number | null
  category_name: string | null
  item_type: ApiItemType
  tracking_type: string
  unit: string
  qty: number
  unit_cost: number
  qr_code: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const { useBreakpoint } = Grid

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const MOBILE_PAGE_SIZE = 20

const StockItemListPage: React.FC = () => {
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = screens.md === false
  const [mobilePage, setMobilePage] = useState(1)
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const fileRef = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<ApiStockItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [itemType, setItemType] = useState<ApiItemType | undefined>()
  const [isActive, setIsActive] = useState<boolean | undefined>()

  const [scanModal, setScanModal] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const scannerRef = useRef<any>(null)
  const scanDivId = 'qr-reader'

  const [scanResult, setScanResult] = useState<ApiStockItem | 'not_found' | null>(null)
  const [scanLookupLoading, setScanLookupLoading] = useState(false)

  const [qrItem, setQrItem] = useState<ApiStockItem | null>(null)
  const [qrBulkOpen, setQrBulkOpen] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const selectedItems = data.filter((d) => selectedRowKeys.includes(d.id))

  const downloadQR = (matCode: string, svgId: string) => {
    const svg = document.getElementById(svgId)
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 240
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 240, 240)
      const link = document.createElement('a')
      link.download = `qr-${matCode}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`
  }

  const printItems = (items: ApiStockItem[], idPrefix: string) => {
    const blocks = items.map((item) => {
      const svg = document.getElementById(`${idPrefix}-${item.mat_code}`)
      if (!svg) return ''
      const svgData = btoa(new XMLSerializer().serializeToString(svg))
      return `
        <div style="display:inline-block;text-align:center;padding:12px;border:1px solid #e5e7eb;margin:8px;border-radius:8px;">
          <img src="data:image/svg+xml;base64,${svgData}" width="160" height="160" />
          <div style="font-size:13px;font-weight:600;margin-top:6px;">${item.mat_code}</div>
          <div style="font-size:11px;color:#6b7280;">${item.item_name}</div>
        </div>
      `
    }).join('')
    const win = window.open('', '_blank')
    if (!win) {
      message.error('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ — เบราว์เซอร์บล็อก popup')
      return
    }
    win.document.write(`<html><head><title>QR Code</title></head><body style="font-family:sans-serif;">${blocks}</body></html>`)
    win.document.close()
    win.print()
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/stock/items`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { search: search || undefined, item_type: itemType, is_active: isActive, page_size: 100 },
      })
      const body = res.data?.data
      const raw = Array.isArray(res.data) ? res.data : Array.isArray(body) ? body : body?.data
      setData(Array.isArray(raw) ? raw : [])
    } catch (err: any) {
      setData([])
      message.error(err?.response?.data?.message || err?.message || 'Failed to load stock items')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${BASE_URL}/stock/items/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('Item deleted')
      fetchData()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Delete failed')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await axios.post(`${BASE_URL}/stock/items/import`, formData, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'multipart/form-data' },
      })
      message.success(`Imported ${res.data?.count ?? 0} items`)
      fetchData()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Import failed')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleReset = () => {
    setSearch('')
    setItemType(undefined)
    setIsActive(undefined)
  }

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop()
        scannerRef.current = null
      }
    } catch {}
    setScanning(false)
  }

  const lookupScannedCode = async (code: string) => {
    await stopScanner()
    setScanLookupLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/stock/items`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { search: code, page_size: 5 },
      })
      const body = res.data?.data
      const raw = Array.isArray(res.data) ? res.data : Array.isArray(body) ? body : body?.data
      const items: ApiStockItem[] = Array.isArray(raw) ? raw : []
      const match = items.find((it) => it.mat_code === code || it.qr_code === code) ?? items[0]
      setScanResult(match ?? 'not_found')
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'ค้นหา item ไม่สำเร็จ')
      setScanResult('not_found')
    } finally {
      setScanLookupLoading(false)
    }
  }

  const handleQRDetected = (decodedText: string) => {
    lookupScannedCode(decodedText)
  }

  const startScanner = async () => {
    setScanning(true)
    setScanError(null)
    try {
      const scanner = new Html5Qrcode(scanDivId)
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQRDetected(decodedText)
        },
        undefined
      )
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError' || /permission/i.test(err?.message ?? '')
      setScanError(
        denied
          ? 'ไม่ได้รับอนุญาตให้เข้าถึงกล้อง กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์แล้วลองใหม่อีกครั้ง'
          : 'ไม่สามารถเปิดกล้องได้ — ' + (err?.message ?? err)
      )
      setScanning(false)
    }
  }

  const openScanModal = () => {
    setScanModal(true)
    setScanError(null)
    setScanResult(null)
  }

  const closeScanModal = async () => {
    await stopScanner()
    setScanModal(false)
    setScanResult(null)
  }

  const rescan = () => {
    setScanResult(null)
    setScanError(null)
    setTimeout(() => startScanner(), 300)
  }

  useEffect(() => {
    if (scanModal) {
      setTimeout(() => startScanner(), 300)
    }
    return () => {
      stopScanner()
    }
  }, [scanModal])

  useEffect(() => { fetchData() }, [search, itemType, isActive])

  const columns = [
    {
      title: 'Item Code',
      dataIndex: 'mat_code',
      key: 'mat_code',
      render: (code: string, record: ApiStockItem) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/stock/items/${record.id}/edit`)}>
          {code}
        </a>
      ),
    },
    { title: 'Item Name', dataIndex: 'item_name', key: 'item_name', ellipsis: true },
    {
      title: 'Category',
      dataIndex: 'category_name',
      key: 'category_name',
      render: (val?: string | null) => val || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      render: (val: ApiItemType) => (
        <Tag color={val === 'RETURNABLE' ? 'blue' : 'orange'}>
          {val === 'RETURNABLE' ? 'Returnable' : 'Consumable'}
        </Tag>
      ),
    },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
      render: (val: number) => val?.toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (val: boolean) => <Tag color={val ? 'green' : 'default'}>{val ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_: any, record: ApiStockItem) => (
        <Space>
          <Tooltip title="Edit">
            <PermissionButton menuCode={MENU_CODE} action="edit" size="small" icon={<EditOutlined />} onClick={() => navigate(`/stock/items/${record.id}/edit`)} />
          </Tooltip>
          <Tooltip title="QR Code">
            <Button size="small" icon={<QrcodeOutlined />} onClick={() => setQrItem(record)} />
          </Tooltip>
          <Popconfirm title="Delete this item?" okText="Delete" cancelText="Cancel" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="Delete">
              <PermissionButton menuCode={MENU_CODE} action="delete" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
      <PageHeader
        title="Item Master"
        subtitle="Manage stock item catalog"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'Item Master' }]}
        extra={
          <Space>
            <Button
              icon={<QrcodeOutlined />}
              onClick={openScanModal}
            >
              Scan QR
            </Button>
            <PermissionButton menuCode={MENU_CODE} action="write" icon={<UploadOutlined />} onClick={() => fileRef.current?.click()}>Import Excel</PermissionButton>
            <PermissionButton
              menuCode={MENU_CODE}
              action="write"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/stock/items/create')}
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
            >
              Add Item
            </PermissionButton>
          </Space>
        }
      />
      <Card style={cardStyle}>
        <Space
          direction={isMobile ? 'vertical' : 'horizontal'}
          style={{ marginBottom: 16, width: isMobile ? '100%' : undefined, flexWrap: 'wrap' }}
        >
          <Input
            placeholder="Search item code / name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchData}
            style={isMobile ? { width: '100%' } : { width: 220 }}
            allowClear
          />
          <Select
            placeholder="Item Type"
            value={itemType}
            onChange={setItemType}
            allowClear
            style={isMobile ? { width: '100%' } : { width: 150 }}
            options={[
              { value: 'RETURNABLE', label: 'Returnable' },
              { value: 'CONSUMABLE', label: 'Consumable' },
            ]}
          />
          <Select
            placeholder="Status"
            value={isActive}
            onChange={setIsActive}
            allowClear
            style={isMobile ? { width: '100%' } : { width: 130 }}
            options={[
              { value: true, label: 'Active' },
              { value: false, label: 'Inactive' },
            ]}
          />
          <Button type="primary" block={isMobile} icon={<SearchOutlined />} onClick={fetchData}>Search</Button>
          <Button block={isMobile} icon={<ReloadOutlined />} onClick={handleReset}>Reset</Button>
          {selectedRowKeys.length > 0 && (
            <Button block={isMobile} icon={<QrcodeOutlined />} onClick={() => setQrBulkOpen(true)}>
              สร้าง QR Code ({selectedRowKeys.length})
            </Button>
          )}
        </Space>

        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!loading && data.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>No items found</div>
            )}
            {data
              .slice((mobilePage - 1) * MOBILE_PAGE_SIZE, mobilePage * MOBILE_PAGE_SIZE)
              .map((item) => {
                const isSelected = selectedRowKeys.includes(item.id)
                const toggle = () =>
                  setSelectedRowKeys(
                    isSelected ? selectedRowKeys.filter((k) => k !== item.id) : [...selectedRowKeys, item.id],
                  )
                return (
                  <div
                    key={item.id}
                    style={{
                      ...cardStyle,
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      padding: 14,
                      background: isSelected ? '#eff6ff' : '#fff',
                      border: isSelected ? '1px solid #93c5fd' : '1px solid transparent',
                    }}
                  >
                    <Checkbox checked={isSelected} onChange={toggle} style={{ marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }} onClick={() => navigate(`/stock/items/${item.id}/edit`)}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#2563eb', wordBreak: 'break-all' }}>
                        {item.mat_code}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 13, color: '#1f2937' }}>{item.item_name}</div>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <Tag style={{ fontSize: 11 }}>{item.unit}</Tag>
                        {item.category_name && <Tag style={{ fontSize: 11 }}>{item.category_name}</Tag>}
                        <Tag color={item.item_type === 'RETURNABLE' ? 'blue' : 'orange'} style={{ fontSize: 11 }}>
                          {item.item_type === 'RETURNABLE' ? 'Returnable' : 'Consumable'}
                        </Tag>
                        <Tag color={item.is_active ? 'green' : 'default'} style={{ fontSize: 11 }}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </Tag>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                        Qty: {item.qty?.toLocaleString()}
                      </div>
                    </div>
                    <Space direction="vertical" size={4}>
                      <Tooltip title="Edit">
                        <PermissionButton
                          menuCode={MENU_CODE}
                          action="edit"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => navigate(`/stock/items/${item.id}/edit`)}
                        />
                      </Tooltip>
                      <Tooltip title="QR Code">
                        <Button size="small" icon={<QrcodeOutlined />} onClick={() => setQrItem(item)} />
                      </Tooltip>
                    </Space>
                  </div>
                )
              })}
            {data.length > MOBILE_PAGE_SIZE && (
              <Pagination
                style={{ marginTop: 4, textAlign: 'center' }}
                current={mobilePage}
                pageSize={MOBILE_PAGE_SIZE}
                total={data.length}
                showSizeChanger={false}
                onChange={setMobilePage}
              />
            )}
          </div>
        ) : (
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={data}
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
            pagination={{ pageSize: 20, showTotal: (t) => `Total ${t} items` }}
            locale={{ emptyText: 'No items found' }}
          />
        )}
      </Card>

      <Modal
        title={
          <Space>
            <QrcodeOutlined style={{ color: '#2563eb' }} />
            <span>{scanResult ? 'ผลการสแกน' : 'Scan QR Code'}</span>
          </Space>
        }
        open={scanModal}
        onCancel={closeScanModal}
        footer={null}
        width={380}
        centered
        destroyOnClose
      >
        {scanLookupLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>กำลังค้นหาข้อมูล...</div>
          </div>
        ) : scanResult === 'not_found' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CloseCircleOutlined style={{ fontSize: 40, color: '#dc2626' }} />
            <div style={{ marginTop: 12, fontSize: 15, fontWeight: 600, color: '#dc2626' }}>
              ไม่พบวัสดุนี้ในระบบ Stock
            </div>
            <Button type="primary" style={{ marginTop: 20 }} onClick={rescan}>สแกนใหม่</Button>
          </div>
        ) : scanResult ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <CheckCircleFilled style={{ fontSize: 36, color: '#16a34a' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 10, fontSize: 14 }}>
              <span style={{ color: '#64748b' }}>รหัสวัสดุ</span>
              <span style={{ fontWeight: 600 }}>{scanResult.mat_code}</span>
              <span style={{ color: '#64748b' }}>ชื่อวัสดุ</span>
              <span>{scanResult.item_name}</span>
              <span style={{ color: '#64748b' }}>หมวดหมู่</span>
              <span>{scanResult.category_name || '—'}</span>
              <span style={{ color: '#64748b' }}>หน่วย</span>
              <span>{scanResult.unit}</span>
              <span style={{ color: '#64748b' }}>จำนวนคงเหลือ</span>
              <span>{scanResult.qty?.toLocaleString()}</span>
              <span style={{ color: '#64748b' }}>ราคาต่อหน่วย</span>
              <span>{scanResult.unit_cost?.toLocaleString()}</span>
            </div>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Button onClick={rescan}>สแกนใหม่</Button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div
              id={scanDivId}
              style={{
                width: '100%',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#000',
                minHeight: 280,
              }}
            />

            {scanError && (
              <div style={{
                marginTop: 12,
                padding: '8px 12px',
                background: '#fef2f2',
                border: '0.5px solid #fecaca',
                borderRadius: 8,
                color: '#dc2626',
                fontSize: 13,
              }}>
                {scanError}
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>
              {scanning
                ? '🎥 กล้องกำลังทำงาน — นำ QR Code เข้ามาในกรอบ'
                : scanError
                ? 'กล้องไม่พร้อมใช้งาน'
                : 'กำลังเปิดกล้อง...'}
            </div>

            <Button
              style={{ marginTop: 16 }}
              onClick={closeScanModal}
            >
              Cancel
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <QrcodeOutlined style={{ color: '#2563eb' }} />
            <span>QR Code</span>
          </Space>
        }
        open={!!qrItem}
        onCancel={() => setQrItem(null)}
        footer={null}
        width={320}
        centered
        destroyOnClose
      >
        {qrItem && (
          <div style={{ textAlign: 'center' }}>
            <QRCodeSVG id={`qr-single-${qrItem.mat_code}`} value={qrItem.mat_code} size={200} level="M" />
            <div style={{ marginTop: 12, fontWeight: 600 }}>{qrItem.mat_code}</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>{qrItem.item_name}</div>
            <Space style={{ marginTop: 16 }}>
              <Button icon={<DownloadOutlined />} onClick={() => downloadQR(qrItem.mat_code, `qr-single-${qrItem.mat_code}`)}>
                บันทึกรูปภาพ
              </Button>
              <Button icon={<PrinterOutlined />} onClick={() => printItems([qrItem], 'qr-single')}>
                พิมพ์
              </Button>
            </Space>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <QrcodeOutlined style={{ color: '#2563eb' }} />
            <span>สร้าง QR Code ({selectedItems.length} รายการ)</span>
          </Space>
        }
        open={qrBulkOpen}
        onCancel={() => setQrBulkOpen(false)}
        footer={null}
        width={720}
        centered
        destroyOnClose
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxHeight: '60vh', overflowY: 'auto' }}>
          {selectedItems.map((item) => (
            <div key={item.id} style={{ textAlign: 'center', padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, width: 160 }}>
              <QRCodeSVG id={`qr-bulk-${item.mat_code}`} value={item.mat_code} size={120} level="M" />
              <div style={{ marginTop: 8, fontWeight: 600, fontSize: 12 }}>{item.mat_code}</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>{item.item_name}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => printItems(selectedItems, 'qr-bulk')}>
            พิมพ์ทั้งหมด
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default StockItemListPage
