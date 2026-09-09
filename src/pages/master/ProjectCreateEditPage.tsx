import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, message, InputNumber } from 'antd'
import { SaveOutlined, CloseOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { JOB_TYPES } from '@/constants/jobTypes'

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
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  // The old free-text "เจ้าของโครงการ" value (project_owner_name), preserved
  // for existing records but no longer editable via this form — kept out of
  // the Form's state so the customer_id dropdown fully replaces it as the
  // field the user interacts with, while the payload still passes it through
  // unchanged (per backend still accepting/storing it).
  const [legacyProjectOwnerName, setLegacyProjectOwnerName] = useState<string | undefined>()

  // "เจ้าของโครงการ" dropdown — same source as CustomerPage.tsx (GET /customer),
  // fetched in full (large page_size) like the department/supplier dropdowns
  // elsewhere in this codebase.
  useEffect(() => {
    if (!accessToken) return
    setCustomersLoading(true)
    axios.get(`${BASE_URL}/customer`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page: 1, page_size: 1000 },
    })
      .then((res) => {
        const body = res.data?.data ?? res.data
        const list: CustomerOption[] = Array.isArray(body) ? body : body?.items ?? body?.data ?? []
        setCustomers(list)
      })
      .catch(() => message.error('โหลดข้อมูลลูกค้าไม่สำเร็จ'))
      .finally(() => setCustomersLoading(false))
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
          customer_id: p.customer_id ?? undefined,
          job_codes: p.job_codes ?? [],
          budget_amount: p.budget_amount ?? 0,
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
      project_code:  values.project_code,
      project_name:  values.project_name,
      // "ที่อยู่โครงการ" — location_code is now a free-text project address
      // (no longer validated/joined against the location master), per the
      // backend's Create/Update Swagger description. Same field/column as
      // before, just relabeled/re-typed on the frontend.
      location_code: values.location_code || undefined,
      // "ผู้รับผิดชอบหลัก" — required free text, replaces the old owner_id dropdown
      responsible_person_name: values.responsible_person_name,
      // "เจ้าของโครงการ" — now a customer_id FK dropdown (GET /customer),
      // replacing the old project_owner_name free-text input.
      customer_id: values.customer_id ?? undefined,
      // project_owner_name is no longer editable from this form, but is passed
      // through unchanged for existing records so it isn't silently dropped
      // from the payload if the backend still stores/reads it.
      project_owner_name: legacyProjectOwnerName,
      job_codes:     values.job_codes ?? [],
      budget_amount: values.budget_amount ?? 0,
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
        await axios.post(`${BASE_URL}/master/projects`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('เพิ่มโครงการสำเร็จ')
      }
      navigate('/master/projects')
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'บันทึกไม่สำเร็จ')
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

      <Form form={form} layout="vertical" initialValues={{ status: 'ACTIVE', budget_amount: 0 as number }}>
        <Card title={<span style={cardTitleStyle}>ข้อมูลโครงการ</span>} style={cardStyle} loading={loading}>
          <Row gutter={16}>
            <Col md={12} xs={24}>
              <Form.Item
                label="รหัสโครงการ"
                name="project_code"
                rules={[{ required: true, message: 'กรุณากรอกรหัสโครงการ' }]}
              >
                <Input disabled={isEdit} placeholder="เช่น XM-400" />
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
              {/* location_code repurposed as free-text project address per the
                  backend's Create/Update Swagger description — no longer
                  validated/joined against the location master. Same field,
                  just relabeled/re-typed here (was never a Select in this
                  form to begin with). */}
              <Form.Item label="ที่อยู่โครงการ" name="location_code">
                <Input.TextArea rows={2} placeholder="ที่อยู่โครงการ" />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              {/* Required free text — replaces the old owner_id (users) dropdown. */}
              <Form.Item
                label="ผู้รับผิดชอบหลัก"
                name="responsible_person_name"
                rules={[{ required: true, message: 'กรุณากรอกผู้รับผิดชอบหลัก' }]}
              >
                <Input placeholder="ชื่อผู้รับผิดชอบหลัก" />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              {/* "เจ้าของโครงการ" — customer dropdown (GET /customer), same
                  source/pattern as CustomerPage.tsx. Replaces the old
                  project_owner_name free-text input; distinct from
                  responsible_person_name above. */}
              <Form.Item label="เจ้าของโครงการ" name="customer_id">
                <Select
                  placeholder="— เลือกลูกค้า —"
                  loading={customersLoading}
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={customers.map((c) => ({ value: c.cus_id, label: `${c.customer_code} - ${c.customer_name}` }))}
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
              <Form.Item
                label="มูลค่าโครงการ"
                name="budget_amount"
                rules={[{ required: true, message: 'กรุณากรอกมูลค่าโครงการ' }]}
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
