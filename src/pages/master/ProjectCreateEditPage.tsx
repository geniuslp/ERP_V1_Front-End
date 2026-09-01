import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, message, InputNumber } from 'antd'
import { SaveOutlined, CloseOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { JOB_TYPES } from '@/constants/jobTypes'
import { permissionMatrixService } from '@/services/permissionMatrix.service'
import type { Department } from '@/types/permission.types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

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
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentsLoading, setDepartmentsLoading] = useState(false)

  // Reuses the same GET /departments source as UsersPage.tsx/PermissionMatrix —
  // no separate department endpoint for this form.
  useEffect(() => {
    if (!accessToken) return
    setDepartmentsLoading(true)
    permissionMatrixService.getDepartments(accessToken)
      .then(setDepartments)
      .catch(() => message.error('โหลดข้อมูลแผนกไม่สำเร็จ'))
      .finally(() => setDepartmentsLoading(false))
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
        form.setFieldsValue({
          project_code: p.project_code,
          project_name: p.project_name,
          location_code: p.location_code,
          dept_code: p.dept_code,
          responsible_person_name: p.responsible_person_name,
          project_owner_name: p.project_owner_name,
          job_codes: p.job_codes ?? [],
          budget_amount: p.budget_amount ?? 0,
          consultant_name: p.consultant_name,
          consultant_phone: p.consultant_phone,
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
      // Free-text project address — sent as-is, no location master lookup.
      location_code: values.location_code ?? undefined,
      dept_code:     values.dept_code ?? undefined,
      // "ผู้รับผิดชอบหลัก" — required free text, replaces the old owner_id dropdown
      responsible_person_name: values.responsible_person_name,
      // "เจ้าของโครงการ" — free text, distinct from responsible_person_name above
      project_owner_name: values.project_owner_name ?? undefined,
      job_codes:     values.job_codes ?? [],
      budget_amount: values.budget_amount ?? 0,
      consultant_name: values.consultant_name ?? undefined,
      consultant_phone: values.consultant_phone ?? undefined,
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
              {/* Free-text project address — no longer an FK/lookup against the location master. */}
              <Form.Item label="ที่อยู่โครงการ" name="location_code">
                <Input placeholder="กรอกที่อยู่โครงการ" />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              {/* Reuses GET /departments (permissionMatrixService.getDepartments) — the same
                  source UsersPage.tsx/PermissionMatrix already use, no new endpoint. */}
              <Form.Item label="แผนก" name="dept_code">
                <Select
                  placeholder="— เลือกแผนก —"
                  loading={departmentsLoading}
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={departments.map((d) => ({ value: d.dept_code, label: d.dept_name }))}
                />
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
              {/* "เจ้าของโครงการ" — free text, distinct from responsible_person_name above */}
              <Form.Item label="เจ้าของโครงการ" name="project_owner_name">
                <Input placeholder="ชื่อเจ้าของโครงการ" />
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
              <Form.Item label="ที่ปรึกษาโครงการ" name="consultant_name">
                <Input placeholder="ชื่อบริษัท/บุคคลที่ปรึกษา (ถ้ามี)" />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="เบอร์ติดต่อของที่ปรึกษา" name="consultant_phone">
                <Input placeholder="เบอร์โทรที่ปรึกษา (ถ้ามี)" />
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
