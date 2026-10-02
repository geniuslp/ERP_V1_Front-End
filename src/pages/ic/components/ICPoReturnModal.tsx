import { icActionButtonProps } from '@/pages/ic/utils/actionButtonStyle'
import React, { useMemo, useState, useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Button, Select, Spin, message, Table, Space } from 'antd'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { goBackToICProject, confirmLeaveIfDirty } from '@/pages/ic/utils/icNavigation'
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
  /** Project to return to (ICProjectListPage) on save / X. Falls back to onClose when absent. */
  projectCode?: string
  preparedBy?: string | null
}

const formatMoney = (value: number) =>
  value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatQty = (value: number) =>
  value.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const ICPoReturnModal: React.FC<ICPoReturnModalProps> = ({ open, poId, onClose, projectCode, preparedBy }) => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [data, setData] = useState<ICReturnLinesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [typedQty, setTypedQty] = useState<Record<number, number>>({})
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({})
  const [remarks, setRemarks] = useState('')
  const [filterMode, setFilterMode] = useState<'mat_code' | 'cost_code'>('mat_code')
  const [rowFilter, setRowFilter] = useState<string | undefined>(undefined)
  const [rowText, setRowText] = useState('')
  const [remarksError, setRemarksError] = useState<string | undefined>()

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
      setRemarksError(undefined)
      setRowFilter(undefined)
      setRowText('')
      setFilterMode('mat_code')
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

  // Top-right X ends the whole process: back to the project page (confirm if qty/remarks typed).
  const handleExit = () => {
    confirmLeaveIfDirty(hasAnyTypedQty || remarks.trim() !== '', () => {
      if (projectCode) goBackToICProject(navigate, projectCode, preparedBy)
      else onClose()
    })
  }

  const handleSubmit = async () => {
    if (!poId || !data) return

    const payloadLines = data.lines
      .map((line) => ({ line_id: line.line_id, return_qty: typedQty[line.line_id] ?? 0, qty_received: line.qty_received }))
      .filter((l) => l.return_qty > 0)

    if (!remarks.trim()) {
      setRemarksError('กรุณากรอกหมายเหตุ')
      message.warning('กรุณากรอกหมายเหตุ')
      return
    }

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
          remarks: remarks.trim(),
          lines: payloadLines.map(({ line_id, return_qty }) => ({ line_id, return_qty })),
        },
        { headers: authHeader },
      )
      message.success('บันทึกการคืนสินค้าสำเร็จ')
      setRemarks('')
      setTypedQty({})
      // Saved: end the whole process and return to the project page (no unsaved-data confirm).
      if (projectCode) goBackToICProject(navigate, projectCode, preparedBy)
      else {
        await fetchLines()
      }
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message
      message.error(serverMsg || err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  // Filter options: distinct values of the selected field among the already-loaded lines.
  const filterOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { value: string; label: string }[] = []
    for (const l of data?.lines ?? []) {
      const v = (l[filterMode] ?? '') as string
      if (!v || seen.has(v)) continue
      seen.add(v)
      opts.push({ value: v, label: v })
    }
    return opts
  }, [data, filterMode])

  // Client-side filter over the loaded lines, scoped to the selected field. A dropdown pick
  // (exact match) wins over the free text (contains, case-insensitive), as on PO Receive.
  // Hidden rows keep their typed qty and are still submitted.
  const visibleLines = useMemo(() => {
    const lines = data?.lines ?? []
    if (rowFilter) return lines.filter((l) => (l[filterMode] ?? '') === rowFilter)
    const q = rowText.trim().toLowerCase()
    if (!q) return lines
    return lines.filter((l) => String(l[filterMode] ?? '').toLowerCase().includes(q))
  }, [data, filterMode, rowFilter, rowText])

  const handleFilterModeChange = (value: 'mat_code' | 'cost_code') => {
    setFilterMode(value)
    setRowFilter(undefined)
    setRowText('')
  }

  const columns = useMemo(
    () => [
      {
        title: 'ลำดับ',
        key: 'index',
        width: 50,
        render: (_: unknown, __: ICReturnLine, index: number) => index + 1,
      },
      {
        title: 'CostCode',
        dataIndex: 'cost_code',
        key: 'cost_code',
        width: 100,
        render: (value: string | null | undefined) => value || '-',
      },
      {
        title: 'MatCode',
        dataIndex: 'mat_code',
        key: 'mat_code',
        width: 100,
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
        width: 80,
        align: 'right' as const,
        render: (value: number) => formatQty(value),
      },
      {
        title: 'Return QTY',
        key: 'return_qty',
        width: 120,
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
        width: 100,
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
        width: 60,
      },
      {
        title: 'ราคาต่อหน่วย',
        dataIndex: 'unit_price',
        key: 'unit_price',
        width: 100,
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
      onCancel={handleExit}
      footer={null}
      width={1152}
      destroyOnClose
      styles={{ body: { paddingTop: 8 } }}
    >
      <Spin spinning={loading}>
        <Space wrap size="middle" style={{ marginBottom: 12 }}>
          <Select
            value={filterMode}
            onChange={handleFilterModeChange}
            style={{ width: 160 }}
            options={[
              { value: 'mat_code', label: 'ค้นหาจาก MatCode' },
              { value: 'cost_code', label: 'ค้นหาจาก CostCode' },
            ]}
          />
          <Select
            allowClear
            showSearch
            placeholder={filterMode === 'mat_code' ? 'เลือก MatCode' : 'เลือก CostCode'}
            value={rowFilter}
            onChange={(v) => setRowFilter(v)}
            options={filterOptions}
            style={{ width: 240 }}
            filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
          <Input
            allowClear
            placeholder={filterMode === 'mat_code' ? 'ค้นหา MatCode' : 'ค้นหา CostCode'}
            value={rowText}
            onChange={(e) => setRowText(e.target.value)}
            disabled={!!rowFilter}
            style={{ width: 220 }}
          />
        </Space>
        <Table
          rowKey="line_id"
          columns={columns}
          dataSource={visibleLines}
          pagination={false}
          locale={{ emptyText: 'ไม่พบรายการสินค้า' }}
        />

        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="หมายเหตุ" required validateStatus={remarksError ? 'error' : undefined} help={remarksError}>
            <TextArea
              rows={3}
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value)
                if (remarksError) setRemarksError(undefined)
              }}
              placeholder="กรุณาระบุเหตุผลการคืนสินค้า"
            />
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button type="primary" loading={submitting} disabled={!hasAnyTypedQty} onClick={handleSubmit} {...icActionButtonProps('return', !hasAnyTypedQty || submitting)}>
              บันทึกการคืนสินค้า
            </Button>
          </Space>
        </div>
      </Spin>
    </Modal>
  )
}

export default ICPoReturnModal
