import { calcProjectTier, formatProjectTier, PROJECT_TIER_RANGE } from '@/utils/projectTier'
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, message, InputNumber, Table, Typography, Modal } from 'antd'
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { formatApproverOption } from '@/utils/formatApproverOption'
import { VO_NAME_PREFIX, buildVoName, stripVoPrefix } from '@/constants/projectName'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

// GET /master/job-types -> [{ job_code, job_name, needs_share }]
interface JobTypeApi {
  job_code: string
  job_name: string
  needs_share: boolean
}

// One editable row of the "ประเภทงาน" table. `key` is frontend-only.
interface JobRow {
  key: string
  job_code?: string
  share_percent: number | null
}

const newKey = () => `new-${Date.now()}-${Math.random().toString(36).slice(2)}`
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

interface CustomerOption {
  cus_id: number
  customer_code: string
  customer_name: string
}

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}
const cardTitleStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#1e40af',
  textTransform: 'uppercase', letterSpacing: '0.04em',
}

// Form.Item child: the form value is always the full name. For VO the prefix is a read-only addon
// and only the text after it is editable. A stored VO name without the prefix is shown as-is and
// only gets the prefix once the user edits it (or switches the kind).
const ProjectNameInput: React.FC<{ value?: string; onChange?: (v: string) => void; kind: 'NEW' | 'VO' }> = ({
  value, onChange, kind,
}) => {
  if (kind !== 'VO') {
    return <Input value={value} onChange={(e) => onChange?.(e.target.value)} />
  }
  return (
    <Input
      prefix={<span style={{ whiteSpace: 'pre', userSelect: 'none', color: '#64748b' }}>{VO_NAME_PREFIX}</span>}
      value={stripVoPrefix(value ?? '')}
      onChange={(e) => onChange?.(buildVoName(e.target.value))}
    />
  )
}

const ProjectCreateEditPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const watchedCustomerId: number | undefined = Form.useWatch('customer_id', form)
  const projectKind: 'NEW' | 'VO' = Form.useWatch('project_kind', form) ?? 'NEW'
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  // "ผู้รับผิดชอบหลัก" options: ALL active users (GET /users/options -> [{ id, username }]), loaded once.
  const [userOptions, setUserOptions] = useState<{ value: number; label: string }[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  // The old free-text "เจ้าของโครงการ" value (project_owner_name), preserved
  // for existing records but no longer editable via this form — kept out of
  // the Form's state so the customer_id dropdown fully replaces it as the
  // field the user interacts with, while the payload still passes it through
  // unchanged (per backend still accepting/storing it).
  const selectedCustomer = customers.find((c) => c.cus_id === watchedCustomerId)
  // Gregorian year in Asia/Bangkok, then the owner's customer_code (already in the dropdown data).
  const bkkYear = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', calendar: 'gregory' }).format(new Date())
  const codePrefix = !isEdit && selectedCustomer?.customer_code ? `${bkkYear}-${selectedCustomer.customer_code}-` : ''
  // Non-blocking preview of the real next code (GET /master/projects/next-code). Any failure just keeps the local prefix.
  const [previewCode, setPreviewCode] = useState<string | undefined>()
  useEffect(() => {
    setPreviewCode(undefined)
    if (isEdit || !accessToken || !watchedCustomerId) return
    let stale = false
    axios.get(`${BASE_URL}/master/projects/next-code`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { customer_id: watchedCustomerId },
      timeout: 5000,
    })
      .then((res) => {
        const d = res.data?.data ?? res.data
        const code = typeof d === 'string' ? d : d?.project_code
        if (!stale && code) setPreviewCode(String(code))
      })
      .catch(() => { /* fall back to the local prefix silently */ })
    return () => { stale = true }
  }, [watchedCustomerId, isEdit, accessToken])

  // ── ประเภทงาน: job type options from the API + local repeatable rows ──
  const [jobTypes, setJobTypes] = useState<JobTypeApi[]>([])
  const [jobTypesLoading, setJobTypesLoading] = useState(false)
  const [jobRows, setJobRows] = useState<JobRow[]>([])
  const watchedBudget: number | undefined = Form.useWatch('budget_amount', form)
  const watchedVo: number | undefined = Form.useWatch('vo_amount', form)
  const watchedContract: number | undefined = Form.useWatch('contract_amount', form)
  // Tier follows the project value as soon as it is typed (same rule as the DB's project_tier).
  const previewTier = calcProjectTier(projectKind === 'VO' ? watchedVo : watchedBudget, watchedContract)
  // Job-share base: NEW -> contract value (budget_amount), VO -> vo_amount. Empty/0 is allowed.
  const shareBase = Number(projectKind === 'VO' ? watchedVo : watchedBudget) || 0
  const jobTypeMap = new Map(jobTypes.map((j) => [j.job_code, j]))
  const needsShare = (code?: string) => !!code && jobTypeMap.get(code)?.needs_share === true
  const totalShare = round2(jobRows.reduce((sum, r) => sum + (needsShare(r.job_code) ? Number(r.share_percent) || 0 : 0), 0))
  // Edit mode: owner is locked while in_use is true or still unknown (undefined = not loaded yet).
  const [inUse, setInUse] = useState<boolean | undefined>()
  const [inUseBy, setInUseBy] = useState<string[]>([])
  const ownerLocked = isEdit && inUse !== false
  // Edit mode: the saved code + owner, and the live preview when an unused project's owner changes.
  // Only the customer segment changes: {year}-{customer_code}-{NNN} (middle part may contain '-').
  const [savedCode, setSavedCode] = useState<string | undefined>()
  const [savedCustomerId, setSavedCustomerId] = useState<number | undefined>()
  const [codeError, setCodeError] = useState<string | undefined>()
  const newCode = (() => {
    if (!isEdit || ownerLocked || !savedCode || !selectedCustomer?.customer_code) return undefined
    if (watchedCustomerId === savedCustomerId) return undefined
    const m = /^(\d{4})-(.*)-(\d+)$/.exec(savedCode)
    if (!m) return undefined
    const next = `${m[1]}-${selectedCustomer.customer_code}-${m[3]}`
    return next === savedCode ? undefined : next
  })()

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setJobTypesLoading(true)
    axios.get(`${BASE_URL}/master/job-types`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        const body = res.data?.data ?? res.data
        if (!cancelled) setJobTypes(Array.isArray(body) ? body : [])
      })
      .catch((e) => message.error(e?.response?.data?.message || e?.response?.data?.error || 'โหลดประเภทงานไม่สำเร็จ'))
      .finally(() => { if (!cancelled) setJobTypesLoading(false) })
    return () => { cancelled = true }
  }, [accessToken])

  const updateJobRow = (key: string, patch: Partial<JobRow>) =>
    setJobRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const [legacyProjectOwnerName, setLegacyProjectOwnerName] = useState<string | undefined>()

  // "เจ้าของโครงการ" dropdown — same source as CustomerPage.tsx (GET /customer),
  // fetched in full (large page_size) like the department/supplier dropdowns
  // elsewhere in this codebase.
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setCustomersLoading(true)
    ;(async () => {
      const all: CustomerOption[] = []
      // Backend caps page_size at 500 — walk the pages so every active customer is reachable.
      for (let page = 1; page <= 20; page++) {
        const res = await axios.get(`${BASE_URL}/customer`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { page, page_size: 500 },
        })
        const body = res.data?.data ?? res.data
        const list: CustomerOption[] = Array.isArray(body) ? body : body?.items ?? body?.data ?? []
        all.push(...list)
        const totalPages: number = body?.total_pages ?? 1
        if (page >= totalPages || list.length === 0) break
      }
      if (!cancelled) setCustomers(all)
    })()
      .catch(() => message.error('โหลดข้อมูลลูกค้าไม่สำเร็จ'))
      .finally(() => { if (!cancelled) setCustomersLoading(false) })
    return () => { cancelled = true }
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setUsersLoading(true)
    axios.get(`${BASE_URL}/users/options`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        const list: { id: number; username: string }[] = res.data?.data ?? []
        if (!cancelled) setUserOptions(list.map((u) => ({ value: Number(u.id), label: formatApproverOption(u.username, u.id) })))
      })
      .catch((e) => message.error(e?.response?.data?.error || e?.response?.data?.message || 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ'))
      .finally(() => { if (!cancelled) setUsersLoading(false) })
    return () => { cancelled = true }
  }, [accessToken])

  useEffect(() => {
    if (!isEdit) return
    const fetchProject = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/projects/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const p = res.data?.data ?? res.data
        setLegacyProjectOwnerName(p.project_owner_name ?? undefined)
        setInUse(typeof p.in_use === 'boolean' ? p.in_use : undefined)
        setInUseBy(Array.isArray(p.in_use_by) ? p.in_use_by : [])
        setSavedCode(p.project_code)
        setSavedCustomerId(p.customer_id ?? undefined)
        // job_codes is the full list; job_shares only covers needs-share jobs (empty for legacy
        // projects, so those rows get an empty % that must be filled before Save).
        const shares: { job_code: string; share_percent: number }[] = Array.isArray(p.job_shares) ? p.job_shares : []
        const codes: string[] = Array.isArray(p.job_codes) ? p.job_codes : []
        setJobRows(codes.map((code) => ({
          key: newKey(),
          job_code: code,
          share_percent: shares.find((sh) => sh.job_code === code)?.share_percent ?? null,
        })))
        form.setFieldsValue({
          project_code: p.project_code,
          project_name: p.project_name,
          location_code: p.location_code,
          responsible_person_name: p.responsible_person_name,
          responsible_user_ids: (p.responsible_users ?? []).map((u: { id: number }) => Number(u.id)),
          customer_id: p.customer_id ?? undefined,
          budget_amount: p.budget_amount ?? 0,
          vo_amount: p.vo_amount ?? 0,
          contract_amount: p.contract_amount ?? 0,
          cost_amount: p.cost_amount ?? 0,
          project_kind: p.project_kind ?? 'NEW',
          date_range: p.start_date && p.end_date
            ? [dayjs(p.start_date), dayjs(p.end_date)]
            : undefined,
          status: p.status ?? 'ACTIVE',
        })
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลโครงการไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    fetchProject()
  }, [id])

  // NEW -> VO adds the locked prefix and keeps the typed text; VO -> NEW removes it and keeps the rest.
  const handleKindChange = (kind: 'NEW' | 'VO') => {
    const current = String(form.getFieldValue('project_name') ?? '')
    const next = kind === 'VO' ? buildVoName(current) : stripVoPrefix(current)
    if (next !== current) form.setFieldsValue({ project_name: next })
    if (form.isFieldTouched('project_name')) form.validateFields(['project_name']).catch(() => undefined)
  }

  const handleSave = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const [startDate, endDate] = values.date_range ?? [undefined, undefined]

    if (jobRows.some((r) => !r.job_code)) {
      message.error('กรุณาเลือกประเภทงานให้ครบทุกแถว หรือลบแถวที่ว่าง')
      return
    }
    const effectiveBase = Number(values.project_kind === 'VO' ? values.vo_amount : values.budget_amount) || 0

    const payload = {
      // Create: the server generates project_code, so it is never sent.
      project_name:  values.project_name,
      // "ที่อยู่โครงการ" — location_code is now a free-text project address
      // (no longer validated/joined against the location master), per the
      // backend's Create/Update Swagger description. Same field/column as
      // before, just relabeled/re-typed on the frontend.
      location_code: values.location_code || undefined,
      // "ผู้รับผิดชอบหลัก" — required free text, replaces the old owner_id dropdown
      // The server derives the legacy responsible_person_name from the selected usernames.
      responsible_user_ids: values.responsible_user_ids ?? [],
      // "เจ้าของโครงการ" — now a customer_id FK dropdown (GET /customer),
      // replacing the old project_owner_name free-text input.
      // Omitted while the owner is locked (in use / unknown) so a changed owner is never sent.
      ...(ownerLocked ? {} : { customer_id: values.customer_id ?? undefined }),
      // project_owner_name is no longer editable from this form, but is passed
      // through unchanged for existing records so it isn't silently dropped
      // from the payload if the backend still stores/reads it.
      project_owner_name: legacyProjectOwnerName,
      job_codes:     jobRows.map((r) => r.job_code as string),
      job_shares:    jobRows
        .filter((r) => needsShare(r.job_code) && r.share_percent !== null && r.share_percent > 0)
        .map((r) => ({
          job_code: r.job_code as string,
          share_percent: Number(r.share_percent),
          share_amount: round2((effectiveBase * Number(r.share_percent)) / 100),
        })),
      budget_amount: values.budget_amount ?? 0,
      vo_amount:     values.project_kind === 'VO' ? values.vo_amount ?? 0 : 0,
      // No longer an input on this form; pass the loaded value through so it is not reset to 0.
      contract_amount: form.getFieldValue('contract_amount') ?? 0,
      cost_amount:   values.cost_amount ?? 0,
      project_kind:  values.project_kind ?? 'NEW',
      start_date:    startDate ? startDate.format('YYYY-MM-DD') : undefined,
      end_date:      endDate ? endDate.format('YYYY-MM-DD') : undefined,
      status:        values.status ?? 'ACTIVE',
    }

    if (isEdit && newCode) {
      const ok = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: `รหัสโครงการจะเปลี่ยนจาก ${savedCode} เป็น ${newCode} ยืนยันหรือไม่`,
          okText: 'ยืนยัน',
          cancelText: 'ยกเลิก',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
      if (!ok) return
    }

    setSubmitting(true)
    setCodeError(undefined)
    try {
      if (isEdit) {
        const res = await axios.put(`${BASE_URL}/master/projects/${id}`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        // Use the code the server actually saved, never the local preview.
        const saved = res.data?.data ?? res.data
        const finalCode: string | undefined = saved?.project_code ?? newCode ?? savedCode
        if (finalCode) {
          setSavedCode(finalCode)
          setSavedCustomerId(watchedCustomerId)
        }
        message.success(finalCode ? `แก้ไขโครงการสำเร็จ รหัสโครงการ ${finalCode}` : 'แก้ไขโครงการสำเร็จ')
      } else {
        const res = await axios.post(`${BASE_URL}/master/projects`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const created = res.data?.data ?? res.data
        const code = created?.project_code
        message.success(code ? `บันทึกแล้ว รหัสโครงการ ${code}` : 'เพิ่มโครงการสำเร็จ')
      }
      navigate('/master/projects')
    } catch (err: any) {
      if (err?.response?.status === 409) {
        // project_code cannot be changed while other documents (PO/requisition/
        // petty cash) still reference it — backend sends either a generic
        // fallback message or an itemized one (e.g. "2 purchase orders, 1
        // requisition"); show whichever comes back verbatim, same
        // field-level-error pattern CustomerPage.tsx uses for its own 409.
        const conflictMessage = err?.response?.data?.message || err?.response?.data?.error || 'ไม่สามารถแก้ไขรหัสโครงการได้ เนื่องจากมีเอกสารอื่นอ้างอิงอยู่'
        if (isEdit) {
          setCodeError(conflictMessage)
          // Revert the preview to the saved code by restoring the saved owner.
          form.setFieldsValue({ customer_id: savedCustomerId })
        }
        message.error(conflictMessage)
      } else {
        message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึกไม่สำเร็จ')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'แก้ไขโครงการ' : 'เพิ่มโครงการ'}
        subtitle="จัดการข้อมูลโครงการ"
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'ข้อมูลหลัก' },
          { title: 'โครงการ' },
          { title: isEdit ? 'แก้ไข' : 'เพิ่ม' },
        ]}
      />

      <Form autoComplete="off" form={form} layout="vertical" initialValues={{ status: 'ACTIVE', budget_amount: 0 as number, vo_amount: 0 as number, contract_amount: 0 as number, cost_amount: 0 as number, project_kind: 'NEW' }}>
        <Card title={<span style={cardTitleStyle}>ข้อมูลโครงการ</span>} style={cardStyle} loading={loading}>
          <Row gutter={16}>
            <Col md={12} xs={24}>
              {/* "เจ้าของโครงการ" — customer dropdown (GET /customer); also drives the project_code preview on create. */}
              <Form.Item
                label="เจ้าของโครงการ"
                name="customer_id"
                rules={isEdit ? [] : [{ required: true, message: 'กรุณาเลือกเจ้าของโครงการ' }]}
                extra={isEdit && inUse === true
                  ? `ไม่สามารถเปลี่ยนเจ้าของโครงการได้ เนื่องจากรหัสโครงการนี้ถูกใช้งานแล้วใน: ${inUseBy.join(', ')}`
                  : undefined}
              >
                <Select
                  disabled={ownerLocked}
                  placeholder="— เลือกลูกค้า —"
                  loading={customersLoading}
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={customers.map((c) => ({ value: c.cus_id, label: `${c.customer_code} ${c.customer_name}` }))}
                  notFoundContent={customersLoading ? 'กำลังโหลด...' : 'ไม่พบข้อมูล'}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item
                label="ชื่อโครงการ"
                name="project_name"
                rules={[{
                  validator: (_, v) => {
                    const s = String(v ?? '')
                    if (projectKind === 'VO') {
                      return stripVoPrefix(s).trim() ? Promise.resolve() : Promise.reject(new Error('กรุณากรอกชื่อโครงการต่อจาก Q -'))
                    }
                    return s.trim() ? Promise.resolve() : Promise.reject(new Error('กรุณากรอกชื่อโครงการ'))
                  },
                }]}
              >
                <ProjectNameInput kind={projectKind} />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              {/* Read-only. Edit: saved code. Add: locally computed prefix only — the server assigns the number on save. */}
              <Form.Item
                label="รหัสโครงการ"
                validateStatus={isEdit && codeError ? 'error' : undefined}
                help={isEdit && codeError ? codeError : undefined}
                extra={isEdit
                  ? (newCode ? `รหัสโครงการจะเปลี่ยนเป็น ${newCode} เมื่อบันทึก` : undefined)
                  : (codePrefix ? 'เลขนี้เป็นตัวอย่าง ระบบจะกำหนดเลขจริงเมื่อบันทึก' : undefined)}
              >
                <Input
                  className="project-code-input"
                  disabled
                  value={isEdit
                    ? (newCode ?? savedCode)
                    : (previewCode ?? (codePrefix ? `${codePrefix} (ระบบกำหนดเลขให้เมื่อบันทึก)` : undefined))}
                  placeholder="เลือกเจ้าของโครงการก่อน"
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="ประเภทโครงการ" name="project_kind">
                <Select
                  onChange={handleKindChange}
                  options={[
                    { value: 'NEW', label: 'โครงการใหม่' },
                    { value: 'VO',  label: 'งานเพิ่ม (VO)' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              {/* location_code is free-text project address (not validated against the location master). */}
              <Form.Item label="ที่อยู่โครงการ" name="location_code">
                <Input.TextArea rows={2} placeholder="ที่อยู่โครงการ" />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item
                label="ผู้รับผิดชอบหลัก"
                name="responsible_user_ids"
                rules={[{ required: true, type: 'array', min: 1, message: 'กรุณาเลือกผู้รับผิดชอบหลัก' }]}
              >
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  placeholder="เลือกผู้รับผิดชอบหลัก"
                  loading={usersLoading}
                  options={userOptions}
                  optionFilterProp="label"
                  notFoundContent={usersLoading ? 'กำลังโหลด...' : 'ไม่พบข้อมูล'}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="มูลค่าสัญญา" name="budget_amount">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0 as number}
                  step={1000}
                  precision={2}
                  formatter={(v) => `฿ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => (v ? Number(v.replace(/[฿,\s]/g, '')) : 0)}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="Tier โครงการ" extra={previewTier ? PROJECT_TIER_RANGE[previewTier] : 'ยังไม่ระบุมูลค่า'}>
                <Input readOnly value={formatProjectTier(previewTier)} />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="มูลค่าต้นทุน" name="cost_amount">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0 as number}
                  step={1000}
                  precision={2}
                  formatter={(v) => `฿ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => (v ? Number(v.replace(/[฿,\s]/g, '')) : 0)}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            {projectKind === 'VO' && (
              <Col md={12} xs={24}>
                <Form.Item label="มูลค่า VO" name="vo_amount">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0 as number}
                    step={1000}
                    precision={2}
                    formatter={(v) => `฿ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(v) => (v ? Number(v.replace(/[฿,\s]/g, '')) : 0)}
                    placeholder="0.00"
                  />
                </Form.Item>
              </Col>
            )}
            <Col span={24}>
              <Form.Item label="ประเภทงาน" style={{ marginBottom: 16 }}>
                <Table<JobRow>
                  size="small"
                  rowKey="key"
                  pagination={false}
                  dataSource={jobRows}
                  loading={jobTypesLoading}
                  locale={{ emptyText: 'ยังไม่มีประเภทงาน' }}
                  columns={[
                    {
                      title: 'ประเภทงาน', dataIndex: 'job_code',
                      render: (_: unknown, r: JobRow) => (
                        <Select
                          style={{ width: '100%' }}
                          placeholder="— เลือกประเภทงาน —"
                          showSearch
                          optionFilterProp="label"
                          value={r.job_code}
                          options={jobTypes.map((j) => ({
                            value: j.job_code,
                            label: `${j.job_code} - ${j.job_name}`,
                            disabled: jobRows.some((o) => o.key !== r.key && o.job_code === j.job_code),
                          }))}
                          onChange={(code: string) =>
                            updateJobRow(r.key, {
                              job_code: code,
                              share_percent: jobTypeMap.get(code)?.needs_share ? r.share_percent : null,
                            })}
                        />
                      ),
                    },
                    {
                      title: 'สัดส่วน (%)', key: 'share_percent', width: 160,
                      render: (_: unknown, r: JobRow) => needsShare(r.job_code) ? (
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0} max={100} precision={2}
                          value={r.share_percent}
                          onChange={(v) => updateJobRow(r.key, { share_percent: v === null ? null : Number(v) })}
                        />
                      ) : <span style={{ color: '#9ca3af' }}>-</span>,
                    },
                    {
                      title: 'มูลค่า (บาท)', key: 'share_amount', width: 180, align: 'right' as const,
                      render: (_: unknown, r: JobRow) =>
                        needsShare(r.job_code) && r.share_percent !== null
                          ? round2((shareBase * r.share_percent) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '-',
                    },
                    {
                      title: '', key: 'action', width: 56,
                      render: (_: unknown, r: JobRow) => (
                        <Button
                          type="text" danger icon={<DeleteOutlined />}
                          onClick={() => setJobRows((rows) => rows.filter((x) => x.key !== r.key))}
                        />
                      ),
                    },
                  ]}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => setJobRows((rows) => [...rows, { key: newKey(), share_percent: null }])}
                  >
                    เพิ่มประเภทงาน
                  </Button>
                  <Typography.Text strong style={{ color: '#1e3a8a' }}>
                    รวมสัดส่วน: {totalShare.toFixed(2)}%
                  </Typography.Text>
                </div>
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="ระยะเวลาโครงการ" name="date_range">
                <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="สถานะ" name="status">
                <Select
                  options={[
                    { value: 'ACTIVE',   label: 'ดำเนินการ' },
                    { value: 'INACTIVE', label: 'ไม่ใช้งาน' },
                    { value: 'CLOSED',   label: 'ปิดโครงการ' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Form>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 12,
        marginTop: 16, padding: '16px 24px', background: '#fff',
        borderRadius: 12, boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
      }}>
        <Button icon={<CloseOutlined />} onClick={() => navigate('/master/projects')}>
          ยกเลิก
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={submitting}
          onClick={handleSave}
          style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none' }}
        >
          บันทึก
        </Button>
      </div>
    </div>
  )
}

export default ProjectCreateEditPage
