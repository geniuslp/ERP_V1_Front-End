import React, { useEffect, useRef } from 'react'
import { Card, Table, Button, Input, InputNumber, DatePicker, Select, Row, Col } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import ConfirmDeleteButton from '@/components/common/ConfirmDeleteButton'
import dayjs, { Dayjs } from 'dayjs'
import { WO_PAYMENT_STATUS_LABEL } from '@/types/workOrder'
import type {
  WOPaymentInstallment, WOPaymentRetention, WOPaymentPenalty, WOPaymentStatus, WOPaymentConditions,
} from '@/types/workOrder'

const DATE_FORMAT = 'YYYY-MM-DD'

// Each numbered block is a clearly separate card: blue outline + blue left bar + a stronger navy shadow
// (the matching header tint lives in index.css under .wo-block).
const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid #bcd0f0',
  borderLeft: '4px solid #2563eb',
  boxShadow: '0 4px 16px rgba(15,45,94,0.14)',
  marginBottom: 20,
}

const subCardStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid #c7d9f5',
  boxShadow: '0 1px 4px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

// ── row shapes while editing — `key` is frontend-only (React list identity),
// dates are Dayjs while editing and formatted to 'YYYY-MM-DD' strings only at
// submit time, mirroring WorkOrderCreatePage's own date-field convention.
// Exported so WorkOrderCreatePage (which now owns this state — see below) can
// type its own useState calls and pass rows down as controlled props. ──

export interface InstallmentRow {
  key: string
  id?: number
  installment_no: number
  description: string
  percent_of_contract: number | null
  amount: number
  due_date?: Dayjs
  payment_status: WOPaymentStatus
  remarks: string
}

export interface RetentionRow {
  key: string
  id?: number
  description: string
  percent_of_contract: number | null
  amount: number
  remarks: string
}

export interface PenaltyRow {
  key: string
  id?: number
  description: string
  percent_per_day: number | null
  contract_start_date?: Dayjs
  contract_end_date?: Dayjs
  remarks: string
}

const newKey = () => `new-${Date.now()}-${Math.random().toString(36).slice(2)}`

export const toInstallmentRow = (i: WOPaymentInstallment, idx: number): InstallmentRow => ({
  key: `existing-${i.id ?? idx}`,
  id: i.id,
  installment_no: i.installment_no ?? idx + 1,
  description: i.description ?? '',
  percent_of_contract: i.percent_of_contract ?? null,
  amount: i.amount ?? 0,
  due_date: i.due_date ? dayjs(i.due_date) : undefined,
  payment_status: i.payment_status === 'PAID' ? 'PAID' : 'UNPAID',
  remarks: i.remarks ?? '',
})

export const toRetentionRow = (r: WOPaymentRetention, idx: number): RetentionRow => ({
  key: `existing-${r.id ?? idx}`,
  id: r.id,
  description: r.description ?? '',
  percent_of_contract: r.percent_of_contract ?? null,
  amount: r.amount ?? 0,
  remarks: r.remarks ?? '',
})

export const toPenaltyRow = (p: WOPaymentPenalty, idx: number): PenaltyRow => ({
  key: `existing-${p.id ?? idx}`,
  id: p.id,
  description: p.description ?? '',
  percent_per_day: p.percent_per_day ?? null,
  contract_start_date: p.contract_start_date ? dayjs(p.contract_start_date) : undefined,
  contract_end_date: p.contract_end_date ? dayjs(p.contract_end_date) : undefined,
  remarks: p.remarks ?? '',
})

export const emptyInstallmentRow = (): InstallmentRow => ({
  key: newKey(), installment_no: 0, description: '', percent_of_contract: null,
  amount: 0, due_date: undefined, payment_status: 'UNPAID', remarks: '',
})

export const emptyRetentionRow = (): RetentionRow => ({
  key: newKey(), description: '', percent_of_contract: null, amount: 0, remarks: '',
})

export const emptyPenaltyRow = (): PenaltyRow => ({
  key: newKey(), description: '', percent_per_day: null, contract_start_date: undefined,
  contract_end_date: undefined, remarks: '',
})

// Builds the POST /work-order/:woId/payment-conditions body from the section's
// current row state — used by WorkOrderCreatePage's handleSave, since the
// bundled follow-up call now happens there, not inside this component.
export const buildPaymentConditionsPayload = (
  installments: InstallmentRow[],
  retentions: RetentionRow[],
  penalties: PenaltyRow[],
): WOPaymentConditions => ({
  installments: installments.map((r): WOPaymentInstallment => ({
    id: r.id,
    installment_no: r.installment_no,
    description: r.description || undefined,
    percent_of_contract: r.percent_of_contract,
    amount: r.amount,
    due_date: r.due_date ? r.due_date.format(DATE_FORMAT) : undefined,
    payment_status: r.payment_status,
    remarks: r.remarks || undefined,
  })),
  retentions: retentions.map((r): WOPaymentRetention => ({
    id: r.id,
    description: r.description || undefined,
    percent_of_contract: r.percent_of_contract,
    amount: r.amount,
    remarks: r.remarks || undefined,
  })),
  penalties: penalties.map((r): WOPaymentPenalty => ({
    id: r.id,
    description: r.description || undefined,
    percent_per_day: r.percent_per_day,
    contract_start_date: r.contract_start_date ? r.contract_start_date.format(DATE_FORMAT) : undefined,
    contract_end_date: r.contract_end_date ? r.contract_end_date.format(DATE_FORMAT) : undefined,
    remarks: r.remarks || undefined,
  })),
})

interface WOPaymentConditionsSectionProps {
  installments: InstallmentRow[]
  onInstallmentsChange: (rows: InstallmentRow[]) => void
  retentions: RetentionRow[]
  onRetentionsChange: (rows: RetentionRow[]) => void
  penalties: PenaltyRow[]
  onPenaltiesChange: (rows: PenaltyRow[]) => void
  // contract_amount (มูลค่าสัญญาไม่รวม VAT) — base for the retention amount = base * % / 100.
  contractAmount?: number | null
  // 7.1 เงินล่วงหน้า content (Form.Items live in the page's form); rendered above 7.2.
  advanceSlot?: React.ReactNode
  // 7.2 เงินงวดสัญญา free-text content (Form.Item progress_payment_note lives in the page's form).
  progressSlot?: React.ReactNode
  // 7.5 หักอื่นๆ content (Form.Items live in the page's form); rendered after 7.4.
  otherSlot?: React.ReactNode
  // 7.4 หักเงินคืนจ่ายล่วงหน้า (read-only): the fixed advance amount and the % displayed in 7.1.
  advanceAmount?: number | null
  advancePct?: number | null
}

// 7.3 เงินประกัน: % of contract offered for new selections. A stored value outside this list
// (e.g. 7) is still shown as an extra option on its own row and is never rewritten on load.
const RETENTION_PCT_OPTIONS = [5, 10]
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const money2 = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Fully-controlled, editable from the moment the create page loads (even with
// no WO id yet) — unlike an earlier version of this component, it no longer
// gates on woId or has its own save button. WorkOrderCreatePage owns the row
// state (same pattern as `items`/WOItemsTable) and bundles a follow-up
// POST /work-order/:woId/payment-conditions into its own handleSave, right
// after the main WO create/update call succeeds and a real id is known — see
// handleSave's comment there for why this can't happen any earlier. In edit
// mode, WorkOrderCreatePage also fetches GET .../payment-conditions once on
// load (alongside the WO itself) to seed this state with existing rows.
const WOPaymentConditionsSection: React.FC<WOPaymentConditionsSectionProps> = ({
  installments, onInstallmentsChange,
  retentions, onRetentionsChange,
  penalties, onPenaltiesChange,
  contractAmount,
  advanceSlot,
  progressSlot,
  otherSlot,
  advanceAmount,
  advancePct,
}) => {
  const base = Number(contractAmount) || 0

  // 7.3 หักเงินประกันผลงาน is a single choice (ไม่มี / 5% / 10%) plus a note, no amount. It is stored
  // as at most one retention row (none = ไม่มี); an old document's first row is what is shown here.
  const retentionPct = retentions[0]?.percent_of_contract ?? 0
  const retentionRemarks = retentions[0]?.remarks ?? ''
  const setRetention = (patch: { pct?: number; remarks?: string }) => {
    const pct = patch.pct ?? retentionPct
    if (pct <= 0) { onRetentionsChange([]); return }
    const cur = retentions[0] ?? emptyRetentionRow()
    onRetentionsChange([{
      ...cur,
      percent_of_contract: pct,
      amount: 0,
      remarks: patch.remarks ?? (cur.remarks ?? ''),
    }])
  }

  // 7.4 หักเงินคืนจ่ายล่วงหน้า — display only, never sent in the payload.
  const advPct = Number(advancePct) || 0
  const advAmount = round2(Number(advanceAmount) || 0)
  const remainAmount = round2(base - advAmount)
  const remainPct = round2(100 - advPct)

  // ── ค่าปรับ (penalties) ──
  const addPenalty = () => {
    onPenaltiesChange([...penalties, emptyPenaltyRow()])
  }
  const updatePenalty = (key: string, patch: Partial<PenaltyRow>) => {
    onPenaltiesChange(penalties.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  const removePenalty = (key: string) => {
    onPenaltiesChange(penalties.filter((r) => r.key !== key))
  }

  const penaltyColumns = [
    {
      title: 'รายละเอียด',
      key: 'description',
      render: (_: unknown, r: PenaltyRow) => (
        <Input
          size="small"
          value={r.description}
          placeholder="รายละเอียด"
          onChange={(e) => updatePenalty(r.key, { description: e.target.value })}
        />
      ),
    },
    {
      title: '% ต่อวัน',
      key: 'percent_per_day',
      width: 100,
      render: (_: unknown, r: PenaltyRow) => (
        <InputNumber
          size="small"
          min={0}
          max={100}
          style={{ width: '100%' }}
          value={r.percent_per_day ?? undefined}
          onChange={(v) => updatePenalty(r.key, { percent_per_day: v ?? null })}
        />
      ),
    },
    {
      title: 'วันที่เริ่มต้นของสัญญา',
      key: 'contract_start_date',
      width: 150,
      render: (_: unknown, r: PenaltyRow) => (
        <DatePicker
          size="small"
          style={{ width: '100%' }}
          format="DD/MM/YYYY"
          value={r.contract_start_date}
          onChange={(v) => updatePenalty(r.key, { contract_start_date: v ?? undefined })}
        />
      ),
    },
    {
      title: 'วันที่สิ้นสุดของสัญญา',
      key: 'contract_end_date',
      width: 150,
      render: (_: unknown, r: PenaltyRow) => (
        <DatePicker
          size="small"
          style={{ width: '100%' }}
          format="DD/MM/YYYY"
          value={r.contract_end_date}
          onChange={(v) => updatePenalty(r.key, { contract_end_date: v ?? undefined })}
        />
      ),
    },
    {
      title: 'หมายเหตุ',
      key: 'remarks',
      render: (_: unknown, r: PenaltyRow) => (
        <Input
          size="small"
          value={r.remarks}
          placeholder="หมายเหตุ"
          onChange={(e) => updatePenalty(r.key, { remarks: e.target.value })}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 40,
      align: 'center' as const,
      render: (_: unknown, r: PenaltyRow) => (
        <ConfirmDeleteButton type="text" size="small" onConfirm={() => removePenalty(r.key)} />
      ),
    },
  ]

  return (
    <Card className="wo-block" title="7. เงื่อนไขการจ่ายเงิน" style={cardStyle}>
      {advanceSlot && (
        <Card title="7.1 เงินล่วงหน้า" size="small" style={subCardStyle}>
          {advanceSlot}
        </Card>
      )}
      {progressSlot && (
        <Card title="7.2 เงินงวดสัญญา" size="small" style={subCardStyle}>
          {progressSlot}
        </Card>
      )}

      <Card title="7.3 หักเงินประกันผลงาน" size="small" style={subCardStyle}>
        <Row gutter={[16, 8]}>
          <Col xs={24} md={8}>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>หักเงินประกันผลงาน</div>
            <Select
              style={{ width: '100%' }}
              value={retentionPct}
              options={[
                { value: 0, label: 'ไม่มี' },
                ...RETENTION_PCT_OPTIONS.map((v) => ({ value: v, label: `${v}%` })),
                ...(retentionPct > 0 && !RETENTION_PCT_OPTIONS.includes(retentionPct)
                  ? [{ value: retentionPct, label: `${retentionPct}%` }]
                  : []),
              ]}
              onChange={(v: number) => setRetention({ pct: v })}
            />
          </Col>
          <Col xs={24} md={16}>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>หมายเหตุ</div>
            <Input.TextArea
              autoSize={{ minRows: 1 }}
              maxLength={500}
              disabled={retentionPct === 0}
              value={retentionRemarks}
              placeholder={retentionPct === 0 ? '' : 'หมายเหตุ'}
              onChange={(e) => setRetention({ remarks: e.target.value })}
            />
          </Col>
        </Row>
      </Card>

      <Card title="7.4 หักเงินคืนจ่ายล่วงหน้า" size="small" style={subCardStyle}>
        <Row gutter={[16, 8]}>
          {[
            { label: 'เงินล่วงหน้าที่หัก (บาท)', value: `${money2(advAmount)} บาท` },
            { label: 'คงเหลือ (บาท)', value: `${money2(remainAmount)} บาท` },
            { label: 'คงเหลือ (%)', value: `${remainPct.toLocaleString('th-TH', { maximumFractionDigits: 2 })} %` },
          ].map((f) => (
            <Col key={f.label} xs={24} md={8}>
              <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{f.label}</div>
              <Input readOnly value={f.value} style={{ textAlign: 'right' }} />
            </Col>
          ))}
        </Row>
      </Card>

      {otherSlot && (
        <Card title="7.5 หักอื่นๆ" size="small" style={{ ...subCardStyle, marginBottom: 0 }}>
          {otherSlot}
        </Card>
      )}

      {/* ค่าปรับ block hidden for now (state/save wiring kept; see 8.1 เบี้ยปรับ). */}
    </Card>
  )
}

export default WOPaymentConditionsSection
