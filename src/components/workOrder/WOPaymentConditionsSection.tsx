import React from 'react'
import { Card, Table, Button, Input, InputNumber, DatePicker, Select } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { WO_PAYMENT_STATUS_LABEL } from '@/types/workOrder'
import type {
  WOPaymentInstallment, WOPaymentRetention, WOPaymentPenalty, WOPaymentStatus, WOPaymentConditions,
} from '@/types/workOrder'

const DATE_FORMAT = 'YYYY-MM-DD'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const subCardStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  boxShadow: 'none',
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
}

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
}) => {
  // ── งวดงาน (installments) ──
  const renumberInstallments = (rows: InstallmentRow[]) => rows.map((r, idx) => ({ ...r, installment_no: idx + 1 }))
  const addInstallment = () => {
    onInstallmentsChange(renumberInstallments([...installments, emptyInstallmentRow()]))
  }
  const updateInstallment = (key: string, patch: Partial<InstallmentRow>) => {
    onInstallmentsChange(installments.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  const removeInstallment = (key: string) => {
    onInstallmentsChange(renumberInstallments(installments.filter((r) => r.key !== key)))
  }

  // ── เงินประกัน (retentions) ──
  const addRetention = () => {
    onRetentionsChange([...retentions, emptyRetentionRow()])
  }
  const updateRetention = (key: string, patch: Partial<RetentionRow>) => {
    onRetentionsChange(retentions.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  const removeRetention = (key: string) => {
    onRetentionsChange(retentions.filter((r) => r.key !== key))
  }

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

  const installmentColumns = [
    {
      title: 'งวดที่',
      dataIndex: 'installment_no',
      width: 64,
      align: 'center' as const,
      render: (v: number) => <span style={{ fontSize: 13, color: '#374151' }}>{v}</span>,
    },
    {
      title: 'รายละเอียดงาน/เงื่อนไข',
      key: 'description',
      render: (_: unknown, r: InstallmentRow) => (
        <Input
          size="small"
          value={r.description}
          placeholder="รายละเอียดงาน/เงื่อนไข"
          onChange={(e) => updateInstallment(r.key, { description: e.target.value })}
        />
      ),
    },
    {
      title: '% ของสัญญา',
      key: 'percent_of_contract',
      width: 110,
      render: (_: unknown, r: InstallmentRow) => (
        <InputNumber
          size="small"
          min={0}
          max={100}
          style={{ width: '100%' }}
          value={r.percent_of_contract ?? undefined}
          onChange={(v) => updateInstallment(r.key, { percent_of_contract: v ?? null })}
        />
      ),
    },
    {
      title: 'จำนวนเงิน',
      key: 'amount',
      width: 130,
      render: (_: unknown, r: InstallmentRow) => (
        <InputNumber
          size="small"
          min={0}
          style={{ width: '100%' }}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(v) => Number(v?.replace(/,/g, '') ?? 0) as 0}
          value={r.amount}
          onChange={(v) => updateInstallment(r.key, { amount: v ?? 0 })}
        />
      ),
    },
    {
      title: 'กำหนดวันครบกำหนดจ่าย',
      key: 'due_date',
      width: 160,
      render: (_: unknown, r: InstallmentRow) => (
        <DatePicker
          size="small"
          style={{ width: '100%' }}
          format="DD/MM/YYYY"
          value={r.due_date}
          onChange={(v) => updateInstallment(r.key, { due_date: v ?? undefined })}
        />
      ),
    },
    {
      title: 'สถานะจ่ายเงิน',
      key: 'payment_status',
      width: 130,
      render: (_: unknown, r: InstallmentRow) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={r.payment_status}
          options={Object.entries(WO_PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(v) => updateInstallment(r.key, { payment_status: v as WOPaymentStatus })}
        />
      ),
    },
    {
      title: 'หมายเหตุ',
      key: 'remarks',
      render: (_: unknown, r: InstallmentRow) => (
        <Input
          size="small"
          value={r.remarks}
          placeholder="หมายเหตุ"
          onChange={(e) => updateInstallment(r.key, { remarks: e.target.value })}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 40,
      align: 'center' as const,
      render: (_: unknown, r: InstallmentRow) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeInstallment(r.key)} />
      ),
    },
  ]

  const retentionColumns = [
    {
      title: 'รายละเอียด/เหตุผลการหัก',
      key: 'description',
      render: (_: unknown, r: RetentionRow) => (
        <Input
          size="small"
          value={r.description}
          placeholder="รายละเอียด/เหตุผลการหัก"
          onChange={(e) => updateRetention(r.key, { description: e.target.value })}
        />
      ),
    },
    {
      title: '% ของสัญญา',
      key: 'percent_of_contract',
      width: 110,
      render: (_: unknown, r: RetentionRow) => (
        <InputNumber
          size="small"
          min={0}
          max={100}
          style={{ width: '100%' }}
          value={r.percent_of_contract ?? undefined}
          onChange={(v) => updateRetention(r.key, { percent_of_contract: v ?? null })}
        />
      ),
    },
    {
      title: 'จำนวนเงิน',
      key: 'amount',
      width: 130,
      render: (_: unknown, r: RetentionRow) => (
        <InputNumber
          size="small"
          min={0}
          style={{ width: '100%' }}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(v) => Number(v?.replace(/,/g, '') ?? 0) as 0}
          value={r.amount}
          onChange={(v) => updateRetention(r.key, { amount: v ?? 0 })}
        />
      ),
    },
    {
      title: 'หมายเหตุ',
      key: 'remarks',
      render: (_: unknown, r: RetentionRow) => (
        <Input
          size="small"
          value={r.remarks}
          placeholder="หมายเหตุ"
          onChange={(e) => updateRetention(r.key, { remarks: e.target.value })}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 40,
      align: 'center' as const,
      render: (_: unknown, r: RetentionRow) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRetention(r.key)} />
      ),
    },
  ]

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
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removePenalty(r.key)} />
      ),
    },
  ]

  return (
    <Card title="เงื่อนไขการจ่ายเงิน" style={cardStyle}>
      <Card title="งวดงาน" size="small" style={subCardStyle}>
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          dataSource={installments}
          columns={installmentColumns}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'ยังไม่มีงวดงาน' }}
        />
        <div style={{ marginTop: 12 }}>
          <Button icon={<PlusOutlined />} size="small" onClick={addInstallment}>
            เพิ่มงวดงาน
          </Button>
        </div>
      </Card>

      <Card title="เงินประกัน" size="small" style={subCardStyle}>
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          dataSource={retentions}
          columns={retentionColumns}
          scroll={{ x: 700 }}
          locale={{ emptyText: 'ยังไม่มีรายการเงินประกัน' }}
        />
        <div style={{ marginTop: 12 }}>
          <Button icon={<PlusOutlined />} size="small" onClick={addRetention}>
            เพิ่มรายการเงินประกัน
          </Button>
        </div>
      </Card>

      <Card title="ค่าปรับ" size="small" style={{ ...subCardStyle, marginBottom: 0 }}>
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          dataSource={penalties}
          columns={penaltyColumns}
          scroll={{ x: 800 }}
          locale={{ emptyText: 'ยังไม่มีรายการค่าปรับ' }}
        />
        <div style={{ marginTop: 12 }}>
          <Button icon={<PlusOutlined />} size="small" onClick={addPenalty}>
            เพิ่มรายการค่าปรับ
          </Button>
        </div>
      </Card>
    </Card>
  )
}

export default WOPaymentConditionsSection
