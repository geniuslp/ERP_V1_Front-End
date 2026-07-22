import React, { useState, useRef, useEffect } from 'react'
import { Card, Form, Input, Select, DatePicker, Button, Space, message, Row, Col, Tooltip, Modal, Alert } from 'antd'
import {
  SaveOutlined, SendOutlined, UploadOutlined, DeleteOutlined,
  CloseOutlined,
  FileTextOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PaperClipOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import PRItemsTable from '@/components/common/PRItemsTable'
import MemoSidebarPanel from '@/pages/pr/components/MemoSidebarPanel'
import axios from 'axios'
import type { User, Memo } from '@/types'
import { useAppSelector } from '@/store'

// Edit uses the same menu code as create (matching POCreatePage.tsx's
// established pattern — the create page's own menu code gates its edit mode
// too, rather than the status page's menu code).
const MENU_CODE = 'MENU_PR_CREATE'

// PR has no approval workflow of its own (see CLAUDE.md) — once a PR leaves
// DRAFT it is permanently non-editable. No age check, no reason-logging, no
// re-approval flow like PO's edit-after-approval feature.
const LOCKED_STATUSES = ['COMPLETED', 'STOCK_CHECK', 'PARTIALLY_FILLED', 'FULFILLED', 'CANCELLED']

interface AttachedFile {
  uid: string
  name: string
  size: number
  file: File
}

interface LineItem {
  mat_code: string
  qty_requested: number
  qty_to_order: number
  cost_subgroup_id: number | null
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
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [form] = Form.useForm()
  const attachmentsRef = useRef<AttachedFile[]>([])
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([])
  const [warehousesLoading, setWarehousesLoading] = useState(false)
  const [prNumber, setPrNumber] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null)

  // Edit mode
  const [prLoading, setPrLoading] = useState(false)
  const [prStatus, setPrStatus] = useState('')
  const canEdit = !isEdit || !LOCKED_STATUSES.includes(prStatus)
  const [initialItems, setInitialItems] = useState<
    { mat_code: string; mat_name?: string; unit_name?: string; qty_requested: number; qty_to_order: number; cost_subgroup_id: number | null; cost_code_label?: string | null }[]
  >([])
  const [savedAttachments, setSavedAttachments] = useState<
    { id: string | number; fileName: string; filePath: string; fileSize: number }[]
  >([])
  const FILE_BASE_URL = BASE_URL.replace(/\/api\/v1\/?$/, '')

  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { role: 'requester' },
        })
        const raw = Array.isArray(res.data)
          ? res.data
          : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
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
    const fetchWarehouses = async () => {
      setWarehousesLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/warehouses`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setWarehouses(list.map((w: any) => ({
          value: w.warehouse_code ?? w.code,
          label: w.warehouse_name ?? w.name ?? w.warehouse_code ?? w.code,
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลคลังสินค้าไม่สำเร็จ')
      } finally {
        setWarehousesLoading(false)
      }
    }
    fetchWarehouses()
  }, [])

  useEffect(() => {
    if (isEdit) return
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
  }, [isEdit])

  // Edit mode: load the existing PR and populate the form/items/attachments with it.
  useEffect(() => {
    if (!isEdit || !id) return
    const fetchPr = async () => {
      setPrLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/pr/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const raw: any = res.data?.data ?? res.data

        const status = (raw.status ?? '').toUpperCase()
        setPrStatus(status)
        setPrNumber(raw.pr_no ?? '')

        form.setFieldsValue({
          location_text: raw.location_text ?? undefined,
          warehouse_code: raw.warehouse_code ?? undefined,
          required_date: raw.required_date ? dayjs(raw.required_date) : undefined,
          project_code: raw.project_code ?? undefined,
          remarks: raw.remarks ?? undefined,
          requested_by: raw.requester_id != null ? Number(raw.requester_id) : undefined,
        })

        if (raw.memo_id != null) {
          form.setFieldValue('memo_no_ref', raw.memo_no ?? `Memo #${raw.memo_id}`)
        }

        const lines = raw.lines ?? []
        setInitialItems(
          lines.map((l: any) => ({
            mat_code: l.mat_code ?? '',
            mat_name: l.mat_name ?? undefined,
            unit_name: l.unit_name ?? undefined,
            qty_requested: l.qty_requested ?? 0,
            qty_to_order: l.qty_to_order ?? 0,
            cost_subgroup_id: l.cost_subgroup_id ?? null,
            cost_code_label: l.cost_code
              ? `${l.cost_code}${l.cost_subgroup_name ? ` — ${l.cost_subgroup_name}` : ''}`
              : null,
          }))
        )

        setSavedAttachments(
          (raw.attachments ?? []).map((a: any) => ({
            id: a.id ?? `${a.file_path}-${a.file_name}`,
            fileName: a.file_name ?? a.fileName ?? 'file',
            filePath: a.file_path ?? a.filePath ?? '',
            fileSize: a.file_size ?? a.fileSize ?? 0,
          }))
        )
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูล PR ไม่สำเร็จ'
        )
      } finally {
        setPrLoading(false)
      }
    }
    fetchPr()
  }, [isEdit, id])

  const handleSubmit = async (status: 'DRAFT' | 'COMPLETED') => {
    if (isEdit && !canEdit) {
      message.warning('ไม่สามารถแก้ไขใบขอซื้อนี้ได้')
      return
    }
    setSubmitting(true)
    try {
      const { location_text, required_date, project_code, remarks, warehouse_code, requested_by } =
        await form.validateFields()

      // 1. Upload newly-added files — keep already-saved attachments (edit mode) as-is.
      const existingAttachments = savedAttachments.map((a) => ({
        file_path: a.filePath,
        file_name: a.fileName,
        file_size: a.fileSize,
        file_type: a.fileName.split('.').pop()?.toLowerCase() ?? '',
      }))
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

      const payload = {
        pr_no: prNumber,
        pr_date: dayjs().format('YYYY-MM-DD'),
        requested_by,
        created_by: requested_by,
        location_text,
        warehouse_code: warehouse_code || undefined,
        required_date: required_date ? required_date.format('YYYY-MM-DD') : undefined,
        project_code,
        remarks,
        status,
        memo_id: selectedMemo?.id ? Number(selectedMemo.id) : null,
        lines: lineItems.map((item, i) => ({
          line_no: i + 1,
          mat_code: item.mat_code,
          qty_requested: item.qty_requested,
          qty_to_order: item.qty_to_order,
          cost_subgroup_id: item.cost_subgroup_id,
        })),
        attachments: [...existingAttachments, ...uploadedFiles],
      }

      if (isEdit) {
        await axios.put(`${BASE_URL}/pr/${id}`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('บันทึกการแก้ไข PR สำเร็จ')
      } else {
        await axios.post(`${BASE_URL}/pr`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('บันทึก PR สำเร็จ')
      }
      navigate('/pr/status')
    } catch (err: any) {
      const shortages = err?.response?.data?.shortages
      if (Array.isArray(shortages) && shortages.length > 0) {
        const lines = shortages.map((s: any) =>
          `${s.mat_code}: ขอ ${s.requested} เหลือ ${s.available}`
        ).join('\n')
        Modal.error({
          title: 'สต็อกไม่เพียงพอ',
          content: <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{lines}</pre>,
        })
      } else {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึก PR ไม่สำเร็จ'
        )
      }
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
        title={isEdit ? 'แก้ไขใบขอซื้อ' : 'สร้างใบขอซื้อ'}
        subtitle="สร้างใบขอซื้อสินค้า/บริการเพื่อส่งอนุมัติ"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบขอซื้อ' }, { title: isEdit ? 'แก้ไขใบขอซื้อ' : 'สร้างใบขอซื้อ' }]}
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

      {isEdit && !canEdit && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message={`ใบขอซื้อนี้อยู่ในสถานะ ${prStatus} — ไม่สามารถแก้ไขได้ (แก้ไขได้เฉพาะสถานะแบบร่างเท่านั้น)`}
        />
      )}

      <div style={{ marginBottom: 16 }}>
        <span style={{ color: '#999' }}>{isEdit ? 'เลขที่ PR : ' : 'PR ล่าสุด : '}</span>
        <span style={{ color: 'red', fontWeight: 'bold', fontSize: 18 }}>{prNumber}</span>
      </div>

      <Form form={form} layout="horizontal" disabled={isEdit && !canEdit} initialValues={{ pr_date: dayjs().format('YYYY-MM-DD') }}>
        <Card
          title={
            <div style={{ textAlign: 'center', color: '#1e3a8a', fontWeight: 700, fontSize: 15 }}>
              {isEdit ? 'แก้ไขใบขอซื้อ (PR)' : 'ออกใบขอซื้อ (PR)'}
            </div>
          }
          style={cardStyle}
          loading={prLoading}
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
                <Form.Item name="location_text" noStyle rules={[{ required: true, message: 'กรุณากรอกสถานที่ส่งของ' }]}>
                  <Input placeholder="ระบุสถานที่ส่งของ" style={{ width: '100%' }} />
                </Form.Item>
              </Field>

              <Field label="คลังสินค้า">
                <Form.Item name="warehouse_code" noStyle>
                  <Select
                    placeholder="- ไม่ระบุ -"
                    style={{ width: '100%' }}
                    loading={warehousesLoading}
                    showSearch
                    allowClear
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={warehouses}
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
                    disabled={!!selectedMemo}
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={projects}
                  />
                </Form.Item>
                {selectedMemo && (
                  <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 4 }}>
                    ล็อกตามโครงการของ Memo ที่เลือก — ล้าง Memo Reference เพื่อแก้ไข
                  </div>
                )}
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
                <Form.Item
                  name="requested_by"
                  noStyle
                  rules={[{ required: true, message: 'กรุณาเลือกผู้ขอซื้อ' }]}
                >
                  <Select
                    placeholder="- เลือกรายการ -"
                    style={{ width: '100%' }}
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
                      label: u.fullName || u.username,
                      searchLabel: `${u.fullName || u.username} ${u.department ?? ''}`,
                      name: u.fullName || u.username,
                      dept: u.department,
                    }))}
                  />
                </Form.Item>
              </Field>

              {/* Approval no longer happens on PR — it happens via Memo instead
                  (memo.status: DRAFT / PENDING_APPROVAL / APPROVED / REJECTED / CANCELLED).
                  The approver is now selected on the Memo, not here. */}

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

                {/* Saved attachments (edit mode) */}
                {savedAttachments.length > 0 && (
                  <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {savedAttachments.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: '#f8faff',
                          border: '0.5px solid #bfdbfe',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 12,
                        }}
                      >
                        <PaperClipOutlined style={{ color: '#2563eb' }} />
                        <a
                          href={`${FILE_BASE_URL}/${a.filePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="attachment-filename-link"
                          style={{ color: '#1e40af', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {a.fileName}
                        </a>
                        <span style={{ color: '#9ca3af' }}>{formatSize(a.fileSize)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Drop zone */}
                {(!isEdit || canEdit) && (
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
                )}

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

        <PRItemsTable
          readonly={isEdit && !canEdit}
          initialItems={initialItems}
          onBack={() => navigate('/pr/status')}
          onItemsChange={setLineItems}
        />

        {/* ── Action bar ── */}
        {(!isEdit || canEdit) && (
          <Card style={{ ...cardStyle, marginTop: 16 }}>
            <div className="pr-action-bar">
              <Space wrap>
                <PermissionButton
                  menuCode={MENU_CODE}
                  action={isEdit ? 'edit' : 'write'}
                  icon={<SaveOutlined />}
                  loading={submitting}
                  disabled={submitting}
                  onClick={() => handleSubmit('DRAFT')}
                >
                  บันทึกร่าง
                </PermissionButton>
                <PermissionButton
                  menuCode={MENU_CODE}
                  action={isEdit ? 'edit' : 'write'}
                  type="primary"
                  icon={<SendOutlined />}
                  loading={submitting}
                  disabled={submitting}
                  onClick={() => handleSubmit('COMPLETED')}
                >
                  ส่งใบขอซื้อ
                </PermissionButton>
              </Space>
            </div>
          </Card>
        )}
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
          form.setFieldValue('project_code', (memo as any).projectCode ?? (memo as any).project_code)
          setSelectedMemo(memo)
        }}
      />
    </div>
  )
}

export default PRCreatePage
