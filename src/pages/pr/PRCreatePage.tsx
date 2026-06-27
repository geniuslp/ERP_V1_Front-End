import React, { useState, useRef, useEffect } from 'react'
import { Card, Form, Input, Select, DatePicker, Button, Space, message, Row, Col, Tooltip } from 'antd'
import {
  SaveOutlined, SendOutlined, UploadOutlined, DeleteOutlined,
  EditOutlined, CloseOutlined, StopOutlined,
  FileTextOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PRItemsTable from '@/components/common/PRItemsTable'
import MemoSidebarPanel from '@/pages/pr/components/MemoSidebarPanel'
import axios from 'axios'
import type { User, Memo } from '@/types'
import { useAppSelector } from '@/store'

interface AttachedFile {
  uid: string
  name: string
  size: number
  file: File
}

interface LineItem {
  mat_code: string
  qty_requested: number
  [key: string]: any
}

interface UploadedFile {
  file_path: string
  file_name: string
  file_size: number
  file_type: string
}

/* ── responsive styles injected once ─────────────────────────────── */
const responsiveStyle = `
  .pr-field-row {
    display: flex;
    align-items: center;
    margin-bottom: 14px;
  }
  .pr-field-label {
    width: 130px;
    min-width: 130px;
    text-align: right;
    padding-right: 8px;
    color: #374151;
    font-size: 13px;
    flex-shrink: 0;
  }
  .pr-field-control {
    flex: 1;
    min-width: 0;
  }
  .pr-action-bar {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
  }
  /* tablet */
  @media (max-width: 768px) {
    .pr-field-row {
      flex-direction: column;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .pr-field-label {
      width: 100%;
      text-align: left;
      padding-right: 0;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .pr-field-control {
      width: 100%;
    }
    .pr-action-bar {
      justify-content: stretch;
    }
    .pr-action-bar .ant-btn {
      flex: 1;
      min-width: 0;
    }
  }
  /* mobile */
  @media (max-width: 480px) {
    .pr-action-bar {
      flex-direction: column;
    }
    .pr-action-bar .ant-btn {
      width: 100%;
    }
  }
`
const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const PRCreatePage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const user = useAppSelector((s) => s.auth.user)
  const [form] = Form.useForm()
  const attachmentsRef = useRef<AttachedFile[]>([])
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [approvers, setApprovers] = useState<User[]>([])
  const [approversLoading, setApproversLoading] = useState(false)
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [prNumber, setPrNumber] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [requestedBy, setRequestedBy] = useState<number | null>(null)
  const [approverId, setApproverId] = useState<number | null>(null)
  const [memoOpen, setMemoOpen] = useState(false)
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { role: 'requester' },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setUsers(list.map((u: any) => ({
          id: String(u.id),
          username: u.username,
          fullName: u.full_name ?? u.fullName ?? u.username,
          email: u.email,
          role: u.role ?? '-',
          department: u.department ?? '-',
        })))
      } catch {
        message.error('โหลดรายชื่อผู้ขอซื้อไม่สำเร็จ')
      } finally {
        setUsersLoading(false)
      }
    }
    fetchUsers()
  }, [])

  useEffect(() => {
    const fetchApprovers = async () => {
      setApproversLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { role: 'approver' },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setApprovers(list.map((u: any) => ({
          id: String(u.id),
          username: u.username,
          fullName: u.full_name ?? u.fullName ?? u.username,
          email: u.email,
          role: u.role ?? '-',
          department: u.department ?? '-',
        })))
      } catch {
        message.error('โหลดรายชื่อผู้อนุมัติไม่สำเร็จ')
      } finally {
        setApproversLoading(false)
      }
    }
    fetchApprovers()
  }, [])

  useEffect(() => {
    const fetchLocations = async () => {
      setLocationsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/locations`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setLocations(list.map((l: any) => ({
          value: l.location_code,
          label: l.location_name ?? l.name,
        })))
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดสถานที่ไม่สำเร็จ'
        )
      } finally {
        setLocationsLoading(false)
      }
    }
    fetchLocations()
  }, [])

  useEffect(() => {
    const fetchProjects = async () => {
      setProjectsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/projects`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setProjects(list.map((p: any) => ({
          value: p.project_code,
          label: p.project_code
            ? `${p.project_code} — ${p.project_name ?? p.name ?? ''}`
            : (p.project_name ?? p.name ?? String(p.id)),
        })))
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดรหัสงานไม่สำเร็จ'
        )
      } finally {
        setProjectsLoading(false)
      }
    }
    fetchProjects()
  }, [])

  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/pr/next-number`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        setPrNumber(res.data.data.next_number)
      } catch (err: any) {
        message.error(err?.response?.data?.message || 'โหลดเลข PR ไม่สำเร็จ')
      }
    }
    fetchNextNumber()
  }, [])

  const handleSubmit = async (status: 'DRAFT' | 'PENDING_APPROVAL') => {
    setSubmitting(true)
    try {
      const { location_code, required_date, project_code, remarks } = form.getFieldsValue()

      // 1. Upload attachments first
      const uploadedFiles: UploadedFile[] = []
      for (const f of attachmentsRef.current) {
        const formData = new FormData()
        formData.append('file', f.file)
        const res = await axios.post(`${BASE_URL}/upload/pr`, formData, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'multipart/form-data',
          },
        })
        const d = res.data.data ?? res.data
        uploadedFiles.push({
          file_path: d.file_path,
          file_name: d.file_name,
          file_size: d.file_size,
          file_type: d.file_type,
        })
      }

      // 2. POST PR
      await axios.post(
        `${BASE_URL}/pr`,
        {
          pr_no: prNumber,
          pr_date: dayjs().format('YYYY-MM-DD'),
          requested_by: requestedBy,
          approver_id: approverId,
          created_by: requestedBy,
          location_code,
          required_date: required_date ? required_date.format('YYYY-MM-DD') : undefined,
          project_code,
          remarks,
          status,
          memo_id: selectedMemo?.id ?? null,
          lines: lineItems.map((item, i) => ({
            line_no: i + 1,
            mat_code: item.mat_code,
            qty_requested: item.qty_requested,
          })),
          attachments: uploadedFiles,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      message.success('บันทึก PR สำเร็จ')
      navigate('/pr')
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึก PR ไม่สำเร็จ'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const next: AttachedFile[] = Array.from(files).map((f) => ({
      uid: `${Date.now()}-${Math.random()}`,
      name: f.name,
      size: f.size,
      file: f,
    }))
    attachmentsRef.current = [...attachmentsRef.current, ...next]
    setAttachedFiles([...attachmentsRef.current])
  }

  const formatSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`

  const cardStyle: React.CSSProperties = {
    borderRadius: 12,
    border: 'none',
    boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  }

  /* ── Field helper ─────────────────────────────────────────────── */
  const Field = ({
    label,
    required,
    redLabel,
    alignTop,
    children,
  }: {
    label: string
    required?: boolean
    redLabel?: boolean
    alignTop?: boolean
    children: React.ReactNode
  }) => (
    <div className="pr-field-row" style={alignTop ? { alignItems: 'flex-start' } : {}}>
      <div className="pr-field-label" style={alignTop ? { paddingTop: 6 } : {}}>
        {required && <span style={{ color: '#ff4d4f', marginRight: 2 }}>*</span>}
        <span style={{ color: redLabel ? '#cc0000' : '#374151', fontWeight: redLabel ? 600 : 400 }}>
          {label} :
        </span>
      </div>
      <div className="pr-field-control">{children}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <style>{responsiveStyle}</style>

      {/* ── Left: PR Form ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24, minWidth: 0, transition: 'all .25s ease' }}>

      <PageHeader
        title="ออกใบขอซื้อ (PR)"
        subtitle="สร้างใบขอซื้อสินค้า/บริการเพื่อส่งอนุมัติ"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบขอซื้อ' }, { title: 'สร้างใบขอซื้อ' }]}
        extra={
          <Button
            icon={<FileTextOutlined />}
            type={memoOpen ? 'primary' : 'default'}
            onClick={() => setMemoOpen((v) => !v)}
          >
            Memo {memoOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
          </Button>
        }
      />

      <div style={{ marginBottom: 16 }}>
        <span style={{ color: '#999' }}>PR ล่าสุด : </span>
        <span style={{ color: 'red', fontWeight: 'bold', fontSize: 18 }}>{prNumber}</span>
      </div>

      <Form form={form} layout="horizontal" initialValues={{ pr_date: dayjs().format('YYYY-MM-DD') }}>
        <Card
          title={
            <div style={{ textAlign: 'center', color: '#1e3a8a', fontWeight: 700, fontSize: 15 }}>
              ออกใบขอซื้อ (PR)
            </div>
          }
          style={cardStyle}
        >
          <Row gutter={[40, 0]}>
            {/* ── Left column ── */}
            <Col xs={24} lg={12}>
              <div className="pr-field-row">
                <div className="pr-field-label">
                  <span style={{ color: '#cc0000', fontWeight: 600 }}>หมายเลข PR :</span>
                </div>
                <div className="pr-field-control">
                  <Input disabled value={prNumber} style={{ color: '#cc0000', fontWeight: 700 }} />
                </div>
              </div>

              <Field label="วันที่">
                <Form.Item name="pr_date" noStyle>
                  <Input disabled style={{ color: '#374151' }} />
                </Form.Item>
              </Field>

              <Field label="สถานที่ส่งของ" required>
                <Form.Item name="location_code" noStyle>
                  <Select
                    placeholder="- เลือกรายการ -"
                    style={{ width: '100%' }}
                    loading={locationsLoading}
                    showSearch
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={locations}
                  />
                </Form.Item>
              </Field>

              <Field label="กำหนดส่งของ">
                <Form.Item name="required_date" noStyle>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Field>

              <Field label="รหัสงาน">
                <Form.Item name="project_code" noStyle>
                  <Select
                    placeholder="- เลือกรายการ -"
                    style={{ width: '100%' }}
                    loading={projectsLoading}
                    showSearch
                    allowClear
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={projects}
                  />
                </Form.Item>
              </Field>

              <Field label="Memo Reference">
                <Input.Group compact style={{ display: 'flex' }}>
                  <Input
                    style={{ flex: 1, color: '#2563eb', fontWeight: 500 }}
                    value={selectedMemo?.memoNo ?? ''}
                    placeholder="— not selected"
                    readOnly
                  />
                  <Tooltip title="Clear">
                    <Button
                      icon={<CloseOutlined />}
                      disabled={!selectedMemo}
                      onClick={() => {
                        setSelectedMemo(null)
                        form.setFieldValue('memo_id', undefined)
                        form.setFieldValue('memo_no_ref', undefined)
                      }}
                    />
                  </Tooltip>
                </Input.Group>
              </Field>

              <Field label="หมายเหตุ" alignTop>
                <Form.Item name="remarks" noStyle>
                  <Input.TextArea
                    rows={3}
                    placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                  />
                </Form.Item>
              </Field>
            </Col>

            {/* ── Right column ── */}
            <Col xs={24} lg={12}>
              <Field label="สถานะ">
                <Input defaultValue="open" disabled />
              </Field>

              <Field label="ผู้ขอซื้อ" required>
                <Select
                  placeholder="- เลือกรายการ -"
                  style={{ width: '100%' }}
                  loading={usersLoading}
                  showSearch
                  value={requestedBy}
                  onChange={(val) => setRequestedBy(Number(val))}
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
                    label: u.fullName || u.username,
                    searchLabel: `${u.fullName || u.username} ${u.department ?? ''}`,
                    name: u.fullName || u.username,
                    dept: u.department,
                  }))}
                />
              </Field>

              <Field label="ผู้อนุมัติ" required>
                <Select
                  placeholder="- เลือกรายการ -"
                  style={{ width: '100%' }}
                  loading={approversLoading}
                  showSearch
                  value={approverId}
                  onChange={(val) => setApproverId(Number(val))}
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
                  options={approvers.map((u) => ({
                    value: Number(u.id),
                    label: u.fullName || u.username,
                    searchLabel: `${u.fullName || u.username} ${u.department ?? ''}`,
                    name: u.fullName || u.username,
                    dept: u.department,
                  }))}
                />
              </Field>

              {/* File upload */}
              <Field label="แนบไฟล์" alignTop>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    addFiles(e.target.files)
                    ;(e.target as HTMLInputElement).value = ''
                  }}
                />

                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files) }}
                  style={{
                    border: `1.5px dashed ${isDragging ? '#2563eb' : '#bfdbfe'}`,
                    borderRadius: 8,
                    padding: '8px 14px',
                    cursor: 'pointer',
                    background: isDragging ? '#eff6ff' : '#f8faff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s',
                  }}
                >
                  <UploadOutlined style={{ color: '#2563eb', fontSize: 16, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: '#1e40af' }}>
                      คลิกเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                      รองรับ JPG, PDF, DOC, XLS — เลือกได้หลายไฟล์พร้อมกัน
                    </div>
                  </div>
                </div>

                {/* File pills */}
                {attachedFiles.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {attachedFiles.map((f) => (
                      <div
                        key={f.uid}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: '#eff6ff',
                          border: '0.5px solid #bfdbfe',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 12,
                          color: '#1e40af',
                          maxWidth: 240,
                        }}
                      >
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 160,
                          }}
                          title={f.name}
                        >
                          {f.name}
                        </span>
                        <span style={{ color: '#9ca3af', flexShrink: 0 }}>{formatSize(f.size)}</span>
                        <DeleteOutlined
                          style={{ color: '#93c5fd', cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => {
                            attachmentsRef.current = attachmentsRef.current.filter((x) => x.uid !== f.uid)
                            setAttachedFiles([...attachmentsRef.current])
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Field>
            </Col>
          </Row>
        </Card>

        <PRItemsTable onBack={() => navigate('/pr')} onItemsChange={setLineItems} />

        {/* ── Action bar ── */}
        <Card style={{ ...cardStyle, marginTop: 16 }}>
          <div className="pr-action-bar">
            <Space wrap>
              <Button icon={<EditOutlined />} disabled={submitting}>Update</Button>
              <Button icon={<CloseOutlined />} danger disabled={submitting}>Cancel</Button>
              <Button icon={<StopOutlined />} style={{ color: '#d97706', borderColor: '#d97706' }} disabled={submitting}>Reject</Button>
              <Button
                icon={<SaveOutlined />}
                loading={submitting}
                disabled={submitting}
                onClick={() => handleSubmit('DRAFT')}
              >
                บันทึกร่าง
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={submitting}
                disabled={submitting}
                onClick={() => handleSubmit('PENDING_APPROVAL')}
              >
                ส่งใบขอซื้อ
              </Button>
            </Space>
          </div>
        </Card>
      </Form>
      </div>

      {/* ── Right: Memo Sidebar ── */}
      <MemoSidebarPanel
        open={memoOpen}
        onClose={() => setMemoOpen(false)}
        selectedMemoId={selectedMemo?.id}
        onSelect={(memo) => {
          form.setFieldValue('memo_id', memo.id)
          form.setFieldValue('memo_no_ref', memo.memoNo)
          setSelectedMemo(memo)
        }}
      />
    </div>
  )
}

export default PRCreatePage
