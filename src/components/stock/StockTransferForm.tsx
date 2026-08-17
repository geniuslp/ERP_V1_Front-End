import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Button, Table, Select, InputNumber, Checkbox, message } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import WarehouseStockItemPickerModal from '@/components/stock/WarehouseStockItemPickerModal'
import { useAppSelector } from '@/store'
import { stockTransferService } from '@/services/stockTransfer.service'
import type { StockTransferLine, StockTransferType } from '@/types/stockTransfer'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

interface Props {
  transferType: StockTransferType
  menuCode: string
  title: string
  breadcrumbLabel: string
  listPath: string
  detailPathPrefix: string
}

const StockTransferForm: React.FC<Props> = ({ transferType, menuCode, title, breadcrumbLabel, listPath, detailPathPrefix }) => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [saving, setSaving] = useState(false)

  const [fromWarehouseCode, setFromWarehouseCode] = useState<string | undefined>()
  const [toWarehouseCode, setToWarehouseCode] = useState<string | undefined>()
  const [toProjectCode, setToProjectCode] = useState<string | undefined>()
  const [purpose, setPurpose] = useState('')
  const [isStockHouse, setIsStockHouse] = useState(false)
  const [containerNo, setContainerNo] = useState('')
  const [containerNoError, setContainerNoError] = useState<string | undefined>()

  const [warehouseOptions, setWarehouseOptions] = useState<{ value: string; label: string }[]>([])
  const [warehousesLoading, setWarehousesLoading] = useState(false)
  const [projectOptions, setProjectOptions] = useState<{ value: string; label: string }[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)

  const [lines, setLines] = useState<StockTransferLine[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    const fetchWarehouses = async () => {
      setWarehousesLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/warehouses`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { is_active: true },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setWarehouseOptions(list.map((w: any) => ({
          value: w.warehouse_code,
          label: w.warehouse_name ? `${w.warehouse_code} — ${w.warehouse_name}` : w.warehouse_code,
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลคลังสินค้าไม่สำเร็จ')
      } finally {
        setWarehousesLoading(false)
      }
    }
    fetchWarehouses()
  }, [accessToken])

  useEffect(() => {
    if (transferType !== 'WH_TO_PROJECT') return
    const fetchProjects = async () => {
      setProjectsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/projects`, { headers: { Authorization: `Bearer ${accessToken}` } })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setProjectOptions(list.map((p: any) => ({
          value: p.project_code,
          label: p.project_code ? `${p.project_code} — ${p.project_name ?? p.name ?? ''}` : (p.project_name ?? String(p.id)),
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลโครงการไม่สำเร็จ')
        setProjectOptions([])
      } finally {
        setProjectsLoading(false)
      }
    }
    fetchProjects()
  }, [accessToken, transferType])

  // WarehouseStockItemPickerModal queries /stock-items scoped by warehouse_code directly,
  // so every row it returns already has a real stock_item id + qty_on_hand at
  // fromWarehouseCode — no separate per-material resolve step needed, and no risk of
  // picking a material that has zero stock (or no stock_item row at all) at this warehouse.
  const handlePickerConfirm = (newLines: StockTransferLine[]) => {
    setLines((prev) => [...prev, ...newLines.filter((n) => !prev.some((l) => l.mat_code === n.mat_code))])
  }

  const removeLine = (matCode: string) => setLines((prev) => prev.filter((l) => l.mat_code !== matCode))

  const updateLine = (matCode: string, field: 'qty_requested' | 'remarks', value: number | string | null) => {
    setLines((prev) => prev.map((l) => (l.mat_code === matCode ? { ...l, [field]: value } : l)))
  }

  const handleSave = async () => {
    if (!fromWarehouseCode) {
      message.warning('กรุณาเลือกคลังต้นทาง')
      return
    }
    if (transferType === 'WH_TO_WH') {
      if (!toWarehouseCode) {
        message.warning('กรุณาเลือกคลังปลายทาง')
        return
      }
      if (toWarehouseCode === fromWarehouseCode) {
        message.warning('คลังต้นทางและปลายทางต้องไม่ใช่คลังเดียวกัน')
        return
      }
    }
    if (transferType === 'WH_TO_PROJECT' && !toProjectCode) {
      message.warning('กรุณาเลือกโครงการปลายทาง')
      return
    }
    if (lines.length === 0) {
      message.warning('กรุณาเพิ่มรายการวัสดุอย่างน้อย 1 รายการ')
      return
    }
    if (lines.some((l) => l.qty_requested <= 0)) {
      message.warning('จำนวนที่เบิกต้องมากกว่า 0')
      return
    }
    if (lines.some((l) => l.qty_on_hand != null && l.qty_requested > l.qty_on_hand)) {
      message.warning('มีรายการที่จำนวนเบิกเกินจำนวนคงเหลือในคลัง')
      return
    }
    if (isStockHouse && !containerNo.trim()) {
      setContainerNoError('กรุณากรอกหมายเลขตู้')
      message.warning('กรุณากรอกหมายเลขตู้ Container')
      return
    }
    setContainerNoError(undefined)

    setSaving(true)
    try {
      const result = await stockTransferService.create(accessToken!, {
        transfer_type: transferType,
        from_warehouse_code: fromWarehouseCode,
        to_warehouse_code: transferType === 'WH_TO_WH' ? toWarehouseCode : undefined,
        to_project_code: transferType === 'WH_TO_PROJECT' ? toProjectCode : undefined,
        purpose: purpose || undefined,
        is_stock_house: isStockHouse,
        container_no: isStockHouse ? containerNo.trim() : null,
        lines: lines.map((l) => ({
          item_id: l.item_id,
          mat_code: l.mat_code,
          unit: l.unit,
          qty_requested: l.qty_requested,
          remarks: l.remarks || undefined,
        })),
      })
      message.success('บันทึกร่างสำเร็จ')
      navigate(`${detailPathPrefix}/${result.transfer_id}`)
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'บันทึกไม่สำเร็จ'
      if (isStockHouse && /container/i.test(errMsg)) {
        setContainerNoError(errMsg)
      }
      message.error(errMsg)
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: 'ลบ', key: 'delete', width: 50,
      render: (_: unknown, record: StockTransferLine) => (
        <Button danger size="small" icon={<DeleteOutlined />} onClick={() => removeLine(record.mat_code)} />
      ),
    },
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'ชื่อวัสดุ', dataIndex: 'item_name', key: 'item_name', ellipsis: true },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 90 },
    {
      title: 'คงเหลือในคลัง', dataIndex: 'qty_on_hand', key: 'qty_on_hand', align: 'right' as const,
      render: (v?: number) => (v ?? 0).toLocaleString(),
    },
    {
      title: 'จำนวนที่เบิก', key: 'qty_requested', align: 'right' as const,
      render: (_: unknown, record: StockTransferLine) => (
        <InputNumber
          min={1}
          max={record.qty_on_hand}
          value={record.qty_requested}
          onChange={(val) => updateLine(record.mat_code, 'qty_requested', val ?? 1)}
          style={{ width: 100 }}
          status={record.qty_on_hand != null && record.qty_requested > record.qty_on_hand ? 'error' : undefined}
        />
      ),
    },
    {
      title: 'หมายเหตุ', key: 'remarks',
      render: (_: unknown, record: StockTransferLine) => (
        <Input
          value={record.remarks}
          onChange={(e) => updateLine(record.mat_code, 'remarks', e.target.value)}
          placeholder="หมายเหตุ"
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="สร้างรายการใหม่"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: breadcrumbLabel }, { title: 'สร้าง' }]}
        extra={<Button onClick={() => navigate(listPath)}>ยกเลิก</Button>}
      />

      <Card title="ข้อมูลทั่วไป" style={cardStyle}>
        <Form layout="vertical">
          <Form.Item label="คลังต้นทาง" required>
            <Select
              value={fromWarehouseCode}
              onChange={(v) => { setFromWarehouseCode(v); setLines([]) }}
              options={warehouseOptions}
              loading={warehousesLoading}
              disabled={lines.length > 0}
              style={{ width: 260 }}
              placeholder="เลือกคลังต้นทาง"
            />
            {lines.length > 0 && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                ไม่สามารถเปลี่ยนคลังได้เมื่อมีรายการวัสดุแล้ว — กรุณาลบรายการทั้งหมดก่อนหากต้องการเปลี่ยนคลัง
              </div>
            )}
          </Form.Item>

          {transferType === 'WH_TO_WH' && (
            <Form.Item label="คลังปลายทาง" required>
              <Select
                value={toWarehouseCode}
                onChange={setToWarehouseCode}
                options={warehouseOptions.filter((o) => o.value !== fromWarehouseCode)}
                loading={warehousesLoading}
                style={{ width: 260 }}
                placeholder="เลือกคลังปลายทาง"
              />
            </Form.Item>
          )}

          {transferType === 'WH_TO_PROJECT' && (
            <Form.Item label="โครงการปลายทาง" required>
              <Select
                value={toProjectCode}
                onChange={setToProjectCode}
                options={projectOptions}
                loading={projectsLoading}
                showSearch
                filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                style={{ width: 320 }}
                placeholder="เลือกโครงการ"
              />
            </Form.Item>
          )}

          {transferType === 'WH_TO_PROJECT' && (
            <Form.Item>
              <Checkbox
                checked={isStockHouse}
                onChange={(e) => {
                  setIsStockHouse(e.target.checked)
                  if (!e.target.checked) {
                    setContainerNo('')
                    setContainerNoError(undefined)
                  }
                }}
              >
                ส่งเป็น Stock House (ตู้ Container) ที่หน้างาน
              </Checkbox>

              {isStockHouse && (
                <div style={{ marginTop: 12, maxWidth: 320 }}>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: '#dc2626' }}>*</span> หมายเลขตู้ Container
                  </div>
                  <Input
                    placeholder="เช่น TCLU1234567"
                    value={containerNo}
                    onChange={(e) => {
                      setContainerNo(e.target.value)
                      if (containerNoError) setContainerNoError(undefined)
                    }}
                    status={containerNoError ? 'error' : undefined}
                  />
                  {containerNoError && (
                    <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{containerNoError}</div>
                  )}
                </div>
              )}
            </Form.Item>
          )}

          <Form.Item label="วัตถุประสงค์ / หมายเหตุ">
            <Input.TextArea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </Form.Item>
        </Form>
      </Card>

      <Card title="รายการวัสดุ" style={cardStyle}>
        <Button
          icon={<PlusOutlined />}
          disabled={!fromWarehouseCode}
          onClick={() => setPickerOpen(true)}
          style={{ marginBottom: 16 }}
          title={!fromWarehouseCode ? 'เลือกคลังต้นทางก่อน' : undefined}
        >
          {fromWarehouseCode ? 'เลือกรายการวัสดุ' : 'กรุณาเลือกคลังต้นทางก่อน'}
        </Button>
        <Table
          rowKey="mat_code"
          dataSource={lines}
          columns={columns}
          pagination={false}
          locale={{ emptyText: 'ยังไม่มีรายการวัสดุ — เลือกเพื่อเพิ่ม' }}
        />
      </Card>

      <WarehouseStockItemPickerModal
        open={pickerOpen}
        warehouseCode={fromWarehouseCode || ''}
        excludeMatCodes={lines.map((l) => l.mat_code)}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerConfirm}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={() => navigate(listPath)}>ยกเลิก</Button>
        <PermissionButton
          menuCode={menuCode}
          action="write"
          type="primary"
          loading={saving}
          onClick={handleSave}
          style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
        >
          บันทึกร่าง
        </PermissionButton>
      </div>
    </div>
  )
}

export default StockTransferForm
