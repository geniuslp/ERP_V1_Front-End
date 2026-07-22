import React, { useEffect, useState } from 'react'
import { Card, Button, Table, Descriptions, InputNumber, message, Modal, Rate, Input, Spin } from 'antd'
import { InboxOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import type { GRNPoDetail, GRNPoLine, GRNCreateLine, GRNCreateResult, GRNScorePayload } from '@/types'

const MENU_CODE = 'MENU_STOCK_RECEIVING'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

interface ReceiptLine extends GRNPoLine {
  add_qty: number
}

const GoodsReceiptDetailPage: React.FC = () => {
  const { poId } = useParams<{ poId: string }>()
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [loading, setLoading] = useState(false)
  const [po, setPo] = useState<GRNPoDetail | null>(null)
  const [lines, setLines] = useState<ReceiptLine[]>([])
  const [saving, setSaving] = useState(false)

  const [scoreModalOpen, setScoreModalOpen] = useState(false)
  const [scoreGrnId, setScoreGrnId] = useState<number | null>(null)
  const [scoreGrnNo, setScoreGrnNo] = useState('')
  const [scoreQuality, setScoreQuality] = useState(0)
  const [scoreQuantity, setScoreQuantity] = useState(0)
  const [scoreOntime, setScoreOntime] = useState(0)
  const [scoreNotes, setScoreNotes] = useState('')
  const [scoreSaving, setScoreSaving] = useState(false)

  useEffect(() => {
    if (!poId) return
    let cancelled = false
    const fetchPo = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/po/${poId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const result: GRNPoDetail = res.data?.data
        if (cancelled) return
        setPo(result)
        setLines(
          (result.lines || []).map((l, index) => ({
            ...l,
            po_line_id: l.po_line_id ?? (l as any).id ?? index,
            add_qty: Math.max(0, l.qty_ordered - l.qty_received),
          }))
        )
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูล PO ไม่สำเร็จ')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchPo()
    return () => { cancelled = true }
  }, [poId, accessToken])

  const setLineAddQty = (poLineId: number, val: number | null) => {
    setLines((prev) => prev.map((l) => (l.po_line_id === poLineId ? { ...l, add_qty: val ?? 0 } : l)))
  }

  const handleSave = async () => {
    if (!po) return
    if (lines.some((l) => l.add_qty < 0)) {
      message.warning('จำนวนที่รับเข้าต้องไม่ติดลบ')
      return
    }
    const receivingLines: GRNCreateLine[] = lines
      .filter((l) => l.add_qty > 0)
      .map((l) => ({ po_line_id: l.po_line_id, mat_code: l.mat_code, add_qty: l.add_qty }))

    if (receivingLines.length === 0) {
      message.warning('กรุณาระบุจำนวนที่รับเข้าอย่างน้อย 1 รายการ')
      return
    }

    setSaving(true)
    try {
      const res = await axios.post(
        `${BASE_URL}/grn/receive`,
        {
          po_id: po.id,
          warehouse_code: po.warehouse_code,
          supplier_code: po.supplier_code,
          lines: receivingLines,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const result: GRNCreateResult = res.data?.data
      message.success(`บันทึกรับเข้าสำเร็จ (${result.grn_no})`)
      setScoreGrnId(result.grn_id)
      setScoreGrnNo(result.grn_no)
      setScoreQuality(0)
      setScoreQuantity(0)
      setScoreOntime(0)
      setScoreNotes('')
      setScoreModalOpen(true)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'บันทึกรับเข้าไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveScore = async () => {
    if (!scoreGrnId) return
    if (scoreQuality < 1 || scoreQuantity < 1 || scoreOntime < 1) {
      message.warning('กรุณาให้คะแนนครบทั้ง 3 หัวข้อ')
      return
    }
    const payload: GRNScorePayload = {
      score_quality: scoreQuality,
      score_quantity: scoreQuantity,
      score_ontime: scoreOntime,
      score_notes: scoreNotes || undefined,
    }
    setScoreSaving(true)
    try {
      await axios.post(`${BASE_URL}/grn/${scoreGrnId}/score`, payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('บันทึกคะแนนสำเร็จ')
      setScoreModalOpen(false)
      navigate('/stock/receiving')
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'บันทึกคะแนนไม่สำเร็จ')
    } finally {
      setScoreSaving(false)
    }
  }

  const columns = [
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'ชื่อวัสดุ', dataIndex: 'item_name', key: 'item_name', ellipsis: true },
    { title: 'จำนวนสั่งซื้อ', dataIndex: 'qty_ordered', key: 'qty_ordered', align: 'right' as const },
    { title: 'รับแล้ว', dataIndex: 'qty_received', key: 'qty_received', align: 'right' as const },
    {
      title: 'คงเหลือในคลัง',
      dataIndex: 'current_stock_qty',
      key: 'current_stock_qty',
      align: 'right' as const,
      render: (val: number | null) => (val ?? 0).toLocaleString(),
    },
    {
      title: 'จำนวนที่รับเข้า',
      key: 'add_qty',
      align: 'right' as const,
      render: (_: any, record: ReceiptLine) => (
        <InputNumber
          min={0}
          value={record.add_qty}
          onChange={(val) => setLineAddQty(record.po_line_id, val)}
          style={{ width: 110 }}
        />
      ),
    },
    {
      title: 'จะเป็น',
      key: 'will_be',
      align: 'right' as const,
      render: (_: any, record: ReceiptLine) => {
        const total = (record.current_stock_qty ?? 0) + (record.add_qty || 0)
        return <span style={{ fontWeight: 600, color: '#2563eb' }}>{total.toLocaleString()}</span>
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="บันทึกรับเข้า"
        subtitle={po ? `PO: ${po.po_no}` : undefined}
        breadcrumbs={[
          { title: 'Home' },
          { title: 'Stock Management' },
          { title: 'รับเข้า' },
          { title: po?.po_no || '...' },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/stock/receiving')}>
            กลับไปค้นหา
          </Button>
        }
      />

      {loading && (
        <Card style={cardStyle}>
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        </Card>
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
              <Descriptions.Item key="po_no" label="เลข PO">{po.po_no}</Descriptions.Item>
              <Descriptions.Item key="po_date" label="วันที่สั่งซื้อ">{po.po_date || '—'}</Descriptions.Item>
              <Descriptions.Item key="expected_date" label="วันที่ส่งของ">
                {po.expected_date ? (
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>{po.expected_date}</span>
                ) : (
                  <span style={{ color: '#9ca3af' }}>ไม่ระบุ</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item key="supplier_code" label="Supplier">{po.supplier_code}</Descriptions.Item>
              <Descriptions.Item key="warehouse_code" label="คลัง">{po.warehouse_code || '—'}</Descriptions.Item>
              <Descriptions.Item key="status" label="สถานะ PO">{po.status}</Descriptions.Item>
              <Descriptions.Item key="currency" label="สกุลเงิน">{po.currency}</Descriptions.Item>
              <Descriptions.Item key="net_amount" label="มูลค่าสุทธิ">{(po.net_amount ?? 0).toLocaleString()}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card style={cardStyle}>
            <Table
              rowKey="po_line_id"
              columns={columns}
              dataSource={lines}
              pagination={false}
              locale={{ emptyText: 'ไม่มีรายการใน PO นี้' }}
            />

            <div style={{ textAlign: 'right', marginTop: 20 }}>
              <PermissionButton
                menuCode={MENU_CODE}
                action="write"
                type="primary"
                icon={<InboxOutlined />}
                loading={saving}
                onClick={handleSave}
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
              >
                บันทึกรับเข้า
              </PermissionButton>
            </div>
          </Card>
        </>
      )}

      <Modal
        title="ให้คะแนนซัพพลายเออร์"
        open={scoreModalOpen}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={null}
        width={440}
        centered
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {scoreGrnNo && (
            <div style={{ fontSize: 13, color: '#64748b' }}>GRN: <strong>{scoreGrnNo}</strong></div>
          )}
          <div>
            <div style={{ marginBottom: 4, color: '#64748b', fontSize: 13 }}>
              ตรงเวลาในการส่งของ <span style={{ color: 'red' }}>*</span>
            </div>
            <Rate value={scoreOntime} onChange={setScoreOntime} />
          </div>
          <div>
            <div style={{ marginBottom: 4, color: '#64748b', fontSize: 13 }}>
              ความครบถ้วนของจำนวน <span style={{ color: 'red' }}>*</span>
            </div>
            <Rate value={scoreQuantity} onChange={setScoreQuantity} />
          </div>
          <div>
            <div style={{ marginBottom: 4, color: '#64748b', fontSize: 13 }}>
              คุณภาพสินค้า <span style={{ color: 'red' }}>*</span>
            </div>
            <Rate value={scoreQuality} onChange={setScoreQuality} />
          </div>
          <div>
            <div style={{ marginBottom: 4, color: '#64748b', fontSize: 13 }}>หมายเหตุ (ถ้ามี)</div>
            <Input.TextArea rows={3} value={scoreNotes} onChange={(e) => setScoreNotes(e.target.value)} />
          </div>
          <Button type="primary" loading={scoreSaving} onClick={handleSaveScore} block>
            บันทึกคะแนน
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default GoodsReceiptDetailPage
