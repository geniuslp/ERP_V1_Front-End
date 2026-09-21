import React, { useMemo, useState, useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Button, Spin, message, Table, Space } from 'antd'
import axios from 'axios'
import { useAppSelector } from '@/store'

const { TextArea } = Input

const BASE_URL = (import.meta as any).env?.VITE_API_URL

interface ICPoReturnContext {
  po_no: string
  project_name?: string | null
}

interface ICReturnLine {
  line_id: number
  cost_code?: string | null
  mat_code: string
  description: string
  qty_received: number
  unit: string
  unit_price: number
}

interface ICReturnLinesResponse {
  context: ICPoReturnContext
  lines: ICReturnLine[]
}

interface ICPoReturnModalProps {
  open: boolean
  poId: number | null
  onClose: () => void
}

const formatMoney = (value: number) =>
  value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatQty = (value: number) =>
  value.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const ICPoReturnModal: React.FC<ICPoReturnModalProps> = ({ open, poId, onClose }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [data, setData] = useState<ICReturnLinesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [typedQty, setTypedQty] = useState<Record<number, number>>({})
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({})
  const [remarks, setRemarks] = useState('')

  const fetchLines = async () => {
    if (!poId) return
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/ic/pos/${poId}/return-lines`, { headers: authHeader })
      const payload: ICReturnLinesResponse = res.data?.data ?? res.data
      setData(payload)
      setTypedQty({})
      setLineErrors({})
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดรายการสินค้าไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && poId) {
      fetchLines()
    }
    if (!open) {
      setData(null)
      setTypedQty({})
      setLineErrors({})
      setRemarks('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, poId])

  const handleQtyChange = (lineId: number, value: number | null) => {
    setTypedQty((prev) => ({ ...prev, [lineId]: value ?? 0 }))
    setLineErrors((prev) => {
      if (!prev[lineId]) return prev
      const next = { ...prev }
      delete next[lineId]
      return next
    })
  }

  const hasAnyTypedQty = Object.values(typedQty).some((v) => v > 0)

  const handleSubmit = async () => {
    if (!poId || !data) return

    const payloadLines = data.lines
      .map((line) => ({ line_id: line.line_id, return_qty: typedQty[line.line_id] ?? 0, qty_received: line.qty_received }))
      .filter((l) => l.return_qty > 0)

    if (payloadLines.length === 0) {
      message.warning('กรุณากรอกจำนวนที่ต้องการคืนอย่างน้อย 1 รายการ')
      return
    }

    const errors: Record<number, string> = {}
    payloadLines.forEach((l) => {
      if (l.return_qty > l.qty_received) {
        errors[l.line_id] = `จำนวนที่คืนต้องไม่เกิน ${formatQty(l.qty_received)}`
      }
    })
    if (Object.keys(errors).length > 0) {
      setLineErrors(errors)
      message.error('มีรายการที่จำนวนคืนเกินยอดรับ กรุณาตรวจสอบ')
      return
    }

    setSubmitting(true)
    try {
      await axios.post(
        `${BASE_URL}/ic/pos/${poId}/return-lines/submit`,
        {
          remarks: remarks || undefined,
          lines: payloadLines.map(({ line_id, return_qty }) => ({ line_id, return_qty })),
        },
        { headers: authHeader },
      )
      message.success('บันทึกการคืนสินค้าสำเร็จ')
      setRemarks('')
      await fetchLines()
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message
      message.error(serverMsg || err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        title: 'ลำดับ',
        key: 'index',
        width: 60,
        render: (_: unknown, __: ICReturnLine, index: number) => index + 1,
      },
      {
        title: 'CostCode',
        dataIndex: 'cost_code',
        key: 'cost_code',
        render: (value: string | null | undefined) => value || '-',
      },
      {
        title: 'MatCode',
        dataIndex: 'mat_code',
        key: 'mat_code',
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
      },
      {
        title: 'รับแล้ว',
        dataIndex: 'qty_received',
        key: 'qty_received',
        align: 'right' as const,
        render: (value: number) => formatQty(value),
      },
      {
        title: 'Return QTY',
        key: 'return_qty',
        width: 140,
        render: (_: unknown, record: ICReturnLine) => (
          <Form.Item
            style={{ marginBottom: 0 }}
            validateStatus={lineErrors[record.line_id] ? 'error' : undefined}
            help={lineErrors[record.line_id]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={record.qty_received}
              precision={2}
              value={typedQty[record.line_id] ?? 0}
              onChange={(value) => handleQtyChange(record.line_id, value)}
            />
          </Form.Item>
        ),
      },
      {
        title: 'คงเหลือหลังคืน',
        key: 'remaining',
        align: 'right' as const,
        render: (_: unknown, record: ICReturnLine) => {
          const remaining = record.qty_received - (typedQty[record.line_id] ?? 0)
          return formatQty(Math.max(remaining, 0))
        },
      },
      {
        title: 'Unit',
        dataIndex: 'unit',
        key: 'unit',
      },
      {
        title: 'ราคาต่อหน่วย',
        dataIndex: 'unit_price',
        key: 'unit_price',
        align: 'right' as const,
        render: (value: number) => formatMoney(value),
      },
    ],
    [typedQty, lineErrors],
  )

  return (
    <Modal
      title={`คืนสินค้า${data?.context ? ` — ${data.context.po_no} (${data.context.project_name || '-'})` : ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={960}
      destroyOnClose
      styles={{ body: { paddingTop: 8 } }}
    >
      <Spin spinning={loading}>
        <Table
          rowKey="line_id"
          columns={columns}
          dataSource={data?.lines ?? []}
          pagination={false}
          locale={{ emptyText: 'ไม่พบรายการสินค้า' }}
        />

        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="หมายเหตุ">
            <TextArea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button type="primary" loading={submitting} disabled={!hasAnyTypedQty} onClick={handleSubmit}>
              บันทึกการคืนสินค้า
            </Button>
          </Space>
        </div>
      </Spin>
    </Modal>
  )
}

export default ICPoReturnModal
