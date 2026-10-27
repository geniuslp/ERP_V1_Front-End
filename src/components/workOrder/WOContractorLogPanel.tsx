import React, { useEffect, useState } from 'react'
import { Button, Col, Form, Input, InputNumber, Row, Select, Spin, Table, Tabs, message } from 'antd'
import axios from 'axios'
import type { ColumnsType } from 'antd/es/table'
import { useAppSelector } from '@/store'
import { useProjectOptions } from '@/hooks/useProjectOptions'
import WOContractorBillTab from '@/components/workOrder/WOContractorBillTab'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const labelStyle: React.CSSProperties = { color: '#374151', fontSize: 13 }
const fieldStyle: React.CSSProperties = { width: '100%', borderRadius: 8 }
const FIELD_SPAN = { xs: 24, sm: 12, md: 8 }

type ItemType = 'CONTRACT' | 'ADVANCE' | 'RETENTION'

interface TermRow {
  item_type: ItemType
  percent: number | null
  amount: number | null
  accumulate: number | null
  balance: number | null
}

const TERM_LABEL: Record<ItemType, string> = {
  CONTRACT: 'Contract',
  ADVANCE: 'Advance',
  RETENTION: 'Retention',
}

const emptyTerms = (): TermRow[] => [
  { item_type: 'CONTRACT', percent: 100, amount: null, accumulate: null, balance: null },
  { item_type: 'ADVANCE', percent: null, amount: null, accumulate: null, balance: null },
  { item_type: 'RETENTION', percent: null, amount: null, accumulate: null, balance: null },
]

const woProjectLabel = (code?: string | null, name?: string | null, text?: string | null) =>
  code ? `${code} ${name ?? ''}`.trim() : (text ?? '')

const errText = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.response?.data?.error || fallback

interface Props {
  woId: number
}

/**
 * บันทึกงานของผู้รับเหมาตามใบสั่งจ้าง for ONE work order, shown inside the finance WO detail page
 * (FinancePaymentDetailPage). Tab 1 ข้อมูลเอกสาร + tab 2 ประเภทรับวางบิล. One record per WO: it is looked up
 * by WO (GET /wo-contractor-log/by-wo/:woId) and created on the first save.
 */
const WOContractorLogPanel: React.FC<Props> = ({ woId }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const headers = { Authorization: `Bearer ${accessToken}` }
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('doc')
  const [logId, setLogId] = useState<number | undefined>()
  const [terms, setTerms] = useState<TermRow[]>(emptyTerms())
  // WO-derived values tab 2 needs (supplier for PAY TO, credit term from supplier.payment_terms).
  const [woCtx, setWoCtx] = useState<{ supplier?: string; credit?: number | null; contractAmount?: number }>({})

  const [pjCurrent, setPjCurrent] = useState<string | undefined>()
  const { options: projects, loading: projectsLoading } = useProjectOptions({}, pjCurrent)

  useEffect(() => {
    if (!accessToken || !woId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      form.resetFields()
      setLogId(undefined)
      setTerms(emptyTerms())
      setPjCurrent(undefined)
      try {
        const found = await axios.get(`${BASE_URL}/wo-contractor-log/by-wo/${woId}`, { headers })
        const existingId: number | undefined = found.data?.data?.id
        if (existingId) {
          // Saved record: WO info is live-read by the API, nothing is stored twice.
          const res = await axios.get(`${BASE_URL}/wo-contractor-log/${existingId}`, { headers })
          const d = res.data?.data
          if (cancelled) return
          setLogId(existingId)
          form.setFieldsValue({
            wo_no: d.wo_no,
            supplier_name: d.supplier_name ?? '',
            wo_project: woProjectLabel(d.wo_project_code, d.wo_project_name, d.wo_project_name_text),
            contract_description: d.contract_description ?? '',
            project_code: d.project_code ?? undefined,
          })
          setPjCurrent(d.project_code ?? undefined)
          setWoCtx({ supplier: d.supplier_name ?? '', credit: d.credit_term_days, contractAmount: Number(d.contract_amount ?? 0) })
          const saved: TermRow[] = Array.isArray(d.terms) ? d.terms : []
          setTerms(emptyTerms().map((t) => saved.find((s) => s.item_type === t.item_type) ?? t))
        } else {
          // Nothing saved yet: prefill from the work order (supplier, project, contract description, contract value).
          const res = await axios.get(`${BASE_URL}/work-order/${woId}`, { headers })
          const wo = res.data?.data
          if (cancelled) return
          form.setFieldsValue({
            wo_no: wo?.wo_no,
            supplier_name: wo?.supplier_name ?? '',
            wo_project: woProjectLabel(wo?.project_code, wo?.project_name, wo?.project_name_text),
            contract_description: wo?.contract_description ?? '',
          })
          setWoCtx({ supplier: wo?.supplier_name ?? '', credit: null, contractAmount: Number(wo?.contract_amount ?? 0) })
          setTerms((prev) => prev.map((t) => (t.item_type === 'CONTRACT' ? { ...t, amount: wo?.contract_amount ?? null } : t)))
        }
      } catch (e) {
        if (!cancelled) message.error(errText(e, 'โหลดข้อมูลบันทึกงานของผู้รับเหมาไม่สำเร็จ'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, woId])

  const setTerm = (type: ItemType, patch: Partial<TermRow>) =>
    setTerms((prev) => prev.map((t) => (t.item_type === type ? { ...t, ...patch } : t)))

  const numCell = (type: ItemType, key: 'percent' | 'amount' | 'accumulate' | 'balance', isPct = false) => (
    <InputNumber<number>
      style={{ width: '100%' }}
      min={0}
      precision={2}
      controls={false}
      value={terms.find((t) => t.item_type === type)?.[key] ?? undefined}
      onChange={(v) => setTerm(type, { [key]: v ?? null })}
      addonAfter={isPct ? '%' : undefined}
      formatter={isPct ? undefined : (v) => (v === undefined ? '' : `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
      parser={isPct ? undefined : (v) => Number((v ?? '').replace(/,/g, ''))}
    />
  )

  const columns: ColumnsType<TermRow> = [
    { title: 'รายการ (Item)', dataIndex: 'item_type', render: (t: ItemType) => TERM_LABEL[t], width: 160 },
    { title: '%', width: 140, render: (_, r) => numCell(r.item_type, 'percent', true) },
    { title: 'Amount', width: 200, render: (_, r) => numCell(r.item_type, 'amount') },
    { title: 'Accumulate (สะสม)', width: 200, render: (_, r) => numCell(r.item_type, 'accumulate') },
    { title: 'Balance', width: 200, render: (_, r) => numCell(r.item_type, 'balance') },
  ]

  // Saves the tab 1 data (project + Contract/Advance/Retention table), creating the record on the first call, and
  // returns its id. Tab 2's บันทึกร่าง / บันทึก buttons call this before saving the bill, so tab 2 is the only place
  // that saves. Throws on failure (the caller shows the error).
  const ensureLog = async (): Promise<number> => {
    const payload = { wo_id: woId, project_code: form.getFieldValue('project_code') ?? null, terms }
    if (logId) {
      await axios.put(`${BASE_URL}/wo-contractor-log/${logId}`, payload, { headers })
      return logId
    }
    const res = await axios.post(`${BASE_URL}/wo-contractor-log`, payload, { headers })
    const newId: number = res.data?.data?.id
    setLogId(newId)
    return newId
  }

  // After a bill is saved: pick up the credit term (AUTO) from the saved record's supplier join for the next bill.
  const refreshCredit = async (id: number) => {
    try {
      const g = await axios.get(`${BASE_URL}/wo-contractor-log/${id}`, { headers })
      setWoCtx((p) => ({ ...p, credit: g.data?.data?.credit_term_days ?? null }))
    } catch { /* tab 2 simply keeps the credit term it has */ }
  }

  const docTab = (
    <Form autoComplete="off" form={form} layout="vertical">
      <Row gutter={[16, 0]}>
        <Col {...FIELD_SPAN}>
          <Form.Item label={<span style={labelStyle}>เอกสารหนังสือสั่งจ้าง</span>} name="wo_no">
            <Input style={fieldStyle} readOnly />
          </Form.Item>
        </Col>
        <Col {...FIELD_SPAN}>
          <Form.Item label={<span style={labelStyle}>ผู้รับจ้าง</span>} name="supplier_name">
            <Input style={fieldStyle} readOnly placeholder="AUTO" />
          </Form.Item>
        </Col>
        <Col {...FIELD_SPAN}>
          <Form.Item label={<span style={labelStyle}>โครงการ/แผนก</span>} name="wo_project">
            <Input style={fieldStyle} readOnly placeholder="AUTO" />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item label={<span style={labelStyle}>ลักษณะสัญญา</span>} name="contract_description">
            <Input.TextArea style={fieldStyle} readOnly autoSize={{ minRows: 3 }} placeholder="AUTO" />
          </Form.Item>
        </Col>
      </Row>

      <div style={{ marginBottom: 12 }}>
        <Button onClick={() => setActiveTab('billType')}>ประเภทวางบิล</Button>
      </div>

      <Table<TermRow>
        rowKey="item_type"
        size="small"
        pagination={false}
        dataSource={terms}
        columns={columns}
        scroll={{ x: 700 }}
        style={{ marginBottom: 20 }}
      />

      <Row gutter={[16, 0]}>
        <Col {...FIELD_SPAN}>
          <Form.Item label={<span style={labelStyle}>PJ</span>} name="project_code" style={{ marginBottom: 0 }}>
            <Select
              showSearch
              allowClear
              loading={projectsLoading}
              style={fieldStyle}
              placeholder="เลือกโครงการ"
              optionFilterProp="label"
              options={projects}
              onChange={(v?: string) => setPjCurrent(v)}
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  )

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
  }

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'doc', label: 'ข้อมูลเอกสาร', children: docTab },
          {
            key: 'billType',
            label: 'ประเภทรับวางบิล',
            children: (
              <WOContractorBillTab
                logId={logId}
                onEnsureLog={ensureLog}
                onBillSaved={refreshCredit}
                woId={woId}
                supplierName={woCtx.supplier}
                creditTermDays={woCtx.credit}
                contractAmount={terms.find((t) => t.item_type === 'CONTRACT')?.amount ?? woCtx.contractAmount ?? 0}
                defaultAdvPct={terms.find((t) => t.item_type === 'ADVANCE')?.percent}
                defaultRetentionPct={terms.find((t) => t.item_type === 'RETENTION')?.percent}
              />
            ),
          },
        ]}
      />
    </div>
  )
}

export default WOContractorLogPanel
