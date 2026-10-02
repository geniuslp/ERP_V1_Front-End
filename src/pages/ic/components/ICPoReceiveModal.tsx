import { icActionButtonProps } from '@/pages/ic/utils/actionButtonStyle'
import React, { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Tabs,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Button,
  Spin,
  Alert,
  message,
  Row,
  Col,
  Select,
  Table,
  Space,
  Popconfirm,
  Tooltip,
  Typography,
  Modal as AntModal,
} from 'antd'
import { PrinterOutlined, DeleteOutlined, ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { goBackToICProject, confirmLeaveIfDirty, IC_PROJECT_LIST_ROUTE } from '@/pages/ic/utils/icNavigation'
import { useAppSelector } from '@/store'
import ICPoReceiveRatingModal from './ICPoReceiveRatingModal'
import ICPoReceivePrint, { type ICReceivePrintData } from './ICPoReceivePrint'

const { TextArea } = Input
const { Text } = Typography

const BASE_URL = (import.meta as any).env?.VITE_API_URL
const DATE_FORMAT = 'YYYY-MM-DD'

interface ICPoReceiveContext {
  po_no: string
  supplier_name?: string | null
  project_name?: string | null
  job_code?: string | null
  use_vat: boolean
  vat_amount?: number | null
  credit_days_from_supplier?: number | null
  currency: string
}

// Full document detail. GET .../receive-document (the current empty draft,
// if any) and GET .../receive-documents/{docId} (one specific document)
// both resolve to this shape — the latter also carries rating fields
// (score_quality/score_quantity/score_ontime/score_notes/rated_at/rated_by).
// Only `rated_at` is typed here (used as the "already rated" guard for the
// auto-triggered rating modal) — the individual score fields stay untyped
// since nothing on this side reads them back.
interface ICPoReceiveDocument {
  id: number
  receive_no?: string | null
  tax_invoice_no: string
  tax_invoice_date: string
  temp_delivery_no?: string | null
  temp_delivery_date?: string | null
  exchange_rate?: number | null
  remarks?: string | null
  created_at: string
  // due_date = this document's created_at + credit_days_from_supplier,
  // computed and stored server-side. Never recompute this on the client
  // from tax_invoice_date — that was the old (wrong) rule.
  due_date?: string | null
  rated_at?: string | null
}

interface ICPoReceiveDocumentResponse {
  context: ICPoReceiveContext
  document: ICPoReceiveDocument | null
}

// One row of GET /ic/pos/:poId/receive-documents (newest first).
interface ICPoReceiveDocListItem {
  id: number
  receive_no?: string | null
  tax_invoice_no: string
  tax_invoice_date: string
  temp_delivery_no?: string | null
  temp_delivery_date?: string | null
  credit_days?: number | null
  due_date?: string | null
  created_at: string
  line_count: number
  deletable: boolean
}

interface ICPoReceiveDocumentsListResponse {
  documents: ICPoReceiveDocListItem[]
  can_create_new: boolean
  remaining_qty_total: number
}

interface FormValues {
  tax_invoice_no?: string
  tax_invoice_date?: Dayjs
  temp_delivery_no?: string
  temp_delivery_date?: Dayjs
  remarks?: string
}

interface ICPoReceiveModalProps {
  open: boolean
  poId: number | null
  onClose: () => void
  /** Project to return to (ICProjectListPage) on save / X. Falls back to onClose when absent. */
  projectCode?: string
  preparedBy?: string | null
}

// Editable line — GET .../receive-lines?receive_document_id=, used only
// while the selected document is still a draft (no receive_no yet).
// qty_received/bal_receive are cumulative across ALL documents of the PO.
interface ICReceiveLine {
  line_id: number
  cost_code?: string | null
  mat_code: string
  description: string
  qty_ordered: number
  qty_received?: number | null
  bal_receive: number
  unit: string
  unit_price: number
}

interface ICReceiveLinesResponse {
  po_context: { order_type?: string; project_code?: string }
  lines: ICReceiveLine[]
  mat_code_options: string[]
  cost_code_options: string[]
}

// Read-only line — GET .../receive-documents/{docId}/lines. Used once a
// document has a receive_no (closed / print-only). No line_id or
// bal_receive here since nothing on this view is editable anymore.
interface ICReceiveLineReadonly {
  cost_code?: string | null
  mat_code: string
  description: string
  unit: string
  unit_price: number
  qty: number
}

interface ICReceiveDocumentLinesResponse {
  scoped_by_document: boolean
  lines: ICReceiveLineReadonly[]
}

const formatMoney = (value: number) =>
  value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatQty = (value: number) =>
  value.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const ICPoReceiveModal: React.FC<ICPoReceiveModalProps> = ({ open, poId, onClose, projectCode, preparedBy }) => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [form] = Form.useForm<FormValues>()

  // 'list' = the "ใบรับของ" document list for this PO (landing view).
  // 'detail' = the existing 3-tab modal, scoped to one document
  // (selectedDocId) — either a just-created draft, an existing draft picked
  // from the list, or a received (closed) document.
  const [view, setView] = useState<'list' | 'detail'>('list')
  // Which date field the user edited last — drives the estimated due date.
  // Controlled so a failed details validation can jump back to the details tab.
  const [activeTab, setActiveTab] = useState<'document' | 'items' | 'attachments'>('document')
  const [lastDueDateField, setLastDueDateField] = useState<'invoice' | 'temp' | null>(null)

  // PO-level context (po_no/supplier/project/job/currency/vat/credit days)
  // is the same regardless of which document is selected — fetched once per
  // modal open via GET .../receive-document, not per document.
  const [context, setContext] = useState<ICPoReceiveContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)

  const [docsList, setDocsList] = useState<ICPoReceiveDocumentsListResponse | null>(null)
  const [docsListLoading, setDocsListLoading] = useState(false)

  const [selectedDocId, setSelectedDocId] = useState<number | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<ICPoReceiveDocument | null>(null)
  const [selectedDocLoading, setSelectedDocLoading] = useState(false)
  // True only while filling the "สร้างใบรับใหม่" form: no document exists until the single
  // save on the items tab (receive-lines/submit creates it together with its lines).
  const [creatingNew, setCreatingNew] = useState(false)

  const [linesData, setLinesData] = useState<ICReceiveLinesResponse | null>(null)
  const [linesLoading, setLinesLoading] = useState(false)
  const [linesSubmitting, setLinesSubmitting] = useState(false)
  const [matCodeFilter, setMatCodeFilter] = useState<string | undefined>(undefined)
  const [costCodeFilter, setCostCodeFilter] = useState<string | undefined>(undefined)
  const [typedQty, setTypedQty] = useState<Record<number, number>>({})
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({})

  const [readonlyLines, setReadonlyLines] = useState<ICReceiveLineReadonly[] | null>(null)
  const [readonlyLinesLoading, setReadonlyLinesLoading] = useState(false)

  // Printing follows the exact same pattern as PurchaseOrderPrint.tsx /
  // PRPrint.tsx: render ICPoReceivePrint in-place (portal to document.body,
  // off-screen), auto-fire window.print() via onReady, unmount right after.
  const [printData, setPrintData] = useState<ICReceivePrintData | null>(null)

  const [successInfo, setSuccessInfo] = useState<{ receiveNo?: string } | null>(null)
  // True when the print was started from the success modal: leave for the project page once
  // printing finishes (see handlePrintFromSuccess).
  const exitAfterPrintRef = React.useRef(false)

  // Supplier-rating modal — auto-opens exactly once, right after a fresh
  // receive-document save that has no rated_at yet (never on merely opening
  // an already-saved/rated document from the list).
  // Strict post-save sequence, one step visible at a time: 'rating' (mandatory vendor rating) ->
  // 'success' (พิมพ์ / ปิด) -> 'idle'. Lives here (always mounted) so refreshes of the documents
  // list / selected document after the save can't unmount or reset it.
  const [phase, setPhase] = useState<'idle' | 'rating' | 'success'>('idle')
  // Navigation back to the project page runs at most once per modal session.
  const exitedRef = React.useRef(false)
  // Print timers are armed only by an actual click on "พิมพ์".
  const printCleanupRef = React.useRef<(() => void) | null>(null)
  const [ratingDocId, setRatingDocId] = useState<number | null>(null)

  const extractErrorMessage = (err: any, fallback: string) =>
    err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback

  const fetchContext = async () => {
    if (!poId) return
    setContextLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/ic/pos/${poId}/receive-document`, { headers: authHeader })
      const payload: ICPoReceiveDocumentResponse = res.data?.data ?? res.data
      setContext(payload.context)
    } catch (err: any) {
      message.error(extractErrorMessage(err, 'โหลดข้อมูล PO ไม่สำเร็จ'))
    } finally {
      setContextLoading(false)
    }
  }

  const fetchDocsList = async (): Promise<ICPoReceiveDocumentsListResponse | null> => {
    if (!poId) return null
    setDocsListLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/ic/pos/${poId}/receive-documents`, { headers: authHeader })
      const payload: ICPoReceiveDocumentsListResponse = res.data?.data ?? res.data
      setDocsList(payload)
      return payload
    } catch (err: any) {
      message.error(extractErrorMessage(err, 'โหลดรายการใบรับของไม่สำเร็จ'))
      return null
    } finally {
      setDocsListLoading(false)
    }
  }

  const fetchDocDetail = async (docId: number): Promise<ICPoReceiveDocument | null> => {
    if (!poId) return null
    setSelectedDocLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/ic/pos/${poId}/receive-documents/${docId}`, { headers: authHeader })
      const doc: ICPoReceiveDocument = res.data?.data ?? res.data
      setSelectedDoc(doc)
      form.setFieldsValue({
        tax_invoice_no: doc.tax_invoice_no,
        tax_invoice_date: doc.tax_invoice_date ? dayjs(doc.tax_invoice_date) : undefined,
        temp_delivery_no: doc.temp_delivery_no ?? undefined,
        temp_delivery_date: doc.temp_delivery_date ? dayjs(doc.temp_delivery_date) : undefined,
        remarks: doc.remarks ?? undefined,
      })
      return doc
    } catch (err: any) {
      message.error(extractErrorMessage(err, 'โหลดข้อมูลเอกสารไม่สำเร็จ'))
      return null
    } finally {
      setSelectedDocLoading(false)
    }
  }

  const fetchLines = async (docId?: number): Promise<ICReceiveLinesResponse | null> => {
    if (!poId) return null
    setLinesLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/ic/pos/${poId}/receive-lines`, {
        params: docId ? { receive_document_id: docId } : undefined,
        headers: authHeader,
      })
      const payload: ICReceiveLinesResponse = res.data?.data ?? res.data
      setLinesData(payload)
      setTypedQty({})
      setLineErrors({})
      return payload
    } catch (err: any) {
      message.error(extractErrorMessage(err, 'โหลดรายการสินค้าไม่สำเร็จ'))
      return null
    } finally {
      setLinesLoading(false)
    }
  }

  const fetchReadonlyLines = async (docId: number): Promise<ICReceiveLineReadonly[] | null> => {
    if (!poId) return null
    setReadonlyLinesLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/ic/pos/${poId}/receive-documents/${docId}/lines`, { headers: authHeader })
      const payload: ICReceiveDocumentLinesResponse = res.data?.data ?? res.data
      setReadonlyLines(payload.lines)
      return payload.lines
    } catch (err: any) {
      message.error(extractErrorMessage(err, 'โหลดรายการสินค้าไม่สำเร็จ'))
      return null
    } finally {
      setReadonlyLinesLoading(false)
    }
  }

  useEffect(() => {
    if (open && !poId) {
      console.warn('[ICPoReceiveModal] opened with a falsy poId — no /ic calls will be made. Check the caller is passing the correct id field (this API keys it as `po_id`, not `id`).')
    }
    if (open && poId) {
      setView('list')
      setSelectedDocId(null)
      setSelectedDoc(null)
      setCreatingNew(false)
      setLinesData(null)
      setReadonlyLines(null)
      setPrintData(null)
      setSuccessInfo(null)
      setPhase('idle')
      setRatingDocId(null)
      form.resetFields()
      fetchContext()
      fetchDocsList()
    }
    if (!open) {
      setView('list')
      setContext(null)
      setDocsList(null)
      setSelectedDocId(null)
      setSelectedDoc(null)
      setCreatingNew(false)
      setLinesData(null)
      setReadonlyLines(null)
      setMatCodeFilter(undefined)
      setCostCodeFilter(undefined)
      setTypedQty({})
      setLineErrors({})
      setPrintData(null)
      setSuccessInfo(null)
      setPhase('idle')
      setRatingDocId(null)
      form.resetFields()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, poId])

  // Selecting a document from the list — never mixes another document's
  // header into the form: fetchDocDetail always overwrites the form with
  // exactly the picked document's own fields.
  const handleSelectDocument = async (doc: ICPoReceiveDocListItem) => {
    setSelectedDocId(doc.id)
    setSelectedDoc(null)
    setCreatingNew(false)
    setLinesData(null)
    setReadonlyLines(null)
    setActiveTab('document')
    setView('detail')
    const detail = await fetchDocDetail(doc.id)
    if (detail?.receive_no) {
      await fetchReadonlyLines(doc.id)
    } else {
      await fetchLines(doc.id)
    }
  }

  // Creates nothing server-side: just opens an empty details + items form. The document is
  // created atomically with its lines by the single save on the items tab.
  const handleCreateNew = () => {
    setSelectedDocId(null)
    setSelectedDoc(null)
    setCreatingNew(true)
    setLinesData(null)
    setReadonlyLines(null)
    setLastDueDateField(null)
    form.resetFields()
    setActiveTab('document')
    setView('detail')
    fetchLines()
  }

  const handleBackToList = () => {
    setView('list')
    setSelectedDocId(null)
    setSelectedDoc(null)
    setCreatingNew(false)
    setLinesData(null)
    setReadonlyLines(null)
    form.resetFields()
    fetchDocsList()
  }

  const handleDeleteDocument = async (docId: number) => {
    if (!poId) return
    try {
      await axios.delete(`${BASE_URL}/ic/pos/${poId}/receive-documents/${docId}`, { headers: authHeader })
      message.success('ลบใบรับของสำเร็จ')
      fetchDocsList()
    } catch (err: any) {
      message.error(extractErrorMessage(err, 'ลบไม่สำเร็จ'))
    }
  }

  const buildPrintData = (
    printContext: ICPoReceiveContext,
    printDocument: ICPoReceiveDocument,
    lines: ICReceiveLineReadonly[],
  ): ICReceivePrintData => ({
    poNo: printContext.po_no,
    projectName: printContext.project_name || '',
    tempDeliveryNo: printDocument.temp_delivery_no,
    tempDeliveryDate: printDocument.temp_delivery_date ? dayjs(printDocument.temp_delivery_date).format(DATE_FORMAT) : undefined,
    receiveNo: printDocument.receive_no ?? '',
    receivedDate: dayjs(printDocument.created_at).format(DATE_FORMAT),
    jobCode: printContext.job_code,
    items: lines.map((line, index) => ({
      no: String(index + 1),
      costCode: line.cost_code ?? '',
      desc: line.description,
      qty: line.qty,
    })),
  })

  const handleQtyChange = (lineId: number, value: number | null) => {
    setTypedQty((prev) => ({ ...prev, [lineId]: value ?? 0 }))
    setLineErrors((prev) => {
      if (!prev[lineId]) return prev
      const next = { ...prev }
      delete next[lineId]
      return next
    })
  }

  const filteredLines = useMemo(() => {
    const lines = linesData?.lines ?? []
    return lines.filter((line) => {
      if (matCodeFilter && line.mat_code !== matCodeFilter) return false
      if (costCodeFilter && line.cost_code !== costCodeFilter) return false
      return true
    })
  }, [linesData, matCodeFilter, costCodeFilter])

  const handleLinesSubmit = async () => {
    if (!poId || !linesData || (!creatingNew && !selectedDocId)) return

    // Details form rules first (no new rules added); jump back to the details tab on failure.
    let values: FormValues
    try {
      values = await form.validateFields()
    } catch (e: any) {
      setActiveTab('document')
      message.error('กรุณากรอกรายละเอียดเอกสารให้ครบก่อนบันทึก')
      const firstField = e?.errorFields?.[0]?.name
      if (firstField) setTimeout(() => form.focusField(firstField), 100)
      return
    }

    const payloadLines = linesData.lines
      .map((line) => ({ line_id: line.line_id, receive_qty: typedQty[line.line_id] ?? 0, bal_receive: line.bal_receive }))
      .filter((l) => l.receive_qty > 0)

    if (payloadLines.length === 0) {
      message.warning('กรุณากรอกจำนวนที่ต้องการรับอย่างน้อย 1 รายการ')
      return
    }

    const errors: Record<number, string> = {}
    payloadLines.forEach((l) => {
      if (l.receive_qty > l.bal_receive) {
        errors[l.line_id] = `จำนวนที่รับต้องไม่เกิน ${formatQty(l.bal_receive)}`
      }
    })
    if (Object.keys(errors).length > 0) {
      setLineErrors(errors)
      message.error('มีรายการที่จำนวนรับเกินยอดคงเหลือ กรุณาตรวจสอบ')
      return
    }

    const lines = payloadLines.map(({ line_id, receive_qty }) => ({ line_id, receive_qty }))
    // New document: header + lines (created atomically). Existing draft: id + lines (header ignored).
    const body = creatingNew
      ? {
          header: {
            tax_invoice_no: values.tax_invoice_no || undefined,
            tax_invoice_date: values.tax_invoice_date ? values.tax_invoice_date.format(DATE_FORMAT) : undefined,
            temp_delivery_no: values.temp_delivery_no || undefined,
            temp_delivery_date: values.temp_delivery_date ? values.temp_delivery_date.format(DATE_FORMAT) : undefined,
            remarks: values.remarks || undefined,
          },
          lines,
        }
      : { receive_document_id: selectedDocId, lines }

    setLinesSubmitting(true)
    try {
      const res = await axios.post(`${BASE_URL}/ic/pos/${poId}/receive-lines/submit`, body, { headers: authHeader })
      const responsePayload = res.data?.data ?? res.data
      const receiveNo = responsePayload?.receive_no
      const docId: number = responsePayload?.receive_document_id ?? selectedDocId

      setSelectedDocId(docId)
      setCreatingNew(false)
      const [updatedDoc] = await Promise.all([fetchDocDetail(docId), fetchReadonlyLines(docId)])
      fetchDocsList()

      setSuccessInfo({ receiveNo: receiveNo ?? updatedDoc?.receive_no ?? undefined })
      setRatingDocId(docId)

      // Auto-trigger the rating modal right here — this is the one place a
      // receive-document transitions from unrated to just-saved. Guarded by
      // rated_at so a (theoretically impossible, but defensive) already-rated
      // response doesn't pop the modal anyway.
      // Step 1 is the mandatory rating; only an already-rated document goes straight to step 2.
      setPhase(updatedDoc?.rated_at ? 'success' : 'rating')
    } catch (err: any) {
      const status = err?.response?.status
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message
      if (status === 409 && creatingNew && /empty receive document already exists/i.test(String(serverMsg))) {
        // Don't create duplicates: offer to open the existing empty draft instead.
        const list = await fetchDocsList()
        const draft = list?.documents.find((d) => !d.receive_no)
        AntModal.confirm({
          title: serverMsg,
          content: draft ? 'ต้องการเปิดใบรับที่ยังไม่บันทึกเลขที่ใบนั้นหรือไม่?' : undefined,
          okText: 'เปิดใบรับนั้น',
          cancelText: 'ปิด',
          okButtonProps: draft ? undefined : { style: { display: 'none' } },
          onOk: () => {
            if (draft) handleSelectDocument(draft)
          },
        })
      } else if (status === 409 && !creatingNew && selectedDocId) {
        message.error(serverMsg || 'เอกสารนี้ถูกบันทึกไปแล้ว')
        await fetchDocDetail(selectedDocId)
        await fetchReadonlyLines(selectedDocId)
      } else {
        // Other backend errors shown as-is; all entered values are kept for a retry.
        message.error(extractErrorMessage(err, 'บันทึกไม่สำเร็จ'))
      }
    } finally {
      setLinesSubmitting(false)
    }
  }

  const hasAnyTypedQty = Object.values(typedQty).some((v) => v > 0)

  // The single navigation call for this flow. Guarded so it runs at most once, and never while
  // the mandatory rating is still pending. Falls back to the plain IC project list (never "/").
  const exitToProject = () => {
    if (exitedRef.current || phase === 'rating') return
    exitedRef.current = true
    if (projectCode) goBackToICProject(navigate, projectCode, preparedBy)
    else navigate(IC_PROJECT_LIST_ROUTE, { replace: true })
  }

  useEffect(() => {
    if (open) exitedRef.current = false
  }, [open])

  // Clear any armed print timer/listener on unmount.
  useEffect(() => () => printCleanupRef.current?.(), [])

  // Top-right X ends the whole process (the "← กลับไปที่รายการใบรับของ" link only steps back
  // inside the modal). Confirm first when receive quantities were typed but not saved.
  const handleExit = () => {
    confirmLeaveIfDirty(hasAnyTypedQty && !selectedDoc?.receive_no, exitToProject)
  }

  // Navigation after a save happens ONLY from the success modal: "ปิด", or when printing
  // started from it finishes. The rating modal never navigates.
  const handleSuccessClose = () => {
    setSuccessInfo(null)
    setPhase('idle')
    // phase is still 'success' in this closure, so the 'rating' guard doesn't block.
    exitToProject()
  }

  const handlePrintFromSuccess = () => {
    exitAfterPrintRef.current = true
    handlePrint()
    // handlePrint warns and sets no printData when there is nothing to print; don't get stuck.
    if (!selectedDoc?.receive_no || !readonlyLines || !context) exitAfterPrintRef.current = false
  }

  const handlePrint = () => {
    if (!selectedDoc?.receive_no || !readonlyLines || !context) {
      message.warning('ยังไม่มีข้อมูลการรับสินค้าให้พิมพ์')
      return
    }
    setPrintData(buildPrintData(context, selectedDoc, readonlyLines))
  }

  // Details are editable until the document is received (new document or an empty draft);
  // read-only once it has a receive_no.
  const isReceived = !!selectedDoc?.receive_no
  const headerReadOnly = isReceived

  const vatDisplay =
    context?.use_vat && context.vat_amount != null ? `${formatMoney(context.vat_amount)} บาท` : 'ไม่มีภาษี'

  const creditDisplay =
    context?.credit_days_from_supplier != null ? `${context.credit_days_from_supplier} วัน` : '-'

  // Due date for a new document = (most recently edited of invoice date / temp delivery
  // date) + credit days; falls back to the other field, then to today, when empty.
  const invoiceDateWatch: Dayjs | undefined = Form.useWatch('tax_invoice_date', form)
  const tempDateWatch: Dayjs | undefined = Form.useWatch('temp_delivery_date', form)
  const dueBase: Dayjs | undefined =
    lastDueDateField === 'temp'
      ? tempDateWatch ?? invoiceDateWatch
      : lastDueDateField === 'invoice'
        ? invoiceDateWatch ?? tempDateWatch
        : undefined

  const dueDateDisplay = selectedDoc
    ? (selectedDoc.due_date ? dayjs(selectedDoc.due_date).format(DATE_FORMAT) : '-')
    : (context?.credit_days_from_supplier != null
        ? (dueBase ?? dayjs()).add(context.credit_days_from_supplier, 'day').format(DATE_FORMAT)
        : '-')

  const dueDateExtra = !selectedDoc && context?.credit_days_from_supplier != null
    ? (dueBase
        ? `คำนวณจาก${lastDueDateField === 'temp' ? 'วันที่ใบส่งของชั่วคราว' : 'วันที่ใบกำกับภาษี'}ที่กรอกล่าสุด — ระบบจะยืนยันวันที่จริงเมื่อบันทึกเอกสาร`
        : 'ประมาณการจากวันนี้ — ระบบจะยืนยันวันที่จริงเมื่อบันทึกเอกสาร')
    : undefined

  const documentDetailTab = (
    <Spin spinning={selectedDocLoading || contextLoading}>
      {headerReadOnly && selectedDoc && (
        <Alert
          type="info"
          showIcon
          message={`เอกสารนี้ถูกบันทึกแล้วเมื่อ ${dayjs(selectedDoc.created_at).format('DD/MM/YYYY HH:mm')}`}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}
      <Form form={form} layout="vertical" disabled={headerReadOnly}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="หมายเลข PO">
              <Input value={context?.po_no} disabled readOnly />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="ผู้ขาย">
              <Input value={context?.supplier_name || '-'} disabled readOnly />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="โครงการ / แผนก">
              <Input value={context?.project_name || '-'} disabled readOnly />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="ระบบงาน">
              <Input value={context?.job_code || '-'} disabled readOnly />
            </Form.Item>
          </Col>

          {/* Row 3 */}
          <Col lg={6} sm={12} xs={24}>
            <Form.Item label="เลขที่ใบกำกับภาษี" name="tax_invoice_no">
              <Input placeholder="กรอกเลขที่ใบกำกับภาษี" />
            </Form.Item>
          </Col>
          <Col lg={6} sm={12} xs={24}>
            <Form.Item label="วันที่ใบกำกับภาษี" name="tax_invoice_date">
              <DatePicker
                style={{ width: '100%' }}
                format={DATE_FORMAT}
                onChange={() => setLastDueDateField('invoice')}
              />
            </Form.Item>
          </Col>
          <Col lg={6} sm={12} xs={24}>
            <Form.Item label="ภาษีมูลค่าเพิ่ม">
              <Input value={vatDisplay} disabled readOnly />
            </Form.Item>
          </Col>
          <Col lg={6} sm={12} xs={24}>
            <Form.Item label="วันครบกำหนด" extra={dueDateExtra}>
              <Input value={dueDateDisplay} disabled readOnly />
            </Form.Item>
          </Col>

          {/* Row 4 */}
          <Col lg={6} sm={12} xs={24}>
            <Form.Item label="เลขที่ใบส่งของชั่วคราว" name="temp_delivery_no">
              <Input placeholder="กรอกเลขที่ใบส่งของชั่วคราว (ถ้ามี)" />
            </Form.Item>
          </Col>
          <Col lg={6} sm={12} xs={24}>
            <Form.Item label="วันที่ใบส่งของชั่วคราว" name="temp_delivery_date">
              <DatePicker
                style={{ width: '100%' }}
                format={DATE_FORMAT}
                onChange={() => setLastDueDateField('temp')}
              />
            </Form.Item>
          </Col>
          <Col lg={6} sm={12} xs={24}>
            <Form.Item label="เครดิต">
              <Input value={creditDisplay} disabled readOnly />
            </Form.Item>
          </Col>
          <Col lg={6} sm={12} xs={24}>
            <Form.Item label="สกุลเงิน">
              <Input value={context?.currency} disabled readOnly />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item label="หมายเหตุ" name="remarks">
              <TextArea rows={3} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />
            </Form.Item>
          </Col>
        </Row>

      </Form>
    </Spin>
  )

  const draftItemsColumns = [
    {
      title: 'ลำดับ',
      key: 'index',
      width: 60,
      render: (_: unknown, __: ICReceiveLine, index: number) => index + 1,
    },
    {
      title: 'CostCode',
      dataIndex: 'cost_code',
      key: 'cost_code',
      render: (value: string | null | undefined) => value || '-',
    },
    {
      title: 'MatCode',
      dataIndex: 'mat_code',
      key: 'mat_code',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'PO order',
      dataIndex: 'qty_ordered',
      key: 'qty_ordered',
      align: 'right' as const,
      render: (value: number) => formatQty(value),
    },
    {
      title: 'Receive QTY',
      key: 'receive_qty',
      width: 140,
      render: (_: unknown, record: ICReceiveLine) => (
        <Form.Item
          style={{ marginBottom: 0 }}
          validateStatus={lineErrors[record.line_id] ? 'error' : undefined}
          help={lineErrors[record.line_id]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={record.bal_receive}
            precision={2}
            value={typedQty[record.line_id] ?? 0}
            onChange={(value) => handleQtyChange(record.line_id, value)}
          />
        </Form.Item>
      ),
    },
    {
      title: 'Bal.Receive',
      key: 'bal_receive',
      align: 'right' as const,
      render: (_: unknown, record: ICReceiveLine) => {
        const remaining = record.bal_receive - (typedQty[record.line_id] ?? 0)
        return formatQty(Math.max(remaining, 0))
      },
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
    },
    {
      title: 'ราคาต่อหน่วย',
      dataIndex: 'unit_price',
      key: 'unit_price',
      align: 'right' as const,
      render: (value: number) => formatMoney(value),
    },
  ]

  const readonlyItemsColumns = [
    {
      title: 'ลำดับ',
      key: 'index',
      width: 60,
      render: (_: unknown, __: ICReceiveLineReadonly, index: number) => index + 1,
    },
    {
      title: 'CostCode',
      dataIndex: 'cost_code',
      key: 'cost_code',
      render: (value: string | null | undefined) => value || '-',
    },
    { title: 'MatCode', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
    {
      title: 'ราคาต่อหน่วย',
      dataIndex: 'unit_price',
      key: 'unit_price',
      align: 'right' as const,
      render: (value: number) => formatMoney(value),
    },
    {
      title: 'จำนวนที่รับ',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
      render: (value: number) => formatQty(value),
    },
  ]

  const itemsTab = (
    <Spin spinning={linesLoading || readonlyLinesLoading}>
      {isReceived ? (
        <>
          <Alert
            type="success"
            showIcon
            message={`เอกสารนี้รับสินค้าแล้ว เลขที่ ${selectedDoc?.receive_no}`}
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
          <Table
            rowKey={(record, index) => `${record.mat_code}-${index}`}
            columns={readonlyItemsColumns}
            dataSource={readonlyLines ?? []}
            pagination={false}
            locale={{ emptyText: 'ไม่พบรายการสินค้า' }}
          />
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              พิมพ์ใบรับสินค้า
            </Button>
          </div>
        </>
      ) : (
        <>
          <Space style={{ marginBottom: 16, flexWrap: 'wrap' }} size="middle">
            <Select
              allowClear
              showSearch
              placeholder="ค้นหา MatCode"
              value={matCodeFilter}
              onChange={setMatCodeFilter}
              style={{ width: 220 }}
              options={(linesData?.mat_code_options ?? []).map((code) => ({ value: code, label: code }))}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
            <Select
              allowClear
              showSearch
              placeholder="ค้นหา CostCode"
              value={costCodeFilter}
              onChange={setCostCodeFilter}
              style={{ width: 220 }}
              options={(linesData?.cost_code_options ?? []).map((code) => ({ value: code, label: code }))}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
          </Space>

          <Table
            rowKey="line_id"
            columns={draftItemsColumns}
            dataSource={filteredLines}
            pagination={false}
            locale={{ emptyText: 'ไม่พบรายการสินค้า' }}
          />

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button icon={<PrinterOutlined />} disabled>
                พิมพ์ใบรับสินค้า
              </Button>
              <Button type="primary" loading={linesSubmitting} disabled={!hasAnyTypedQty} onClick={handleLinesSubmit} {...icActionButtonProps('receive', !hasAnyTypedQty || linesSubmitting)}>
                บันทึกเอกสาร
              </Button>
            </Space>
          </div>
        </>
      )}
    </Spin>
  )

  const canOpenItemsTab = !!selectedDocId || creatingNew

  const tabItems = [
    {
      key: 'document',
      label: 'รายละเอียดเอกสาร',
      children: documentDetailTab,
    },
    {
      key: 'items',
      label: 'รายการสินค้า',
      disabled: !canOpenItemsTab,
      children: canOpenItemsTab ? itemsTab : null,
    },
    {
      key: 'attachments',
      label: 'ไฟล์แนบ',
      disabled: true,
      children: <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>ยังไม่พร้อมใช้งาน (Coming soon)</div>,
    },
  ]

  const listColumns = [
    {
      title: 'เลขที่ใบรับ',
      key: 'receive_no',
      render: (_: unknown, r: ICPoReceiveDocListItem) =>
        r.receive_no ? <span>{r.receive_no}</span> : <span style={{ color: '#9ca3af' }}>ยังไม่มีเลขที่</span>,
    },
    { title: 'เลขที่ใบกำกับภาษี', dataIndex: 'tax_invoice_no', key: 'tax_invoice_no' },
    {
      title: 'วันที่ใบกำกับภาษี',
      dataIndex: 'tax_invoice_date',
      key: 'tax_invoice_date',
      render: (v: string | null | undefined) => (v ? dayjs(v).format(DATE_FORMAT) : '-'),
    },
    {
      title: 'วันครบกำหนด',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (v: string | null | undefined) => (v ? dayjs(v).format(DATE_FORMAT) : '-'),
    },
    {
      title: 'วันที่สร้าง',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'จำนวนรายการ',
      dataIndex: 'line_count',
      key: 'line_count',
      align: 'right' as const,
    },
    {
      title: '',
      key: 'action',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, r: ICPoReceiveDocListItem) =>
        r.deletable ? (
          <Popconfirm
            title="ลบใบรับนี้?"
            okText="ลบ"
            cancelText="ยกเลิก"
            onConfirm={(e) => {
              e?.stopPropagation()
              handleDeleteDocument(r.id)
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button
              danger
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        ) : null,
    },
  ]

  const listView = (
    <Spin spinning={docsListLoading}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text type="secondary">
          {docsList ? `คงเหลือที่ต้องรับทั้งหมด: ${formatQty(docsList.remaining_qty_total)}` : ''}
        </Text>
        <Tooltip title={docsList && !docsList.can_create_new ? 'มีใบรับที่ยังไม่บันทึกเลขที่อยู่แล้ว หรือไม่มีจำนวนคงเหลือให้รับ' : undefined}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!docsList?.can_create_new}
            onClick={handleCreateNew}
            {...icActionButtonProps('receive', !docsList?.can_create_new)}
          >
            สร้างใบรับใหม่
          </Button>
        </Tooltip>
      </div>
      <Table
        rowKey="id"
        columns={listColumns}
        dataSource={docsList?.documents ?? []}
        pagination={false}
        locale={{ emptyText: 'ยังไม่มีใบรับของสำหรับ PO นี้' }}
        onRow={(record) => ({
          onClick: () => handleSelectDocument(record),
          style: { cursor: 'pointer' },
        })}
      />
    </Spin>
  )

  const detailView = (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={handleBackToList}
        style={{ paddingLeft: 0, marginBottom: 8 }}
      >
        กลับไปที่รายการใบรับของ
      </Button>
      {/* key remounts Tabs (resets active tab to "document") whenever the
          selected document changes — switching documents, or moving between
          an existing document and the "create new" form, must never carry
          over a stale active tab or the previous document's lines. */}
      <Tabs
        key={selectedDocId ?? 'new'}
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'document' | 'items' | 'attachments')}
        items={tabItems}
      />
    </div>
  )

  return (
    <Modal
      title={view === 'list' ? `ใบรับของ - PO ${context?.po_no ?? ''}` : 'รายละเอียดเอกสาร PO Receive'}
      open={open}
      onCancel={handleExit}
      footer={null}
      width={1152}
      destroyOnHidden
      styles={{ body: { paddingTop: 8 } }}
    >
      {view === 'list' ? listView : detailView}

      {printData && (
        <ICPoReceivePrint
          data={printData}
          onReady={() => {
            let finished = false
            let timer: ReturnType<typeof setTimeout> | undefined
            const cleanup = () => {
              window.removeEventListener('afterprint', finish)
              if (timer) clearTimeout(timer)
              printCleanupRef.current = null
            }
            const finish = () => {
              if (finished) return
              finished = true
              cleanup()
              setPrintData(null)
              if (exitAfterPrintRef.current) {
                exitAfterPrintRef.current = false
                exitToProject()
              }
            }
            printCleanupRef.current = cleanup
            window.addEventListener('afterprint', finish)
            window.print()
            // Fallback so the user is never stuck if 'afterprint' doesn't fire.
            timer = setTimeout(finish, 10000)
          }}
        />
      )}

      <Modal
        title="บันทึกข้อมูลเรียบร้อยแล้ว"
        open={phase === 'success'}
        onCancel={handleSuccessClose}
        footer={[
          <Button key="print" icon={<PrinterOutlined />} onClick={handlePrintFromSuccess}>
            พิมพ์
          </Button>,
          <Button key="close" onClick={handleSuccessClose}>
            ปิด
          </Button>,
        ]}
      >
        {successInfo?.receiveNo && (
          <div>
            <div>เลขที่เอกสาร:</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e3a8a', marginTop: 4 }}>{successInfo.receiveNo}</div>
          </div>
        )}
      </Modal>

      <ICPoReceiveRatingModal
        open={phase === 'rating'}
        poId={poId}
        docId={ratingDocId}
        onClose={() => {}}
        onDone={() => setPhase('success')}
      />
    </Modal>
  )
}

export default ICPoReceiveModal
