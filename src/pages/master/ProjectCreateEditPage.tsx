import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, message, InputNumber } from 'antd'
import { SaveOutlined, CloseOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { JOB_TYPES } from '@/constants/jobTypes'
import { formatApproverOption } from '@/utils/formatApproverOption'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

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
        form.setFieldsValue({
          project_code: p.project_code,
          project_name: p.project_name,
          location_code: p.location_code,
          responsible_person_name: p.responsible_person_name,
          responsible_user_ids: (p.responsible_users ?? []).map((u: { id: number }) => Number(u.id)),
          customer_id: p.customer_id ?? undefined,
          job_codes: p.job_codes ?? [],
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

  const handleSave = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const [startDate, endDate] = values.date_range ?? [undefined, undefined]

    const payload = {
      // Create: the server generates project_code, so it is never sent.
      ...(isEdit ? { project_code: values.project_code } : {}),
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
      customer_id: values.customer_id ?? undefined,
      // project_owner_name is no longer editable from this form, but is passed
      // through unchanged for existing records so it isn't silently dropped
      // from the payload if the backend still stores/reads it.
      project_owner_name: legacyProjectOwnerName,
      job_codes:     values.job_codes ?? [],
      budget_amount: values.project_kind === 'VO' ? 0 : values.budget_amount ?? 0,
      vo_amount:     values.project_kind === 'VO' ? values.vo_amount ?? 0 : 0,
      contract_amount: values.contract_amount ?? 0,
      cost_amount:   values.cost_amount ?? 0,
      project_kind:  values.project_kind ?? 'NEW',
      start_date:    startDate ? startDate.format('YYYY-MM-DD') : undefined,
      end_date:      endDate ? endDate.format('YYYY-MM-DD') : undefined,
      status:        values.status ?? 'ACTIVE',
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        await axios.put(`${BASE_URL}/master/projects/${id}`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('แก้ไขโครงการสำเร็จ')
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
        const conflictMessage = err?.response?.data?.message || 'ไม่สามารถแก้ไขรหัสโครงการได้ เนื่องจากมีเอกสารอื่นอ้างอิงอยู่'
        if (isEdit) form.setFields([{ name: 'project_code', errors: [conflictMessage] }])
        else message.error(conflictMessage)
      } else {
        message.error(err?.response?.data?.message || err?.message || 'บันทึกไม่สำเร็จ')
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

      <Form form={form} layout="vertical" initialValues={{ status: 'ACTIVE', budget_amount: 0 as number, vo_amount: 0 as number, contract_amount: 0 as number, cost_amount: 0 as number, project_kind: 'NEW' }}>
        <Card title={<span style={cardTitleStyle}>ข้อมูลโครงการ</span>} style={cardStyle} loading={loading}>
          <Row gutter={16}>
            <Col md={12} xs={24}>
              {/* "เจ้าของโครงการ" — customer dropdown (GET /customer); also drives the project_code preview on create. */}
              <Form.Item
                label="เจ้าของโครงการ"
                name="customer_id"
                rules={isEdit ? [] : [{ required: true, message: 'กรุณาเลือกเจ้าของโครงการ' }]}
              >
                <Select
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
                rules={[{ required: true, message: 'กรุณากรอกชื่อโครงการ' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              {/* Read-only. Edit: saved code. Add: locally computed prefix only — the server assigns the number on save. */}
              <Form.Item
                label="รหัสโครงการ"
                name={isEdit ? 'project_code' : undefined}
                extra={!isEdit && codePrefix ? 'เลขนี้เป็นตัวอย่าง ระบบจะกำหนดเลขจริงเมื่อบันทึก' : undefined}
              >
                <Input
                  className="project-code-input"
                  disabled
                  {...(isEdit ? {} : { value: previewCode ?? (codePrefix ? `${codePrefix} (ระบบกำหนดเลขให้เมื่อบันทึก)` : undefined) })}
                  placeholder="เลือกเจ้าของโครงการก่อน"
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="ประเภทโครงการ" name="project_kind">
                <Select
                  onChange={(k: 'NEW' | 'VO') => {
                    // Reset the field that is being hidden so no stale value is submitted.
                    const hidden = k === 'VO' ? 'budget_amount' : 'vo_amount'
                    const shown = k === 'VO' ? 'vo_amount' : 'budget_amount'
                    form.setFieldsValue({ [hidden]: 0 })
                    form.setFields([{ name: hidden, errors: [] }, { name: shown, errors: [] }])
                  }}
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
              {/* One value field per project kind, same slot: NEW → มูลค่าโครงการ, VO → มูลค่า VO. */}
              <Form.Item
                key={projectKind}
                label={projectKind === 'VO' ? 'มูลค่า VO' : 'มูลค่าโครงการ'}
                name={projectKind === 'VO' ? 'vo_amount' : 'budget_amount'}
                rules={[{ required: true, message: projectKind === 'VO' ? 'กรุณากรอกมูลค่า VO' : 'กรุณากรอกมูลค่าโครงการ' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0 as number}
                  step={1000}
                  formatter={(v) => `฿ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => (v ? Number(v.replace(/[฿,\s]/g, '')) : 0)}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="ประเภทงาน" name="job_codes">
                <Select
                  mode="multiple"
                  placeholder="— เลือกประเภทงาน —"
                  allowClear
                  options={JOB_TYPES.map((jt) => ({ value: jt.code, label: jt.label }))}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="ระยะเวลาโครงการ" name="date_range">
                <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item
                label="มูลค่าสัญญา"
                name="contract_amount"
              >
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
              <Form.Item
                label="มูลค่าต้นทุน"
                name="cost_amount"
              >
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
