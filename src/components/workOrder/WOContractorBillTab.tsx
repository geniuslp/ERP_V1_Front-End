import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button, Col, DatePicker, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Tooltip, message,
} from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined, FileAddOutlined, EyeOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const labelStyle: React.CSSProperties = { color: '#374151', fontSize: 13, marginBottom: 4 }
const fieldStyle: React.CSSProperties = { width: '100%', borderRadius: 8 }
const subCardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
}
const FIELD_SPAN = { xs: 24, sm: 12, md: 6 }

type BillType = 'ADV' | 'PROGRESS' | 'RETENTION'
type BillStatus = 'DRAFT' | 'SAVED'

const BILL_TYPE_OPTIONS: { value: BillType; label: string }[] = [
  { value: 'ADV', label: 'Advance Payment' },
  { value: 'PROGRESS', label: 'Work Progress' },
  { value: 'RETENTION', label: 'Retention' },
]
const BILL_TYPE_LABEL: Record<BillType, string> = {
  ADV: 'Advance Payment',
  PROGRESS: 'Work Progress',
  RETENTION: 'Retention',
}

// หัก ณ ที่จ่าย: type picks the default rate; the rate itself stays editable.
const WHT_TYPE_OPTIONS = [
  { value: 'ค่าจ้างรับเหมา', label: 'ค่าจ้างรับเหมา', rate: 3 },
  { value: 'ค่าบริการ', label: 'ค่าบริการ', rate: 3 },
  { value: 'ค่าเช่า', label: 'ค่าเช่า', rate: 5 },
  { value: 'ค่าขนส่ง', label: 'ค่าขนส่ง', rate: 1 },
]

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100
const money = (v: number) => v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const errText = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.response?.data?.error || fallback

interface InvoiceRow {
  key: number
  invoice_no: string
  invoice_date: string | null
  delivery_date: string | null
  bill_date: string | null
  pay_date: string | null
  amount: number | null
}

interface BillListItem {
  id: number
  bill_type: BillType
  installment_no: number | null
  ap_voucher_no: string | null
  net_amount: number
  status: BillStatus
}

interface WoInstallment {
  installment_no: number
  description?: string | null
  percent_of_contract?: number | null
  amount?: number | null
}

interface Props {
  logId?: number
  // Saves tab 1's data first (and creates the record on the first save); resolves to the record id.
  onEnsureLog?: () => Promise<number>
  // Called after a bill was saved, with the record id.
  onBillSaved?: (recordId: number) => void
  woId?: number
  supplierName?: string
  creditTermDays?: number | null
  contractAmount: number
  // Contract value minus the advance: the base of "เงินงวดนี้" %. Falls back to contractAmount until the summary loads.
  paymentBase?: number
  // Tab 1 table values, used only as defaults for a new bill.
  defaultAdvPct?: number | null
  defaultRetentionPct?: number | null
}

interface InvoiceHistoryRow {
  bill_id: number
  bill_no: number
  bill_type: BillType
  installment_no: number | null
  status: BillStatus
  invoice_no: string | null
  invoice_date: string | null
  delivery_date: string | null
  bill_date: string | null
  pay_date: string | null
  invoice_amount: number | null
}

interface BillDetail {
  id: number
  bill_type: BillType
  installment_no: number | null
  status: BillStatus
  progress_note: string | null
  subtotal: number
  net_amount: number
  lines: { line_code: string; percent: number | null; amount: number }[]
}

// Order and wording of the lines in the "what was paid" popup (same as the summary table of the form).
const DETAIL_LINES: { code: string; label: string }[] = [
  { code: 'ADV', label: '1. เงินเบิกล่วงหน้า (ADV. PAYMENT)' },
  { code: 'PROGRESS', label: '2. เงินงวดนี้' },
  { code: 'ADV_DEDUCT', label: '3. หักเงินจ่ายล่วงหน้า' },
  { code: 'VAT', label: '4. ภาษีมูลค่าเพิ่ม (VAT)' },
  { code: 'SUBTOTAL', label: 'รวมเป็นเงิน (1)' },
  { code: 'RETENTION', label: '5. หักเงินประกันผลงาน' },
  { code: 'WHT', label: '6. หัก ณ ที่จ่าย' },
  { code: 'OTHER', label: '7. หักอื่นๆ' },
  { code: 'NET', label: 'จ่ายสุทธิ' },
]

interface BillForm {
  bill_type: BillType
  installment_no: number | null
  ap_voucher_no: string
  pay_to: string
  credit_term_days: number | null
  description: string
  progress_installment_no: number | null
  progress_amount: number
  progress_pct: number
  progress_note: string
  adv_pct: number
  adv_deduct_pct: number
  vat_pct: number
  retention_pct: number
  retention_amount: number | null // set once the amount is typed by hand; null = follows retention_pct
  wht_type: string
  wht_pct: number
  other_amount: number
}

const WOContractorBillTab: React.FC<Props> = ({
  logId, onEnsureLog, onBillSaved, woId, supplierName, creditTermDays, contractAmount, paymentBase, defaultAdvPct, defaultRetentionPct,
}) => {
  const installmentBase = paymentBase && paymentBase > 0 ? paymentBase : contractAmount
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const headers = { Authorization: `Bearer ${accessToken}` }

  // Defaults for the next new bill (set after a save and when the list loads): the installment after the highest
  // saved one, and PROGRESS once an advance bill exists.
  const nextDefaults = useRef<{ bill_type: BillType; installment_no: number }>({ bill_type: 'ADV', installment_no: 1 })
  const computeNext = (list: { bill_type: BillType; installment_no: number | null }[]) => {
    const maxNo = list.reduce((m, b) => Math.max(m, b.installment_no ?? 0), 0)
    nextDefaults.current = {
      bill_type: list.some((b) => b.bill_type === 'ADV') ? 'PROGRESS' : 'ADV',
      installment_no: maxNo + 1,
    }
  }

  const newForm = useCallback((): BillForm => ({
    bill_type: nextDefaults.current.bill_type,
    installment_no: nextDefaults.current.installment_no,
    ap_voucher_no: '',
    pay_to: supplierName ?? '',
    credit_term_days: creditTermDays ?? null,
    description: '',
    progress_installment_no: null,
    progress_amount: 0,
    progress_pct: 0,
    progress_note: '',
    adv_pct: defaultAdvPct ?? 0,
    adv_deduct_pct: 0,
    vat_pct: 7,
    retention_pct: defaultRetentionPct ?? 0,
    retention_amount: null,
    wht_type: WHT_TYPE_OPTIONS[0].value,
    wht_pct: WHT_TYPE_OPTIONS[0].rate,
    other_amount: 0,
  }), [supplierName, creditTermDays, defaultAdvPct, defaultRetentionPct])

  const [bills, setBills] = useState<BillListItem[]>([])
  const [billId, setBillId] = useState<number | null>(null)
  const [billStatus, setBillStatus] = useState<BillStatus>('DRAFT')
  const [f, setF] = useState<BillForm>(newForm())
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [installments, setInstallments] = useState<WoInstallment[]>([])
  // Invoices of every payment (bill) of this contract, shown under the invoice table being filled in.
  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceHistoryRow[]>([])
  const [saving, setSaving] = useState(false)
  // Popup with what a past payment (bill) paid: every summary line with its % and amount.
  const [detail, setDetail] = useState<BillDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const keySeq = useRef(0)

  const patch = (p: Partial<BillForm>) => setF((prev) => ({ ...prev, ...p }))

  const loadBills = useCallback(async () => {
    if (!logId) return
    try {
      const res = await axios.get(`${BASE_URL}/wo-contractor-log/${logId}/bills`, { headers })
      const list: BillListItem[] = Array.isArray(res.data?.data) ? res.data.data : []
      computeNext(list)
      setBills(list)
      const inv = await axios.get(`${BASE_URL}/wo-contractor-log/${logId}/invoices`, { headers })
      setInvoiceHistory(Array.isArray(inv.data?.data) ? inv.data.data : [])
    } catch (e) {
      message.error(errText(e, 'โหลดรายการรับวางบิลไม่สำเร็จ'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId])

  useEffect(() => { loadBills() }, [loadBills])

  // Progress bills pick one of the WO's contract installments (งวดงาน) for the "เงินงวดนี้" line.
  useEffect(() => {
    if (!woId) return
    ;(async () => {
      try {
        const res = await axios.get(`${BASE_URL}/work-order/${woId}/payment-conditions`, { headers })
        const list = res.data?.data?.installments
        setInstallments(Array.isArray(list) ? list : [])
      } catch {
        setInstallments([])
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [woId])

  // A new (unsaved) bill picks up the supplier / credit term once tab 1's data has loaded.
  useEffect(() => {
    if (billId === null) setF(newForm())
  }, [billId, newForm])

  const showDetail = async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/wo-contractor-log/bills/${id}`, { headers })
      setDetail(res.data?.data ?? null)
    } catch (e) {
      message.error(errText(e, 'โหลดรายละเอียดการจ่ายไม่สำเร็จ'))
    } finally {
      setDetailLoading(false)
    }
  }

  const detailRows = useMemo(() => {
    if (!detail) return []
    const byCode = new Map(detail.lines.map((l) => [l.line_code, l]))
    return DETAIL_LINES.map((d) => {
      if (d.code === 'SUBTOTAL') return { ...d, percent: null, amount: Number(detail.subtotal), strong: true }
      if (d.code === 'NET') return { ...d, percent: null, amount: Number(detail.net_amount), strong: true }
      const l = byCode.get(d.code)
      return { ...d, percent: l?.percent ?? null, amount: Number(l?.amount ?? 0), strong: false }
    })
  }, [detail])

  const startNew = () => {
    setBillId(null)
    setBillStatus('DRAFT')
    setInvoices([])
    setF(newForm())
  }

  const openBill = async (id: number) => {
    try {
      const res = await axios.get(`${BASE_URL}/wo-contractor-log/bills/${id}`, { headers })
      const d = res.data?.data
      const line = (code: string) => (d.lines ?? []).find((l: any) => l.line_code === code)
      setBillId(id)
      setBillStatus(d.status)
      setF({
        bill_type: d.bill_type,
        installment_no: d.installment_no,
        ap_voucher_no: d.ap_voucher_no ?? '',
        pay_to: d.pay_to ?? '',
        credit_term_days: d.credit_term_days,
        description: d.description ?? '',
        progress_installment_no: d.progress_installment_no,
        progress_amount: Number(line('PROGRESS')?.amount ?? 0),
        progress_note: d.progress_note ?? '',
        progress_pct: line('PROGRESS')?.percent != null
          ? Number(line('PROGRESS')?.percent)
          : pctOfContract(Number(line('PROGRESS')?.amount ?? 0)),
        adv_pct: Number(line('ADV')?.percent ?? 0),
        adv_deduct_pct: Number(line('ADV_DEDUCT')?.percent ?? 0),
        vat_pct: Number(line('VAT')?.percent ?? 0),
        retention_pct: Number(line('RETENTION')?.percent ?? 0),
        // A saved amount that doesn't follow its % was typed by hand: keep it as typed.
        retention_amount: (() => {
          const amt = Number(line('RETENTION')?.amount ?? 0)
          const base = Number(line('ADV')?.amount ?? 0) + Number(line('PROGRESS')?.amount ?? 0)
          return Math.abs(amt - round2((base * Number(line('RETENTION')?.percent ?? 0)) / 100)) > 0.01 ? amt : null
        })(),
        wht_type: d.wht_type ?? WHT_TYPE_OPTIONS[0].value,
        wht_pct: Number(line('WHT')?.percent ?? 0),
        other_amount: Number(line('OTHER')?.amount ?? 0),
      })
      setInvoices((d.invoices ?? []).map((r: any) => ({
        key: ++keySeq.current,
        invoice_no: r.invoice_no ?? '',
        invoice_date: r.invoice_date,
        delivery_date: r.delivery_date,
        bill_date: r.bill_date,
        pay_date: r.pay_date,
        amount: r.invoice_amount ?? null,
      })))
    } catch (e) {
      message.error(errText(e, 'โหลดข้อมูลไม่สำเร็จ'))
    }
  }

  // เงินงวดนี้: % of the contract value <-> amount, either one can be typed and the other follows.
  const pctOfContract = (amount: number) => (installmentBase > 0 ? round2((amount / installmentBase) * 100) : 0)

  // ── Summary (สรุปรายการเบิก), all AUTO from the percentages / typed amounts ──
  const calc = useMemo(() => {
    const adv = f.bill_type === 'ADV' ? round2(contractAmount * f.adv_pct / 100) : 0
    const progress = f.progress_amount
    const base = adv + progress
    const advDeduct = round2(base * f.adv_deduct_pct / 100)
    const afterDeduct = base - advDeduct
    const vat = round2(afterDeduct * f.vat_pct / 100)
    const subtotal = round2(afterDeduct + vat)
    // 5. retention: the % and the amount are both typeable; the one typed last wins and the other follows.
    const retention = f.retention_amount ?? round2(base * f.retention_pct / 100)
    const retentionPct = f.retention_amount != null
      ? (base > 0 ? round2((f.retention_amount / base) * 100) : 0)
      : f.retention_pct
    const wht = round2(afterDeduct * f.wht_pct / 100)
    const net = round2(subtotal - retention - wht - f.other_amount)
    return { adv, progress, advDeduct, vat, subtotal, retention, retentionPct, wht, net }
  }, [f, contractAmount])

  const invoiceTotal = useMemo(() => round2(invoices.reduce((s, r) => s + (r.amount ?? 0), 0)), [invoices])
  const historyTotal = useMemo(() => round2(invoiceHistory.reduce((s, r) => s + (r.invoice_amount ?? 0), 0)), [invoiceHistory])

  // "งวดที่" (top) and the installment of "2. เงินงวดนี้" are one value: changing either one changes both, and a number
  // that matches one of the WO's installments (งวดงาน) fills the amount / % too (still editable afterwards).
  const setInstallmentNo = (no: number | null) => {
    const ins = no == null ? undefined : installments.find((i) => i.installment_no === no)
    if (!ins) {
      patch({ installment_no: no, progress_installment_no: no })
      return
    }
    patch({
      installment_no: no,
      progress_installment_no: no,
      progress_amount: Number(ins.amount ?? 0),
      progress_pct: pctOfContract(Number(ins.amount ?? 0)),
    })
  }

  const setInvoice = (key: number, p: Partial<InvoiceRow>) =>
    setInvoices((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)))

  const dateCell = (key: number, field: 'invoice_date' | 'delivery_date' | 'bill_date' | 'pay_date', v: string | null) => (
    <DatePicker
      style={{ width: '100%' }}
      format="DD/MM/YYYY"
      value={v ? dayjs(v) : null}
      onChange={(d) => setInvoice(key, { [field]: d ? d.format('YYYY-MM-DD') : null })}
    />
  )

  const invoiceColumns: ColumnsType<InvoiceRow> = [
    {
      title: 'ใบกำกับภาษี / INVOICE NO.', dataIndex: 'invoice_no', width: 220,
      render: (v: string, r) => <Input value={v} onChange={(e) => setInvoice(r.key, { invoice_no: e.target.value })} />,
    },
    { title: 'INVOICE DATE', dataIndex: 'invoice_date', width: 160, render: (v, r) => dateCell(r.key, 'invoice_date', v) },
    {
      title: 'มูลค่า/INV ที่เบิก', dataIndex: 'amount', width: 170, align: 'right',
      render: (v: number | null, r) => (
        <InputNumber<number>
          style={{ width: '100%' }}
          min={0}
          precision={2}
          controls={false}
          placeholder="0.00"
          value={v ?? undefined}
          onChange={(val) => setInvoice(r.key, { amount: val ?? null })}
        />
      ),
    },
    { title: 'วันที่ส่งมอบงาน', dataIndex: 'delivery_date', width: 160, render: (v, r) => dateCell(r.key, 'delivery_date', v) },
    { title: 'วันที่วางบิล', dataIndex: 'bill_date', width: 160, render: (v, r) => dateCell(r.key, 'bill_date', v) },
    { title: 'วันที่จ่าย', dataIndex: 'pay_date', width: 160, render: (v, r) => dateCell(r.key, 'pay_date', v) },
    {
      title: '', width: 48,
      render: (_, r) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setInvoices((p) => p.filter((x) => x.key !== r.key))} />
      ),
    },
  ]

  const pctInput = (value: number, onChange: (v: number) => void, disabled = false) => (
    <InputNumber<number>
      style={{ width: 110 }}
      min={0}
      max={100}
      precision={2}
      controls={false}
      disabled={disabled}
      addonAfter="%"
      value={value}
      onChange={(v) => onChange(v ?? 0)}
    />
  )

  interface SummaryRow {
    key: string
    label: React.ReactNode
    pct?: React.ReactNode
    amount: React.ReactNode
    strong?: boolean
  }

  const amountText = (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(v)}</span>
  const isAdv = f.bill_type === 'ADV'

  const summaryRows: SummaryRow[] = [
    {
      key: 'adv',
      label: '1. เงินเบิกล่วงหน้า (ADV. PAYMENT)',
      pct: pctInput(f.adv_pct, (v) => patch({ adv_pct: v }), !isAdv),
      amount: amountText(calc.adv),
    },
    {
      key: 'progress',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flexShrink: 0 }}>2. เงินงวดนี้ งวดที่</span>
          {/* One joined field: installment number + free-text detail */}
          <Space.Compact size="small" style={{ flex: 1, minWidth: 0 }}>
            <InputNumber<number>
              min={1}
              precision={0}
              controls={false}
              style={{ width: 64 }}
              value={f.installment_no ?? undefined}
              onChange={(v) => setInstallmentNo(v ?? null)}
            />
            <Input
              maxLength={500}
              placeholder="ระบุงวด/รายละเอียดเงินงวดนี้"
              value={f.progress_note}
              onChange={(e) => patch({ progress_note: e.target.value })}
            />
          </Space.Compact>
        </div>
      ),
      pct: pctInput(
        f.progress_pct,
        (v) => patch({ progress_pct: v, progress_amount: round2((installmentBase * v) / 100) }),
      ),
      amount: (
        <InputNumber<number>
          style={{ width: 180 }}
          min={0}
          precision={2}
          controls={false}
          value={f.progress_amount}
          onChange={(v) => patch({ progress_amount: v ?? 0, progress_pct: pctOfContract(v ?? 0) })}
        />
      ),
    },
    {
      key: 'advDeduct',
      label: '3. หักเงินจ่ายล่วงหน้า',
      pct: pctInput(f.adv_deduct_pct, (v) => patch({ adv_deduct_pct: v })),
      amount: amountText(calc.advDeduct),
    },
    {
      key: 'vat',
      label: '4. ภาษีมูลค่าเพิ่ม (VAT)',
      pct: pctInput(f.vat_pct, (v) => patch({ vat_pct: v })),
      amount: amountText(calc.vat),
    },
    { key: 'subtotal', label: 'รวมเป็นเงิน (1)', amount: amountText(calc.subtotal), strong: true },
    {
      key: 'retention',
      label: '5. หักเงินประกันผลงาน',
      pct: pctInput(calc.retentionPct, (v) => patch({ retention_pct: v, retention_amount: null })),
      amount: (
        <InputNumber<number>
          style={{ width: 180 }}
          min={0}
          precision={2}
          controls={false}
          value={calc.retention}
          onChange={(v) => patch({ retention_amount: v ?? 0 })}
        />
      ),
    },
    {
      key: 'wht',
      label: (
        <Space wrap>
          <span>6. หัก ณ ที่จ่าย</span>
          <Select
            size="small"
            style={{ minWidth: 150 }}
            value={f.wht_type}
            options={WHT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) => {
              const opt = WHT_TYPE_OPTIONS.find((o) => o.value === v)
              patch({ wht_type: v, wht_pct: opt ? opt.rate : f.wht_pct })
            }}
          />
        </Space>
      ),
      pct: pctInput(f.wht_pct, (v) => patch({ wht_pct: v })),
      amount: amountText(calc.wht),
    },
    {
      key: 'other',
      label: '7. หักอื่นๆ',
      amount: (
        <InputNumber<number>
          style={{ width: 180 }}
          min={0}
          precision={2}
          controls={false}
          value={f.other_amount}
          onChange={(v) => patch({ other_amount: v ?? 0 })}
        />
      ),
    },
    { key: 'net', label: 'จ่ายสุทธิ', amount: amountText(calc.net), strong: true },
  ]

  const summaryColumns: ColumnsType<SummaryRow> = [
    {
      title: 'สรุปรายการเบิก', dataIndex: 'label',
      render: (v, r) => (r.strong ? <strong>{v}</strong> : v),
    },
    { title: '%', dataIndex: 'pct', width: 160 },
    {
      title: 'จำนวนเงิน', dataIndex: 'amount', width: 220, align: 'right',
      render: (v, r) => (r.strong ? <strong>{v}</strong> : v),
    },
  ]

  const buildPayload = (status: BillStatus) => ({
    bill_type: f.bill_type,
    installment_no: f.installment_no,
    ap_voucher_no: f.ap_voucher_no.trim() || null,
    pay_to: f.pay_to.trim() || null,
    credit_term_days: f.credit_term_days,
    description: f.description.trim() || null,
    progress_installment_no: f.progress_installment_no,
    progress_note: f.progress_note.trim() || null,
    wht_type: f.wht_type,
    status,
    lines: [
      { line_code: 'ADV', percent: f.adv_pct, amount: calc.adv },
      { line_code: 'PROGRESS', percent: f.progress_pct, amount: calc.progress },
      { line_code: 'ADV_DEDUCT', percent: f.adv_deduct_pct, amount: calc.advDeduct },
      { line_code: 'VAT', percent: f.vat_pct, amount: calc.vat },
      { line_code: 'RETENTION', percent: calc.retentionPct, amount: calc.retention },
      { line_code: 'WHT', percent: f.wht_pct, amount: calc.wht },
      { line_code: 'OTHER', percent: null, amount: f.other_amount },
    ],
    invoices: invoices.map((r) => ({
      invoice_no: r.invoice_no.trim() || null,
      invoice_date: r.invoice_date,
      delivery_date: r.delivery_date,
      bill_date: r.bill_date,
      pay_date: r.pay_date,
      invoice_amount: r.amount,
    })),
  })

  const handleSave = async (status: BillStatus) => {
    setSaving(true)
    try {
      // tab 1's data is saved first (this tab is the only place that saves)
      const recordId = onEnsureLog ? await onEnsureLog() : logId
      if (!recordId) return
      const payload = buildPayload(status)
      if (billId) {
        await axios.put(`${BASE_URL}/wo-contractor-log/bills/${billId}`, payload, { headers })
      } else {
        const res = await axios.post(`${BASE_URL}/wo-contractor-log/${recordId}/bills`, payload, { headers })
        setBillId(res.data?.data?.id ?? null)
      }
      setBillStatus(status)
      message.success(status === 'DRAFT' ? 'บันทึกฉบับร่างเรียบร้อยแล้ว' : 'บันทึกข้อมูลเรียบร้อยแล้ว')
      await loadBills()
      onBillSaved?.(recordId)
      // The saved values stay on screen (clearing them looked like nothing was saved); "สร้างรายการใหม่" starts the next bill.
    } catch (e) {
      message.error(errText(e, 'บันทึกข้อมูลไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  const billColumns: ColumnsType<BillListItem> = [
    { title: 'ประเภท', dataIndex: 'bill_type', render: (v: BillType) => BILL_TYPE_LABEL[v] },
    { title: 'งวดที่', dataIndex: 'installment_no', width: 90, render: (v) => v ?? '—' },
    { title: 'AP Voucher No.', dataIndex: 'ap_voucher_no', render: (v) => v || '—' },
    { title: 'จ่ายสุทธิ', dataIndex: 'net_amount', align: 'right', render: (v: number) => money(Number(v)) },
    {
      title: 'สถานะ', dataIndex: 'status', width: 100,
      render: (v: BillStatus) => <Tag color={v === 'SAVED' ? 'green' : 'default'}>{v === 'SAVED' ? 'SAVE' : 'DRAFT'}</Tag>,
    },
  ]

  return (
    <div>
      <div style={subCardStyle}>
        <Row gutter={[16, 12]}>
          <Col {...FIELD_SPAN}>
            <div style={labelStyle}>ประเภทรับวางบิล</div>
            <Select
              style={fieldStyle}
              value={f.bill_type}
              options={BILL_TYPE_OPTIONS}
              onChange={(v: BillType) => patch({ bill_type: v })}
            />
          </Col>
          <Col {...FIELD_SPAN}>
            <div style={labelStyle}>งวดที่</div>
            <InputNumber<number>
              style={fieldStyle}
              min={1}
              precision={0}
              value={f.installment_no ?? undefined}
              onChange={(v) => setInstallmentNo(v ?? null)}
            />
          </Col>
          <Col {...FIELD_SPAN}>
            <Tooltip title="ฝ่ายบัญชีเป็นผู้กรอก">
              <div style={labelStyle}>AP Voucher No.*</div>
              <Input
                style={{ ...fieldStyle, background: '#fef9c3' }}
                value={f.ap_voucher_no}
                onChange={(e) => patch({ ap_voucher_no: e.target.value })}
              />
            </Tooltip>
          </Col>
          <Col {...FIELD_SPAN}>
            <div style={labelStyle}>PAY TO (ชื่อผู้รับเงิน)</div>
            <Input style={fieldStyle} value={f.pay_to} onChange={(e) => patch({ pay_to: e.target.value })} />
          </Col>
          <Col {...FIELD_SPAN}>
            <div style={labelStyle}>Credit Term</div>
            <InputNumber<number>
              style={fieldStyle}
              min={0}
              precision={0}
              addonAfter="วัน"
              placeholder="AUTO"
              value={f.credit_term_days ?? undefined}
              onChange={(v) => patch({ credit_term_days: v ?? null })}
            />
          </Col>
          <Col xs={24} md={18}>
            <div style={labelStyle}>รายละเอียด</div>
            <Input.TextArea
              style={fieldStyle}
              autoSize={{ minRows: 2 }}
              value={f.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Col>
        </Row>
      </div>

      <div style={subCardStyle}>
        <Table<InvoiceRow>
          rowKey="key"
          size="small"
          pagination={false}
          dataSource={invoices}
          columns={invoiceColumns}
          scroll={{ x: 1070 }}
          locale={{ emptyText: 'ยังไม่มีใบกำกับภาษี' }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2} align="right"><strong>รวมมูลค่า/INV ที่เบิก</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><strong>{money(invoiceTotal)}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={3} colSpan={4} />
            </Table.Summary.Row>
          )}
        />
        <div style={{ marginTop: 12 }}>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setInvoices((p) => [...p, {
              key: ++keySeq.current, invoice_no: '', invoice_date: null, delivery_date: null, bill_date: null, pay_date: null, amount: null,
            }])}
          >
            เพิ่มใบกำกับภาษี
          </Button>
        </div>
      </div>

      <div style={subCardStyle}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>ใบกำกับภาษีของทุกครั้งที่จ่าย</div>
        <Table<InvoiceHistoryRow>
          rowKey={(r) => `${r.bill_id}-${r.invoice_no ?? ''}-${r.invoice_date ?? ''}-${r.pay_date ?? ''}`}
          size="small"
          pagination={false}
          dataSource={invoiceHistory}
          scroll={{ x: 1170 }}
          locale={{ emptyText: 'ยังไม่มีรายการที่บันทึก' }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4} align="right"><strong>รวมมูลค่า/INV ที่เบิก</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right"><strong>{money(historyTotal)}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={5} colSpan={5} />
            </Table.Summary.Row>
          )}
          rowClassName={(r) => (r.bill_id === billId ? 'ant-table-row-selected' : '')}
          columns={[
            { title: 'ครั้งที่จ่าย', dataIndex: 'bill_no', width: 100, align: 'center' as const },
            { title: 'ประเภท', dataIndex: 'bill_type', width: 150, render: (v: BillType) => BILL_TYPE_LABEL[v] ?? v },
            { title: 'ใบกำกับภาษี / INVOICE NO.', dataIndex: 'invoice_no', render: (v: string | null) => v || '—' },
            { title: 'INVOICE DATE', dataIndex: 'invoice_date', width: 130, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—') },
            {
              title: 'มูลค่า/INV ที่เบิก', dataIndex: 'invoice_amount', width: 150, align: 'right' as const,
              render: (v: number | null) => (v == null ? '—' : money(Number(v))),
            },
            { title: 'วันที่ส่งมอบงาน', dataIndex: 'delivery_date', width: 130, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—') },
            { title: 'วันที่วางบิล', dataIndex: 'bill_date', width: 130, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—') },
            { title: 'วันที่จ่าย', dataIndex: 'pay_date', width: 130, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—') },
            {
              title: 'สถานะ', dataIndex: 'status', width: 90,
              render: (v: BillStatus) => <Tag color={v === 'SAVED' ? 'green' : 'default'}>{v === 'SAVED' ? 'SAVE' : 'DRAFT'}</Tag>,
            },
            {
              title: '', width: 120,
              render: (_: unknown, r: InvoiceHistoryRow) => (
                <Button size="small" icon={<EyeOutlined />} onClick={() => showDetail(r.bill_id)}>รายละเอียด</Button>
              ),
            },
          ]}
        />
        <Modal
          open={!!detail || detailLoading}
          onCancel={() => setDetail(null)}
          footer={<Button onClick={() => setDetail(null)}>ปิด</Button>}
          width={620}
          loading={detailLoading}
          title={detail
            ? `รายละเอียดการจ่าย — ${BILL_TYPE_LABEL[detail.bill_type] ?? detail.bill_type}${detail.installment_no ? ` งวดที่ ${detail.installment_no}` : ''}`
            : 'รายละเอียดการจ่าย'}
        >
          {detail?.progress_note ? <div style={{ marginBottom: 8, color: '#6b7280' }}>{detail.progress_note}</div> : null}
          <Table
            rowKey="code"
            size="small"
            pagination={false}
            dataSource={detailRows}
            columns={[
              { title: 'รายการ', dataIndex: 'label', render: (v: string, r: { strong: boolean }) => (r.strong ? <strong>{v}</strong> : v) },
              {
                title: '%', dataIndex: 'percent', width: 100, align: 'right' as const,
                render: (v: number | null) => (v == null ? '—' : `${money(Number(v))}%`),
              },
              {
                title: 'จำนวนเงิน', dataIndex: 'amount', width: 160, align: 'right' as const,
                render: (v: number, r: { strong: boolean }) => (r.strong ? <strong>{money(v)}</strong> : money(v)),
              },
            ]}
          />
        </Modal>
      </div>

      <div style={subCardStyle}>
        <Table<SummaryRow>
          rowKey="key"
          size="small"
          pagination={false}
          dataSource={summaryRows}
          columns={summaryColumns}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={startNew} disabled={saving}>สร้างรายการใหม่</Button>
        <Button loading={saving} onClick={() => handleSave('DRAFT')}>บันทึกร่าง</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => handleSave('SAVED')}>บันทึก</Button>
      </div>
      {billId ? (
        <div style={{ textAlign: 'right', marginTop: 8, color: '#6b7280', fontSize: 12 }}>
          สถานะปัจจุบัน: {billStatus === 'SAVED' ? 'SAVE' : 'DRAFT'}
        </div>
      ) : null}
    </div>
  )
}

export default WOContractorBillTab
