import React, { useCallback, useEffect, useState } from 'react'
import { Card, Table, Space, Input, Select, Tag, Upload, Typography, Button, message, Descriptions, Modal } from 'antd'
import type { UploadProps } from 'antd'
import { InboxOutlined, CheckCircleOutlined, CloseCircleOutlined, PlusOutlined, SaveOutlined, DownloadOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import PermissionGate from '@/components/permission/PermissionGate'
import { useAppSelector } from '@/store'
import { stockService } from '@/services/stock.service'
import type { BulkPreviewRow, BulkPreviewSummary } from '@/services/stock.service'
import type { StockItem, StockCategory, StockImportResult, StockItemType, StockTrackingType } from '@/types'

const { Text, Title } = Typography

const MENU_CODE = 'master-stock'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}
const panelHead: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16,
}

interface PendingRow {
  rowKey: string
  matCode: string
  itemName: string
  description: string
  unit: string
  qty: string
  unitCost: string
  categoryId: string
  itemType: StockItemType
  trackingType: StockTrackingType
}

const newRow = (): PendingRow => ({
  rowKey: `${Date.now()}${Math.random()}`,
  matCode: '', itemName: '', description: '',
  unit: '', qty: '', unitCost: '',
  categoryId: '', itemType: 'CONSUMABLE', trackingType: 'sku',
})

interface RowSaveResult { rowKey: string; matCode: string; ok: boolean; error?: string }

interface LocalParsedRow {
  row: number
  unit: string
  qty: string
  unitCost: string
}

type MergedPreviewRow = BulkPreviewRow & { unit?: string; qty?: string; unitCost?: string }

const statusTag = (status: BulkPreviewRow['status']) => {
  if (status === 'ok') return <Tag color="success">พร้อมนำเข้า</Tag>
  if (status === 'name_mismatch') return <Tag color="warning">ชื่อไม่ตรง</Tag>
  return <Tag color="error">ไม่พบรหัสวัสดุ</Tag>
}

// Local, cosmetic-only parse used solely to pull unit/qty/cost for display in the
// preview table — the backend preview endpoint doesn't echo these back, only
// match-check fields. The backend import handler remains the source of truth for
// what actually gets persisted.
// Header is always 3 rows; real data starts at row 4 (0-indexed row 3).
// Col C(2)=item_name, D(3)=qty, E(4)=unit, G(6)=mat_code, J(9)=unit_cost.
const parseStockImportFileLocal = (file: File): Promise<LocalParsedRow[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const ab = e.target?.result as ArrayBuffer
        const wb = XLSX.read(ab, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        // raw: false forces sheet_to_json to read the FORMATTED display text (cell.w)
        // instead of the raw stored value (cell.v). mat_code cells are numbers with a
        // custom format like "PG"0000000000000000 — reading raw would give the bare
        // number without the "PG" prefix and leading zeros, silently corrupting the code.
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
        const dataRows = rows.slice(3)
        const parsed: LocalParsedRow[] = []
        dataRows.forEach((r, idx) => {
          const itemName = String(r[2] ?? '').trim()
          const qty = String(r[3] ?? '').trim()
          const unit = String(r[4] ?? '').trim()
          const matCode = String(r[6] ?? '').trim()
          const unitCost = String(r[9] ?? '').trim()

          if (!matCode && !itemName) return // trailing blank row — skip entirely

          parsed.push({ row: idx + 4, unit, qty, unitCost })
        })
        resolve(parsed)
      } catch {
        reject(new Error('อ่านไฟล์ไม่ได้'))
      }
    }
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'))
    reader.readAsArrayBuffer(file)
  })

const downloadTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['CODE', 'DESCRIPTION', 'UNIT', "Q'TY", 'MATERIAL COST'],
    ['MAT001', 'เหล็กแผ่น SS400', 'แผ่น', 10, 450],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Stock')
  XLSX.writeFile(wb, 'stock_import_template.xlsx')
}

const StockListPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<StockItem[]>([])
  const [categories, setCategories] = useState<StockCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [pendingRows, setPendingRows] = useState<PendingRow[]>([newRow()])
  const [submitting, setSubmitting] = useState(false)
  const [saveResults, setSaveResults] = useState<RowSaveResult[]>([])

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<StockImportResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewRows, setPreviewRows] = useState<MergedPreviewRow[] | null>(null)
  const [previewSummary, setPreviewSummary] = useState<BulkPreviewSummary | null>(null)
  const [previewFilter, setPreviewFilter] = useState<'all' | 'ok' | 'errors'>('all')
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([])
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const fetchItems = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const result = await stockService.listItems(accessToken, { search, page, pageSize })
      setData(result.items)
      setTotal(result.total)
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'โหลดข้อมูลพัสดุไม่สำเร็จ'
      message.error(errMsg)
    } finally {
      setLoading(false)
    }
  }, [accessToken, search, page, pageSize])

  useEffect(() => {
    if (!accessToken) return
    const fetchCategories = async () => {
      try {
        const list = await stockService.listCategories(accessToken)
        setCategories(list)
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'โหลดหมวดหมู่ไม่สำเร็จ'
        message.error(errMsg)
      }
    }
    fetchCategories()
  }, [accessToken])

  useEffect(() => { fetchItems() }, [fetchItems])

  const categoryOptions = categories.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))

  const updateRow = (rowKey: string, field: keyof PendingRow, val: string) =>
    setPendingRows((p) => p.map((r) => r.rowKey === rowKey ? { ...r, [field]: val } : r))
  const removeRow = (rowKey: string) => setPendingRows((p) => p.filter((r) => r.rowKey !== rowKey))

  const handleSubmitAll = async () => {
    if (!accessToken) return
    const invalid = pendingRows.some((r) => !r.matCode || !r.itemName || !r.categoryId || !r.unit)
    if (invalid) { message.warning('กรุณากรอกข้อมูลที่จำเป็น (รหัสวัสดุ, ชื่อ Item, หมวดหมู่, หน่วยนับ) ให้ครบทุกแถว'); return }

    setSubmitting(true)
    setSaveResults([])
    const results: RowSaveResult[] = []
    for (const row of pendingRows) {
      try {
        await stockService.createItem(accessToken, {
          matCode: row.matCode,
          itemName: row.itemName,
          description: row.description.trim() || undefined,
          categoryId: row.categoryId,
          itemType: row.itemType,
          trackingType: row.trackingType,
          unit: row.unit,
          unitCost: Number(row.unitCost) || 0,
          qty: Number(row.qty) || 0,
        })
        results.push({ rowKey: row.rowKey, matCode: row.matCode, ok: true })
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'บันทึกไม่สำเร็จ'
        results.push({ rowKey: row.rowKey, matCode: row.matCode, ok: false, error: errMsg })
      }
    }
    setSaveResults(results)
    setSubmitting(false)

    const failed = results.filter((r) => !r.ok)
    const succeeded = results.filter((r) => r.ok)
    if (failed.length === 0) {
      message.success(`บันทึกสำเร็จ ${succeeded.length} รายการ`)
      setPendingRows([newRow()])
    } else {
      message.warning(`บันทึกสำเร็จ ${succeeded.length} รายการ, ไม่สำเร็จ ${failed.length} รายการ — แก้ไขแถวที่ผิดพลาดแล้วลองใหม่`)
      // keep only the failed rows in the form so the user can fix and retry
      setPendingRows(pendingRows.filter((r) => failed.some((f) => f.rowKey === r.rowKey)))
    }
    if (succeeded.length > 0) await fetchItems()
  }

  const handleUpload: UploadProps['beforeUpload'] = (file) => {
    if (!accessToken) return false
    setImportResult(null)
    setPreviewFilter('all')
    setPreviewLoading(true)
    const doPreview = async () => {
      try {
        const [result, localRows] = await Promise.all([
          stockService.previewImport(accessToken, file),
          parseStockImportFileLocal(file),
        ])
        const localByRow = new Map(localRows.map((r) => [r.row, r]))
        const merged: MergedPreviewRow[] = result.rows.map((r) => {
          const local = localByRow.get(r.row_no)
          return { ...r, unit: local?.unit, qty: local?.qty, unitCost: local?.unitCost }
        })
        setPreviewRows(merged)
        setPreviewSummary(result.summary)
        setExpandedRowKeys(merged.filter((r) => r.status !== 'ok').map((r) => r.row_no))
        setPendingFile(file)
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'ตรวจสอบไฟล์ไม่สำเร็จ'
        message.error(errMsg)
      } finally {
        setPreviewLoading(false)
      }
    }
    doPreview()
    return false
  }

  const handleCancelPreview = () => {
    setPreviewRows(null)
    setPreviewSummary(null)
    setPreviewFilter('all')
    setExpandedRowKeys([])
    setPendingFile(null)
  }

  const doConfirmImport = async () => {
    if (!accessToken || !pendingFile) return
    setImporting(true)
    try {
      const result = await stockService.importExcel(accessToken, pendingFile)
      setImportResult(result)
      if (result.failedCount === 0) message.success(`นำเข้าสำเร็จ ${result.successCount} รายการ`)
      setPreviewRows(null)
      setPreviewSummary(null)
      setPendingFile(null)
      await fetchItems()
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'นำเข้าข้อมูลไม่สำเร็จ'
      message.error(errMsg)
    } finally {
      setImporting(false)
    }
  }

  const handleConfirmImport = () => {
    const problemCount = previewRows?.filter((r) => r.status !== 'ok').length ?? 0
    if (problemCount > 0) {
      Modal.confirm({
        title: 'นำเข้าต่อหรือไม่?',
        icon: <ExclamationCircleFilled style={{ color: '#d97706' }} />,
        content: `พบ ${problemCount} รายการที่มีปัญหา (ไม่พบรหัสวัสดุ หรือ ชื่อไม่ตรง) ต้องการนำเข้าต่อหรือไม่?`,
        okText: 'นำเข้าต่อ',
        cancelText: 'ยกเลิก',
        onOk: doConfirmImport,
      })
    } else {
      doConfirmImport()
    }
  }

  const columns = [
    {
      title: 'รหัสวัสดุ', dataIndex: 'matCode', key: 'matCode', width: 140,
      render: (v: string) => <Text style={{ color: '#2563eb', fontWeight: 600 }}>{v}</Text>,
    },
    { title: 'ชื่อ Item', dataIndex: 'itemName', key: 'itemName', align: 'center' as const },
    {
      title: 'ประเภท', dataIndex: 'itemType', key: 'itemType', width: 130,
      render: (v: StockItem['itemType']) => (
        <Tag color={v === 'RETURNABLE' ? 'blue' : 'orange'}>{v === 'RETURNABLE' ? 'Returnable' : 'Consumable'}</Tag>
      ),
    },
    { title: 'หน่วยนับ', dataIndex: 'unit', key: 'unit', width: 100 },
    {
      title: 'ราคาต้นทุนต่อหน่วย', dataIndex: 'unitCost', key: 'unitCost', width: 150, align: 'right' as const,
      render: (v: number) => v.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    { title: 'จำนวนคงเหลือ', dataIndex: 'qty', key: 'qty', width: 110, align: 'right' as const },
    {
      title: 'สถานะ', dataIndex: 'isActive', key: 'isActive', width: 100,
      render: (v: boolean) => <Tag color={v ? 'success' : 'error'}>{v ? 'ใช้งาน' : 'ปิด'}</Tag>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="ข้อมูลพัสดุ (Stock)"
        subtitle="รายการพัสดุหลัก ค้นหา เพิ่มรายการ และนำเข้าจากไฟล์ Excel"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'พัสดุ (Stock)' }]}
      />

      {/* list */}
      <Card style={{ ...cardStyle, marginBottom: 20 }}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="ค้นหารหัสวัสดุ / ชื่อ Item"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            allowClear
            style={{ width: 240 }}
          />
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          scroll={{ x: 1000 }}
          className="stock-list-table"
        />
      </Card>

      {/* manual add rows */}
      <Card style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={panelHead}>
          <div>
            <Title level={5} style={{ margin: 0 }}>เพิ่มรายการใหม่</Title>
            <Text style={{ fontSize: 12, color: '#9ca3af' }}>กรอกได้หลายรายการ แล้วกด "บันทึกทั้งหมด"</Text>
          </div>
          <Button icon={<PlusOutlined />} onClick={() => setPendingRows((p) => [...p, newRow()])}>เพิ่มแถว</Button>
        </div>

        {pendingRows.map((row, idx) => {
          const result = saveResults.find((r) => r.rowKey === row.rowKey)
          return (
            <div key={row.rowKey} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 8, background: result && !result.ok ? '#fff1f0' : '#fff' }}>
              <Space wrap style={{ width: '100%' }} size={10}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {idx + 1}
                </div>
                <Input placeholder="รหัสวัสดุ*" size="small" style={{ width: 130 }} value={row.matCode} onChange={(e) => updateRow(row.rowKey, 'matCode', e.target.value)} />
                <Input placeholder="ชื่อ Item*" size="small" style={{ width: 200 }} value={row.itemName} onChange={(e) => updateRow(row.rowKey, 'itemName', e.target.value)} />
                <Input placeholder="คำอธิบาย" size="small" style={{ width: 180 }} value={row.description} onChange={(e) => updateRow(row.rowKey, 'description', e.target.value)} />
                <Input placeholder="หน่วยนับ*" size="small" style={{ width: 90 }} value={row.unit} onChange={(e) => updateRow(row.rowKey, 'unit', e.target.value)} />
                <Input placeholder="จำนวนคงเหลือ" size="small" style={{ width: 100 }} value={row.qty} onChange={(e) => updateRow(row.rowKey, 'qty', e.target.value)} />
                <Input placeholder="ราคาต้นทุน" size="small" style={{ width: 100 }} value={row.unitCost} onChange={(e) => updateRow(row.rowKey, 'unitCost', e.target.value)} />
                {pendingRows.length > 1 && (
                  <Button size="small" danger type="text" onClick={() => removeRow(row.rowKey)}>ลบ</Button>
                )}
              </Space>

              <div style={{ fontSize: 11, color: '#9ca3af', margin: '10px 0 6px', paddingTop: 8, borderTop: '1px dashed #e5e7eb' }}>
                ข้อมูลเพิ่มเติม (ไม่มีในไฟล์ Excel)
              </div>
              <Space wrap size={10}>
                <Select
                  placeholder="หมวดหมู่*" size="small" style={{ width: 170 }}
                  options={categoryOptions} value={row.categoryId || undefined}
                  onChange={(v) => updateRow(row.rowKey, 'categoryId', v)}
                />
                <Select
                  size="small" style={{ width: 130 }} value={row.itemType}
                  options={[{ value: 'RETURNABLE', label: 'Returnable' }, { value: 'CONSUMABLE', label: 'Consumable' }]}
                  onChange={(v) => updateRow(row.rowKey, 'itemType', v)}
                />
                <Select
                  size="small" style={{ width: 110 }} value={row.trackingType}
                  options={[{ value: 'sku', label: 'SKU' }, { value: 'serial', label: 'Serial' }]}
                  onChange={(v) => updateRow(row.rowKey, 'trackingType', v)}
                />
              </Space>
              {result && !result.ok && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#cf1322' }}>{result.error}</div>
              )}
            </div>
          )
        })}

        <Button block type="dashed" icon={<PlusOutlined />} style={{ marginTop: 4, marginBottom: 16 }}
          onClick={() => setPendingRows((p) => [...p, newRow()])}>
          + เพิ่มแถวใหม่
        </Button>

        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={() => { setPendingRows([newRow()]); setSaveResults([]) }}>ล้างทั้งหมด</Button>
          <PermissionButton
            menuCode={MENU_CODE} action="write"
            type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSubmitAll}
            style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', border: 'none' }}
          >
            บันทึกทั้งหมด ({pendingRows.length} รายการ)
          </PermissionButton>
        </Space>
      </Card>

      {/* excel import */}
      <Card style={cardStyle}>
        <div style={panelHead}>
          <div>
            <Title level={5} style={{ margin: 0 }}>อัปโหลดไฟล์เพื่ออัปเดตข้อมูล</Title>
            <Text style={{ fontSize: 12, color: '#9ca3af' }}>นำเข้าข้อมูลพัสดุจากไฟล์ Excel หรือ CSV ได้ครั้งละหลายรายการ</Text>
          </div>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>ดาวน์โหลด Template (.xlsx)</Button>
        </div>

        <PermissionGate menuCode={MENU_CODE} action="write">
          <Upload.Dragger
            name="file"
            accept=".csv,.xlsx,.xls"
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={importing || !!previewRows}
          >
            <div style={{ padding: '16px 0' }}>
              <p style={{ fontSize: 36, color: '#9ca3af', margin: 0 }}><InboxOutlined /></p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '6px 0 2px' }}>
                {importing ? 'กำลังนำเข้า...' : 'คลิกหรือลากไฟล์มาวางที่นี่'}
              </p>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                รองรับไฟล์ <Text code>.xlsx</Text> <Text code>.xls</Text> <Text code>.csv</Text>
              </p>
            </div>
          </Upload.Dragger>
        </PermissionGate>

        {previewRows && (
          <div style={{ marginTop: 16 }}>
            <Space style={{ marginBottom: 10 }}>
              <Text strong>ตัวอย่างข้อมูลก่อนนำเข้า ({previewRows.length} แถว)</Text>
            </Space>
            {previewSummary && (
              <Space style={{ marginBottom: 10, display: 'flex' }}>
                <Tag
                  color={previewFilter === 'all' ? 'blue' : 'default'}
                  style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
                  onClick={() => setPreviewFilter('all')}
                >
                  ทั้งหมด: {previewSummary.total}
                </Tag>
                <Tag
                  color={previewFilter === 'ok' ? 'green' : 'default'}
                  style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
                  onClick={() => setPreviewFilter('ok')}
                >
                  พร้อมนำเข้า: {previewSummary.ok}
                </Tag>
                <Tag
                  color={previewFilter === 'errors' ? 'red' : 'default'}
                  style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
                  onClick={() => setPreviewFilter('errors')}
                >
                  มีปัญหา: {previewSummary.code_not_found + previewSummary.name_mismatch}
                </Tag>
              </Space>
            )}
            <Table
              size="small"
              rowKey="row_no"
              loading={previewLoading}
              dataSource={previewRows.filter((r) => {
                if (previewFilter === 'ok') return r.status === 'ok'
                if (previewFilter === 'errors') return r.status !== 'ok'
                return true
              })}
              pagination={{ pageSize: 20 }}
              scroll={{ x: 700 }}
              onRow={(r) => ({
                style: r.status === 'ok' ? undefined : { background: 'rgba(220,38,38,0.08)' },
              })}
              expandable={{
                expandedRowKeys,
                onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as React.Key[]),
                expandedRowRender: (r: MergedPreviewRow) => (
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 280px', minWidth: 280 }}>
                      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#6b7280' }}>
                        จากไฟล์ (From File)
                      </Text>
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="ชื่อ Item">{r.file_name || '—'}</Descriptions.Item>
                        <Descriptions.Item label="รหัสวัสดุ">{r.mat_code || '—'}</Descriptions.Item>
                        {r.unit && <Descriptions.Item label="หน่วยนับ">{r.unit}</Descriptions.Item>}
                        {(r.qty || r.unitCost) && (
                          <Descriptions.Item label="จำนวน / ราคาต้นทุน">
                            {[r.qty, r.unitCost].filter(Boolean).join(' / ')}
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                    </div>
                    <div style={{ flex: '1 1 280px', minWidth: 280 }}>
                      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#6b7280' }}>
                        จาก Master (From Database)
                      </Text>
                      {r.master ? (
                        <Descriptions column={2} size="small" bordered>
                          <Descriptions.Item label="รหัสวัสดุ">{r.master.mat_code || '—'}</Descriptions.Item>
                          <Descriptions.Item label="กลุ่ม">{r.master.group_name || '—'}</Descriptions.Item>
                          <Descriptions.Item label="กลุ่มย่อย">{r.master.subgroup_name || '—'}</Descriptions.Item>
                          <Descriptions.Item label="ชื่อวัสดุ">{r.master.mat_name || '—'}</Descriptions.Item>
                          <Descriptions.Item label="Spec">{r.master.spec_description || '—'}</Descriptions.Item>
                          <Descriptions.Item label="ยี่ห้อ">{r.master.brand_name || '—'}</Descriptions.Item>
                          <Descriptions.Item label="หน่วยนับ">{r.master.unit_name || '—'}</Descriptions.Item>
                        </Descriptions>
                      ) : (
                        <Text type="secondary">ไม่พบข้อมูลในระบบ</Text>
                      )}
                    </div>
                  </div>
                ),
              }}
              columns={[
                { title: 'แถวที่', dataIndex: 'row_no', key: 'row_no', width: 80 },
                {
                  title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code', width: 260,
                  render: (v: string, r: MergedPreviewRow) => {
                    const masterCode = r.master?.mat_code ?? null
                    const codeMismatch = r.code_found && masterCode != null && masterCode !== v
                    return (
                      <div style={codeMismatch ? { background: 'rgba(220,38,38,0.08)', borderRadius: 4, padding: '2px 4px' } : undefined}>
                        <div style={{ fontSize: 13 }}>
                          รหัสจากไฟล์: {v || <Text type="danger">—</Text>}
                        </div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                          รหัสใน Master: {masterCode ?? '— ไม่พบ —'}
                        </div>
                      </div>
                    )
                  },
                },
                {
                  title: 'ชื่อ Item', dataIndex: 'file_name', key: 'file_name', ellipsis: true,
                  render: (v: string) => v || <Text type="danger">—</Text>,
                },
                {
                  title: 'สถานะ', dataIndex: 'status', key: 'status', width: 150,
                  render: (status: BulkPreviewRow['status']) => statusTag(status),
                },
              ]}
            />
            <Space style={{ marginTop: 12, justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={handleCancelPreview} disabled={importing}>ยกเลิก</Button>
              <PermissionButton
                menuCode={MENU_CODE} action="write"
                type="primary" loading={importing}
                onClick={handleConfirmImport}
                style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', border: 'none' }}
              >
                ยืนยันนำเข้า
              </PermissionButton>
            </Space>
          </div>
        )}

        {importResult && (
          <div style={{ marginTop: 16 }}>
            <Space style={{ marginBottom: 10 }} wrap>
              <Tag color="success" icon={<CheckCircleOutlined />}>สำเร็จ {importResult.successCount} รายการ</Tag>
              {importResult.failedCount > 0 && (
                <Tag color="error" icon={<CloseCircleOutlined />}>ไม่สำเร็จ {importResult.failedCount} รายการ</Tag>
              )}
            </Space>

            {importResult.errors.length > 0 && (
              <Table
                size="small"
                dataSource={importResult.errors.map((e, i) => ({ ...e, key: i }))}
                pagination={false}
                columns={[
                  { title: 'แถวที่', dataIndex: 'row', key: 'row', width: 80 },
                  { title: 'ข้อผิดพลาด', dataIndex: 'message', key: 'message' },
                ]}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

export default StockListPage
