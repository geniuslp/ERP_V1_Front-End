import PanelTabs from '@/components/common/PanelTabs'
import React, { useEffect, useState } from 'react'
import {
  Card, Form, Select, DatePicker, Input, Button, Space, Spin, Result, Row, Col, Grid,
  Table, Descriptions, Modal, message,
} from 'antd'
import {
  ArrowLeftOutlined, SaveOutlined, EditOutlined, DeleteOutlined, PlusOutlined, EyeOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import {
  showMovementError,
  LINKED_WAREHOUSE_ISSUE_NOT_SUPPORTED,
  REDIRECT_DELAY_MS,
} from '@/pages/ic/utils/movementErrors'
import { goBackToICProject, confirmLeaveIfDirty } from '@/pages/ic/utils/icNavigation'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import ICMovementAddLineModal, { type PendingMovementLine } from '@/pages/ic/components/ICMovementAddLineModal'

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

interface MovementHeader {
  doc_no?: string
  project_name?: string
  job_code?: string
  doc_type?: 'ISSUE' | 'TRANSFER'
  status?: 'DRAFT' | 'POSTED'
  requested_by?: number
  doc_date?: string
  remark?: string
  remarks?: string
}

interface MovementLine {
  key: string
  mat_code: string
  item_name: string
  spec_name?: string
  cost_code: string
  qty: number
  unit: string
  to_project_name?: string
  to_cost_code?: string
  remark?: string
  pending?: PendingMovementLine
}

const mapLine = (l: any, index: number): MovementLine => ({
  key: String(l.line_id ?? l.id ?? index),
  mat_code: l.mat_code,
  item_name: l.item_name ?? l.mat_name ?? '',
  spec_name: l.spec_name,
  cost_code: l.cost_code,
  qty: Number(l.qty ?? 0),
  unit: l.unit,
  to_project_name: l.to_project_name,
  to_cost_code: l.to_cost_code,
  remark: l.remarks ?? l.remark,
})

const docTypeLabel = (type?: string) => {
  if (type === 'ISSUE') return 'ตัดเบิก'
  if (type === 'TRANSFER') return 'โอนข้ามโครงการ'
  return '-'
}

/**
 * One page for both routes: /ic/projects/:projectCode/movement/create (no :movementId — empty
 * header form, "รายการสินค้า" tab disabled) and /ic/projects/:projectCode/movement/:movementId
 * (existing document — both tabs populated, opens on "รายการสินค้า").
 */
const ICProjectMovementPage: React.FC = () => {
  const { projectCode, movementId: routeMovementId } = useParams<{ projectCode: string; movementId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const preparedBy = searchParams.get('prepared_by')
  // Preset from the list page's type chooser (?doc_type=ISSUE|TRANSFER); defaults to ISSUE.
  const presetDocType: 'ISSUE' | 'TRANSFER' = searchParams.get('doc_type') === 'TRANSFER' ? 'TRANSFER' : 'ISSUE'
  const [form] = Form.useForm()

  // All rows share one 2fr/3fr grid inside a 60%-wide wrapper (single column on mobile), so
  // column 1 is 24% of the card and column 2 is 36%. Rows 2-3 cap their column-2 field at 2/3 of
  // that cell (see narrowSecond), which makes it exactly the same 24% as column 1.
  // minmax(0, …) keeps long values (e.g. the project name) from stretching a column.
  const screens = Grid.useBreakpoint()
  const pairGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: screens.sm ? 'minmax(0, 2fr) minmax(0, 3fr)' : 'minmax(0, 1fr)',
    columnGap: 24,
  }
  const narrowSecond: React.CSSProperties | undefined = screens.sm ? { width: 'calc(100% * 2 / 3)' } : undefined

  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  // The document id: from the route for an existing document, or set in state right after the
  // first save (the URL is then synced with navigate(..., { replace: true })).
  const [docId, setDocId] = useState<string | null>(routeMovementId ?? null)
  const [activeKey, setActiveKey] = useState<'details' | 'items'>(routeMovementId ? 'items' : 'details')

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ICProjectInfo | null>(null)
  const [header, setHeader] = useState<MovementHeader | null>(null)

  const [jobOptions, setJobOptions] = useState<JobCodeOption[]>([])
  const [jobOptionsLoading, setJobOptionsLoading] = useState(true)

  const [users, setUsers] = useState<UserOption[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  const [lines, setLines] = useState<MovementLine[]>([])
  // Lines added in this session; only sent to the backend when Submit is clicked.
  const [pendingLines, setPendingLines] = useState<MovementLine[]>([])
  const [linesLoading, setLinesLoading] = useState(false)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Create mode (no document yet): job/doc type come from the live form values.
  const watchedJob: string | undefined = Form.useWatch('job_code', form)
  const watchedDocType: 'ISSUE' | 'TRANSFER' | undefined = Form.useWatch('doc_type', form)
  const effectiveJob = docId ? header?.job_code : watchedJob
  const effectiveDocType = docId ? header?.doc_type : watchedDocType
  // Last accepted Job/doc type, used to revert when the user declines the "clear lines" confirm.
  const lastAcceptedRef = React.useRef<{ job_code?: string; doc_type?: string }>({ doc_type: presetDocType })

  const isPosted = String((header as any)?.status ?? (header as any)?.doc_status ?? '').trim().toUpperCase() === 'POSTED'
  console.log('[ICProjectMovementPage] DEBUG header.status =', header?.status, '| isPosted =', isPosted)
  // No header-update endpoint is known, so once a document exists its header is read-only.
  const headerReadOnly = !!docId

  // Keep in sync when navigating between documents (e.g. list → another document).
  useEffect(() => {
    if (routeMovementId && routeMovementId !== docId) {
      setDocId(routeMovementId)
      setActiveKey('items')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeMovementId])

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

  // Default ผู้ขอเบิก from the ผู้จัดทำ picked on the project list page (create mode only).
  useEffect(() => {
    if (!docId && preparedBy && !Number.isNaN(Number(preparedBy))) {
      form.setFieldsValue({ requested_by: Number(preparedBy) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparedBy])

  // GET /ic/projects/:projectCode/movements/:movementId — endpoint not confirmed to
  // exist yet on the backend. TODO: verify with backend; until then, fall back to
  // whatever was passed via navigation state so the page still renders.
  const fetchHeader = async (id: string) => {
    if (!projectCode) return
    try {
      const res = await axios.get(`${BASE_URL}/ic/projects/${projectCode}/movements/${id}`, {
        headers: authHeader,
      })
      const data: MovementHeader = res.data?.data ?? res.data
      setHeader(data)
      form.setFieldsValue({
        job_code: data?.job_code,
        doc_type: data?.doc_type,
        requested_by: data?.requested_by,
        doc_date: data?.doc_date ? dayjs(data.doc_date) : undefined,
        remark: data?.remark ?? data?.remarks,
      })
    } catch (err: any) {
      // Without the header the lock state (status) is unknown and every button looks editable,
      // so surface the failure instead of falling back silently.
      console.error('[ICProjectMovementPage] GET movement header failed', err?.response?.status, err?.response?.data)
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลเอกสารไม่สำเร็จ — สถานะเอกสารอาจไม่ถูกต้อง')
      const stateDocNo = (location.state as any)?.doc_no
      setHeader((prev) => prev ?? (stateDocNo ? { doc_no: stateDocNo } : {}))
    }
  }

  const fetchLines = async (id: string) => {
    if (!projectCode) return
    setLinesLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/ic/projects/${projectCode}/movements/${id}/lines`, {
        headers: authHeader,
      })
      const raw = res.data?.data ?? res.data
      const list = Array.isArray(raw) ? raw : raw?.data ?? []
      setLines((Array.isArray(list) ? list : []).map(mapLine))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดรายการวัสดุไม่สำเร็จ')
    } finally {
      setLinesLoading(false)
    }
  }

  // Load header + lines whenever an existing document is open. Right after the first save the
  // header is already in state, so only the lines are (re)loaded.
  useEffect(() => {
    if (!docId) {
      setHeader(null)
      setLines([])
      setPendingLines([])
      return
    }
    if (!header?.doc_no && !header?.job_code) fetchHeader(docId)
    fetchLines(docId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, projectCode])

  // Changing Job / document type after lines were added invalidates them (available materials
  // depend on both): confirm, then clear; on decline revert the field.
  const handleValuesChange = (changed: Record<string, unknown>) => {
    if (docId || !('job_code' in changed || 'doc_type' in changed)) return
    const prev = lastAcceptedRef.current
    if (pendingLines.length === 0) {
      lastAcceptedRef.current = { ...prev, ...(changed as object) }
      return
    }
    Modal.confirm({
      title: 'รายการที่เพิ่มไว้จะถูกล้าง',
      content: 'การเปลี่ยนประเภท Job หรือประเภทเอกสารจะล้างรายการสินค้าที่เพิ่มไว้ทั้งหมด ต้องการดำเนินการต่อหรือไม่?',
      okText: 'ดำเนินการต่อ',
      cancelText: 'ยกเลิก',
      onOk: () => {
        setPendingLines([])
        lastAcceptedRef.current = { ...prev, ...(changed as object) }
      },
      onCancel: () => form.setFieldsValue(prev),
    })
  }

  const handleItemsTabChange = (k: string) => {
    if (k === 'items' && !docId && (!watchedJob || !watchedDocType)) {
      message.warning('กรุณาเลือกประเภท Job และประเภทเอกสารก่อน')
      setActiveKey('details')
      return
    }
    setActiveKey(k as 'details' | 'items')
  }

  // Single save for a new document: header + lines in ONE request (nothing persists on failure).
  const submitNewMovement = async () => {
    if (!projectCode) return
    let values: any
    try {
      values = await form.validateFields()
    } catch (e: any) {
      setActiveKey('details')
      message.error('กรุณากรอกรายละเอียดเอกสารให้ครบก่อนบันทึก')
      const first = e?.errorFields?.[0]?.name
      if (first) setTimeout(() => form.focusField(first), 100)
      return
    }
    if (pendingLines.length === 0) {
      message.warning('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ')
      return
    }
    setSubmitting(true)
    try {
      const res = await axios.post(
        `${BASE_URL}/ic/projects/${projectCode}/movements/submit`,
        {
          header: {
            doc_type: values.doc_type,
            job_code: values.job_code,
            requested_by: values.requested_by,
            doc_date: values.doc_date ? values.doc_date.format('YYYY-MM-DD') : undefined,
            remarks: values.remark || undefined,
          },
          lines: pendingLines.map((l) => l.pending!.payload),
        },
        { headers: authHeader },
      )
      const data = res.data?.data ?? res.data
      message.success(data?.doc_no ? `บันทึกสำเร็จ เลขที่เอกสาร ${data.doc_no}` : 'บันทึกเอกสารสำเร็จ')
      setPendingLines([])
      goBackToICProject(navigate, projectCode, preparedBy)
    } catch (err: any) {
      // Failure: nothing was saved; keep every entered value so the user can retry.
      const code = showMovementError(err)
      if (code === LINKED_WAREHOUSE_ISSUE_NOT_SUPPORTED) {
        setTimeout(() => navigate('/ic/projects'), REDIRECT_DELAY_MS)
      } else if (!code) {
        message.error(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'บันทึกเอกสารไม่สำเร็จ')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handlePreview = () => {
    message.info('Preview - coming soon')
  }

  const handleAddItem = () => {
    if (isPosted) return
    setEditingKey(null)
    setItemModalOpen(true)
  }

  const toPendingRow = (key: string, l: PendingMovementLine): MovementLine => ({
    key,
    mat_code: l.payload.mat_code,
    item_name: l.display.item_name,
    spec_name: l.display.spec_name,
    cost_code: l.display.cost_code,
    qty: l.payload.qty,
    unit: l.display.unit,
    to_project_name: l.display.to_project_name,
    to_cost_code: l.display.to_cost_code,
    remark: l.payload.remarks,
    pending: l,
  })

  // Local state only — nothing is persisted until Submit. Editing replaces the row in place.
  const handleAddLine = (l: PendingMovementLine) => {
    if (editingKey) {
      setPendingLines((prev) => prev.map((p) => (p.key === editingKey ? toPendingRow(p.key, l) : p)))
    } else {
      setPendingLines((prev) => [...prev, toPendingRow(`pending-${Date.now()}-${prev.length}`, l)])
    }
    setEditingKey(null)
    setItemModalOpen(false)
  }

  const handleEditLine = (line: MovementLine) => {
    if (isPosted || !line.pending) return
    setEditingKey(line.key)
    setItemModalOpen(true)
  }

  const handleDeleteLine = (key: string) => {
    if (isPosted) return
    setPendingLines((prev) => prev.filter((l) => l.key !== key))
  }

  const submitMovement = async () => {
    if (!projectCode || !docId) return
    if (lines.length + pendingLines.length === 0) {
      message.warning('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ')
      return
    }
    setSubmitting(true)
    try {
      // Persist the locally held lines one by one, then post the document.
      for (const l of pendingLines) {
        try {
          await axios.post(`${BASE_URL}/ic/projects/${projectCode}/movements/${docId}/lines`, l.pending!.payload, {
            headers: authHeader,
          })
          setPendingLines((prev) => prev.filter((p) => p.key !== l.key))
        } catch (err: any) {
          await fetchLines(docId)
          throw err
        }
      }
      await axios.post(`${BASE_URL}/ic/projects/${projectCode}/movements/${docId}/submit`, {}, {
        headers: authHeader,
      })
      message.success('บันทึกเอกสารสำเร็จ')
      await fetchLines(docId)
      await fetchHeader(docId)
      // Submitted (document is now POSTED/locked): return to the project page.
      goBackToICProject(navigate, projectCode, preparedBy)
    } catch (err: any) {
      const code = showMovementError(err)
      if (code === LINKED_WAREHOUSE_ISSUE_NOT_SUPPORTED) {
        setTimeout(() => navigate('/ic/projects'), REDIRECT_DELAY_MS)
      } else if (!code) {
        message.error(err?.response?.data?.message || err?.message || 'บันทึกเอกสารไม่สำเร็จ')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = () => {
    console.log('[ICProjectMovementPage] Submit clicked', { docId, status: header?.status, isPosted })
    Modal.confirm({
      title: 'ยืนยันการบันทึก?',
      content: 'หลังจากนี้จะไม่สามารถเพิ่มรายการเพิ่มเติมได้ และจะหักยอดคงเหลือทันที',
      okText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      onOk: docId ? submitMovement : submitNewMovement,
    })
  }

  // Destination columns only apply to TRANSFER documents (doc_type is fixed per document).
  const destColumns = effectiveDocType === 'ISSUE' ? [] : [
    {
      title: 'ToProject',
      dataIndex: 'to_project_name',
      key: 'to_project_name',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: 'ToCostCode',
      dataIndex: 'to_cost_code',
      key: 'to_cost_code',
      render: (value: string | undefined) => value || '-',
    }
  ]

  const columns = [
    {
      title: 'Action',
      key: 'action',
      width: 90,
      render: (_: unknown, record: MovementLine) => isPosted || !record.pending ? null : (
        <Space>
          <EditOutlined style={{ color: '#2563eb', cursor: 'pointer' }} onClick={() => handleEditLine(record)} />
          <DeleteOutlined style={{ color: '#dc2626', cursor: 'pointer' }} onClick={() => handleDeleteLine(record.key)} />
        </Space>
      ),
    },
    {
      title: 'No',
      key: 'no',
      width: 60,
      render: (_: unknown, __: MovementLine, index: number) => index + 1,
    },
    { title: 'MatCode', dataIndex: 'mat_code', key: 'mat_code' },
    {
      title: 'MateName',
      key: 'mate_name',
      render: (_: unknown, record: MovementLine) =>
        [record.item_name, record.spec_name].filter(Boolean).join(' '),
    },
    { title: 'CostCode', dataIndex: 'cost_code', key: 'cost_code' },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', align: 'right' as const },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
    ...destColumns,
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      render: (value: string | undefined) => value || '-',
    },
  ]

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

  const detailsTab = (
    <Form
      form={form}
      layout="vertical"
      disabled={headerReadOnly || isPosted}
      onValuesChange={handleValuesChange}
      initialValues={{
        doc_type: presetDocType,
        doc_date: dayjs(),
      }}
    >
      {/* One width value for both columns of every pair, so paired fields always match. */}
      <div style={{ width: screens.sm ? '60%' : '100%' }}>
        <div style={pairGrid}>
          <div>
            <Form.Item label="รหัสโครงการ">
              <Input value={project.project_code} disabled />
            </Form.Item>
          </div>
          <div>
            <Form.Item label="ชื่อโครงการ">
              <Input value={project.project_name} disabled />
            </Form.Item>
          </div>
        </div>

        <div style={pairGrid}>
          <div>
            <Form.Item
              name="job_code"
              label="ประเภท Job"
              rules={[{ required: true, message: 'กรุณาเลือกประเภท Job' }]}
            >
              <Select
                placeholder={jobOptionsLoading ? 'กำลังโหลด...' : '- เลือกรายการ -'}
                loading={jobOptionsLoading}
                showSearch
                disabled={!headerReadOnly && !jobOptionsLoading && jobOptions.length === 0}
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={jobOptions}
              />
            </Form.Item>
            {!headerReadOnly && !jobOptionsLoading && jobOptions.length === 0 && (
              <div style={{ marginTop: -16, marginBottom: 16, fontSize: 12, color: '#d97706' }}>
                โครงการนี้ยังไม่ได้กำหนดประเภทงาน (Job) กรุณาติดต่อผู้ดูแลระบบก่อนสร้างเอกสาร
              </div>
            )}
          </div>
          <div style={narrowSecond}>
            <Form.Item
              name="doc_type"
              label="ประเภทเอกสาร"
              rules={[{ required: true, message: 'กรุณาเลือกประเภทเอกสาร' }]}
            >
              {/* Locked: type is chosen in the list page chooser and never editable here. */}
              <Select
                disabled
                options={[
                  { label: 'ตัดเบิก (Issue)', value: 'ISSUE' },
                  { label: 'โอนข้ามโครงการ (Transfer)', value: 'TRANSFER' },
                ]}
              />
            </Form.Item>
          </div>
        </div>

        <div style={pairGrid}>
          <div>
            <Form.Item
              name="requested_by"
              label="ผู้ขอเบิก / ผู้ทำรายการ"
              rules={[{ required: true, message: 'กรุณาระบุผู้ขอเบิก / ผู้ทำรายการ' }]}
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
          </div>
          <div style={narrowSecond}>
            <Form.Item
              name="doc_date"
              label="วันที่เอกสาร"
              rules={[{ required: true, message: 'กรุณาเลือกวันที่เอกสาร' }]}
            >
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </div>
        </div>
      </div>

      <Row gutter={24}>
        <Col span={24}>
          <Form.Item name="remark" label="หมายเหตุ">
            <Input.TextArea rows={3} placeholder="หมายเหตุ (ถ้ามี)" />
          </Form.Item>
        </Col>
      </Row>

      {headerReadOnly && (
        <Space>
          <Button onClick={() => navigate(`/ic/projects/${projectCode}/movements`)}>กลับไปรายการ</Button>
        </Space>
      )}
    </Form>
  )

  const itemsTab = (
    <>
      <Descriptions column={3} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="เลขที่เอกสาร">{header?.doc_no || '-'}</Descriptions.Item>
        <Descriptions.Item label="โครงการ">{header?.project_name || project.project_name || '-'}</Descriptions.Item>
        <Descriptions.Item label="ประเภท Job">{effectiveJob || '-'}</Descriptions.Item>
        <Descriptions.Item label="ประเภทเอกสาร">{docTypeLabel(effectiveDocType)}</Descriptions.Item>
      </Descriptions>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <Button icon={<EyeOutlined />} onClick={handlePreview}>
          Preview
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddItem} disabled={isPosted}>
          เพิ่มรายการ
        </Button>
      </div>

      <Table
        rowKey="key"
        columns={columns}
        dataSource={[...lines, ...pendingLines]}
        loading={linesLoading}
        pagination={false}
        locale={{ emptyText: 'ยังไม่มีรายการ' }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={submitting}
          disabled={isPosted}
          // Inline colors override antd's disabled look, so grey them out explicitly when locked.
          style={isPosted ? undefined : { background: '#16a34a', borderColor: '#16a34a' }}
          onClick={handleSubmit}
        >
          Submit
        </Button>
      </div>
    </>
  )

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          style={{ height: 36, borderRadius: 8, fontWeight: 500 }}
          onClick={() =>
            confirmLeaveIfDirty(pendingLines.length > 0 || (!docId && form.isFieldsTouched()), () => goBackToICProject(navigate, project.project_code, preparedBy))
          }
        >
          กลับ
        </Button>
      </div>
      <PageHeader
        title={header?.doc_no ? `เอกสารตัดเบิก/โอน ${header.doc_no}` : 'สร้างเอกสารตัดเบิก/โอน (โครงการ)'}
        subtitle={`${project.project_code} — ${project.project_name}`}
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'โครงการ' },
          { title: project.project_name },
          { title: 'ตัดเบิก/โอน' },
        ]}
      />

      <Card style={cardStyle}>
        <PanelTabs
          activeKey={activeKey}
          onChange={handleItemsTabChange}
          items={[
            { key: 'details', label: 'รายละเอียดเอกสาร', children: detailsTab },
            { key: 'items', label: 'รายการสินค้า', children: itemsTab },
          ]}
        />
      </Card>

      {projectCode && (docId || (effectiveJob && effectiveDocType)) && (
        <ICMovementAddLineModal
          open={itemModalOpen}
          projectCode={projectCode}
          movementId={docId ?? undefined}
          jobCode={effectiveJob}
          docType={effectiveDocType}
          editing={pendingLines.find((p) => p.key === editingKey)?.pending}
          onClose={() => { setItemModalOpen(false); setEditingKey(null) }}
          onAdd={handleAddLine}
        />
      )}
    </div>
  )
}

export default ICProjectMovementPage
