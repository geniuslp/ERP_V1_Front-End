import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card, Form, Input, Row, Col, Button, Table, InputNumber, Space, message, Alert, Select,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, SendOutlined, CloseOutlined,
  UploadOutlined, FileOutlined, FileImageOutlined, FileExcelOutlined,
  FilePdfOutlined, CloseCircleFilled,
} from '@ant-design/icons'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { ROUTES } from '@/config/routes'
import { useAppSelector } from '@/store'

const MENU_CODE = 'MENU_MEMO_CREATE'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const LOCKED_STATUSES = ['APPROVED', 'CANCELLED', 'PENDING_APPROVAL']

// memo.department is a plain varchar(100) with no backing lookup table — the
// short code is stored (matching the code/name display pattern used elsewhere
// in this codebase, e.g. job_code), not the full Thai label.
const DEPARTMENT_OPTIONS = [
  { value: 'HO', label: 'HO — สำนักงานใหญ่' },
  { value: 'FAC-S', label: 'FAC-S — ศาลายา' },
  { value: 'FAC-P', label: 'FAC-P — ปราจีนบุรี' },
  { value: 'BO', label: 'BO' },
]

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#1e40af',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

interface EditableItem {
  key: string
  description: string
  unit: string
  quantity: number
  remark?: string
}

const emptyItem = (): EditableItem => ({
  key: `item-${Date.now()}-${Math.random()}`,
  description: '',
  unit: '',
  quantity: 1,
  remark: '',
})

interface AttachedFile {
  uid: string
  name: string
  size: number
  file: File | null
  type: string
  isExisting?: boolean
  filePath?: string
}

const ACCEPTED_FILE_TYPES = '.jpg,.jpeg,.png,.gif,.webp,.xlsx,.xls,.csv,.pdf'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_FILE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'xlsx', 'xls', 'csv', 'pdf']

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <FileImageOutlined style={{ color: '#2563eb' }} />
  if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileExcelOutlined style={{ color: '#16a34a' }} />
  if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#dc2626' }} />
  return <FileOutlined style={{ color: '#64748b' }} />
}

const MemoCreateEditPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const currentUser = useAppSelector((s) => s.auth.user)
  const [items, setItems] = useState<EditableItem[]>([emptyItem()])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [canEdit, setCanEdit] = useState(true)
  const [memoStatus, setMemoStatus] = useState('')
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [approvers, setApprovers] = useState<{ value: number; label: string; dept?: string }[]>([])
  const [approversLoading, setApproversLoading] = useState(false)
  const [requesters, setRequesters] = useState<{ value: number; label: string; dept?: string }[]>([])
  const [requestersLoading, setRequestersLoading] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchProjects = async () => {
      setProjectsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/projects`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const raw = Array.isArray(res.data)
          ? res.data
          : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setProjects(list.map((p: any) => ({
          value: p.project_code,
          label: p.project_code
            ? `${p.project_code} — ${p.project_name ?? p.name ?? ''}`
            : (p.project_name ?? p.name ?? String(p.id)),
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'Failed to load projects')
      } finally {
        setProjectsLoading(false)
      }
    }
    fetchProjects()
  }, [])

  useEffect(() => {
    const fetchApprovers = async () => {
      setApproversLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/eligible-approvers`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { doc_type: 'MEMO' },
        })
        const raw = Array.isArray(res.data)
          ? res.data
          : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        // Endpoint is expected to already return { value, label, dept } — pass
        // through as-is, with a fallback in case a raw user shape slips through
        // (e.g. { id, full_name, department }) until the real response is confirmed.
        setApprovers(list.map((u: any) => ({
          value: u.value ?? Number(u.id),
          label: u.label ?? u.full_name ?? u.fullName ?? u.username,
          dept: u.dept ?? u.department,
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'Failed to load approvers')
      } finally {
        setApproversLoading(false)
      }
    }
    fetchApprovers()
  }, [])

  useEffect(() => {
    const fetchRequesters = async () => {
      setRequestersLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { role: 'requester' },
        })
        const raw = Array.isArray(res.data)
          ? res.data
          : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setRequesters(list.map((u: any) => ({
          value: Number(u.id),
          label: u.full_name ?? u.fullName ?? u.username,
          dept: u.department,
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'Failed to load requesters')
      } finally {
        setRequestersLoading(false)
      }
    }
    fetchRequesters()
  }, [])

  useEffect(() => {
    if (!isEdit && currentUser?.id) {
      form.setFieldValue('requested_by', Number(currentUser.id))
    }
  }, [isEdit, currentUser])

  useEffect(() => {
    if (!isEdit) return
    const fetchMemo = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/memo/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const memo = res.data?.data ?? res.data

        const status = memo.status ?? ''
        setMemoStatus(status)
        setCanEdit(!LOCKED_STATUSES.includes(status.toUpperCase()))

        form.setFieldsValue({
          requested_by: memo.requested_by ?? memo.requestedBy,
          title:        memo.title,
          project_code: memo.project_code ?? memo.projectCode,
          approver_id:  memo.approver_id ?? memo.approverId,
          department:   memo.department,
          delivery_location: memo.delivery_location ?? memo.deliveryLocation,
          note:         memo.note,
        })

        const lines = memo.lines ?? memo.items ?? []
        setItems(
          lines.map((it: any) => ({
            key:         String(it.id ?? `${Date.now()}-${Math.random()}`),
            description: it.description ?? '',
            unit:        it.unit        ?? '',
            quantity:    it.quantity    ?? 1,
            remark:      it.remark      ?? '',
          }))
        )

        // Load existing attachments (edit mode)
        const existingFiles = memo.attachments ?? []
        if (existingFiles.length > 0) {
          setAttachedFiles(
            existingFiles.map((f: any) => ({
              uid: String(f.id ?? `${Date.now()}-${Math.random()}`),
              name: f.file_name ?? f.fileName ?? 'file',
              size: f.file_size ?? f.fileSize ?? 0,
              file: null,
              type: (f.file_name ?? '').split('.').pop()?.toLowerCase() ?? '',
              isExisting: true,
              filePath: f.file_path ?? f.filePath,
            }))
          )
        }
      } catch (err: any) {
        message.error(
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'โหลดข้อมูลใบบันทึกขอซื้อ (Memo) ไม่สำเร็จ'
        )
      } finally {
        setLoading(false)
      }
    }
    fetchMemo()
  }, [id])

  const updateItem = (key: string, field: keyof EditableItem, value: any) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)))
  }

  const addItem = () => setItems((prev) => [...prev, emptyItem()])
  const removeItem = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key))

  const validateItems = () => {
    const invalid = items.some((it) => !it.description.trim() || !it.unit.trim())
    if (invalid) {
      message.warning('กรุณากรอกรายการและหน่วยให้ครบทุกแถว')
      return false
    }
    return true
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const next: AttachedFile[] = []
    const rejected: string[] = []

    Array.from(files).forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_FILE_EXTS.includes(ext)) {
        rejected.push(`${f.name} (ไม่รองรับไฟล์ประเภทนี้)`)
        return
      }
      if (f.size > MAX_FILE_SIZE) {
        rejected.push(`${f.name} (ไฟล์ใหญ่เกิน 10MB)`)
        return
      }
      next.push({
        uid: `${Date.now()}-${Math.random()}`,
        name: f.name,
        size: f.size,
        file: f,
        type: ext,
      })
    })

    if (rejected.length > 0) {
      message.warning(`ไม่สามารถแนบไฟล์: ${rejected.join(', ')}`)
    }
    setAttachedFiles((prev) => [...prev, ...next])
  }

  const removeFile = (uid: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.uid !== uid))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const handleSave = async (status?: 'DRAFT' | 'PENDING_APPROVAL') => {
    if (isEdit && !canEdit) {
      message.warning('ไม่สามารถแก้ไขใบบันทึกขอซื้อ (Memo) นี้ได้')
      return
    }

    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    if (!validateItems()) return

    setSubmitting(true)
    try {
      // 1. Upload new files (skip existing ones already on server)
      const uploadedAttachments: { file_path: string; file_name: string; file_size: number; file_type: string }[] = []
      const existingAttachments: { file_path: string; file_name: string; file_size: number; file_type: string }[] = []

      for (const f of attachedFiles) {
        if (f.isExisting) {
          existingAttachments.push({
            file_path: f.filePath ?? '',
            file_name: f.name,
            file_size: f.size,
            file_type: f.type,
          })
          continue
        }
        const formData = new FormData()
        formData.append('file', f.file as File)
        const uploadRes = await axios.post(`${BASE_URL}/upload/memo`, formData, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'multipart/form-data',
          },
        })
        const d = uploadRes.data?.data ?? uploadRes.data
        uploadedAttachments.push({
          file_path: d.file_path,
          file_name: d.file_name,
          file_size: d.file_size,
          file_type: d.file_type,
        })
      }

      const payload: any = {
        requested_by: values.requested_by,
        title:        values.title,
        project_code: values.project_code ?? undefined,
        approver_id:  values.approver_id,
        department:   values.department   ?? undefined,
        delivery_location: values.delivery_location ?? undefined,
        note:         values.note         ?? undefined,
        lines: items.map((item, i) => ({
          line_no:     i + 1,
          description: item.description,
          unit:        item.unit,
          quantity:    item.quantity,
          remark:      item.remark || undefined,
        })),
        attachments: [...existingAttachments, ...uploadedAttachments],
      }

      if (!isEdit && status) {
        payload.status = status
      }

      let res
      if (isEdit) {
        res = await axios.put(`${BASE_URL}/memo/${id}`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (memoStatus === 'REJECTED' || memoStatus === 'DRAFT') {
          try {
            await axios.post(
              `${BASE_URL}/memo/${id}/submit`,
              {},
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )
            message.success('แก้ไขและส่งขออนุมัติสำเร็จ')
          } catch (err: any) {
            message.warning(
              'บันทึกข้อมูลสำเร็จ แต่ส่งขออนุมัติไม่สำเร็จ: ' +
              (err?.response?.data?.message || err?.message || 'unknown error')
            )
          }
        } else {
          message.success('แก้ไขใบบันทึกขอซื้อ (Memo) สำเร็จ')
        }
      } else {
        res = await axios.post(`${BASE_URL}/memo`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success(status === 'DRAFT' ? 'บันทึกร่างสำเร็จ' : 'ส่งขออนุมัติสำเร็จ — รอผู้อนุมัติดำเนินการ')
      }
      const memoId = res.data?.data?.id ?? res.data?.id ?? id
      navigate(ROUTES.MEMO.DETAIL.replace(':id', String(memoId)))
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'บันทึกไม่สำเร็จ'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    { title: '#', key: 'no', width: 40, render: (_: any, __: any, idx: number) => idx + 1 },
    {
      title: 'รายการ/รายละเอียด *',
      key: 'description',
      render: (_: any, record: EditableItem) => (
        <Input
          value={record.description}
          status={!record.description.trim() ? 'error' : undefined}
          onChange={(e) => updateItem(record.key, 'description', e.target.value)}
        />
      ),
    },
    {
      title: 'จำนวน *',
      key: 'quantity',
      width: 110,
      render: (_: any, record: EditableItem) => (
        <InputNumber
          min={0.01}
          style={{ width: '100%' }}
          value={record.quantity}
          onChange={(val) => updateItem(record.key, 'quantity', val ?? 0)}
        />
      ),
    },
    {
      title: 'หน่วย *',
      key: 'unit',
      width: 100,
      render: (_: any, record: EditableItem) => (
        <Input
          value={record.unit}
          status={!record.unit.trim() ? 'error' : undefined}
          onChange={(e) => updateItem(record.key, 'unit', e.target.value)}
        />
      ),
    },
    {
      title: 'หมายเหตุ',
      key: 'remark',
      render: (_: any, record: EditableItem) => (
        <Input
          placeholder="(optional)"
          value={record.remark}
          onChange={(e) => updateItem(record.key, 'remark', e.target.value)}
        />
      ),
    },
    {
      title: 'ลบ',
      key: 'delete',
      width: 60,
      render: (_: any, record: EditableItem) => (
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          disabled={items.length === 1}
          onClick={() => removeItem(record.key)}
        />
      ),
    },
  ]

  const lockedMessage = memoStatus === 'APPROVED'
    ? 'ใบบันทึกขอซื้อ (Memo) นี้อนุมัติแล้ว — ไม่สามารถแก้ไขได้'
    : memoStatus === 'PENDING_APPROVAL'
    ? 'ใบบันทึกขอซื้อ (Memo) นี้อยู่ระหว่างรอการอนุมัติ — ไม่สามารถแก้ไขได้ในขณะนี้'
    : 'ใบบันทึกขอซื้อ (Memo) นี้ถูกยกเลิกแล้ว — ไม่สามารถแก้ไขได้'

  return (
    <div>
      <PageHeader
        title={isEdit ? 'แก้ไขใบบันทึกขอซื้อ (Memo)' : 'สร้างใบบันทึกขอซื้อ (Memo)'}
        subtitle="บันทึกความต้องการจัดซื้อ"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบบันทึกขอซื้อ (Memo)' }, { title: isEdit ? 'แก้ไข' : 'สร้าง' }]}
        extra={null}
      />

      {isEdit && !canEdit && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message={lockedMessage}
        />
      )}

      {isEdit && memoStatus === 'REJECTED' && canEdit && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message="ใบบันทึกขอซื้อ (Memo) นี้ถูกตีกลับ — แก้ไขแล้วกดบันทึกเพื่อส่งขออนุมัติใหม่"
        />
      )}

      <Form form={form} layout="vertical" disabled={isEdit && !canEdit}>
        <Card
          title={<span style={cardTitleStyle}>ข้อมูลทั่วไป</span>}
          style={{ ...cardStyle, marginBottom: 16 }}
          loading={loading}
        >
          <Row gutter={16}>
            <Col md={12} xs={24}>
              <Form.Item label="หัวข้อ / เรื่อง" name="title" rules={[{ required: true, message: 'กรุณากรอกหัวข้อ' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item
                label="ผู้ขอ"
                name="requested_by"
                rules={[{ required: true, message: 'กรุณาเลือกผู้ขอ' }]}
              >
                <Select
                  placeholder="— เลือกผู้ขอ —"
                  loading={requestersLoading}
                  showSearch
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
                  options={requesters}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="โครงการ" name="project_code">
                <Select
                  placeholder="— เลือกโครงการ —"
                  loading={projectsLoading}
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={projects}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item
                label="ผู้อนุมัติ"
                name="approver_id"
                rules={[{ required: true, message: 'กรุณาเลือกผู้อนุมัติ' }]}
              >
                <Select
                  placeholder="— เลือกผู้อนุมัติ —"
                  loading={approversLoading}
                  showSearch
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
                  options={approvers}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="หน่วยงาน" name="department">
                <Select
                  placeholder="เลือกหน่วยงาน"
                  allowClear
                  options={DEPARTMENT_OPTIONS}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="สถานที่ส่งของ" name="delivery_location">
                <Input placeholder="ระบุสถานที่ส่งของ" maxLength={255} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="หมายเหตุ" name="note">
                <Input.TextArea rows={3} maxLength={1000} showCount />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card
          title={<span style={cardTitleStyle}>รายการวัสดุ/บริการ</span>}
          extra={
            !isEdit || canEdit ? (
              <Button type="dashed" icon={<PlusOutlined />} onClick={addItem}>
                เพิ่มรายการ
              </Button>
            ) : null
          }
          style={cardStyle}
        >
          <Table
            rowKey="key"
            columns={columns}
            dataSource={items}
            pagination={false}
            scroll={{ x: 900 }}
          />
        </Card>

        <Card
          title={<span style={cardTitleStyle}>แนบไฟล์</span>}
          style={{ ...cardStyle, marginTop: 16 }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            style={{ display: 'none' }}
            onChange={(e) => {
              addFiles(e.target.files)
              ;(e.target as HTMLInputElement).value = ''
            }}
          />

          {(!isEdit || canEdit) && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: `1.5px dashed ${isDragging ? '#2563eb' : '#bfdbfe'}`,
                borderRadius: 10,
                padding: '20px 24px',
                cursor: 'pointer',
                background: isDragging ? '#eff6ff' : '#f8faff',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <UploadOutlined style={{ fontSize: 22, color: '#2563eb' }} />
              <div>
                <div style={{ fontSize: 14, color: '#1e40af', fontWeight: 500 }}>
                  คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  รองรับไฟล์รูปภาพ (JPG, PNG, GIF), Excel, CSV และ PDF — สูงสุด 10MB ต่อไฟล์
                </div>
              </div>
            </div>
          )}

          {attachedFiles.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {attachedFiles.map((f) => (
                <div
                  key={f.uid}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#f8faff',
                    border: '0.5px solid #bfdbfe',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 13,
                    color: '#1e40af',
                    maxWidth: 280,
                  }}
                >
                  {getFileIcon(f.name)}
                  <span
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}
                    title={f.name}
                  >
                    {f.name}
                  </span>
                  <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>
                    ({formatSize(f.size)})
                  </span>
                  {(!isEdit || canEdit) && (
                    <CloseCircleFilled
                      onClick={(e) => { e.stopPropagation(); removeFile(f.uid) }}
                      style={{ fontSize: 14, color: '#93c5fd', cursor: 'pointer', flexShrink: 0 }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {attachedFiles.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
              {attachedFiles.length} ไฟล์ที่แนบ
            </div>
          )}
        </Card>
      </Form>

      {/* Bottom action bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 24,
        padding: '16px 24px',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
        border: 'none',
      }}>
        <Button icon={<CloseOutlined />} onClick={() => navigate(ROUTES.MEMO.LIST)}>
          ยกเลิก
        </Button>
        {isEdit ? (
          <PermissionButton
            menuCode={MENU_CODE}
            action="edit"
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            disabled={!canEdit}
            onClick={() => handleSave()}
            style={{
              background: canEdit ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : undefined,
              border: 'none',
            }}
          >
            บันทึก
          </PermissionButton>
        ) : (
          <>
            <PermissionButton menuCode={MENU_CODE} action="write" icon={<SaveOutlined />} loading={submitting} onClick={() => handleSave('DRAFT')}>
              บันทึกร่าง
            </PermissionButton>
            <PermissionButton
              menuCode={MENU_CODE}
              action="write"
              type="primary"
              icon={<SendOutlined />}
              loading={submitting}
              onClick={() => handleSave('PENDING_APPROVAL')}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}
            >
              บันทึก
            </PermissionButton>
          </>
        )}

        
        
      </div>
    </div>
  )
}


export default MemoCreateEditPage
