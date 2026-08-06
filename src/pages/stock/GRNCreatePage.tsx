import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Descriptions, InputNumber, Input, message, Spin, Alert, Space, Tag } from 'antd'
import { ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { grnReceivingService, GRN_RECEIVING_MOCK_MODE } from '@/services/grnReceivingService'
import type { ReceivablePoLinesResponse, ReceivablePoLine } from '@/types'

const MENU_CODE = 'MENU_STOCK_RECEIVING'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

interface DraftLine extends ReceivablePoLine {
  qty_accepted: number
}

// Two-step create: POST /grn saves a draft, then POST /grn/:id/confirm
// finalizes it. Lines come from GET /po/:id/receivable-lines, which the
// backend already filters to only still-receivable lines.
const GRNCreatePage: React.FC = () => {
  const { poId } = useParams<{ poId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [po, setPo] = useState<ReceivablePoLinesResponse | null>(null)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [deliveryNote, setDeliveryNote] = useState('')
  const [warehouseCode, setWarehouseCode] = useState('')

  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [draftGrnId, setDraftGrnId] = useState<number | null>(null)
  const [draftGrnNo, setDraftGrnNo] = useState('')

  useEffect(() => {
    if (!poId) return
    let cancelled = false
    const fetchLines = async () => {
      setLoading(true)
      try {
        const result = await grnReceivingService.getReceivableLines(Number(poId))
        if (cancelled) return
        setPo(result)
        setWarehouseCode(result.warehouse_code || '')
        setLines(result.lines.map((l) => ({ ...l, qty_accepted: 0 })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดรายการที่รับได้ไม่สำเร็จ')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchLines()
    return () => { cancelled = true }
  }, [poId])

  const setLineQtyAccepted = (poLineId: number, val: number | null) => {
    setLines((prev) => prev.map((l) => (l.po_line_id === poLineId ? { ...l, qty_accepted: val ?? 0 } : l)))
  }

  const validateLines = (): string | null => {
    for (const l of lines) {
      if (l.qty_accepted < 0) return `จำนวนรับ (${l.mat_code}) ต้องไม่ติดลบ`
      // Client-side guard against over-receiving before the request is even
      // sent — backend also validates this, but don't rely on that alone.
      if (l.qty_accepted > l.qty_remaining) return `จำนวนรับ (${l.mat_code}) เกินจำนวนคงเหลือที่รับได้ (${l.qty_remaining})`
    }
    if (lines.every((l) => l.qty_accepted === 0)) return 'กรุณาระบุจำนวนรับอย่างน้อย 1 รายการ'
    if (!warehouseCode.trim()) return 'กรุณาระบุรหัสคลัง'
    return null
  }

  const handleSaveDraft = async () => {
    if (!po) return
    const err = validateLines()
    if (err) {
      message.warning(err)
      return
    }
    setSaving(true)
    try {
      const result = await grnReceivingService.createGrnDraft({
        po_id: po.po_id,
        warehouse_code: warehouseCode,
        delivery_note: deliveryNote || undefined,
        lines: lines
          .filter((l) => l.qty_accepted > 0)
          .map((l) => ({ po_line_id: l.po_line_id, mat_code: l.mat_code, qty_accepted: l.qty_accepted })),
      })
      setDraftGrnId(result.grn_id)
      setDraftGrnNo(result.grn_no)
      message.success(`บันทึกร่าง GRN สำเร็จ (${result.grn_no})`)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'บันทึกร่าง GRN ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async () => {
    if (!draftGrnId) return
    setConfirming(true)
    try {
      await grnReceivingService.confirmGrn(draftGrnId)
      message.success('ยืนยันรับเข้าสำเร็จ')
      navigate('/stock/grn')
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'ยืนยันรับเข้าไม่สำเร็จ')
    } finally {
      setConfirming(false)
    }
  }

  const columns = [
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'ชื่อวัสดุ', dataIndex: 'mat_name', key: 'mat_name', ellipsis: true },
    { title: 'สั่งซื้อ', dataIndex: 'qty_ordered', key: 'qty_ordered', align: 'right' as const },
    { title: 'รับแล้ว', dataIndex: 'qty_received', key: 'qty_received', align: 'right' as const },
    {
      title: 'คงเหลือที่รับได้',
      dataIndex: 'qty_remaining',
      key: 'qty_remaining',
      align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v.toLocaleString()}</span>,
    },
    {
      title: 'จำนวนที่รับ (qty_accepted)',
      key: 'qty_accepted',
      align: 'right' as const,
      render: (_: unknown, record: DraftLine) => (
        <InputNumber
          min={0}
          max={record.qty_remaining}
          value={record.qty_accepted}
          disabled={!!draftGrnId}
          onChange={(val) => setLineQtyAccepted(record.po_line_id, val)}
          style={{ width: 120 }}
          status={record.qty_accepted > record.qty_remaining ? 'error' : undefined}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="สร้าง GRN"
        subtitle={po ? `PO: ${po.po_no}` : undefined}
        breadcrumbs={[
          { title: 'Home' }, { title: 'Stock Management' }, { title: 'รับเข้า' }, { title: po?.po_no || '...' },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/stock/receivable')}>
            กลับไปรายการ
          </Button>
        }
      />

      {GRN_RECEIVING_MOCK_MODE && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="กำลังแสดงข้อมูลจำลอง (mock) — รอ backend deploy GET /po/:id/receivable-lines, POST /grn, POST /grn/:id/confirm"
        />
      )}

      {loading && (
        <Card style={cardStyle}><div style={{ textAlign: 'center', padding: 40 }}><Spin /></div></Card>
      )}

      {!loading && po && (
        <>
          <Card style={{ ...cardStyle, marginBottom: 20 }}>
            <Descriptions
              bordered
              size="small"
              column={2}
              styles={{ label: { width: 140, fontWeight: 600, background: '#f8fafc' } }}
            >
              <Descriptions.Item label="เลข PO">{po.po_no}</Descriptions.Item>
              <Descriptions.Item label="Supplier">{po.supplier_code}</Descriptions.Item>
              <Descriptions.Item label="เลขที่ใบส่งของ (delivery_note)">
                <Input
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  disabled={!!draftGrnId}
                  placeholder="ไม่บังคับ"
                />
              </Descriptions.Item>
              <Descriptions.Item label="รหัสคลัง (warehouse_code)">
                <Input
                  value={warehouseCode}
                  onChange={(e) => setWarehouseCode(e.target.value)}
                  disabled={!!draftGrnId}
                />
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card style={cardStyle}>
            {draftGrnId && (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
                message={<span>บันทึกร่างแล้ว: <Tag color="blue">{draftGrnNo}</Tag> — กด "ยืนยันรับเข้า" เพื่อปิดรายการ</span>}
              />
            )}
            <Table
              rowKey="po_line_id"
              columns={columns}
              dataSource={lines}
              pagination={false}
              locale={{ emptyText: 'ไม่มีรายการที่รับได้ใน PO นี้' }}
            />
            <div style={{ textAlign: 'right', marginTop: 20 }}>
              <Space>
                <PermissionButton
                  menuCode={MENU_CODE}
                  action="write"
                  icon={<SaveOutlined />}
                  loading={saving}
                  disabled={!!draftGrnId}
                  onClick={handleSaveDraft}
                >
                  บันทึกร่าง
                </PermissionButton>
                <PermissionButton
                  menuCode={MENU_CODE}
                  action="write"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={confirming}
                  disabled={!draftGrnId}
                  onClick={handleConfirm}
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
                >
                  ยืนยันรับเข้า
                </PermissionButton>
              </Space>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

export default GRNCreatePage
