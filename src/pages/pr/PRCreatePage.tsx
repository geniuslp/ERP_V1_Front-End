import React, { useState, useRef, useEffect } from 'react'
import { Card, Form, Input, Select, DatePicker, Button, Space, message, Row, Col, Tooltip, Modal, Alert, Spin } from 'antd'
import {
  SaveOutlined, SendOutlined, UploadOutlined, DeleteOutlined,
  CloseOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import PRItemsTable from '@/components/common/PRItemsTable'
import MemoSidebarPanel from '@/pages/pr/components/MemoSidebarPanel'
import PRPrint, { type PRData } from '@/pages/pr/PRPrint'
import axios from 'axios'
import type { User, Memo, PROrderType, CreatePRRequest } from '@/types'
import { useAppSelector } from '@/store'
import { JOB_TYPES } from '@/constants/jobTypes'

const MENU_CODE = 'MENU_PR_CREATE'

// Edit mode (route /pr/:id/edit): the PR was already COMPLETED and has been
// reopened to DRAFT server-side (PUT /pr/:id/reopen, triggered from
// PRDetailPage before navigating here). This page then behaves like create,
// prefilled from GET /pr/:id, and saves via PUT /pr/:id instead of POST /pr.
// Saving always keeps status DRAFT — the user must re-submit separately.

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

interface InitialLineItem {
  mat_code: string
  mat_name?: string
  unit_name?: string
  qty_requested: number
  qty_to_order: number
  cost_subgroup_id: number | null
  cost_code_label?: string | null
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
  const [existingAttachments, setExistingAttachments] = useState<UploadedFile[]>([])
  // Files attached to the linked Memo (read-only here — owned by the Memo,
  // never resubmitted as part of this PR's own `attachments` on save).
  const [memoAttachments, setMemoAttachments] = useState<UploadedFile[]>([])
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
  const [initialLineItems, setInitialLineItems] = useState<InitialLineItem[] | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(isEdit)
  const [overOrderedLines, setOverOrderedLines] = useState<string[]>([])
  // Remarks near the line items table — lifted up from PRItemsTable so it can
  // be included in the submit payload.
  const [remark, setRemark] = useState('')
  const orderType: PROrderType | undefined = Form.useWatch('order_type', form)
  const jobTypeCode: string | undefined = Form.useWatch('job_code', form)
  const [printData, setPrintData] = useState<PRData | null>(null)

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

  // Edit mode: load the reopened PR's header/lines and check for lines whose
  // qty_requested was lowered below qty already ordered on an existing PO.
  useEffect(() => {
    if (!isEdit || !id) return
    // React.StrictMode (see main.tsx) double-invokes effects in dev, firing
    // this effect's mount → cleanup → mount cycle — without this guard both
    // invocations fire GET /pr/:id concurrently, and the first (now-stale)
    // one's error handler can still show a toast after the second has
    // already resolved and rendered the page correctly. `ignore` makes the
    // cleanup from the first invocation suppress its own state updates.
    let ignore = false
    const fetchExisting = async () => {
      setLoadingExisting(true)
      try {
        const res = await axios.get(`${BASE_URL}/pr/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (ignore) return
        const raw = res.data?.data ?? res.data
        setPrNumber(raw.pr_no ?? '')
        form.setFieldsValue({
          pr_date: raw.pr_date ? dayjs(raw.pr_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
          location_text: raw.location_text,
          warehouse_code: raw.warehouse_code || undefined,
          required_date: raw.required_date ? dayjs(raw.required_date) : undefined,
          project_code: raw.project_code || undefined,
          order_type: raw.order_type || undefined,
          pr_type: raw.pr_type || 'PO_WO',
          job_code: raw.job_code || undefined,
          requested_by: raw.requester_id ?? raw.requested_by,
        })
        setRemark(raw.remarks ?? '')
        setInitialLineItems(
          (raw.lines ?? []).map((l: any) => ({
            mat_code: l.mat_code,
            mat_name: l.mat_name,
            unit_name: l.unit_name,
            qty_requested: l.qty_requested,
            qty_to_order: l.qty_to_order,
            cost_subgroup_id: l.cost_subgroup_id ?? null,
            cost_code_label: l.cost_code
              ? `${l.cost_code}${l.cost_subgroup_name ? ` — ${l.cost_subgroup_name}` : ''}`
              : null,
          }))
        )
        // attachments is { pr: [...], memo: [...] } — pr = files uploaded
        // directly to this PR (editable/removable, resubmitted on save),
        // memo = files carried over from the linked Memo (display-only).
        // Not a flat array — see backend confirmation on GET /pr/:id.
        setExistingAttachments(
          (raw.attachments?.pr ?? []).map((a: any) => ({
            file_path: a.file_path,
            file_name: a.file_name,
            file_size: a.file_size,
            file_type: a.file_type,
          }))
        )
        setMemoAttachments(
          (raw.attachments?.memo ?? []).map((a: any) => ({
            file_path: a.file_path,
            file_name: a.file_name,
            file_size: a.file_size,
            file_type: a.file_type,
          }))
        )
      } catch (err: any) {
        if (ignore) return
        console.error('fetchExisting error:', err)  // เพิ่มบรรทัดนี้ชั่วคราว
        message.error(err?.response?.data?.message || 'โหลดข้อมูล PR ไม่สำเร็จ')
      } finally {
        if (!ignore) setLoadingExisting(false)
      }
    }
    const fetchOverOrdered = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/pr/${id}/lines-with-po-status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (ignore) return
        const raw = res.data?.data ?? res.data
        const lines = raw?.lines ?? []
        const overs = lines
          .filter((l: any) => (l.qty_remaining ?? 0) < 0)
          .map((l: any) => l.mat_code)
        setOverOrderedLines(overs)
      } catch {
        // non-critical — skip the warning banner if this fails
      }
    }
    fetchExisting()
    fetchOverOrdered()
    return () => {
      ignore = true
    }
  }, [isEdit, id])

  const handleSubmit = async (status: 'DRAFT' | 'COMPLETED') => {
    setSubmitting(true)
    try {
      const { location_text, required_date, project_code, order_type, pr_type, job_code, warehouse_code, requested_by } =
        await form.validateFields()

      // 1. Upload newly-added files.
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

      const payload: CreatePRRequest = {
        pr_no: prNumber,
        pr_date: dayjs().format('YYYY-MM-DD'),
        requested_by,
        created_by: requested_by,
        location_text,
        // Warehouse only applies when ordering against stock — dropped otherwise
        // even if a stale value lingers in the (hidden) form field.
        warehouse_code: order_type === 'stock' ? (warehouse_code || undefined) : undefined,
        required_date: required_date ? required_date.format('YYYY-MM-DD') : undefined,
        project_code,
        order_type,
        pr_type,
        job_code,
        remarks: remark,
        status: isEdit ? 'DRAFT' : status,
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
        // Update never touches status (backend-confirmed) — the reopened PR
        // stays DRAFT until explicitly submitted. Do that here so saving an
        // edit always finishes back at COMPLETED instead of stranding it.
        await axios.post(`${BASE_URL}/pr/${id}/submit`, {}, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        Modal.success({
          title: 'บันทึกและส่งใบขอซื้อสำเร็จ',
          content: `PR ${prNumber} กลับสู่สถานะ "เสร็จสมบูรณ์" เรียบร้อยแล้ว`,
        })
        navigate(`/pr/${id}`)
      } else {
        await axios.post(`${BASE_URL}/pr`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('บันทึก PR สำเร็จ')
        navigate('/pr/status')
      }
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

  // Print the form's current (possibly unsaved) state — items come from
  // PRItemsTable itself (see PRItemsTable's onPrint), since this page's own
  // `lineItems` state only carries the submit-payload fields, not the
  // display-only ones (description/unit/cost code label/per-line remark).
  const handlePrintCurrent = (
    items: { mat_code: string; description: string; unit: string; qty_requested: number; cost_code_label: string | null; remark: string }[],
  ) => {
    const values = form.getFieldsValue()
    setPrintData({
      prNo: prNumber,
      prDate: dayjs().format('DD/MM/YYYY'),
      projectDept: values.project_code ?? '',
      vendor: '',
      deliveryDate: values.required_date ? values.required_date.format('DD/MM/YYYY') : '',
      deliveryTo: values.location_text ?? '',
      remark,
      orderType: values.order_type ?? '',
      // This page's print button always previews the current unsaved/editing
      // state — and saving from here always resets the record to DRAFT (see
      // handleSubmit above), so the printed doc is DRAFT whenever this fires.
      status: 'DRAFT',
      items: items.map((it, i) => ({
        no: String(i + 1),
        costCode: it.cost_code_label ?? '',
        matCode: it.mat_code,
        desc: it.description,
        qty: it.qty_requested,
        unit: it.unit,
        remark: it.remark,
      })),
    })
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
        title={isEdit ? `แก้ไขใบขอซื้อ ${prNumber}` : 'สร้างใบขอซื้อ'}
        subtitle={isEdit ? 'แก้ไขใบขอซื้อที่ถูกเปิดกลับเป็นร่างชั่วคราว' : 'สร้างใบขอซื้อสินค้า/บริการเพื่อส่งอนุมัติ'}
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบขอซื้อ' }, { title: isEdit ? 'แก้ไขใบขอซื้อ' : 'สร้างใบขอซื้อ' }]}
      />

      <div style={{ marginBottom: 16 }}>
        <span style={{ color: '#999' }}>{isEdit ? 'เลขที่ PR : ' : 'PR ล่าสุด : '}</span>
        <span style={{ color: 'red', fontWeight: 'bold', fontSize: 18 }}>{prNumber}</span>
      </div>

      {isEdit && (
        <Alert
          style={{ marginBottom: 16, borderRadius: 8 }}
          type="info"
          showIcon
          message="ใบขอซื้อนี้ถูกเปิดกลับเป็นสถานะ ร่าง (DRAFT) ชั่วคราวเพื่อแก้ไข"
          description='แก้ไขข้อมูลด้านล่างแล้วกด "บันทึกการแก้ไข" — ระบบจะบันทึกและส่งใบขอซื้อนี้ให้กลับสู่สถานะ "เสร็จสมบูรณ์" ให้ทันที'
        />
      )}

      {isEdit && overOrderedLines.length > 0 && (
        <Alert
          style={{ marginBottom: 16, borderRadius: 8 }}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="รายการนี้สั่งซื้อไปแล้วเกินจำนวนที่ขอใหม่ กรุณาแก้ไข PO ที่เกี่ยวข้องด้วย"
          description={`รหัสวัสดุที่ได้รับผลกระทบ: ${overOrderedLines.join(', ')}`}
        />
      )}

      {loadingExisting ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : (
      <Form form={form} layout="horizontal" initialValues={{ pr_date: dayjs().format('YYYY-MM-DD'), pr_type: 'PO_WO' }}>
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

              <Field label="โครงการ">
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

              <Field label="ประเภท Job">
                <Form.Item name="job_code" noStyle>
                  <Select
                    placeholder="- เลือกรายการ -"
                    style={{ width: '100%' }}
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={JOB_TYPES.map((jt) => ({ value: jt.code, label: jt.label }))}
                  />
                </Form.Item>
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

              <Field label="ประเภทการสั่งซื้อ">
                <Form.Item name="order_type" noStyle>
                  <Select
                    placeholder="- เลือกประเภท -"
                    style={{ width: '100%' }}
                    allowClear
                    options={[
                      { value: 'stock', label: 'คลังสินค้า (Stock)' },
                      { value: 'cost', label: 'โครงการ (Cost)' },
                    ]}
                  />
                </Form.Item>
              </Field>

              <Field label="ประเภทใบขอซื้อ">
                <Form.Item name="pr_type" noStyle>
                  <Select
                    placeholder="- เลือกประเภท -"
                    style={{ width: '100%' }}
                    options={[
                      { value: 'PO_WO', label: 'PO/WO' },
                      { value: 'PO_ONLY', label: 'PO Only' },
                      { value: 'WO_ONLY', label: 'WO Only' },
                    ]}
                  />
                </Form.Item>
              </Field>

              {orderType === 'stock' && (
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
              )}

              <Field label="สถานที่ส่งของ" required>
                <Form.Item name="location_text" noStyle rules={[{ required: true, message: 'กรุณากรอกสถานที่ส่งของ' }]}>
                  <Input
                    placeholder="ระบุสถานที่ส่งของ"
                    style={{ width: '100%' }}
                    disabled={!!selectedMemo}
                  />
                </Form.Item>
                {selectedMemo && (
                  <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 4 }}>
                    ล็อกตามสถานที่ส่งของของ Memo ที่เลือก — ล้าง Memo Reference เพื่อแก้ไข
                  </div>
                )}
              </Field>

              <Field label="กำหนดส่งของ">
                <Form.Item name="required_date" noStyle>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Field>
            </Col>

            {/* ── Right column ── */}
            <Col xs={24} lg={12}>
              <Field label="วันที่">
                <Form.Item name="pr_date" noStyle>
                  <Input disabled style={{ color: '#374151' }} />
                </Form.Item>
              </Field>

              {/* Approval no longer happens on PR — it happens via Memo instead
                  (memo.status: DRAFT / PENDING_APPROVAL / APPROVED / REJECTED / CANCELLED).
                  The approver is now selected on the Memo, not here. */}

              <Field label="Memo Reference" alignTop>
                <div
                  onClick={() => setMemoOpen(true)}
                  title="คลิกเพื่อเลือก Memo"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    border: `1.5px dashed ${selectedMemo ? '#bfdbfe' : '#93c5fd'}`,
                    borderRadius: 8,
                    padding: '6px 10px',
                    background: selectedMemo ? '#f8faff' : '#eff6ff',
                    transition: 'all 0.15s',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      color: selectedMemo ? '#2563eb' : '#60a5fa',
                      fontWeight: selectedMemo ? 500 : 400,
                      fontSize: 13,
                    }}
                  >
                    {selectedMemo?.memoNo ?? 'คลิกเพื่อเลือก Memo'}
                  </span>
                  <Tooltip title="Clear">
                    <Button
                      size="small"
                      icon={<CloseOutlined />}
                      disabled={!selectedMemo}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedMemo(null)
                        form.setFieldValue('memo_id', undefined)
                        form.setFieldValue('memo_no_ref', undefined)
                      }}
                    />
                  </Tooltip>
                </div>

                {selectedMemo && selectedMemo.attachments && selectedMemo.attachments.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: '#60a5fa', marginBottom: 4 }}>
                      ไฟล์แนบจาก Memo
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedMemo.attachments.map((f) => (
                        <a
                          key={f.filePath}
                          href={f.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: '#f0f5ff',
                            border: '0.5px solid #bfdbfe',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 12,
                            color: '#1e40af',
                            maxWidth: 240,
                            textDecoration: 'none',
                          }}
                        >
                          <span
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}
                            title={f.fileName}
                          >
                            {f.fileName}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
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

                {/* Existing attachments (edit mode) */}
                {existingAttachments.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {existingAttachments.map((f) => (
                      <div
                        key={f.file_path}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: '#f3f4f6',
                          border: '0.5px solid #d1d5db',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 12,
                          color: '#374151',
                          maxWidth: 240,
                        }}
                      >
                        <span
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}
                          title={f.file_name}
                        >
                          {f.file_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Memo attachments (read-only — owned by the linked Memo, not this PR) */}
                {memoAttachments.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: '#60a5fa', marginBottom: 4 }}>
                      ไฟล์แนบจาก Memo
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {memoAttachments.map((f) => (
                        <a
                          key={f.file_path}
                          href={f.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: '#f0f5ff',
                            border: '0.5px solid #bfdbfe',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 12,
                            color: '#1e40af',
                            maxWidth: 240,
                            textDecoration: 'none',
                          }}
                        >
                          <span
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}
                            title={f.file_name}
                          >
                            {f.file_name}
                          </span>
                        </a>
                      ))}
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
          onBack={() => navigate(isEdit ? `/pr/${id}` : '/pr/status')}
          onItemsChange={setLineItems}
          initialItems={initialLineItems}
          remark={remark}
          onRemarkChange={setRemark}
          onPrint={handlePrintCurrent}
          jobTypeCode={jobTypeCode}
        />

        {/* ── Action bar ── */}
        <Card style={{ ...cardStyle, marginTop: 16 }}>
          <div className="pr-action-bar">
            <Space wrap>
              {isEdit ? (
                <PermissionButton
                  menuCode={MENU_CODE}
                  action="write"
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={submitting}
                  disabled={submitting}
                  onClick={() => handleSubmit('DRAFT')}
                >
                  บันทึกการแก้ไข
                </PermissionButton>
              ) : (
                <>
                  <PermissionButton
                    menuCode={MENU_CODE}
                    action="write"
                    icon={<SaveOutlined />}
                    loading={submitting}
                    disabled={submitting}
                    onClick={() => handleSubmit('DRAFT')}
                  >
                    บันทึกร่าง
                  </PermissionButton>
                  <PermissionButton
                    menuCode={MENU_CODE}
                    action="write"
                    type="primary"
                    icon={<SendOutlined />}
                    loading={submitting}
                    disabled={submitting}
                    onClick={() => handleSubmit('COMPLETED')}
                  >
                    ส่งใบขอซื้อ
                  </PermissionButton>
                </>
              )}
            </Space>
          </div>
        </Card>
      </Form>
      )}
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
          if (memo.deliveryLocation) {
            form.setFieldValue('location_text', memo.deliveryLocation)
          }
          setSelectedMemo(memo)
        }}
      />

      {printData && (
        <PRPrint
          data={printData}
          onReady={() => {
            window.print()
            setPrintData(null)
          }}
        />
      )}
    </div>
  )
}

export default PRCreatePage
