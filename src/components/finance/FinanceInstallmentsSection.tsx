import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Card, Switch, Table, InputNumber, Input, Checkbox, Button, Tag, Tooltip, message } from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import PermissionButton from '@/components/common/PermissionButton'
import { financeService } from '@/services/financeService'
import type { FinanceDocType, SaveInstallmentRow } from '@/types/finance'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const thb = (n: number) => (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

interface Row {
  key: string
  id?: number
  percent: number | null
  amount: number | null
  description: string
  is_paid: boolean
  // True when the row was already paid as loaded from the server: %, amount,
  // description and delete stay locked.
  locked: boolean
  paid_at?: string | null
}

let rowSeq = 0
const newRow = (): Row => ({ key: `new-${++rowSeq}`, percent: null, amount: null, description: '', is_paid: false, locked: false })

// Selection is keyed by the row's client key (backend id when saved, temp key otherwise).
export interface SelectedInstallment { key: string; no: number; amount: number }

export interface InstallmentsPlan {
  installments: SaveInstallmentRow[]
  // Installment numbers (1-based, request order) of the rows selected for payment.
  selectedNumbers: number[]
  hasEmptyRow: boolean
}

export interface InstallmentsSectionHandle {
  getPlan: () => InstallmentsPlan
}

interface Props {
  accessToken: string
  docType: FinanceDocType
  docId: string
  onSaved?: () => void
  // Bumped by the parent (e.g. after a payment) to re-fetch from the server.
  reloadKey?: number
  onSelectedChange: (items: SelectedInstallment[]) => void
}

const FinanceInstallmentsSection = forwardRef<InstallmentsSectionHandle, Props>(({ accessToken, docType, docId, onSaved, reloadKey, onSelectedChange }, ref) => {
  const [rows, setRows] = useState<Row[]>([])
  const [enabled, setEnabled] = useState(false)
  const [netAmount, setNetAmount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await financeService.getInstallments(accessToken, docType, docId)
      setNetAmount(res.net_amount)
      const loaded: Row[] = res.installments.map((i) => ({
          key: `id-${i.id}`,
          id: i.id,
          percent: i.percent,
          amount: i.amount,
          description: i.description ?? '',
          is_paid: i.is_paid,
          locked: i.is_paid,
          paid_at: i.paid_at,
      }))
      setRows(loaded)
      setEnabled(loaded.length > 0)
      setSelectedKeys([])
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดงวดการจ่ายเงินไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType, docId, reloadKey])

  const patchRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const onToggle = (on: boolean) => {
    if (!on) {
      if (rows.some((r) => r.is_paid || r.locked)) {
        message.warning('ไม่สามารถปิดการชำระเป็นงวดได้ เนื่องจากมีงวดที่จ่ายแล้ว')
        return
      }
      setRows([])
      setEnabled(false)
      return
    }
    setEnabled(true)
    if (rows.length === 0) setRows([newRow()])
  }

  const toggleSelect = (key: string, checked: boolean) =>
    setSelectedKeys((ks) => (checked ? [...ks, key] : ks.filter((k) => k !== key)))

  // Live derivation: editing % / amount of a selected row updates the parent immediately.
  useEffect(() => {
    onSelectedChange(
      rows
        .map((r, i) => ({ key: r.key, no: i + 1, amount: r.amount ?? 0, selected: selectedKeys.includes(r.key) && !r.is_paid }))
        .filter((x) => x.selected)
        .map(({ key, no, amount }) => ({ key, no, amount })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selectedKeys])

  const buildRows = (): SaveInstallmentRow[] =>
    rows.map((r) => ({
      ...(r.id != null ? { id: r.id } : {}),
      percent: r.percent ?? 0,
      amount: r.amount ?? 0,
      description: r.description.trim(),
    }))

  useImperativeHandle(ref, () => ({
    getPlan: () => ({
      installments: enabled ? buildRows() : [],
      selectedNumbers: rows.flatMap((r, i) => (selectedKeys.includes(r.key) && !r.is_paid ? [i + 1] : [])),
      hasEmptyRow: enabled && rows.some((r) => r.amount == null && r.percent == null),
    }),
  }))

  const onPercent = (key: string, v: number | null) =>
    patchRow(key, { percent: v, amount: v == null ? null : round2((netAmount * v) / 100) })

  const onAmount = (key: string, v: number | null) =>
    patchRow(key, { amount: v, percent: v == null || netAmount <= 0 ? null : round2((v / netAmount) * 100) })

  const totalAmount = round2(rows.reduce((s, r) => s + (r.amount ?? 0), 0))
  const totalPercent = round2(rows.reduce((s, r) => s + (r.percent ?? 0), 0))
  const remaining = round2(netAmount - totalAmount)
  const over = remaining < 0

  const handleSave = async () => {
    if (enabled && rows.some((r) => r.amount == null && r.percent == null)) {
      message.warning('กรุณาระบุ % หรือจำนวนเงินให้ครบทุกงวด')
      return
    }
    setSaving(true)
    try {
      await financeService.saveInstallments(
        accessToken,
        docType,
        docId,
        enabled ? buildRows() : [],
      )
      message.success('บันทึกงวดการจ่ายเงินสำเร็จ')
      await load()
      onSaved?.()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึกงวดการจ่ายเงินไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<Row> = [
    { title: 'งวดที่', key: 'no', width: 70, render: (_: unknown, __: Row, i: number) => i + 1 },
    {
      title: '% งวด',
      key: 'percent',
      width: 130,
      render: (_: unknown, r: Row) => (
        <InputNumber
          min={0}
          max={100}
          precision={2}
          value={r.percent}
          disabled={r.locked}
          style={{ width: '100%' }}
          onChange={(v) => onPercent(r.key, v)}
        />
      ),
    },
    {
      title: 'จำนวนเงิน',
      key: 'amount',
      width: 170,
      render: (_: unknown, r: Row) => (
        <InputNumber min={0} precision={2} value={r.amount} disabled={r.locked} style={{ width: '100%' }} onChange={(v) => onAmount(r.key, v)} />
      ),
    },
    {
      title: 'รายละเอียด',
      key: 'description',
      render: (_: unknown, r: Row) => (
        <Input value={r.description} disabled={r.locked} onChange={(e) => patchRow(r.key, { description: e.target.value })} />
      ),
    },
    {
      title: 'สถานะ',
      key: 'is_paid',
      width: 190,
      render: (_: unknown, r: Row) =>
        r.is_paid ? (
          <span>
            <Tag color="success" style={{ marginRight: 6 }}>จ่ายแล้ว</Tag>
            {r.paid_at ? dayjs(r.paid_at).format('DD/MM/YYYY') : ''}
          </span>
        ) : (
          <Tooltip title={(r.amount ?? 0) > 0 ? undefined : 'กรอกจำนวนเงินก่อน'}>
            <Checkbox
              checked={selectedKeys.includes(r.key)}
              disabled={(r.amount ?? 0) <= 0}
              onChange={(e) => toggleSelect(r.key, e.target.checked)}
            >
              เลือกจ่าย
            </Checkbox>
          </Tooltip>
        ),
    },
    {
      title: '',
      key: 'del',
      width: 50,
      render: (_: unknown, r: Row) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          disabled={r.locked}
          onClick={() => {
            setRows((rs) => rs.filter((x) => x.key !== r.key))
            setSelectedKeys((ks) => ks.filter((k) => k !== r.key))
          }}
        />
      ),
    },
  ]

  return (
    <Card
      title="การชำระเป็นงวด"
      style={{ ...cardStyle, marginBottom: 20 }}
      loading={loading}
      extra={
        <span>
          ชำระเป็นงวด <Switch checked={enabled} onChange={onToggle} style={{ marginLeft: 8 }} />
        </span>
      }
    >
      {enabled && (
        <>
          <Table rowKey="key" size="small" pagination={false} columns={columns} dataSource={rows} scroll={{ x: 800 }} />
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            style={{ marginTop: 12 }}
            onClick={() => setRows((rs) => [...rs, newRow()])}
          >
            เพิ่มงวด
          </Button>
          <div style={{ display: 'flex', gap: 32, marginTop: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div>รวมจำนวนเงิน: <b>{thb(totalAmount)}</b></div>
            <div>
              คงเหลือ: <b style={{ color: over ? '#dc2626' : undefined }}>{thb(remaining)}</b>
            </div>
            <div>รวม %: <b>{thb(totalPercent)}</b></div>
          </div>
        </>
      )}
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <PermissionButton
          menuCode="MENU_FINANCE_PAYMENTS"
          action="write"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={over}
          onClick={handleSave}
          style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none' }}
        >
          บันทึกแผนงวด
        </PermissionButton>
      </div>
    </Card>
  )
})

FinanceInstallmentsSection.displayName = 'FinanceInstallmentsSection'

export default FinanceInstallmentsSection
