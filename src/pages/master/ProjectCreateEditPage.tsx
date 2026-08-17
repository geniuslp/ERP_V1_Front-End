import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, message, InputNumber, Divider } from 'antd'
import { SaveOutlined, CloseOutlined, SettingOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'

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
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [creatingLocation, setCreatingLocation] = useState(false)
  const [owners, setOwners] = useState<{ value: number; label: string; dept?: string }[]>([])
  const [ownersLoading, setOwnersLoading] = useState(false)

  const fetchLocations = async () => {
    setLocationsLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/locations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { is_active: true },
      })
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
      setLocations(list.map((l: any) => ({
        value: l.location_code,
        label: l.location_name ?? l.name,
      })))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดสถานที่ไม่สำเร็จ')
    } finally {
      setLocationsLoading(false)
    }
  }

  useEffect(() => {
    fetchLocations()
  }, [])

  // Manager-tier quick-create: reuses the guard already on this page (project
  // create/edit is manager-gated) rather than a separate permission check. Confirmed
  // against the live backend: location_code is auto-generated server-side and
  // location_type defaults to 'SITE' when omitted, so this quick-add flow only ever
  // sends location_name — do not synthesize a code client-side.
  const handleCreateLocation = async () => {
    const name = newLocationName.trim()
    if (!name) {
      message.warning('กรุณาพิมพ์ชื่อสถานที่')
      return
    }
    setCreatingLocation(true)
    try {
      const res = await axios.post(`${BASE_URL}/master/locations`, {
        location_name: name,
      }, { headers: { Authorization: `Bearer ${accessToken}` } })
      const created = res.data?.data ?? res.data
      const option = { value: created?.location_code, label: created?.location_name ?? name }
      setLocations((prev) => [...prev, option])
      form.setFieldValue('location_code', option.value)
      setNewLocationName('')
      message.success('เพิ่มสถานที่สำเร็จ')
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'เพิ่มสถานที่ไม่สำเร็จ')
    } finally {
      setCreatingLocation(false)
    }
  }

  useEffect(() => {
    const fetchOwners = async () => {
      setOwnersLoading(true)
      try {
        // Filter to engineering team only
        const res = await axios.get(`${BASE_URL}/users/allUser`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { role: 'engineering' },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setOwners(list.map((u: any) => ({
          value: Number(u.id),
          label: u.full_name ?? u.fullName ?? u.username,
          dept: u.department,
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดรายชื่อผู้รับผิดชอบไม่สำเร็จ')
      } finally {
        setOwnersLoading(false)
      }
    }
    fetchOwners()
  }, [])

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
          owner_id: p.owner_id,
          budget_amount: p.budget_amount ?? 0,
          consultant_name: p.consultant_name,
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
      location_code: values.location_code ?? undefined,
      owner_id:      values.owner_id ?? undefined,
      budget_amount: values.budget_amount ?? 0,
      consultant_name: values.consultant_name ?? undefined,
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
              <Form.Item
                label={
                  <span>
                    สถานที่{' '}
                    <a onClick={() => navigate('/master/location')} style={{ fontSize: 12, fontWeight: 400 }}>
                      <SettingOutlined /> จัดการสถานที่
                    </a>
                  </span>
                }
                name="location_code"
              >
                <Select
                  placeholder="— เลือกสถานที่ —"
                  loading={locationsLoading}
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={locations}
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider style={{ margin: '4px 0' }} />
                      <div style={{ padding: '4px 8px', display: 'flex', gap: 8 }}>
                        <Input
                          placeholder="พิมพ์ชื่อสถานที่ใหม่..."
                          value={newLocationName}
                          onChange={(e) => setNewLocationName(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                        <Button type="link" size="small" loading={creatingLocation} onClick={handleCreateLocation}>
                          + เพิ่ม
                        </Button>
                      </div>
                    </>
                  )}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="ผู้รับผิดชอบหลัก" name="owner_id">
                <Select
                  placeholder="— เลือกผู้รับผิดชอบ (ทีมวิศวกร) —"
                  loading={ownersLoading}
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  optionRender={(option) => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span>{option.data.label}</span>
                      {option.data.dept && (
                        <span style={{ color: '#9ca3af', fontSize: 12, flexShrink: 0 }}>{option.data.dept}</span>
                      )}
                    </div>
                  )}
                  options={owners}
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
