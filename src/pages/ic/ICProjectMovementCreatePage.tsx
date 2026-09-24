import React, { useEffect, useState } from 'react'
import { Card, Form, Select, DatePicker, Input, Button, Space, Spin, Result, Row, Col, message } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
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

interface ICProjectInfo {
  project_code: string
  project_name: string
}

interface JobCodeOption {
  value: string
  label: string
}

interface UserOption {
  id: string
  fullName: string
  department?: string
}

const ICProjectMovementCreatePage: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ICProjectInfo | null>(null)

  const [jobOptions, setJobOptions] = useState<JobCodeOption[]>([])
  const [jobOptionsLoading, setJobOptionsLoading] = useState(true)

  const [users, setUsers] = useState<UserOption[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  const [submitting, setSubmitting] = useState(false)

  // Step 1: validate :projectCode and load the project context header.
  useEffect(() => {
    if (!projectCode) {
      navigate('/ic/projects', { replace: true })
      return
    }
    let cancelled = false
    const fetchProject = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/by-code/${projectCode}`, { headers: authHeader })
        const proj = res.data?.data ?? res.data
        if (!proj || !proj.project_code) {
          throw new Error('not found')
        }
        if (!cancelled) setProject(proj)
      } catch (err: any) {
        if (!cancelled) {
          message.error(
            err?.response?.data?.message || err?.message || `ไม่พบข้อมูลโครงการ (${projectCode})`
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchProject()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode])

  // Step 2: load job codes allowed for this project.
  useEffect(() => {
    if (!projectCode) return
    let cancelled = false
    const fetchJobCodes = async () => {
      setJobOptionsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/${projectCode}/job-codes`, { headers: authHeader })
        const raw = res.data?.data ?? res.data
        const list = Array.isArray(raw) ? raw : []
        if (!cancelled) {
          setJobOptions(
            list.map((jc: any) => ({
              value: jc.job_code,
              label: `${jc.job_code} - ${jc.job_name}`,
            }))
          )
        }
      } catch (err: any) {
        if (!cancelled) message.error(err?.response?.data?.message || err?.message || 'โหลดประเภท Job ไม่สำเร็จ')
      } finally {
        if (!cancelled) setJobOptionsLoading(false)
      }
    }
    fetchJobCodes()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode])

  // Step 3: load users for the "ผู้ขอเบิก" dropdown, same source as PR create page.
  useEffect(() => {
    let cancelled = false
    const fetchUsers = async () => {
      setUsersLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, {
          headers: authHeader,
          params: { role: 'requester' },
        })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        if (!cancelled) {
          setUsers(
            list.map((u: any) => ({
              id: String(u.id),
              fullName: u.full_name ?? u.fullName ?? u.username,
              department: u.department ?? '-',
            }))
          )
        }
      } catch {
        if (!cancelled) message.error('โหลดรายชื่อผู้ขอเบิกไม่สำเร็จ')
      } finally {
        if (!cancelled) setUsersLoading(false)
      }
    }
    fetchUsers()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        job_code: values.job_code,
        doc_type: values.doc_type,
        requested_by: values.requested_by,
        doc_date: values.doc_date ? values.doc_date.format('YYYY-MM-DD') : undefined,
        remark: values.remark || undefined,
      }
      const res = await axios.post(`${BASE_URL}/ic/projects/${projectCode}/movements`, payload, {
        headers: authHeader,
      })
      const data = res.data?.data ?? res.data
      const docNo = data?.doc_no
      const movementId = data?.id ?? data?.movement_id
      message.success(docNo ? `บันทึกสำเร็จ เลขที่เอกสาร ${docNo}` : 'บันทึกสำเร็จ')
      if (movementId) {
        navigate(`/ic/projects/${projectCode}/movement/${movementId}`, { state: { doc_no: docNo } })
      } else {
        navigate('/ic/projects')
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.response?.data?.message || err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!project) {
    return (
      <div style={{ padding: 24 }}>
        <Result
          status="error"
          title="โหลดข้อมูลโครงการไม่สำเร็จ"
          subTitle={`ไม่พบข้อมูลโครงการรหัส ${projectCode}`}
          extra={
            <Button type="primary" onClick={() => navigate('/ic/projects')}>
              กลับไปหน้ารายการโครงการ
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="สร้างเอกสารตัดเบิก/โอน (โครงการ)"
        subtitle={`${project.project_code} — ${project.project_name}`}
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'โครงการ' },
          { title: project.project_name },
          { title: 'ตัดเบิก/โอน' },
        ]}
      />

      <Card style={cardStyle}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            doc_type: 'ISSUE',
            doc_date: dayjs(),
          }}
        >
          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item label="รหัสโครงการ">
                <Input value={project.project_code} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="ชื่อโครงการ">
                <Input value={project.project_name} disabled />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="job_code"
                label="ประเภท Job"
                rules={[{ required: true, message: 'กรุณาเลือกประเภท Job' }]}
              >
                <Select
                  placeholder={jobOptionsLoading ? 'กำลังโหลด...' : '- เลือกรายการ -'}
                  loading={jobOptionsLoading}
                  showSearch
                  disabled={!jobOptionsLoading && jobOptions.length === 0}
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={jobOptions}
                />
              </Form.Item>
              {!jobOptionsLoading && jobOptions.length === 0 && (
                <div style={{ marginTop: -16, marginBottom: 16, fontSize: 12, color: '#d97706' }}>
                  โครงการนี้ยังไม่ได้กำหนดประเภทงาน (Job) กรุณาติดต่อผู้ดูแลระบบก่อนสร้างเอกสาร
                </div>
              )}
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="doc_type"
                label="ประเภทเอกสาร"
                rules={[{ required: true, message: 'กรุณาเลือกประเภทเอกสาร' }]}
              >
                <Select
                  options={[
                    { label: 'ตัดเบิก', value: 'ISSUE' },
                    { label: 'โอน', value: 'TRANSFER' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="requested_by"
                label="ผู้ขอเบิก"
                rules={[{ required: true, message: 'กรุณาเลือกผู้ขอเบิก' }]}
              >
                <Select
                  placeholder="- เลือกรายการ -"
                  loading={usersLoading}
                  showSearch
                  filterOption={(input, option) =>
                    String(option?.searchLabel ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  optionRender={(option) => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span>{option.data.name}</span>
                      {option.data.dept && (
                        <span style={{ color: '#9ca3af', fontSize: 12, flexShrink: 0 }}>{option.data.dept}</span>
                      )}
                    </div>
                  )}
                  options={users.map((u) => ({
                    value: Number(u.id),
                    label: u.fullName,
                    searchLabel: `${u.fullName} ${u.department ?? ''}`,
                    name: u.fullName,
                    dept: u.department,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="doc_date"
                label="วันที่เอกสาร"
                rules={[{ required: true, message: 'กรุณาเลือกวันที่เอกสาร' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={24}>
              <Form.Item name="remark" label="หมายเหตุ">
                <Input.TextArea rows={3} placeholder="หมายเหตุ (ถ้ามี)" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card style={{ ...cardStyle, marginTop: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            disabled={!jobOptionsLoading && jobOptions.length === 0}
            onClick={handleSubmit}
          >
            บันทึก
          </Button>
          <Button onClick={() => navigate(`/ic/projects`)}>ยกเลิก</Button>
        </Space>
      </Card>
    </div>
  )
}

export default ICProjectMovementCreatePage
