import React, { useEffect, useState } from 'react'
import { Button, Col, Form, Input, InputNumber, Popconfirm, Row, Select, Spin, Table, Tabs, Upload, message } from 'antd'
import { DeleteOutlined, InboxOutlined } from '@ant-design/icons'
import axios from 'axios'
import type { ColumnsType } from 'antd/es/table'
import { useAppSelector } from '@/store'
import { useProjectOptions } from '@/hooks/useProjectOptions'
import WOContractorBillTab from '@/components/workOrder/WOContractorBillTab'
import { WO_CONTRACT_DESCRIPTION_LABEL } from '@/types/workOrder'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const labelStyle: React.CSSProperties = { color: '#374151', fontSize: 13 }
const fieldStyle: React.CSSProperties = { width: '100%', borderRadius: 8 }
const FIELD_SPAN = { xs: 24, sm: 12, md: 8 }

type ItemType = 'CONTRACT' | 'ADVANCE' | 'RETENTION'

interface LogFile {
  id: number
  file_name: string
  file_path: string
  file_size?: number | null
  uploaded_at?: string | null
}

const fmtSize = (n?: number | null) => (n ? (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : '-')

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

// ลักษณะของสัญญา comes from the work order as created; an old WO may hold a dropdown code instead of text.
const woContractDescription = (v?: string | null) =>
  v ? (WO_CONTRACT_DESCRIPTION_LABEL[v as keyof typeof WO_CONTRACT_DESCRIPTION_LABEL] ?? v) : ''

const errText = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.response?.data?.error || fallback

interface Props {
  woId: number
  // Called with the contract money paid through all SAVED bills (ex VAT / WHT) and the WO contract value (on load and after every save).
  onBillsPaidChange?: (paid: number, contractAmount: number) => void
}

/**
 * บันทึกงานของผู้รับเหมาตามใบสั่งจ้าง for ONE work order, shown inside the finance WO detail page
 * (FinancePaymentDetailPage). Tab 1 ข้อมูลเอกสาร (Contract table / ประเภทวางบิล via two buttons) + tab 2 แนบไฟล์ PDF/JPEG. One record per WO: it is looked up
 * by WO (GET /wo-contractor-log/by-wo/:woId) and created on the first save.
 */
const WOContractorLogPanel: React.FC<Props> = ({ woId, onBillsPaidChange }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const headers = { Authorization: `Bearer ${accessToken}` }
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('doc')
  // Inside the document tab: nothing is shown until a button is pressed — Contract table or the bill form (ประเภทวางบิล).
  const [docView, setDocView] = useState<'contract' | 'bill' | null>(null)
  const [files, setFiles] = useState<LogFile[]>([])
  const [uploading, setUploading] = useState(false)
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
      setFiles([])
      setDocView(null)
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
          loadFiles(existingId)
          form.setFieldsValue({
            wo_no: d.wo_no,
            supplier_name: d.supplier_name ?? '',
            wo_project: woProjectLabel(d.wo_project_code, d.wo_project_name, d.wo_project_name_text),
            contract_description: woContractDescription(d.contract_description),
            // PJ defaults to the work order's project when none was chosen; still editable.
            project_code: d.project_code ?? d.wo_project_code ?? undefined,
          })
          setPjCurrent(d.project_code ?? d.wo_project_code ?? undefined)
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
            contract_description: woContractDescription(wo?.contract_description),
            // PJ defaults to the work order's project; the user can still change it.
            project_code: wo?.project_code ?? undefined,
          })
          setPjCurrent(wo?.project_code ?? undefined)
          setWoCtx({ supplier: wo?.supplier_name ?? '', credit: null, contractAmount: Number(wo?.contract_amount ?? 0) })
          setTerms((prev) => prev.map((t) => (t.item_type === 'CONTRACT' ? { ...t, amount: wo?.contract_amount ?? null } : t)))
        }
        if (!cancelled) await loadSummary()
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

  // Contract / Advance / Retention are calculated (GET /wo-contractor-log/summary/:woId) — shown read-only.
  const numCell = (type: ItemType, key: 'percent' | 'amount' | 'accumulate' | 'balance', isPct = false) => {
    const v = terms.find((t) => t.item_type === type)?.[key]
    const text = v == null ? '-' : isPct ? `${Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return <div style={{ textAlign: 'right', padding: '4px 0', fontVariantNumeric: 'tabular-nums' }}>{text}</div>
  }

  // Pulls the calculated rows; called on load and after a bill is saved (the totals change then).
  const loadSummary = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/wo-contractor-log/summary/${woId}`, { headers })
      const d = res.data?.data
      if (!d) return
      onBillsPaidChange?.(Number(d.bills_paid_total ?? 0), Number(d.contract?.amount ?? 0))
      setTerms([
        { item_type: 'CONTRACT', percent: d.contract.percent, amount: d.contract.amount, accumulate: d.contract.accumulate, balance: d.contract.balance },
        { item_type: 'ADVANCE', percent: d.advance.percent, amount: d.advance.amount, accumulate: d.advance.accumulate, balance: d.advance.balance },
        { item_type: 'RETENTION', percent: d.retention.percent, amount: d.retention.amount, accumulate: d.retention.accumulate, balance: d.retention.balance },
      ])
    } catch (e) {
      message.error(errText(e, 'โหลดสรุป Contract / Advance / Retention ไม่สำเร็จ'))
    }
  }

  const columns: ColumnsType<TermRow> = [
    { title: 'รายการ (Item)', dataIndex: 'item_type', render: (t: ItemType) => TERM_LABEL[t], width: 130 },
    { title: '%', width: 130, render: (_, r) => numCell(r.item_type, 'percent', true) },
    { title: 'Amount', width: 170, render: (_, r) => numCell(r.item_type, 'amount') },
    { title: 'Accumulate (สะสม)', width: 170, render: (_, r) => numCell(r.item_type, 'accumulate') },
    { title: 'Balance', width: 170, render: (_, r) => numCell(r.item_type, 'balance') },
  ]

  const loadFiles = async (id: number) => {
    try {
      const res = await axios.get(`${BASE_URL}/wo-contractor-log/${id}/attachments`, { headers })
      setFiles(Array.isArray(res.data?.data) ? res.data.data : [])
    } catch (e) {
      message.error(errText(e, 'โหลดไฟล์แนบไม่สำเร็จ'))
    }
  }

  // Uploading needs a saved record: the first file saves the document data (creating the record) like the bill buttons do.
  const uploadFile = async (file: File) => {
    const okType = /\.(pdf|jpe?g)$/i.test(file.name)
    if (!okType) { message.error('รองรับเฉพาะไฟล์ PDF หรือ JPEG'); return }
    if (file.size > 10 * 1024 * 1024) { message.error('ไฟล์ต้องมีขนาดไม่เกิน 10 MB'); return }
    setUploading(true)
    try {
      const id = await ensureLog()
      const fd = new FormData()
      fd.append('file', file)
      await axios.post(`${BASE_URL}/wo-contractor-log/${id}/attachments`, fd, { headers })
      await loadFiles(id)
      message.success('แนบไฟล์เรียบร้อยแล้ว')
    } catch (e) {
      message.error(errText(e, 'แนบไฟล์ไม่สำเร็จ'))
    } finally {
      setUploading(false)
    }
  }

  const removeFile = async (f: LogFile) => {
    if (!logId) return
    try {
      await axios.delete(`${BASE_URL}/wo-contractor-log/${logId}/attachments/${f.id}`, { headers })
      setFiles((prev) => prev.filter((x) => x.id !== f.id))
    } catch (e) {
      message.error(errText(e, 'ลบไฟล์ไม่สำเร็จ'))
    }
  }

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
      await loadSummary()
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

      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Button type={docView === 'contract' ? 'primary' : 'default'} onClick={() => setDocView('contract')}>Contract</Button>
        <Button type={docView === 'bill' ? 'primary' : 'default'} onClick={() => setDocView('bill')}>ประเภทวางบิล</Button>
      </div>

      <div style={{ display: docView === 'contract' ? 'block' : 'none' }}>
      <Table<TermRow>
        rowKey="item_type"
        size="small"
        pagination={false}
        dataSource={terms}
        columns={columns}
        className="wo-log-terms"
        scroll={{ x: 770 }}
        style={{ marginBottom: 20 }}
      />

      </div>
    </Form>
  )

  const billView = (
    <div style={{ display: docView === 'bill' ? 'block' : 'none' }}>
      <WOContractorBillTab
        logId={logId}
        onEnsureLog={ensureLog}
        onBillSaved={refreshCredit}
        woId={woId}
        supplierName={woCtx.supplier}
        creditTermDays={woCtx.credit}
        // The bill's % -> amount always uses this work order's own contract value (not the editable Contract row).
        contractAmount={woCtx.contractAmount || (terms.find((t) => t.item_type === 'CONTRACT')?.amount ?? 0)}
        defaultAdvPct={terms.find((t) => t.item_type === 'ADVANCE')?.percent}
        defaultRetentionPct={terms.find((t) => t.item_type === 'RETENTION')?.percent}
      />
    </div>
  )

  const filesTab = (
    <div>
      <Upload.Dragger
        accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
        showUploadList={false}
        multiple
        disabled={uploading}
        beforeUpload={(file) => { void uploadFile(file as unknown as File); return false }}
        style={{ marginBottom: 16 }}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">{uploading ? 'กำลังอัปโหลด...' : 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}</p>
        <p className="ant-upload-hint">รองรับไฟล์ PDF / JPEG ไฟล์ละไม่เกิน 10 MB (เลือกได้หลายไฟล์)</p>
      </Upload.Dragger>
      <Table<LogFile>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={files}
        locale={{ emptyText: 'ยังไม่มีไฟล์แนบ' }}
        columns={[
          { title: 'ชื่อไฟล์', dataIndex: 'file_name', render: (v: string, r) => <a href={r.file_path} target="_blank" rel="noopener noreferrer">{v}</a> },
          { title: 'ขนาด', dataIndex: 'file_size', width: 110, align: 'right', render: (v?: number | null) => fmtSize(v) },
          {
            title: '', key: 'del', width: 56, align: 'center',
            render: (_, r) => (
              <Popconfirm title="ลบไฟล์นี้?" okText="ลบ" cancelText="ยกเลิก" onConfirm={() => removeFile(r)}>
                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />
    </div>
  )

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
  }

  return (
    <div>
      <Tabs
        className="wo-log-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'doc', label: 'ข้อมูลเอกสาร', children: <>{docTab}{billView}</> },
          { key: 'files', label: 'แนบไฟล์ PDF/JPEG', children: filesTab },
        ]}
      />
    </div>
  )
}

export default WOContractorLogPanel
