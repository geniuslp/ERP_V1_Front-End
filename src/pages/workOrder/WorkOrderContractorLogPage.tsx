import React, { useEffect, useRef, useState } from 'react'
import {
  Button, Card, Col, Form, Input, InputNumber, Row, Select, Table, Tabs, message,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { useProjectOptions } from '@/hooks/useProjectOptions'
import WOContractorBillTab from '@/components/workOrder/WOContractorBillTab'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}
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

// Only the WO fields this page reads (GET /work-order list rows and GET /wo-contractor-log/:id).
interface WoLite {
  id: number
  wo_no: string
  supplier_name?: string | null
  project_code?: string | null
  project_name?: string | null
  project_name_text?: string | null
  contract_description?: string | null
  contract_amount?: number | null
}

const woProjectLabel = (w: Pick<WoLite, 'project_code' | 'project_name' | 'project_name_text'>) =>
  w.project_code ? `${w.project_code} ${w.project_name ?? ''}`.trim() : (w.project_name_text ?? '')

const errText = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.response?.data?.error || fallback

const WorkOrderContractorLogPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const headers = { Authorization: `Bearer ${accessToken}` }
  const [form] = Form.useForm()

  const [activeTab, setActiveTab] = useState('doc')
  const [saving, setSaving] = useState(false)
  const [woOptions, setWoOptions] = useState<WoLite[]>([])
  const [woLoading, setWoLoading] = useState(false)
  const [terms, setTerms] = useState<TermRow[]>(emptyTerms())
  // WO-derived values tab 2 needs (supplier for PAY TO, credit term from supplier.payment_terms).
  const [woCtx, setWoCtx] = useState<{ woId?: number; supplier?: string; credit?: number | null; contractAmount?: number }>({})
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  const [pjCurrent, setPjCurrent] = useState<string | undefined>()
  const { options: projects, loading: projectsLoading } = useProjectOptions({}, pjCurrent)

  const fillFromWo = (wo: WoLite) => {
    form.setFieldsValue({
      supplier_name: wo.supplier_name ?? '',
      wo_project: woProjectLabel(wo),
      contract_description: wo.contract_description ?? '',
    })
  }

  const loadWos = async (search: string) => {
    setWoLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/work-order`, {
        headers,
        params: { status: 'APPROVED', search: search || undefined, page_size: 30 },
      })
      const rows = res.data?.data?.data
      setWoOptions(Array.isArray(rows) ? rows : [])
    } catch (e) {
      message.error(errText(e, 'โหลดรายการหนังสือสั่งจ้างไม่สำเร็จ'))
    } finally {
      setWoLoading(false)
    }
  }

  useEffect(() => {
    loadWos('')
    return () => clearTimeout(searchTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Edit mode: load the saved record. The WO may no longer be APPROVED, so keep it as an option itself.
  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const res = await axios.get(`${BASE_URL}/wo-contractor-log/${id}`, { headers })
        const d = res.data?.data
        const wo: WoLite = {
          id: d.wo_id,
          wo_no: d.wo_no,
          supplier_name: d.supplier_name,
          project_code: d.wo_project_code,
          project_name: d.wo_project_name,
          project_name_text: d.wo_project_name_text,
          contract_description: d.contract_description,
          contract_amount: d.contract_amount,
        }
        setWoOptions((prev) => (prev.some((o) => o.id === wo.id) ? prev : [wo, ...prev]))
        form.setFieldsValue({ wo_id: d.wo_id, project_code: d.project_code ?? undefined })
        setPjCurrent(d.project_code ?? undefined)
        fillFromWo(wo)
        setWoCtx({ woId: d.wo_id, supplier: d.supplier_name ?? '', credit: d.credit_term_days, contractAmount: Number(d.contract_amount ?? 0) })
        const saved: TermRow[] = Array.isArray(d.terms) ? d.terms : []
        setTerms(emptyTerms().map((t) => saved.find((s) => s.item_type === t.item_type) ?? t))
      } catch (e) {
        message.error(errText(e, 'โหลดข้อมูลไม่สำเร็จ'))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const onWoSearch = (v: string) => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => loadWos(v), 300)
  }

  const onWoChange = (woId?: number) => {
    const wo = woOptions.find((o) => o.id === woId)
    if (!wo) {
      form.setFieldsValue({ supplier_name: '', wo_project: '', contract_description: '' })
      return
    }
    fillFromWo(wo)
    // Contract row defaults to the WO's contract value (100%); still editable.
    setTerms((prev) => prev.map((t) => (t.item_type === 'CONTRACT' ? { ...t, percent: t.percent ?? 100, amount: wo.contract_amount ?? null } : t)))
  }

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

  const handleSave = async () => {
    const values = form.getFieldsValue()
    if (!values.wo_id) {
      message.warning('กรุณาเลือกเอกสารหนังสือสั่งจ้าง')
      return
    }
    setSaving(true)
    try {
      const payload = { wo_id: values.wo_id, project_code: values.project_code ?? null, terms }
      if (id) {
        await axios.put(`${BASE_URL}/wo-contractor-log/${id}`, payload, { headers })
        message.success('บันทึกข้อมูลเรียบร้อยแล้ว')
      } else {
        const res = await axios.post(`${BASE_URL}/wo-contractor-log`, payload, { headers })
        message.success('บันทึกข้อมูลเรียบร้อยแล้ว')
        const newId = res.data?.data?.id
        if (newId) navigate(`/work-order/contractor-log/${newId}`, { replace: true })
      }
    } catch (e) {
      message.error(errText(e, 'บันทึกข้อมูลไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  const docTab = (
    <Form form={form} layout="vertical">
      <Row gutter={[16, 0]}>
        <Col {...FIELD_SPAN}>
          <Form.Item label={<span style={labelStyle}>เอกสารหนังสือสั่งจ้าง</span>} name="wo_id">
            <Select
              showSearch
              allowClear
              filterOption={false}
              loading={woLoading}
              suffixIcon={<SearchOutlined />}
              placeholder="ค้นหาเลขที่ WO / ผู้รับจ้าง"
              style={fieldStyle}
              onSearch={onWoSearch}
              onChange={onWoChange}
              options={woOptions.map((w) => ({
                value: w.id,
                label: `${w.wo_no}${w.supplier_name ? ` — ${w.supplier_name}` : ''}`,
              }))}
            />
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

  return (
    <>
      <PageHeader title="บันทึกงานของผู้รับเหมาตามใบสั่งจ้าง" />
      <Card style={cardStyle}>
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
                  logId={id ? Number(id) : undefined}
                  woId={woCtx.woId}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>ย้อนกลับ</Button>
          {activeTab === 'doc' && (
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>บันทึก</Button>
          )}
        </div>
      </Card>
    </>
  )
}

export default WorkOrderContractorLogPage
