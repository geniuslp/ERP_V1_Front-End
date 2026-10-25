import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useProjectOptions } from '@/hooks/useProjectOptions'
import { Card, Form, Select, Button, Space, message, Input, Row, Col, DatePicker, Grid, Tooltip, Modal, Tag } from 'antd'
import { SaveOutlined, PlusOutlined, CheckCircleFilled, PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import PanelTabs from '@/components/common/PanelTabs'
import DepartmentSelect from '@/components/common/DepartmentSelect'
import { formatApproverOption } from '@/utils/formatApproverOption'
import ApproverPickerModal, { type ChosenApprover } from '@/components/pettyCash/ApproverPickerModal'
import PettyCashSubmitApprove, { type SubmitApproveSummary } from '@/components/pettyCash/PettyCashSubmitApprove'
import PettyCashStationBar from './PettyCashStationBar'
import PettyCashStagedAttachments, { type StagedFile } from '@/components/pettyCash/PettyCashStagedAttachments'
import { validateAttachmentFile } from '@/components/pettyCash/attachmentUtils'
import PettyCashPrint, { projectLabel, pettyCashLineDesc, buildPettyCashPrintData, buildPettyCashPrintLines, type PettyCashPrintData, type PettyCashPrintLine } from './PettyCashPrint'
import { useAppSelector } from '@/store'
import { pettyCashService } from '@/services/pettyCashService'
import PettyCashLineModal from '@/components/pettyCash/PettyCashLineModal'
import PettyCashLineSummaryTable, { type LineModalMode } from '@/components/pettyCash/PettyCashLineSummaryTable'
import { ORDER_TYPE_OPTIONS, getOrderTypeLabel } from '@/constants/orderTypes'
import type { CreatePettyCashRequest, PettyCashLineForm, PettyCashLineOptions, PettyCashAttachment } from '@/types/pettyCash'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'
const MENU_CODE = 'MENU_PETTY_CASH_CREATE'

// Single test-mode switch. false = real API (POST/PUT /petty-cash, POST /petty-cash/:id/submit, real
// validation, real doc number). true = nothing is saved/submitted, validation is skipped, fake doc no.
const PETTY_CASH_MOCK_SAVE = false
const MOCK_PC_NO = 'OF-202610-0001'
const MOCK_ID = 'mock-1'

const MockTag: React.FC = () => (
  <Tag color="warning" style={{ margin: 0 }}>โหมดทดสอบ: ไม่บันทึกจริง</Tag>
)

const DOC_TYPE_OPTIONS = [{ value: 'PETTY_CASH', label: 'เบิกเงินสดย่อย (Petty Cash)' }]

// No branch master endpoint exists in erp-api. These are the codes the frontend already uses for
// the branch dropdown elsewhere (WO employer_branch: HO/FAC-S/FAC-P/BO). Swap this for a fetch
// when a real branch source exists — branch_code is varchar(20) server-side.
const BRANCH_OPTIONS = ['HO', 'FAC-S', 'FAC-P', 'BO'].map((c) => ({ value: c, label: c }))

interface LookupOption { value: string; label: string; name: string }
interface EmployeeOption extends LookupOption { deptCode?: string; deptName?: string }

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

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#1e40af',
  margin: '4px 0 8px',
}

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const filterByLabel = (input: string, option?: { label?: unknown }) =>
  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())

const unwrapList = (d: any): any[] => {
  const raw = Array.isArray(d) ? d : d?.data?.data ?? d?.data ?? []
  return Array.isArray(raw) ? raw : []
}

const PettyCashCreatePage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const currentUser = useAppSelector((s) => s.auth.user)
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const isNarrow = Grid.useBreakpoint().md === false
  const headerProjectCode: string | undefined = Form.useWatch('project_code', form)
  const headerOrderType: string | undefined = Form.useWatch('order_type', form)

  const [activeTab, setActiveTab] = useState<'a' | 'b'>('a')
  useEffect(() => {
    if (PETTY_CASH_MOCK_SAVE) console.warn('[PettyCashCreatePage] PETTY_CASH_MOCK_SAVE is ON — nothing is saved to the backend')
  }, [])
  // Id of a document created in this page session without leaving /create (submit flow saves first,
  // and must not remount the page before the confirmation popup is answered).
  const [savedId, setSavedId] = useState<string | number | undefined>(undefined)
  const docIdEff: string | number | undefined = id ?? savedId
  // Submit-for-approval confirmation popup
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submittingYes, setSubmittingYes] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  // "Form Submit Approve" step: shown after an approver is picked (doc already saved as DRAFT).
  const [chosenApprover, setChosenApprover] = useState<ChosenApprover | null>(null)
  const [approveStepOpen, setApproveStepOpen] = useState(false)
  const [approveSubmitting, setApproveSubmitting] = useState(false)
  const [approveSummary, setApproveSummary] = useState<SubmitApproveSummary | null>(null)
  const [successDocNo, setSuccessDocNo] = useState<string | null>(null)
  const [serverNetAmount, setServerNetAmount] = useState<number | null>(null)
  // Print layout: built from the current form values + line items (works for unsaved/mock docs too).
  const [printPayload, setPrintPayload] = useState<{ data: PettyCashPrintData; lines: PettyCashPrintLine[] } | null>(null)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [docStatus, setDocStatus] = useState<string>('DRAFT')

  const [pcNo, setPcNo] = useState('')
  const [pcDate, setPcDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [requestedByName, setRequestedByName] = useState('')
  // approver_id is not picked on the page itself (the picker modal chooses it at submit), but PUT
  // overwrites it with whatever is sent (omitted = cleared), so the loaded value is carried back.
  const [approverId, setApproverId] = useState<number | null>(null)
  // Inline Thai error for หมายเหตุผู้เบิก — only raised by validateForSubmit (later Submit task).
  const [remarksError, setRemarksError] = useState('')

  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  // dept_name is filled from the selected department; it also names a saved code that is no longer active.
  const savedDeptName: string | undefined = Form.useWatch('dept_name', form)
  // Project dropdown: GET /master/projects/options (all ACTIVE projects); the document's own project is merged in when it is CLOSED/INACTIVE.
  const { options: projects } = useProjectOptions({}, headerProjectCode)

  const [items, setItems] = useState<PettyCashLineForm[]>([])
  // Line modal: which action/row is open (null = closed).
  const [lineModal, setLineModal] = useState<{ mode: LineModalMode; index?: number } | null>(null)
  const openLineModal = (mode: LineModalMode, index?: number) => setLineModal({ mode, index })
  const [lineOptions, setLineOptions] = useState<PettyCashLineOptions | null>(null)

  // Static tax lookups (tax forms / WHT income types / VAT rate) — fetched once on mount.
  useEffect(() => {
    pettyCashService.getLineOptions(accessToken)
      .then(setLineOptions)
      .catch((err: any) => message.error(err?.response?.data?.message || 'โหลดตัวเลือกภาษี/หัก ณ ที่จ่ายไม่สำเร็จ'))
  }, [accessToken])

  // Lookup lists for Tab A. The employee source is isolated here (users.employee_code via
  // GET /users/allUser) so it can be swapped for a real employee master later.
  useEffect(() => {
    const headers = { Authorization: `Bearer ${accessToken}` }
    const load = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, { headers })
        setEmployees(unwrapList(res.data)
          .filter((u: any) => u.employee_code)
          .map((u: any) => {
            const name = u.full_name ?? u.fullName ?? u.username ?? ''
            return {
              value: String(u.employee_code),
              label: `${u.employee_code} ${name}`,
              name,
              deptCode: u.dept_code ?? undefined,
              deptName: u.dept_name ?? u.department ?? undefined,
            }
          }))
      } catch { message.error('โหลดรายชื่อพนักงานไม่สำเร็จ') }
    }
    load()
  }, [accessToken])

  const loadDoc = useCallback(async (docId: string | number) => {
    setLoading(true)
    try {
      const pc = await pettyCashService.get(accessToken, docId)
      if (pc.status !== 'DRAFT' && pc.status !== 'REJECTED') {
        message.warning('แก้ไขได้เฉพาะเอกสารสถานะ ร่าง หรือ ถูกปฏิเสธ เท่านั้น')
      }
      setDocStatus(pc.status)
      setPcNo(pc.pc_no ?? '')
      setPcDate(pc.pc_date ? String(pc.pc_date).slice(0, 10) : dayjs().format('YYYY-MM-DD'))
      setRequestedByName(pc.requested_by_name ?? '')
      setApproverId(pc.approver_id ?? null)
      setServerNetAmount(pc.net_amount ?? null)
      setSavedAttachments(pc.attachments ?? [])
      setRemarksError('')
      form.setFieldsValue({
        doc_type: pc.doc_type ?? 'PETTY_CASH',
        branch_code: pc.branch_code ?? undefined,
        payee_emp_code: pc.payee_emp_code ?? undefined,
        payee_name: pc.payee_name ?? '',
        project_code: pc.project_code ?? undefined,
        project_name: pc.project_name ?? '',
        order_type: pc.order_type ?? undefined,
        dept_code: pc.dept_code ?? undefined,
        dept_name: pc.dept_name ?? '',
        ref_doc_no: pc.ref_doc_no ?? '',
        remarks: pc.remarks ?? '',
      })
      // Every response line key is mapped (nullable keys are omitted by the API → `?? ''` / `?? null`).
      setItems((pc.lines ?? []).map((l) => {
        const amount = l.amount ?? l.qty * l.unit_price // old documents have no `amount`
        return {
          key: `line-${l.id}`,
          id: l.id,
          project_code: l.project_code ?? '',
          mat_code: l.mat_code ?? '',
          mat_name_th: l.mat_name_th ?? '',
          description: l.description ?? '',
          cost_subgroup_id: l.cost_subgroup_id ?? null,
          cost_code: l.cost_code ?? '',
          cost_group_name: l.cost_group_name ?? '',
          cost_subgroup_name: l.cost_subgroup_name ?? '',
          remarks: l.remarks ?? '',
          amount,
          supplier_id: l.supplier_id ?? null,
          supplier_name: l.supplier_name ?? '',
          supplier_address: l.supplier_address ?? '',
          supplier_tax_id: l.supplier_tax_id ?? '',
          has_tax_invoice: l.has_tax_invoice ?? false,
          tax_invoice_no: l.tax_invoice_no ?? '',
          tax_invoice_date: l.tax_invoice_date ? String(l.tax_invoice_date).slice(0, 10) : '',
          has_wht: l.has_wht ?? false,
          wht_base_amount: l.wht_base_amount ?? null,
          tax_form_code: l.tax_form_code ?? '',
          wht_income_type_id: l.wht_income_type_id ?? null,
          wht_income_label: l.wht_income_label ?? '',
          wht_rate: l.wht_rate ?? null,
          wht_pay_date: l.wht_pay_date ? String(l.wht_pay_date).slice(0, 10) : '',
          invoice_no: l.invoice_no ?? '',
          invoice_date: l.invoice_date ? String(l.invoice_date).slice(0, 10) : '',
          line_vat: l.line_vat ?? 0,
          line_wht: l.line_wht ?? 0,
          line_net: l.line_net ?? amount,
        }
      }))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลใบเบิกเงินสดย่อยไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [accessToken, form])

  useEffect(() => {
    if (isEdit && id) loadDoc(id)
  }, [isEdit, id, loadDoc])

  // Blank (never-confirmed) rows are rejected on save/submit; the first one is flagged and scrolled to.
  // Attachments: files picked on tab 1 stay local until the document is saved (then uploaded one by
  // one to POST /petty-cash/:id/attachments); `savedAttachments` are the ones already on the server.
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [savedAttachments, setSavedAttachments] = useState<PettyCashAttachment[]>([])
  const [uploadProgress, setUploadProgress] = useState('')
  const stagedRef = useRef<StagedFile[]>([])
  stagedRef.current = stagedFiles
  const [errorRowKey, setErrorRowKey] = useState<string | null>(null)
  const rejectBlankRows = (): boolean => {
    const bad = items.find((r) => r.isNew)
    if (!bad) { setErrorRowKey(null); return false }
    setActiveTab('b')
    setErrorRowKey(bad.key)
    message.error('กรุณากรอกรายการให้ครบ หรือลบแถวที่ว่างออก')
    setTimeout(() => {
      document.querySelector(`tr[data-row-key="${bad.key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return true
  }

  const canEdit = !docIdEff || docStatus === 'DRAFT' || docStatus === 'REJECTED'

  // Exactly the line keys the backend contract lists — no qty / unit_price / discount / wht_rate.
  const buildLinesPayload = () => items.filter((r) => !r.isNew).map((r) => ({
    project_code: r.project_code || undefined,
    mat_code: r.mat_code,
    description: r.description,
    cost_subgroup_id: r.cost_subgroup_id,
    remarks: r.remarks,
    amount: r.amount,
    supplier_id: r.supplier_id,
    supplier_name: r.supplier_name,
    supplier_address: r.supplier_address,
    supplier_tax_id: r.supplier_tax_id,
    has_tax_invoice: r.has_tax_invoice,
    tax_invoice_no: r.tax_invoice_no,
    tax_invoice_date: r.tax_invoice_date,
    has_wht: r.has_wht,
    wht_base_amount: r.has_wht ? r.wht_base_amount : null,
    tax_form_code: r.tax_form_code,
    wht_income_type_id: r.has_wht ? r.wht_income_type_id : null,
    wht_pay_date: r.wht_pay_date,
    invoice_no: r.invoice_no?.trim() ? r.invoice_no.trim() : null,
    invoice_date: r.invoice_date || null,
  }))

  // หมายเหตุผู้เบิก + at least one line are required at submit only, never for a DRAFT save.
  const validateForSubmit = (): boolean => {
    const remarks = String(form.getFieldValue('remarks') ?? '').trim()
    if (!remarks) {
      setRemarksError('กรุณากรอกหมายเหตุผู้เบิกก่อนส่งอนุมัติ')
      setActiveTab('a')
      message.error('กรุณากรอกหมายเหตุผู้เบิกก่อนส่งอนุมัติ')
      setTimeout(() => form.scrollToField('remarks', { behavior: 'smooth', block: 'center' }), 100)
      return false
    }
    setRemarksError('')
    if (rejectBlankRows()) return false
    if (items.length === 0) {
      setActiveTab('b')
      message.error('กรุณาเพิ่มรายการอย่างน้อย 1 รายการก่อนส่งอนุมัติ')
      return false
    }
    return true
  }

  // Uploads the staged files one by one to POST /petty-cash/:id/attachments (the document is a DRAFT
  // at this point). Each success is removed from the staged list so a retry never re-uploads it;
  // failures stay staged. Returns true only when every staged file went up.
  const uploadStagedFiles = async (docId: string | number): Promise<boolean> => {
    const queue = stagedRef.current
    if (queue.length === 0) return true
    let failed = 0
    for (let i = 0; i < queue.length; i++) {
      const { uid, file } = queue[i]
      setUploadProgress(`กำลังอัปโหลดไฟล์ ${i + 1}/${queue.length}`)
      try {
        await pettyCashService.uploadAttachment(accessToken, docId, file)
        setStagedFiles((prev) => prev.filter((f) => f.uid !== uid))
      } catch (err: any) {
        failed += 1
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'อัปโหลดไม่สำเร็จ'
        message.error(`อัปโหลดไฟล์ "${file.name}" ไม่สำเร็จ: ${msg}`)
      }
    }
    setUploadProgress('')
    if (failed > 0) {
      message.error(`บันทึกเอกสารเรียบร้อยแล้ว แต่อัปโหลดไฟล์ไม่สำเร็จ ${failed} ไฟล์ — ไฟล์ที่ไม่สำเร็จยังคงค้างอยู่ กด "บันทึก" อีกครั้งเพื่อลองใหม่`)
      return false
    }
    return true
  }

  const handleStageFile = (file: File) => {
    const invalid = validateAttachmentFile(file)
    if (invalid) {
      message.error(invalid)
      return
    }
    const dup =
      stagedRef.current.some((f) => f.file.name === file.name && f.file.size === file.size) ||
      savedAttachments.some((a) => a.file_name === file.name && a.file_size === file.size)
    if (dup) {
      message.error(`ไฟล์ "${file.name}" ถูกเลือกไว้แล้ว`)
      return
    }
    // Mutate the ref too: Upload calls this once per file in the same tick for a multi-select.
    stagedRef.current = [...stagedRef.current, { uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file }]
    setStagedFiles(stagedRef.current)
  }

  const handleUnstageFile = (uid: string) => setStagedFiles((prev) => prev.filter((f) => f.uid !== uid))

  const handleDeleteSavedAttachment = async (att: PettyCashAttachment) => {
    if (docIdEff == null) return
    try {
      await pettyCashService.deleteAttachment(accessToken, docIdEff, att.id)
      message.success('ลบไฟล์แนบเรียบร้อย')
      // Re-fetch only the attachment list — loadDoc would overwrite unsaved form edits.
      const pc = await pettyCashService.get(accessToken, docIdEff)
      setSavedAttachments(pc.attachments ?? [])
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ลบไฟล์แนบไม่สำเร็จ')
    }
  }

  // Core save (unchanged logic). `forSubmit` only changes what happens after a CREATE: instead of
  // navigating away (which remounts the page) it stays, so the confirmation popup survives.
  const saveDocument = async (forSubmit = false, toast = !forSubmit): Promise<{ id: string | number; pcNo: string } | null> => {
    try {
      // Validate Tab A's Form first (its pane is force-rendered, so it is mounted even while Tab 2
      // is active). On failure jump to Tab A and focus the first failing field — nothing is saved.
      try {
        await form.validateFields()
      } catch (vErr: any) {
        const first = vErr?.errorFields?.[0]
        setActiveTab('a')
        if (first) {
          message.error(first.errors?.[0] || 'กรุณาตรวจสอบข้อมูลรายละเอียดเอกสาร')
          setTimeout(() => form.scrollToField(first.name, { behavior: 'smooth', block: 'center' }), 100)
          form.getFieldInstance?.(first.name)?.focus?.()
        }
        return null
      }
      // getFieldsValue(true) returns the whole form store (every registered Tab A field, plus
      // values set via setFieldsValue), independent of which tab is visible.
      if (rejectBlankRows()) return null
      const v = form.getFieldsValue(true)
      setSubmitting(true)
      // ALL Tab A keys are sent on every save — an empty string clears the stored value.
      // purpose/currency are intentionally omitted (backend keeps stored / defaults to THB);
      // pc_no / pc_date / requested_by are server-owned and never sent.
      const payload: CreatePettyCashRequest = {
        doc_type: v.doc_type ?? 'PETTY_CASH',
        branch_code: v.branch_code ?? '',
        payee_emp_code: v.payee_emp_code ?? '',
        payee_name: v.payee_name ?? '',
        project_code: v.project_code || undefined,
        project_name: v.project_name ?? '',
        order_type: v.order_type ?? '',
        dept_code: v.dept_code ?? '',
        dept_name: v.dept_name ?? '',
        ref_doc_no: v.ref_doc_no ?? '',
        remarks: v.remarks ?? '',
        approver_id: approverId,
        status: 'DRAFT',
        lines: buildLinesPayload(),
      }

      if (PETTY_CASH_MOCK_SAVE) {
        // TEMPORARY mock: no API. Fake id + document number kept in local state only.
        if (!docIdEff) setSavedId(MOCK_ID)
        setPcNo(MOCK_PC_NO)
        setStagedFiles([])
        if (toast) message.success('บันทึกสำเร็จ (โหมดทดสอบ ไม่ได้บันทึกจริง)')
        return { id: docIdEff ?? MOCK_ID, pcNo: MOCK_PC_NO }
      }
      let result: { id: string | number; pcNo: string }
      if (docIdEff) {
        const updated = await pettyCashService.update(accessToken, docIdEff, payload)
        const uploaded = await uploadStagedFiles(docIdEff)
        await loadDoc(docIdEff)
        // Saved as DRAFT but an upload failed: stop here so nothing is submitted.
        if (!uploaded) return null
        result = { id: docIdEff, pcNo: updated?.pc_no ?? pcNo }
      } else {
        const created = await pettyCashService.create(accessToken, payload)
        result = { id: created.id, pcNo: created.pc_no ?? '' }
        // Remember the new id first so a retry after a failed upload updates this document
        // instead of creating a duplicate.
        setSavedId(created.id)
        const uploaded = await uploadStagedFiles(created.id)
        if (!uploaded) {
          await loadDoc(created.id)
          return null
        }
        if (forSubmit) {
          await loadDoc(created.id)
        } else {
          // The edit route remounts this page and reloads the document from GET /petty-cash/:id.
          navigate(`/petty-cash/${created.id}/edit`, { replace: true })
        }
      }
      if (toast) message.success('บันทึกเรียบร้อย')
      return result
    } catch (err: any) {
      // Backend validation errors are Thai plain strings — show as-is.
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึกไม่สำเร็จ')
      return null
    } finally {
      setSubmitting(false)
    }
  }

  // ── confirm popup (opened by "บันทึก" in Tab 2 and by the station's "ส่งอนุมัติ") ──
  // Nothing is saved here: validate, then ask. The real pc_no only exists after the first save.
  const openConfirm = () => {
    if (submitting || submittingYes) return
    // TEMPORARY: validation is skipped in mock mode so the popup can be reviewed with an empty form.
    if (!PETTY_CASH_MOCK_SAVE && !validateForSubmit()) return
    setConfirmOpen(true)
  }

  // Yes: no save/submit yet — close this popup and open the approver picker.
  const handleConfirmYes = () => {
    setConfirmOpen(false)
    setPickerOpen(true)
  }

  // Picker "ตกลง": save the document as a DRAFT (create/update; mock = fake) so it has a real document
  // number, then show the "Form Submit Approve" step. Nothing is submitted until "ยืนยันการอนุมัติ".
  const handleApproverChosen = async (approver: ChosenApprover) => {
    if (submittingYes || submitting) return
    setSubmittingYes(true)
    try {
      const saved = await saveDocument(true, false)
      if (!saved) return // saveDocument already showed its error; picker stays open
      const v = form.getFieldsValue(true)
      const dept = v.dept_name ?? ''
      setApproveSummary({
        docNo: saved.pcNo,
        docTypeLabel: DOC_TYPE_OPTIONS.find((o) => o.value === (v.doc_type ?? 'PETTY_CASH'))?.label ?? v.doc_type ?? '',
        docDate: dayjs(pcDate).format('DD/MM/YYYY'),
        projectCode: v.project_code ?? '',
        orderTypeLabel: v.order_type ? getOrderTypeLabel(v.order_type) : '',
        deptLabel: dept,
        netAmount: PETTY_CASH_MOCK_SAVE ? netAmount : serverNetAmount ?? netAmount,
      })
      setChosenApprover(approver)
      setPickerOpen(false)
      setApproveStepOpen(true)
    } finally {
      setSubmittingYes(false)
    }
  }

  // "กลับ" on the step: back to the approver picker; the saved document is untouched.
  const handleApproveBack = () => {
    setApproveStepOpen(false)
    setPickerOpen(true)
  }

  // "ยืนยันการอนุมัติ": POST /petty-cash/:id/submit { approver_id } (skipped in mock mode).
  const handleApproveConfirm = async () => {
    if (!chosenApprover || docIdEff == null) return
    setApproveSubmitting(true)
    try {
      let docNo = approveSummary?.docNo || pcNo
      if (PETTY_CASH_MOCK_SAVE) {
        await new Promise((r) => setTimeout(r, 500)) // simulate the submit round-trip
      } else {
        const result = await pettyCashService.submit(accessToken, docIdEff, chosenApprover.userId)
        docNo = result?.doc_no || docNo
      }
      setSuccessDocNo(docNo)
      setApproveStepOpen(false)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ส่งอนุมัติไม่สำเร็จ')
    } finally {
      setApproveSubmitting(false)
    }
  }

  // "ปิดหน้าต่าง": reset the page and go back to the main create page.
  const handleSuccessClose = () => {
    setSuccessDocNo(null)
    setApproveSummary(null)
    setChosenApprover(null)
    form.resetFields()
    setItems([])
    setSavedId(undefined)
    setPcNo('')
    setPcDate(dayjs().format('YYYY-MM-DD'))
    setApproverId(null)
    setRemarksError('')
    setServerNetAmount(null)
    setStagedFiles([])
    setSavedAttachments([])
    setUploadProgress('')
    setDocStatus('DRAFT')
    setActiveTab('a')
    navigate('/petty-cash/create', { replace: true })
  }

  // Draft: save only (no submit), then back to the list.
  const handleConfirmDraft = async () => {
    if (submitting || submittingYes) return
    const saved = await saveDocument(true, true)
    if (!saved) return
    setConfirmOpen(false)
    navigate('/petty-cash')
  }

  const watchedRemarks: string = Form.useWatch('remarks', { form, preserve: true }) ?? ''
  const canSubmit =
    canEdit && !!watchedRemarks.trim() && items.length > 0 && (!docIdEff || docStatus === 'DRAFT' || docStatus === 'REJECTED')

  // Totals come from the lines (after a save the page reloads the server's figures).
  const filledItems = items.filter((r) => !r.isNew)
  const subtotal = filledItems.reduce((a, r) => a + r.amount, 0)
  const totalVat = filledItems.reduce((a, r) => a + r.line_vat, 0)
  const totalWht = filledItems.reduce((a, r) => a + r.line_wht, 0)
  const netAmount = filledItems.reduce((a, r) => a + r.line_net, 0)

  const [printLoading, setPrintLoading] = useState(false)

  // Success popup "พิมพ์": mock = current form values (still intact until "ปิดหน้าต่าง"); real = the
  // saved document re-fetched from GET /petty-cash/:id so the approver name and status are current.
  const handleSuccessPrint = async () => {
    if (PETTY_CASH_MOCK_SAVE) {
      handlePrint('PENDING_APPROVAL')
      return
    }
    if (docIdEff == null) return
    setPrintLoading(true)
    try {
      const pc = await pettyCashService.get(accessToken, docIdEff)
      setPrintPayload({ data: buildPettyCashPrintData(pc), lines: buildPettyCashPrintLines(pc.lines ?? []) })
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลสำหรับพิมพ์ไม่สำเร็จ')
    } finally {
      setPrintLoading(false)
    }
  }

  const handlePrint = (statusOverride?: string) => {
    const v = form.getFieldsValue(true)
    const dmy = (d?: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '')
    setPrintPayload({
      data: {
        status: statusOverride ?? (docIdEff ? docStatus : 'DRAFT'),
        pcNo: PETTY_CASH_MOCK_SAVE ? MOCK_PC_NO : pcNo,
        pcDate: dmy(pcDate),
        project: projectLabel(v.project_code, v.project_name),
        deptCode: v.dept_code ?? '',
        dept: v.dept_name ?? '',
        orderType: v.order_type ? getOrderTypeLabel(v.order_type) : '',
        payee: [v.payee_emp_code, v.payee_name].filter(Boolean).join(' '),
        subtotal,
        discount: 0,
        vat: totalVat,
        wht: totalWht,
        netAmount,
        requester: requestedByName || currentUser?.full_name || currentUser?.fullName || currentUser?.username || '',
        approver: chosenApprover?.name ?? '',
      },
      lines: filledItems.map((r, i) => ({
        no: String(i + 1),
        costCode: r.cost_code,
        desc: pettyCashLineDesc(r.mat_name_th, r.description),
        amount: r.amount,
        vat: r.line_vat,
        wht: r.line_wht,
        net: r.line_net,
        vendor: r.supplier_name,
        remark: r.remarks,
        invoiceNo: r.invoice_no ?? '',
        invoiceDate: dmy(r.invoice_date),
        taxInvoiceNo: r.has_tax_invoice ? r.tax_invoice_no : '',
        taxInvoiceDate: r.has_tax_invoice ? dmy(r.tax_invoice_date) : '',
        whtLabel: r.has_wht ? r.wht_income_label : '',
      })),
    })
  }

  const handleAddBlankRow = () => {
    setErrorRowKey(null)
    setItems((prev) => [...prev, {
      key: `blank-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      isNew: true,
      project_code: headerProjectCode ?? '',
      mat_code: '', mat_name_th: '', description: '',
      cost_subgroup_id: null, cost_code: '', cost_group_name: '', cost_subgroup_name: '',
      remarks: '', amount: 0,
      supplier_id: null, supplier_name: '', supplier_address: '', supplier_tax_id: '',
      has_tax_invoice: false, tax_invoice_no: '', tax_invoice_date: '',
      has_wht: false, wht_base_amount: null, tax_form_code: '', wht_income_type_id: null,
      wht_income_label: '', wht_rate: null, wht_pay_date: '',
      invoice_no: '', invoice_date: '',
      line_vat: 0, line_wht: 0, line_net: 0,
    }])
  }

  const handleDeleteRow = (index: number) => {
    setErrorRowKey(null)
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleLineOk = (line: PettyCashLineForm) => {
    setErrorRowKey(null)
    if (!lineModal) return
    setItems((prev) =>
      lineModal.mode === 'edit' && lineModal.index != null
        ? prev.map((r, i) => (i === lineModal.index ? line : r))
        : [...prev, line],
    )
    setLineModal(null)
  }

  const tabA = (
    <Card title={<span style={cardTitleStyle}>ข้อมูลทั่วไป</span>} style={cardStyle} loading={loading}>
      <Form form={form} layout="vertical" disabled={!canEdit} initialValues={{ doc_type: 'PETTY_CASH' }}>
        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            {/* pc_date is not accepted by POST/PUT — display only. */}
            <Form.Item label="วันที่เอกสาร">
              <DatePicker value={dayjs(pcDate)} format="DD/MM/YYYY" disabled style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Form.Item name="doc_type" label="ประเภทเอกสาร">
              <Select options={DOC_TYPE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Form.Item name="branch_code" label="สาขา">
              <Select placeholder="เลือกสาขา" allowClear options={BRANCH_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            {/* Backend always records the caller as requested_by — read-only display. */}
            <Form.Item label="ผู้จัดทำ">
              <Input disabled value={requestedByName || currentUser?.fullName || currentUser?.full_name || currentUser?.username || ''} />
            </Form.Item>
          </Col>
        </Row>

        <div style={sectionLabelStyle}>จ่ายให้กับ</div>
        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            <Form.Item name="payee_emp_code" label="รหัสพนักงาน">
              <Select
                placeholder="เลือกรหัสพนักงาน"
                showSearch
                allowClear
                options={employees}
                filterOption={filterByLabel}
                onChange={(code?: string) => {
                  const emp = employees.find((e) => e.value === code)
                  form.setFieldValue('payee_name', emp?.name ?? '')
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Form.Item name="payee_name" label="ชื่อพนักงาน">
              <Input maxLength={200} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            <Form.Item name="project_code" label="รหัสโครงการ">
              <Select
                placeholder="เลือกโครงการ"
                showSearch
                allowClear
                options={projects}
                filterOption={filterByLabel}
                onChange={(code?: string) => {
                  form.setFieldValue('project_name', projects.find((p) => p.value === code)?.name ?? '')
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} lg={12}>
            <Form.Item name="project_name" label="ชื่อโครงการ">
              <Input maxLength={200} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Form.Item name="order_type" label="ประเภทการสั่งซื้อ">
              <Select placeholder="เลือกประเภทการสั่งซื้อ" allowClear options={ORDER_TYPE_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            <Form.Item
              name="dept_code"
              label="รหัสแผนก"
              dependencies={['project_code']}
              rules={[
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    value || getFieldValue('project_code')
                      ? Promise.resolve()
                      : Promise.reject(new Error('กรุณาเลือกแผนกหรือโครงการอย่างน้อยหนึ่งอย่าง')),
                }),
              ]}
            >
              <DepartmentSelect
                allowClear
                fallbackName={savedDeptName}
                onChange={(_code, dept) => {
                  form.setFieldValue('dept_name', dept?.dept_name ?? '')
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Form.Item name="dept_name" label="แผนก">
              {/* Filled from the selected department (departments.dept_name), not typed. */}
              <Input maxLength={200} disabled />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Form.Item name="ref_doc_no" label="เอกสาร REF">
              <Input maxLength={50} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24}>
            <Form.Item label="แนบไฟล์ :">
              <PettyCashStagedAttachments
                staged={stagedFiles}
                saved={savedAttachments}
                canStage={canEdit && !submitting}
                canDeleteSaved={docIdEff != null && docStatus === 'DRAFT' && !submitting}
                progressText={uploadProgress}
                onStage={handleStageFile}
                onUnstage={handleUnstageFile}
                onDeleteSaved={handleDeleteSavedAttachment}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24}>
            <Form.Item
              name="remarks"
              label="หมายเหตุผู้เบิก"
              validateStatus={remarksError ? 'error' : undefined}
              help={remarksError || undefined}
            >
              <Input.TextArea
                rows={3}
                maxLength={500}
                showCount
                placeholder="หมายเหตุผู้เบิก"
                onChange={() => { if (remarksError) setRemarksError('') }}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  )

  const tabB = (
    <>
      <Card
        title={<span style={cardTitleStyle}>รายการ</span>}
        style={{ ...cardStyle, marginBottom: 16 }}
        loading={loading}
      >
        {/* Toolbar: the tab label already shows the section title, so only the count is shown. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>({items.length} รายการ)</span>
          {canEdit && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ height: 36, borderRadius: 8 }}
              onClick={handleAddBlankRow}
            >
              เพิ่มรายการ
            </Button>
          )}
        </div>
        <PettyCashLineSummaryTable
          items={items}
          canEdit={canEdit}
          onOpenLine={openLineModal}
          onDelete={handleDeleteRow}
          errorKey={errorRowKey}
        />
        <PettyCashLineModal
          open={lineModal != null}
          mode={lineModal?.mode ?? 'add'}
          initial={lineModal?.index != null ? items[lineModal.index] ?? null : null}
          headerProjectCode={headerProjectCode}
          headerOrderType={headerOrderType}
          lineOptions={lineOptions}
          onOk={handleLineOk}
          onCancel={() => setLineModal(null)}
        />
      </Card>

      <Card title={<span style={cardTitleStyle}>สรุปยอด</span>} style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>ยอดรวมก่อนภาษี</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>฿ {fmt(subtotal)}</span>
            </div>
            {totalVat > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>VAT</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#ca8a04' }}>+ ฿ {fmt(totalVat)}</span>
              </div>
            )}
            {totalWht > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>หัก ณ ที่จ่าย</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#dc2626' }}>- ฿ {fmt(totalWht)}</span>
              </div>
            )}
            <div style={{ borderTop: '0.5px solid #dbeafe', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>ยอดรวมสุทธิ</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>฿ {fmt(netAmount)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Footer row of the Tab 2 block: save lives here (not on Tab A, not in the station card). */}
      {activeTab === 'b' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5eefc' }}>
          {PETTY_CASH_MOCK_SAVE && <MockTag />}
          {uploadProgress && <span style={{ fontSize: 13, color: '#1d4ed8' }}>{uploadProgress}</span>}
          <PermissionButton
            menuCode={MENU_CODE}
            action={isEdit ? 'edit' : 'write'}
            type="primary"
            icon={<SaveOutlined />}
            onClick={openConfirm}
            disabled={!canEdit || submitting}
          >
            บันทึก
          </PermissionButton>
        </div>
      )}
    </>
  )

  return (
    <div style={{ display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <PageHeader
          title={pcNo ? `ใบเบิกเงินสดย่อย ${pcNo}` : isEdit ? 'แก้ไขใบเบิกเงินสดย่อย' : 'สร้างใบเบิกเงินสดย่อย'}
          subtitle="เบิกเงินสดย่อยเพื่อซื้อ/เบิกจ่ายวัสดุสำหรับโครงการ — ไม่มีการตัด stock"
          breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'เบิกเงินสดย่อย' }, { title: isEdit ? 'แก้ไข' : 'สร้าง' }]}
          extra={<Button icon={<PrinterOutlined />} onClick={() => handlePrint()}>พิมพ์</Button>}
        />

        {/* Same shared tab style as ICPoReceiveModal (PanelTabs). forceRender keeps Tab A's
            <Form> mounted while Tab B is showing. */}
        <PanelTabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'a' | 'b')}
          items={[
            { key: 'a', label: 'รายละเอียดเอกสาร', children: tabA, forceRender: true },
            { key: 'b', label: 'รายการเงินสดย่อย', children: tabB, forceRender: true },
          ]}
        />

        {/* Station card: the stepper only, full width. Last element on the page, outside the Tabs, so it
            is visible on both tabs. Sticky to the viewport bottom (window is the scroll container);
            on narrow widths it is a normal end-of-page card. */}
        <Card
          style={{
            ...cardStyle, marginTop: 16, marginBottom: 8,
            ...(isNarrow ? {} : { position: 'sticky', bottom: 8, zIndex: 10 }),
          }}
          styles={{ body: { padding: '12px 20px' } }}
        >
          <PettyCashStationBar
            status={docIdEff ? docStatus : undefined}
            submitEnabled={(PETTY_CASH_MOCK_SAVE || canSubmit) && !submitting}
            onSubmitClick={openConfirm}
          />
        </Card>
      </div>

      <Modal
        open={confirmOpen}
        title={
          <span style={{ fontFamily: 'Sarabun', color: '#1e3a8a', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            ยืนยันทำรายการ {PETTY_CASH_MOCK_SAVE && <MockTag />}
          </span>
        }
        centered
        width={480}
        closable={false}
        maskClosable={false}
        keyboard={false}
        styles={{ content: { borderRadius: 12, boxShadow: '0 8px 30px rgba(15,45,94,0.18)' } }}
        footer={[
          <Button key="draft" onClick={handleConfirmDraft} loading={submitting && !submittingYes} disabled={submittingYes}>Draft</Button>,
          // Plain Button on purpose: it was a PermissionButton (hide mode) and vanished for users without
          // the 'edit' right. It only opens the approver picker; the write happens at the picker's "ตกลง".
          <Button key="yes" type="primary" onClick={handleConfirmYes}>Yes</Button>,
          <Button key="no" onClick={() => setConfirmOpen(false)} disabled={submitting || submittingYes}>No</Button>,
        ]}
      >
        <div>
          เอกสารเลขที่{' '}
          {PETTY_CASH_MOCK_SAVE || pcNo ? (
            <span style={{ fontSize: 18, fontWeight: 700, color: '#1e3a8a' }}>{PETTY_CASH_MOCK_SAVE ? MOCK_PC_NO : pcNo}</span>
          ) : (
            <span style={{ color: '#94a3b8' }}>ระบบจะออกเลขเอกสารเมื่อบันทึก</span>
          )}
        </div>
        <div style={{ marginTop: 8 }}>ส่งให้ผู้มีอำนาจอนุมัติ ต้องการส่งยืนยันการอนุมัติ</div>
      </Modal>

      <Modal
        open={successDocNo != null}
        centered
        width={460}
        closable={false}
        maskClosable={false}
        keyboard={false}
        styles={{ content: { borderRadius: 12, boxShadow: '0 8px 30px rgba(15,45,94,0.18)' } }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <Button
              icon={<PrinterOutlined />}
              loading={printLoading}
              onClick={handleSuccessPrint}
              style={{ height: 40, minWidth: 120 }}
            >
              พิมพ์
            </Button>
            <Button type="primary" onClick={handleSuccessClose} style={{ height: 40, minWidth: 120 }}>ปิดหน้าต่าง</Button>
          </div>
        }
      >
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <CheckCircleFilled style={{ fontSize: 48, color: '#16a34a' }} />
          <div style={{ fontFamily: 'Sarabun', fontSize: 20, fontWeight: 700, color: '#1e3a8a', margin: '12px 0 8px' }}>ทำรายการเสร็จสิ้น</div>
          <div>เลขที่เอกสารที่ {successDocNo} ส่ง submit approve เรียบร้อยแล้ว</div>
        </div>
      </Modal>

      {approveSummary && (
        <PettyCashSubmitApprove
          open={approveStepOpen}
          summary={approveSummary}
          chain={chosenApprover ? [{
            key: chosenApprover.userId,
            employeeCode: chosenApprover.code,
            seq: 1,
            // Picker-flow summary: username only (print data above keeps the full name).
            approveBy: formatApproverOption(chosenApprover.username, chosenApprover.userId),
            roleNames: chosenApprover.roleNames,
            status: null,
          }] : []}
          submitting={approveSubmitting}
          mock={PETTY_CASH_MOCK_SAVE}
          onBack={handleApproveBack}
          onConfirm={handleApproveConfirm}
        />
      )}

      {printPayload && (
        <PettyCashPrint
          data={printPayload.data}
          lines={printPayload.lines}
          onReady={() => {
            window.print()
            setPrintPayload(null)
          }}
        />
      )}

      <ApproverPickerModal
        initialSelectedId={chosenApprover?.userId ?? null}
        open={pickerOpen}
        docType="PETTY_CASH"
        mock={PETTY_CASH_MOCK_SAVE}
        confirming={submittingYes}
        onOk={handleApproverChosen}
        onCancel={() => setPickerOpen(false)}
      />

      {/* TODO: discount / VAT / WHT controls (TaxSidebarPanel) moved to the line modal. The
          use_discount / discount_type / use_vat / use_wht state is kept and still saved & loaded. */}
    </div>
  )
}

export default PettyCashCreatePage
