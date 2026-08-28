import React, { useState, useRef, useEffect } from 'react'
import {
  Card, Form, Select, DatePicker, Button, Space, message, Row, Col, Input, Modal, Alert, Tooltip,
} from 'antd'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Memo } from '@/types'
import {
  SaveOutlined, SendOutlined, UploadOutlined, CloseCircleFilled, FileOutlined,
  PrinterOutlined, ArrowLeftOutlined, PaperClipOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import axios from 'axios'
import dayjs from 'dayjs'
import { useAppSelector } from '@/store'
import PurchaseOrderPrint, { type POData } from './PurchaseOrderPrint'
import { poApprovalService } from '@/services/poApprovalService'
import { getAvailablePRs } from '@/services/poService'
import POItemsTable from '@/components/common/POItemsTable'
import PRItemSelectionModal from '@/components/common/PRItemSelectionModal'
import TaxSidebarPanel from '@/pages/po/components/TaxSidebarPanel'
import type { PRListItem, PRLineWithPOStatus } from '@/types/pr'
import type { POLineItem } from '@/types/po'
import { PO_WORK_TYPE_LABEL } from '@/types/po'

const MENU_CODE = 'MENU_PO_CREATE'

const formatNumber = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'
// Uploaded files are served as static assets off the API server root, not under
// /api/v1 — strip the versioned API suffix to get the file host (same convention
// PRDetailPage.tsx uses for its attachment download links).

interface AttachedFile {
  uid: string
  name: string
  size: number
  file: File
}

interface SavedAttachment {
  id: string | number
  fileName: string
  filePath: string
  fileSize: number
}

const mapAttachment = (a: any): SavedAttachment => ({
  id: a.id ?? `${a.file_path}-${a.file_name}`,
  fileName: a.file_name ?? a.fileName ?? 'file',
  filePath: a.file_path ?? a.filePath ?? '',
  fileSize: a.file_size ?? a.fileSize ?? 0,
})

interface SupplierOption {
  id: number
  supplier_name: string
}

// POs are always editable regardless of status EXCEPT APPROVED and
// PENDING_REAPPROVAL, which both still require going through
// EditApprovedButton's mandatory-reason modal (PUT /po/:id/edit-approved —
// same endpoint, accepts both starting statuses) rather than the plain edit
// PUT /po/:id. PENDING_REAPPROVAL is itself the result of a prior
// edit-approved save, so re-editing it goes through the same reasoned flow
// again (incrementing revision_round further) rather than falling through
// to the plain-PUT branch, which the backend rejects for this status.
const REASON_REQUIRED_STATUSES = ['APPROVED', 'PENDING_REAPPROVAL']
const LOCKED_STATUSES = REASON_REQUIRED_STATUSES

const POCreatePage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const location = useLocation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const fromMemo: Memo | undefined = (location.state as any)?.memo
  // Set only when arriving from EditApprovedButton's reason modal (detail page
  // or My POs list) — an APPROVED PO is otherwise locked (see LOCKED_STATUSES).
  // A direct nav to /po/:id/edit for an APPROVED PO with no reason stays locked.
  const editApprovedReason: string | undefined = (location.state as any)?.editApprovedReason
  const [form] = Form.useForm()
  // Drives the conditional required-ness of PR Order (required only when
  // order_type = 'cost') — re-renders reactively as the user changes the
  // Select, same pattern as PR's own order_type-driven fields.
  const orderType: 'stock' | 'cost' | undefined = Form.useWatch('order_type', form)
  const [poLoading, setPoLoading] = useState(false)
  const [poStatus, setPoStatus] = useState('')
  const [canEdit, setCanEdit] = useState(true)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Distinguishes a genuine user-initiated PR switch (handlePrChange) from
  // selectedPrId being set programmatically by the edit-mode load effect
  // (because the PO already has a pr_id). Both set selectedPrId and both
  // trigger fetchPrDetail below, but only the former should be allowed to
  // override requestedBy/warehouse_code/project_code/deliveryLocation —
  // otherwise opening an existing PO for edit clobbers its own saved values
  // with its linked PR's current data.
  const isUserPrSwitch = useRef(false)

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [supplierDetailLoading, setSupplierDetailLoading] = useState(false)
  const [users, setUsers] = useState<{ value: number; label: string; dept?: string }[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [approvers, setApprovers] = useState<{ value: number; label: string; dept?: string }[]>([])
  const [approversLoading, setApproversLoading] = useState(false)
  const [prOptions, setPrOptions] = useState<PRListItem[]>([])
  const [prOptionsLoading, setPrOptionsLoading] = useState(false)
  const [prFromEditMode, setPrFromEditMode] = useState<PRListItem | null>(null)
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([])
  const [warehousesLoading, setWarehousesLoading] = useState(false)
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectDetails, setProjectDetails] = useState<Record<string, { projectName: string; budgetAmount?: number; spentAmount?: number; remainingAmount?: number }>>({})
  const [selectedProjectCode, setSelectedProjectCode] = useState<string | null>(null)
  const [items, setItems] = useState<POLineItem[]>([])
  const [selectedPrId, setSelectedPrId] = useState<number | null>(null)
  const [prDetailLoading, setPrDetailLoading] = useState(false)
  // Fields use `null` (never `undefined`) to mean "no value" — Ant Design's
  // form.setFieldsValue silently ignores `undefined` keys (treats them as
  // "leave unchanged"), so an undefined here would leave the previous PR's
  // stale value on screen instead of clearing it. Only `null` actually clears.
  const [prAutoFill, setPrAutoFill] = useState<{
    requestedBy: number | null
    warehouseCode: string | null
    projectCode: string | null
    approverId: number | null
  } | null>(null)
  // Grouped by source doc, matching GET /po/:id's attachments shape
  // ({ po, pr?, memo? } — see PODetail in types/po.ts). `po` is this PO's own
  // uploads (editable/removable, resubmitted on save via existingAttachments
  // semantics elsewhere); `pr`/`memo` are read-only carry-overs from the
  // linked PR/Memo and are only ever displayed, never resubmitted.
  const [savedAttachments, setSavedAttachments] = useState<{
    po: SavedAttachment[]
    pr: SavedAttachment[]
    memo: SavedAttachment[]
  }>({ po: [], pr: [], memo: [] })
  const [prModalOpen, setPrModalOpen] = useState(false)
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Synchronous double-submit guard — `submitting` (state) only flips after
  // form.validateFields() resolves, which is async, so a fast double-click or
  // an Enter-key + click combo can fire handleSubmit twice before the button
  // ever re-renders as disabled. A ref updates synchronously on the first
  // call, so the second concurrent call sees it immediately and no-ops.
  const submittingRef = useRef(false)

  const [taxOpen, setTaxOpen] = useState(false)
  const [useDisc, setUseDisc] = useState(false)
  const [discType, setDiscType] = useState<'pct' | 'amt'>('pct')
  const [useVat, setUseVat] = useState(false)
  const [useWht, setUseWht] = useState(false)

  // Each row now carries its own explicit disc_type (set on load and on
  // add-row), so the header toggle only changes the default applied to
  // NEW rows going forward — it must not retroactively touch existing
  // rows' type or value now that they're independently controlled.
  const handleDiscTypeChange = (v: 'pct' | 'amt') => {
    setDiscType(v)
  }

  const [savedPoId, setSavedPoId] = useState<number | string | null>(id ?? null)
  const [printData, setPrintData] = useState<POData | null>(null)
  const [printing, setPrinting] = useState(false)
  // Read-only preview of the next PO number (not reserved) — create mode only.
  // Empty string means "no hint" (either not fetched yet, or the fetch failed).
  const [nextPoNumber, setNextPoNumber] = useState('')

  useEffect(() => {
    const fetchSuppliers = async () => {
      setSuppliersLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/suppliers`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setSuppliers(list)
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลผู้ขายไม่สำเร็จ'
        )
      } finally {
        setSuppliersLoading(false)
      }
    }
    fetchSuppliers()
  }, [])

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
          value: Number(u.id),
          label: u.full_name ?? u.fullName ?? u.username,
          dept: u.department,
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
        // Role-eligible + extra approvers for PO — same endpoint/pattern as
        // MemoCreateEditPage.tsx's fetchApprovers, just doc_type: 'PO'.
        const res = await axios.get(`${BASE_URL}/master/eligible-approvers`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { doc_type: 'PO' },
        })
        const raw = Array.isArray(res.data)
          ? res.data
          : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        // Endpoint is expected to already return { value, label, dept } — pass
        // through as-is, with a fallback in case a raw user shape slips through
        // (e.g. { id, full_name, department }) until the real response is confirmed.
        // Always coerce to Number — form.setFieldsValue sets `approver` as a
        // Number (Number(raw.approver_id)), and AntD Select matches option
        // `value` against the form value with ===, so a string `u.value` from
        // the API would make the Select render empty even though the
        // underlying form value is technically set.
        setApprovers(list.map((u: any) => ({
          value: Number(u.value ?? u.id),
          label: u.label ?? u.full_name ?? u.fullName ?? u.username,
          dept: u.dept ?? u.department,
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดรายชื่อผู้อนุมัติไม่สำเร็จ')
      } finally {
        setApproversLoading(false)
      }
    }
    fetchApprovers()
  }, [])

  const fetchPRs = async () => {
    setPrOptionsLoading(true)
    try {
      // /po/available-prs already excludes PRs that are fully consumed by an
      // existing PO — server-side equivalent of the old client-side
      // per-line qty_remaining check against /pr/:id/lines-with-po-status.
      const list = await getAvailablePRs()
      setPrOptions(
        list.map((pr) => ({
          id: pr.pr_id,
          pr_no: pr.pr_no,
          status: pr.status as PRListItem['status'],
          requested_by: pr.requested_by_name ?? '',
          approver_name: null,
          location_code: '',
          project_code: null,
          remarks: null,
          pr_date: pr.created_at,
        })),
      )
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดรายการ PR ไม่สำเร็จ'
      )
    } finally {
      setPrOptionsLoading(false)
    }
  }

  useEffect(() => {
    fetchPRs()
  }, [])

  // TEMP DIAGNOSTIC — remove after PR-modal investigation
  useEffect(() => {
    console.log('[prOptions]', prOptions)
  }, [prOptions])

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

  // Read-only preview of the next PO number — create mode only. An existing
  // PO already has its real saved po_no (populated from GET /po/:id below),
  // so this preview would be irrelevant/misleading there.
  useEffect(() => {
    if (isEdit) return
    const fetchNextNumber = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/po/next-number`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        setNextPoNumber(res.data.data.next_number)
      } catch (err: any) {
        // Non-fatal — hide the hint rather than show an error or fall back to
        // stale mock text; the field itself isn't required to show a number.
        setNextPoNumber('')
      }
    }
    fetchNextNumber()
  }, [isEdit])

  useEffect(() => {
    const fetchProjects = async () => {
      setProjectsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/projects`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setProjects(list.map((p: any) => ({
          value: p.project_code,
          label: p.project_code
            ? `${p.project_code} — ${p.project_name ?? p.name ?? ''}`
            : (p.project_name ?? p.name ?? String(p.id)),
        })))
        // GET /master/projects already returns budget_amount / spent_amount /
        // remaining_amount alongside the other project fields — reuse this
        // response for the hover tooltip instead of firing a second request
        // when a project is selected.
        const detailMap: Record<string, { projectName: string; budgetAmount?: number; spentAmount?: number; remainingAmount?: number }> = {}
        list.forEach((p: any) => {
          if (!p.project_code) return
          detailMap[p.project_code] = {
            projectName: p.project_name ?? p.name ?? '',
            budgetAmount: p.budget_amount ?? undefined,
            spentAmount: p.spent_amount ?? undefined,
            remainingAmount: p.remaining_amount ?? undefined,
          }
        })
        setProjectDetails(detailMap)
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดรหัสงานไม่สำเร็จ')
      } finally {
        setProjectsLoading(false)
      }
    }
    fetchProjects()
  }, [])

  // Edit mode: load the existing PO and populate the form/items with it.
  useEffect(() => {
    if (!isEdit || !id) return
    const fetchPo = async () => {
      setPoLoading(true)
      try {
        const res = await poApprovalService.getDetail(accessToken ?? '', id)
        const raw: any = res.data?.data ?? res.data

        // TEMP DIAGNOSTIC — remove after Issue 1 / Issue 2 investigation
        console.log('[POCreatePage] GET /po/:id raw response:', raw)
        console.log('[POCreatePage] raw.approver_id:', raw.approver_id, 'typeof:', typeof raw.approver_id)
        console.log('[POCreatePage] approvers options at this moment:', approvers.length, approvers)
        console.log('[POCreatePage] raw contact fields:', {
          office_phone: raw.office_phone,
          fax: raw.fax,
          sales_person: raw.sales_person,
          contact_email: raw.contact_email,
          contact_phone: raw.contact_phone,
        })

        const status = raw.status ?? ''
        const statusUpper = status.toUpperCase()
        // APPROVED/PENDING_REAPPROVAL are normally locked (LOCKED_STATUSES) —
        // the one exception is arriving here via EditApprovedButton's
        // mandatory-reason modal, which is the only path that can set
        // editApprovedReason.
        const isApprovedEditFlow = REASON_REQUIRED_STATUSES.includes(statusUpper) && Boolean(editApprovedReason)
        setPoStatus(status)
        setCanEdit(!LOCKED_STATUSES.includes(statusUpper) || isApprovedEditFlow)
        setSavedPoId(raw.po_id ?? id)

        form.setFieldsValue({
          poNumber: raw.po_no,
          supplier_code: raw.supplier_id,
          vendorCode: raw.supplier_id,
          requestedBy: raw.requested_by != null ? Number(raw.requested_by) : (raw.requester_id != null ? Number(raw.requester_id) : undefined),
          deliveryLocation: raw.location_text ?? raw.delivery_address ?? undefined,
          warehouse_code: raw.warehouse_code ?? undefined,
          project_code: raw.project_code ?? undefined,
          order_type: raw.order_type ?? 'stock',
          work_type: raw.work_type ?? undefined,
          approver: raw.approver_id != null ? Number(raw.approver_id) : null,
          ref: raw.ref ?? null,
          paymentTerm: raw.payment_terms ?? undefined,
          deliveryDate: raw.expected_date ? dayjs(raw.expected_date) : undefined,
          // Supplier contact fields — populated from the saved PO's own joined
          // supplier data (GET /po/:id), not re-fetched from the supplier list,
          // since the PO may have been saved when the supplier's info differed.
          // `?? null`, not `?? undefined`, per the same Ant Design stale-value
          // fix used for the PR-autofill fields earlier this session.
          phone: raw.office_phone ?? null,
          fax: raw.fax ?? null,
          salesperson: raw.sales_person ?? null,
          email: raw.contact_email ?? null,
          contactPhone: raw.contact_phone ?? null,
        })

        // GET /po/:id doesn't yet join office_phone/fax/sales_person/contact_email/
        // contact_phone from the supplier master (pending backend work), so the
        // fields above are set to null/undefined on load. Trigger the same live
        // supplier lookup used when the user manually picks a supplier from the
        // dropdown — it fetches GET /master/suppliers/{code} and overwrites those
        // 5 fields with the supplier's current contact info. Nothing else resets
        // these fields afterward (unlike requestedBy/warehouse_code/project_code/
        // approver, which have dedicated re-apply effects further down), so this
        // fires once and stays.
        if (raw.supplier_id) {
          handleSupplierChange(raw.supplier_id)
        }

        // TEMP DIAGNOSTIC — remove after Issue 1 / Issue 2 investigation
        console.log('[POCreatePage] approver field set to:', raw.approver_id != null ? Number(raw.approver_id) : null)
        console.log('[POCreatePage] form.getFieldsValue().approver immediately after:', form.getFieldsValue().approver)

        setPrAutoFill({
          requestedBy: raw.requested_by != null ? Number(raw.requested_by) : (raw.requester_id != null ? Number(raw.requester_id) : null),
          warehouseCode: raw.warehouse_code ?? null,
          projectCode: raw.project_code ?? null,
          approverId: raw.approver_id != null ? Number(raw.approver_id) : null,
        })
        setSelectedProjectCode(raw.project_code ?? null)

        // pr_id links this PO back to the PR it was created from — select it in
        // the PR Order dropdown. That dropdown's options are filtered to
        // status=COMPLETED PRs only, so a PR this PO already consumed may no
        // longer qualify and would be missing from prOptions. Keep it as separate
        // state (not merged into prOptions) — the real prOptions fetch runs as its
        // own effect and overwrites the array wholesale when it resolves, which
        // would silently wipe a synthetic entry injected directly into it.
        if (raw.pr_id != null) {
          const prId = Number(raw.pr_id)
          setSelectedPrId(prId)
          form.setFieldValue('prOrder', prId)
          setPrFromEditMode({
            id: prId,
            pr_no: raw.pr_no ?? `PR #${prId}`,
            pr_date: raw.pr_date ?? '',
            status: 'COMPLETED',
          } as PRListItem)
        }

        // GET /po/:id (already fetched above via poApprovalService.getDetail)
        // embeds attachments grouped by source doc: { po, pr?, memo? } — see
        // PODetail in types/po.ts. Read straight off `raw.attachments`
        // instead of the old separate GET /po/:id/attachments call, which
        // only ever queried po_attachment and so could never show PR/Memo
        // carry-over files.
        setSavedAttachments({
          po: (raw.attachments?.po ?? []).map(mapAttachment),
          pr: (raw.attachments?.pr ?? []).map(mapAttachment),
          memo: (raw.attachments?.memo ?? []).map(mapAttachment),
        })

        setRemark(raw.remarks ?? '')
        setUseDisc(Boolean(raw.use_discount))
        setDiscType(raw.discount_type === 'amt' ? 'amt' : 'pct')
        setUseVat(Boolean(raw.use_vat))
        setUseWht(Boolean(raw.use_wht))

        const lines = raw.lines ?? []
        setItems(
          lines.map((l: any, idx: number) => ({
            key: `po-line-${l.id ?? idx}`,
            no: idx + 1,
            pr_line_id: l.pr_line_id ?? null,
            mat_code: l.mat_code ?? '',
            mat_name: l.mat_name ?? '',
            unit_name: l.unit_name ?? '',
            qty: l.qty_ordered ?? 0,
            unit_price: l.unit_price ?? 0,
            is_from_pr: l.pr_line_id != null,
            description: l.remarks ?? undefined,
            disc: l.discount ?? undefined,
            // Fall back to the header's global type only for legacy rows saved
            // before per-line disc_type existed — never overwrite a row that
            // already has its own explicit type.
            disc_type: l.disc_type ?? (raw.discount_type === 'amt' ? 'amt' : 'pct'),
            wht_rate: l.wht_rate ?? undefined,
          }))
        )
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูล PO ไม่สำเร็จ'
        )
      } finally {
        setPoLoading(false)
      }
    }
    fetchPo()
  }, [isEdit, id])

  // Live prefill: when a PR is selected, pull requested_by / warehouse_code /
  // project_code / location straight from that PR so the on-screen form reflects
  // it immediately — not just after the PO is saved (server-side auto-fill only
  // affects the persisted record, not what the user sees while still editing).
  useEffect(() => {
    if (!selectedPrId) {
      // PR cleared (handlePrChange's applyChange(null)) — drop its carried-
      // over pr/memo attachment groups so a removed PR's files don't linger
      // in the grouped attachments UI. The PO's own `po` group is untouched.
      setSavedAttachments((prev) => (
        prev.pr.length === 0 && prev.memo.length === 0 ? prev : { ...prev, pr: [], memo: [] }
      ))
      return
    }
    let cancelled = false
    const fetchPrDetail = async () => {
      setPrDetailLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/pr/${selectedPrId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const raw = res.data?.data ?? res.data
        if (cancelled || !raw) return

        // Show this PR's (and its linked Memo's) attachments in the grouped
        // attachments UI immediately — before the PO itself is ever saved.
        // GET /pr/:id returns attachments in the same { pr: [...], memo:
        // [...] } shape as GET /po/:id (see PRDetailPage.tsx's identical
        // convention). Runs regardless of isUserPrSwitch below: whether this
        // PR was just picked by the user or was already linked to the PO
        // being edited, its attachments are correct to show either way —
        // only the requestedBy/warehouse/project/location auto-fill below is
        // restricted to genuine user-initiated switches. The PO's own `po`
        // group (set by fetchPo above) is left untouched.
        setSavedAttachments((prev) => ({
          ...prev,
          pr: (raw.attachments?.pr ?? []).map(mapAttachment),
          memo: (raw.attachments?.memo ?? []).map(mapAttachment),
        }))

        // Only a genuine user-initiated PR switch (handlePrChange) should
        // override the form's requestedBy/warehouse_code/project_code/
        // deliveryLocation with this PR's data. selectedPrId is also set
        // programmatically by the edit-mode load effect when the PO already
        // has a pr_id — in that case the PO's own saved values (already
        // populated by that same effect) must NOT be clobbered by whatever
        // the linked PR currently has.
        if (!isUserPrSwitch.current) {
          return
        }

        // `requested_by` on the PR detail response is the display name (string);
        // the numeric FK is `requester_id` — Number()'ing the name string is what
        // produced "NaN" in the ผู้ขอซื้อ field.
        const requestedById = raw.requester_id != null ? Number(raw.requester_id) : null
        // `?? null`, not `?? undefined` — Ant Design's setFieldsValue silently
        // ignores an undefined value (treated as "leave unchanged"), so a
        // missing field on the new PR would leave the OLD PR's value on
        // screen instead of clearing it. Only null actually clears a field.
        // Fall back to *_id variants in case this PR detail response ever uses
        // the numeric FK name instead of the code — the warehouse_code/
        // project_code Selects on this form are keyed by code either way, so
        // an *_id fallback value still round-trips correctly as long as the
        // options list's `value` uses the same string.
        const warehouseCode = raw.warehouse_code ?? raw.warehouse_id ?? null
        const projectCode = raw.project_code ?? raw.project_id ?? null
        const deliveryLocation = raw.location_text ?? null
        form.setFieldsValue({
          requestedBy: requestedById,
          warehouse_code: warehouseCode,
          project_code: projectCode,
          deliveryLocation: deliveryLocation,
        })
        // Options for these three Selects load asynchronously and may not be
        // populated yet when this fires — re-apply once each options list arrives
        // so the value doesn't render blank waiting on a race with its own fetch.
        setPrAutoFill((prev) => ({
          requestedBy: requestedById,
          warehouseCode,
          projectCode,
          approverId: prev?.approverId ?? null,
        }))
        setSelectedProjectCode(projectCode)
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูล PR สำหรับ auto-fill ไม่สำเร็จ')
      } finally {
        if (!cancelled) setPrDetailLoading(false)
        // Consume the flag once this effect run has finished handling (or
        // deliberately skipping) the override, regardless of which branch —
        // so the next fetchPrDetail run defaults back to "not a user switch"
        // unless handlePrChange sets it again.
        isUserPrSwitch.current = false
      }
    }
    fetchPrDetail()
    return () => { cancelled = true }
  }, [selectedPrId])

  useEffect(() => {
    if (!prAutoFill || warehouses.length === 0) return
    form.setFieldValue('warehouse_code', prAutoFill.warehouseCode)
  }, [warehouses, prAutoFill])

  useEffect(() => {
    if (!prAutoFill || users.length === 0) return
    form.setFieldValue('requestedBy', prAutoFill.requestedBy)
  }, [users, prAutoFill])

  useEffect(() => {
    if (!prAutoFill || approvers.length === 0) return
    // TEMP DIAGNOSTIC — remove after Issue 1 investigation
    console.log('[POCreatePage] reapplying approver — prAutoFill.approverId:', prAutoFill.approverId, typeof prAutoFill.approverId)
    console.log('[POCreatePage] approvers options value types:', approvers.map((a) => ({ value: a.value, type: typeof a.value })))
    form.setFieldValue('approver', prAutoFill.approverId)
    console.log('[POCreatePage] form.getFieldsValue().approver after reapply:', form.getFieldsValue().approver)
  }, [approvers, prAutoFill])

  useEffect(() => {
    if (!prAutoFill || projects.length === 0) return
    form.setFieldValue('project_code', prAutoFill.projectCode)
  }, [projects, prAutoFill])

  useEffect(() => {
    if (!fromMemo) return
    setItems(
      fromMemo.items.map((it, idx) => ({
        key: `from-memo-${it.id}`,
        no: idx + 1,
        pr_line_id: null,
        mat_code: '',
        mat_name: it.description,
        unit_name: it.unit,
        qty: it.quantity,
        unit_price: it.estimatedPrice,
        is_from_pr: false,
        description: it.remark ?? '',
      }))
    )
    setRemark(`[อ้างอิง Memo: ${fromMemo.memoNo}] ${fromMemo.note ?? ''}`.trim())
  }, [fromMemo])

  useEffect(() => {
    if (!fromMemo || !fromMemo.supplierName || suppliers.length === 0) return
    const matched = suppliers.find((s) => s.supplier_name === fromMemo.supplierName)
    if (matched) {
      form.setFieldsValue({ supplier_code: matched.id, vendorCode: matched.id })
    }
  }, [fromMemo, suppliers])

  const prLocked = items.some((i) => i.is_from_pr)
  const existingPrLineIds = items
    .filter((i) => i.is_from_pr && i.pr_line_id != null)
    .map((i) => i.pr_line_id as number)

  const handlePrChange = (newPrId: number | undefined) => {
    const prevPrId = selectedPrId
    // TEMP DIAGNOSTIC — remove after PR-modal investigation
    console.log('[POCreatePage] handlePrChange fired — newPrId:', newPrId, 'prevPrId:', prevPrId, 'items.length:', items.length)
    // The confirm dialog below promises to clear ALL selected items
    // ("ล้างรายการวัสดุที่เลือกไว้ทั้งหมด"), not just PR-linked ones — so the
    // gate for showing it, and the clear itself, must cover every row,
    // including manually-added ones (is_from_pr: false) from POItemsTable's
    // "เลือกจากรายการวัสดุ" picker. A selective is_from_pr-only clear left
    // manually-added rows behind while new PR-linked rows were appended on
    // top, producing old+new rows coexisting in the table.
    const hasItems = items.length > 0

    const applyChange = (id: number | null) => {
      console.log('[POCreatePage] applyChange — setting selectedPrId:', id, 'and opening modal:', Boolean(id))
      isUserPrSwitch.current = true
      setSelectedPrId(id)
      setItems([])
      if (id) setPrModalOpen(true)
    }

    // Switching to a genuinely different PR while any items are already in
    // the table is destructive — confirm before wiping them.
    if (prevPrId && newPrId && newPrId !== prevPrId && hasItems) {
      console.log('[POCreatePage] showing confirm dialog before switching PR')
      Modal.confirm({
        title: 'เปลี่ยน PR',
        content: 'เปลี่ยน PR จะล้างรายการวัสดุที่เลือกไว้ทั้งหมด ต้องการดำเนินการต่อหรือไม่?',
        okText: 'ดำเนินการต่อ',
        cancelText: 'ยกเลิก',
        onOk: () => applyChange(newPrId),
        onCancel: () => {
          // revert the Select's displayed value back to the previous PR
          form.setFieldsValue({ prOrder: prevPrId })
        },
      })
      return
    }

    applyChange(newPrId ?? null)
  }

  // Fires on every option click, even re-selecting the same PR. Only reopens the
  // modal for that same-PR reselect case — switching to a different PR is handled
  // entirely by handlePrChange above (confirmation + clearing items).
  const handlePrSelect = (prId: number) => {
    // TEMP DIAGNOSTIC — remove after PR-modal investigation
    console.log('[POCreatePage] handlePrSelect (onSelect) fired — prId:', prId, 'selectedPrId:', selectedPrId)
    if (prId === selectedPrId) {
      setPrModalOpen(true)
    }
  }

  // Auto-fill contact fields when a supplier is selected — fields stay fully
  // editable afterward (plain <Input>, never disabled); the user can type
  // over any auto-filled value. The list endpoint (/master/suppliers) isn't
  // guaranteed to carry these contact fields, so fetch the single-supplier
  // detail endpoint (typed as SupplierFull, confirmed to include them) rather
  // than assume the already-loaded list has them.
  const handleSupplierChange = async (id: number) => {
    form.setFieldsValue({ vendorCode: id })
    if (!id) return
    setSupplierDetailLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/suppliers/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const raw = res.data?.data ?? res.data
      console.log('[supplier-debug] raw response:', raw)
      // `?? null`, not `?? undefined` — Ant Design's setFieldsValue silently
      // ignores undefined (treated as "leave unchanged"), which would leave a
      // previously-selected supplier's stale contact info on screen instead
      // of clearing it for a supplier that has no value for that field.
      form.setFieldsValue({
        phone: raw?.office_phone ?? null,
        fax: raw?.fax ?? null,
        salesperson: raw?.sales_person ?? null,
        email: raw?.contact_email ?? null,
        contactPhone: raw?.contact_phone ?? null,
        paymentTerm: raw?.payment_terms ?? null,
      })
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลผู้ขายไม่สำเร็จ'
      )
    } finally {
      setSupplierDetailLoading(false)
    }
  }

  const handlePrItemsConfirm = (lines: PRLineWithPOStatus[]) => {
    setPrModalOpen(false)
    if (lines.length === 0) return
    setItems((prev) => {
      const existingLineIds = new Set(prev.map((i) => i.pr_line_id))
      const newLines = lines.filter((l) => !existingLineIds.has(l.id))
      const combined = [
        ...prev,
        ...newLines.map((l) => ({
          key: `pr-${l.id}`,
          no: 0,
          pr_line_id: l.id,
          mat_code: l.mat_code,
          mat_name: l.mat_name,
          unit_name: l.unit,
          qty: l.qty_remaining,
          unit_price: l.selected_unit_price ?? 0,
          is_from_pr: true,
          pr_qty_remaining: l.qty_remaining,
        })),
      ]
      return combined.map((item, idx) => ({ ...item, no: idx + 1 }))
    })
  }

  const total = items.reduce((sum, i) => sum + i.qty * i.unit_price, 0)

  const validateItems = () => {
    if (items.length === 0) {
      message.warning('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ')
      return false
    }
    const invalid = items.some((i) => !i.mat_code || i.qty <= 0 || i.unit_price <= 0)
    if (invalid) {
      message.warning('กรุณากรอกรหัสวัสดุ จำนวน และราคาต่อหน่วยให้ถูกต้อง (มากกว่า 0) ทุกรายการ')
      return false
    }
    const overRemaining = items.find((i) => i.pr_qty_remaining != null && i.qty > i.pr_qty_remaining)
    if (overRemaining) {
      message.error(
        `จำนวนที่สั่ง (${overRemaining.qty}) เกินคงเหลือที่สั่งได้ (${overRemaining.pr_qty_remaining}) สำหรับ ${overRemaining.mat_code}`
      )
      return false
    }
    return true
  }

  // status is omitted entirely (not just left undefined in the payload
  // object — the key itself must not be present) when editing a PO that's
  // already PENDING_APPROVAL: the backend now defaults to the PO's current
  // status when `status` is absent from PUT /po/:id, so omitting it here
  // keeps the PO at PENDING_APPROVAL. Explicitly sending 'DRAFT' (the plain
  // create-mode "บันทึกร่าง" button) would otherwise wrongly demote it back
  // to DRAFT — this is the bug this whole change guards against.
  const handleSubmit = async (status?: 'DRAFT' | 'PENDING_APPROVAL') => {
    // Guard first, synchronously — see submittingRef declaration for why this
    // can't just rely on the `submitting` state / disabled button prop.
    if (submittingRef.current) return
    submittingRef.current = true

    if (isEdit && !canEdit) {
      message.warning('ไม่สามารถแก้ไขใบสั่งซื้อนี้ได้')
      submittingRef.current = false
      return
    }
    if (!validateItems()) {
      submittingRef.current = false
      return
    }

    try {
      await form.validateFields()
    } catch (err: any) {
      const firstField = err?.errorFields?.[0]
      message.error(firstField?.errors?.[0] || 'กรุณากรอกข้อมูลให้ครบถ้วนก่อนบันทึก')
      if (firstField?.name) {
        form.scrollToField(firstField.name, { behavior: 'smooth', block: 'center' })
      }
      submittingRef.current = false
      return
    }

    const values = form.getFieldsValue()
    if (!values.supplier_code) {
      message.warning('กรุณาเลือกผู้ขาย (Supplier)')
      submittingRef.current = false
      return
    }

    const doSubmit = async () => {
      setSubmitting(true)
      try {
        // Upload newly-added files first (POST /upload/po just stores the file
        // and hands back its path/size/type — it does not attach it to a PO).
        // Already-saved attachments (edit mode) are left alone entirely; they
        // were persisted via their own POST /po/:id/attachments call already.
        const uploadedFiles: { file_path: string; file_name: string; file_size: number; file_type: string }[] = []
        for (const f of attachedFiles) {
          const formData = new FormData()
          formData.append('file', f.file)
          const uploadRes = await axios.post(`${BASE_URL}/upload/po`, formData, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'multipart/form-data',
            },
          })
          const d = uploadRes.data?.data ?? uploadRes.data
          uploadedFiles.push({
            file_path: d.file_path,
            file_name: d.file_name,
            file_size: d.file_size,
            file_type: d.file_type,
          })
        }

        const payload = {
          // ── Header ──
          supplier_id: values.supplier_code,
          location_text: values.deliveryLocation,
          warehouse_code: values.warehouse_code || undefined,
          project_code: values.project_code || undefined,
          order_type: values.order_type || undefined,
          work_type: values.work_type || undefined,
          requested_by: values.requestedBy ?? undefined,
          approver_id: values.approver ?? undefined,
          ref: values.ref || undefined,
          pr_id: selectedPrId ?? null,
          rfq_id: null,
          currency: 'THB',
          expected_date: values.deliveryDate
            ? values.deliveryDate.format('YYYY-MM-DD')
            : undefined,
          payment_terms: values.paymentTerm ?? undefined,
          remarks: remark || undefined,
          // Omit the key entirely when status is undefined (PENDING_APPROVAL
          // in-place edit) — sending `status: undefined` would still leave
          // the key present after JSON.stringify drops it, which is fine for
          // axios/fetch, but building the object this way keeps the intent
          // explicit rather than relying on that serialization detail.
          ...(status ? { status } : {}),

          // NOTE: office_phone/fax/sales_person/contact_email/contact_phone are
          // deliberately NOT sent — purchase_order no longer stores these.
          // GET /po/:id now live-joins them from the supplier master via
          // supplier_code, so the form fields (phone/fax/salesperson/email/
          // contactPhone) are still shown for display/auto-fill (handleSupplierChange,
          // edit-mode population) but are never part of the save payload.

          // ── Tax (flat — not nested) ──
          use_discount: useDisc,
          discount_type: discType,
          use_vat: useVat,
          use_wht: useWht,

          // ── Lines ──
          lines: items.map((item, i) => ({
            line_no: i + 1,
            mat_code: item.mat_code,
            pr_line_id: item.pr_line_id ?? null,
            qty_ordered: item.qty,
            unit_price: item.unit_price,
            discount: item.disc ?? 0,
            disc_type: item.disc_type ?? discType,
            wht_rate: useWht ? (item.wht_rate ?? 3) : null,
            description: item.description ?? undefined,
          })),

          // NOTE: CreatePORequest (the same struct both POST /po and PUT /po/:id
          // take) has no `attachments` field — unlike PR/Memo, PO attachments
          // are not part of this payload at all. Sending one here would be
          // silently ignored by the backend, which is exactly the bug this
          // fixes. Attachments are saved via their own POST /po/:id/attachments
          // call below, once the PO id is known.
        }

        // Editing an APPROVED or PENDING_REAPPROVAL PO (arrived via
        // EditApprovedButton's reason modal either way) goes through the
        // dedicated edit-approved endpoint with the mandatory reason, not the
        // plain PUT /po/:id — that endpoint only accepts DRAFT/PENDING_APPROVAL
        // as its starting status and 400s on PENDING_REAPPROVAL, which is
        // exactly the bug this fixes: this condition previously checked
        // === 'APPROVED' only, so a PENDING_REAPPROVAL edit fell through to
        // the plain-PUT branch below and failed backend validation.
        const isApprovedEditFlow = REASON_REQUIRED_STATUSES.includes(poStatus.toUpperCase()) && Boolean(editApprovedReason)

        const res = isApprovedEditFlow
          ? await axios.put(
              `${BASE_URL}/po/${id}/edit-approved`,
              { ...payload, reason: editApprovedReason },
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )
          : isEdit
          ? await axios.put(
              `${BASE_URL}/po/${id}`,
              payload,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )
          : await axios.post(
              `${BASE_URL}/po`,
              payload,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )

        let poId: number | string | null = null
        if (isEdit) {
          poId = id ?? null
          setSavedPoId(poId)
          message.success(
            status === 'DRAFT'
              ? 'บันทึกการแก้ไข PO สำเร็จ'
              : status === 'PENDING_APPROVAL'
              ? 'แก้ไขและส่งใบสั่งซื้อเรียบร้อยแล้ว'
              : 'บันทึกการแก้ไข PO สำเร็จ'
          )
        } else {
          poId = res.data?.data?.po_id ?? res.data?.data?.po?.po_id ?? res.data?.po_id ?? res.data?.po?.po_id ?? null
          if (poId) {
            setSavedPoId(poId)
            // Move the route from /po/create to /po/:id/edit now that the PO
            // exists — without this, `id` (from useParams) stays undefined,
            // so isEdit stays false forever on this mount: a refresh would
            // lose the form back to a blank create page, and clicking
            // "บันทึกร่าง" again would POST a duplicate PO instead of
            // PUT-ing this one.
            navigate(`/po/${poId}/edit`, { replace: true })
          } else {
            // Save succeeded (2xx) but the response didn't carry a usable id —
            // don't leave savedPoId silently unset with no trace of why.
            console.warn('POST /po succeeded but no id found in response:', res.data)
          }
          message.success(status === 'DRAFT' ? 'บันทึกร่าง PO สำเร็จ' : 'ส่งใบสั่งซื้อเรียบร้อยแล้ว')
        }

        // Attach each newly-uploaded file to the PO now that it has an id —
        // POST /upload/po only stores the file; it takes a separate
        // POST /po/:id/attachments call to link it to this PO.
        if (uploadedFiles.length > 0 && poId) {
          const newlyAttached: SavedAttachment[] = []
          for (const f of uploadedFiles) {
            try {
              const attachRes = await axios.post(
                `${BASE_URL}/po/${poId}/attachments`,
                { file_name: f.file_name, file_path: f.file_path, file_size: f.file_size, file_type: f.file_type },
                { headers: { Authorization: `Bearer ${accessToken}` } }
              )
              const saved = attachRes.data?.data ?? attachRes.data
              newlyAttached.push({
                id: saved?.id ?? `${f.file_path}-${f.file_name}`,
                fileName: f.file_name,
                filePath: f.file_path,
                fileSize: f.file_size,
              })
            } catch (attachErr: any) {
              message.warning(
                `แนบไฟล์ ${f.file_name} ไม่สำเร็จ: ` +
                (attachErr?.response?.data?.message || attachErr?.message || 'unknown error')
              )
            }
          }
          if (newlyAttached.length > 0) {
            setSavedAttachments((prev) => ({ ...prev, po: [...prev.po, ...newlyAttached] }))
            setAttachedFiles((prev) => prev.filter((f) => !uploadedFiles.some((u) => u.file_name === f.name)))
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 409) {
          message.error('PR นี้ถูกสร้าง PO ไปแล้ว กรุณาเลือก PR ใหม่')
          fetchPRs()
        } else if (err?.response?.status === 400) {
          // Covers a race between when the PR picker loaded qty_remaining and
          // when this PO is submitted (e.g. another PO consumed the remaining
          // qty in the meantime) — surface the backend's exact message rather
          // than a generic one so the user knows to re-check the PR line.
          message.error(
            err?.response?.data?.message || err?.response?.data?.error || 'จำนวนที่สั่งไม่ถูกต้อง กรุณาตรวจสอบคงเหลือที่สั่งได้ของ PR อีกครั้ง'
          )
        } else {
          message.error(
            err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึก PO ไม่สำเร็จ'
          )
        }
      } finally {
        setSubmitting(false)
        submittingRef.current = false
      }
    }

    if (status === 'PENDING_APPROVAL') {
      const supplierLabel = suppliers.find((s) => s.id === values.supplier_code)?.supplier_name
      Modal.confirm({
        title: 'ยืนยันการส่งใบสั่งซื้อ',
        content: (
          <div>
            <div>ผู้ขาย: {supplierLabel ?? '-'}</div>
            <div>จำนวนรายการ: {items.length}</div>
            <div>มูลค่ารวม: ฿ {total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
          </div>
        ),
        // Modal.confirm doesn't run doSubmit (and therefore never resets the
        // ref) unless the user clicks ยืนยันส่ง — clear it on cancel/close too,
        // otherwise a cancelled confirm permanently locks out further submits.
        onCancel: () => { submittingRef.current = false },
        okText: 'ยืนยันส่ง',
        cancelText: 'ยกเลิก',
        onOk: doSubmit,
      })
    } else {
      doSubmit()
    }
  }


  const handlePrint = async () => {
    if (!savedPoId) {
      message.warning('กรุณาบันทึกร่าง PO ก่อนพิมพ์')
      return
    }
    setPrinting(true)
    try {
      const res = await poApprovalService.getPrintData(accessToken ?? '', savedPoId)
      // Watermark trust source: the print-data endpoint's own status field
      // isn't guaranteed present, but `poStatus` (this page's own tracked
      // status, set on edit-load) is already known-good — merge it in
      // explicitly. Note: on a brand-new PO's first save+print in the same
      // session, poStatus is still '' (only ever set via edit-load fetch),
      // so the watermark won't show even though the record is really DRAFT
      // — pre-existing gap in this page's state tracking, out of scope here.
      setPrintData({ ...res.data.data, status: poStatus })
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลสำหรับพิมพ์ไม่สำเร็จ'
      )
    } finally {
      setPrinting(false)
    }
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const newFiles: AttachedFile[] = Array.from(files).map((f) => ({
      uid: `${Date.now()}-${Math.random()}`,
      name: f.name,
      size: f.size,
      file: f,
    }))
    setAttachedFiles((prev) => [...prev, ...newFiles])
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

  const cardStyle: React.CSSProperties = {
    borderRadius: 12,
    border: 'none',
    boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  }

  const cardTitleStyle: React.CSSProperties = {
    color: '#1e3a8a',
    fontWeight: 600,
  }

  const labelStyle: React.CSSProperties = {
    color: '#374151',
    fontSize: 13,
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'แก้ไขใบสั่งซื้อ (PO)' : 'ออกใบสั่งซื้อ (PO)'}
        subtitle="สร้างใบสั่งซื้อสินค้า/บริการเพื่อส่งอนุมัติ"
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'ใบสั่งซื้อ' },
          { title: isEdit ? 'แก้ไขใบสั่งซื้อ' : 'สร้างใบสั่งซื้อ' },
        ]}
      />

      {isEdit && !canEdit && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message={`ใบสั่งซื้อนี้อนุมัติแล้ว — แก้ไขได้ผ่านปุ่ม "แก้ไข" ในหน้ารายละเอียดเท่านั้น (ต้องระบุเหตุผล)`}
        />
      )}

      {isEdit && canEdit && REASON_REQUIRED_STATUSES.includes(poStatus.toUpperCase()) && editApprovedReason && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message={
            poStatus.toUpperCase() === 'PENDING_REAPPROVAL'
              ? 'กำลังแก้ไขใบสั่งซื้อที่รออนุมัติอีกครั้ง'
              : 'กำลังแก้ไขใบสั่งซื้อที่อนุมัติแล้ว'
          }
          description={`เหตุผลในการแก้ไข: ${editApprovedReason}`}
        />
      )}

      {fromMemo && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message={`กำลังสร้าง PO จากใบบันทึกขอซื้อ (Memo): ${fromMemo.memoNo} — ${fromMemo.title}`}
          description="ข้อมูลถูก pre-fill จากใบบันทึกขอซื้อ (Memo) แล้ว สามารถแก้ไขได้ก่อนบันทึก"
        />
      )}

      <Row gutter={[16, 16]}>

        {/* ── Main Info Card ── */}
        <Col span={24}>
          <Card
            title={<span style={cardTitleStyle}>ข้อมูลใบสั่งซื้อ</span>}
            style={cardStyle}
            loading={poLoading}
          >
            <Form form={form} layout="vertical" disabled={isEdit && !canEdit}>
              {/* Supplier contact fields (sales_person/contact_email/contact_phone/
                  office_phone/fax) are display-only removed on all PO screens — they're
                  live-joined from the supplier master and only meant to appear on the
                  printed PO. Kept registered (hidden) so submit payload / print data
                  building still has access to the values. */}
              <Form.Item name="salesperson" hidden><Input /></Form.Item>
              <Form.Item name="contactPhone" hidden><Input /></Form.Item>
              <Form.Item name="phone" hidden><Input /></Form.Item>
              <Form.Item name="email" hidden><Input /></Form.Item>
              <Row gutter={[40, 0]}>

                {/* ── Left column: PO identity + supplier/contact info ── */}
                <Col xs={24} lg={12}>
                  <Row gutter={16}>

                    {/* PO Number */}
                    <Col xs={24}>
                      <Form.Item
                        label={
                          <span style={{ ...labelStyle, color: '#cc0000', fontWeight: 600 }}>
                            หมายเลข PO
                          </span>
                        }
                        name="poNumber"
                      >
                        <Input
                          disabled={isEdit}
                          style={{ color: '#cc0000', fontWeight: 600 }}
                          prefix={
                            !isEdit && nextPoNumber ? (
                              <span style={{ fontSize: 11, color: '#6b7280', marginRight: 4 }}>
                                ล่าสุด: <span style={{ color: '#cc0000' }}>{nextPoNumber}</span>
                              </span>
                            ) : undefined
                          }
                        />
                      </Form.Item>
                    </Col>

                    {/* โครงการ */}
                    <Col xs={24}>
                      {/* Tooltip must wrap the whole Form.Item, not sit between
                          Form.Item and Select — Form.Item clones its single direct
                          child to inject `value`/`onChange`, so if Tooltip were
                          that direct child, the injected value would land on
                          Tooltip (which ignores it) and Select would never
                          display the selected project. */}
                      <Tooltip
                        placement="right"
                        title={
                          selectedProjectCode && projectDetails[selectedProjectCode] ? (
                            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                              <div>
                                <span style={{ color: '#aaa' }}>โครงการ: </span>
                                <span style={{ fontWeight: 600 }}>
                                  {projectDetails[selectedProjectCode].projectName}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: '#aaa' }}>รหัสโครงการ: </span>
                                <span style={{ fontWeight: 600 }}>{selectedProjectCode}</span>
                              </div>
                              {projectDetails[selectedProjectCode].budgetAmount !== undefined && (
                                <div>
                                  <span style={{ color: '#aaa' }}>งบประมาณ: </span>
                                  <span style={{ fontWeight: 600 }}>
                                    {formatNumber(projectDetails[selectedProjectCode].budgetAmount!)} บาท
                                  </span>
                                </div>
                              )}
                              {projectDetails[selectedProjectCode].spentAmount !== undefined && (
                                <div>
                                  <span style={{ color: '#aaa' }}>ยอดใช้จ่ายไปแล้ว: </span>
                                  <span style={{ fontWeight: 600 }}>
                                    {formatNumber(projectDetails[selectedProjectCode].spentAmount!)} บาท
                                  </span>
                                </div>
                              )}
                              {projectDetails[selectedProjectCode].remainingAmount !== undefined && (
                                <div>
                                  <span style={{ color: '#aaa' }}>คงเหลือ: </span>
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      color: projectDetails[selectedProjectCode].remainingAmount! < 0 ? '#dc2626' : undefined,
                                    }}
                                  >
                                    {formatNumber(projectDetails[selectedProjectCode].remainingAmount!)} บาท
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : null
                        }
                      >
                        <Form.Item
                          label={<span style={labelStyle}>โครงการ</span>}
                          name="project_code"
                        >
                          <Select
                            placeholder="- เลือกรายการ -"
                            loading={projectsLoading || prDetailLoading}
                            showSearch
                            allowClear
                            // Locked once a PR is linked — the project comes from that
                            // PR and must stay in sync with it; clearing the PR
                            // (selectedPrId back to null) unlocks it again.
                            disabled={Boolean(selectedPrId)}
                            filterOption={(input, option) =>
                              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={projects}
                            onChange={(val) => setSelectedProjectCode(val ?? null)}
                          />
                        </Form.Item>
                      </Tooltip>
                    </Col>

                    {/* ผู้ขอซื้อ */}
                    <Col xs={24}>
                      <Form.Item
                        label={
                          <span style={labelStyle}>
                            ผู้ขอซื้อ {prDetailLoading && <span style={{ color: '#60a5fa', fontSize: 11 }}>(กำลังดึงจาก PR...)</span>}
                          </span>
                        }
                        name="requestedBy"
                        rules={[{ required: true, message: 'กรุณาเลือกผู้ขอซื้อ' }]}
                      >
                        <Select
                          placeholder="- เลือกรายการ -"
                          loading={usersLoading || prDetailLoading}
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
                          options={users}
                        />
                      </Form.Item>
                    </Col>

                    {/* ชื่อบริษัท — supplier dropdown — comes right before สถานที่ส่งของ */}
                    <Col xs={24}>
                      <Form.Item
                        label={<span style={labelStyle}>ชื่อบริษัท</span>}
                        name="supplier_code"
                      >
                        <Select
                          showSearch
                          placeholder="- เลือกผู้ขาย -"
                          loading={suppliersLoading || supplierDetailLoading}
                          filterOption={(input, option) =>
                            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          options={suppliers.map((s) => ({ value: s.id, label: s.supplier_name }))}
                          onChange={handleSupplierChange}
                        />
                      </Form.Item>
                    </Col>

                    {/* สถานที่ส่งของ */}
                    <Col xs={24}>
                      <Form.Item
                        label={<span style={labelStyle}>สถานที่ส่งของ</span>}
                        name="deliveryLocation"
                        rules={[{ required: true, message: 'กรุณากรอกสถานที่ส่งของ' }]}
                      >
                        <Input placeholder="ระบุสถานที่ส่งของ" disabled={prDetailLoading} />
                      </Form.Item>
                    </Col>

                    {/* กำหนดส่งของ */}
                    <Col xs={24}>
                      <Form.Item label={<span style={labelStyle}>กำหนดส่งของ</span>} name="deliveryDate">
                        <DatePicker style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>

                    {/* เงื่อนไขชำระเงิน — moved to the left column */}
                    <Col xs={24}>
                      <Form.Item label={<span style={labelStyle}>เงื่อนไขชำระเงิน</span>} name="paymentTerm">
                        <Select
                          placeholder="เลือกเงื่อนไขการชำระเงิน"
                          options={[7, 15, 30, 45, 90].map((d) => ({ label: `${d} วัน`, value: `${d} วัน` }))}
                          allowClear
                        />
                      </Form.Item>
                    </Col>

                  </Row>
                </Col>

                {/* ── Right column: purchasing workflow ── */}
                <Col xs={24} lg={12}>
                  <Row gutter={16}>

                    {/* Date */}
                    <Col xs={24}>
                      <Form.Item label={<span style={labelStyle}>วันที่</span>} name="date">
                        <Input
                          defaultValue={new Date().toLocaleDateString('th-TH', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                          disabled
                        />
                      </Form.Item>
                    </Col>

                    {/* PR Order */}
                    <Col xs={24}>
                      <Form.Item
                        label={<span style={labelStyle}>PR Order</span>}
                        name="prOrder"
                        rules={
                          orderType === 'cost'
                            ? [{ required: true, message: 'กรุณาเลือก PR Order เมื่อประเภทการสั่งซื้อเป็นโครงการ (Cost)' }]
                            : []
                        }
                      >
                        <Select
                          showSearch
                          allowClear
                          placeholder="- เลือก PR Order (เฉพาะที่อนุมัติแล้ว) -"
                          loading={prOptionsLoading}
                          onChange={handlePrChange}
                          onSelect={(val) => { if (val != null) handlePrSelect(val) }}
                          filterOption={(input, option) => {
                            const haystack = `${option?.pr_no ?? ''} ${option?.status ?? ''} ${option?.requested_by ?? ''}`.toLowerCase()
                            return haystack.includes(input.toLowerCase())
                          }}
                          optionRender={(option) => (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                              <span>
                                {option.data.pr_no}
                                {option.data.requested_by ? ` — ${option.data.requested_by}` : ''}
                              </span>
                              <span style={{ color: '#9ca3af', fontSize: 12, flexShrink: 0 }}>
                                {option.data.pr_date ? dayjs(option.data.pr_date).format('DD-MM-YY') : ''}
                                {option.data.status ? ` · ${option.data.status}` : ''}
                              </span>
                            </div>
                          )}
                          options={[
                            ...prOptions,
                            ...(prFromEditMode && !prOptions.some((p) => p.id === prFromEditMode.id)
                              ? [prFromEditMode]
                              : []),
                          ].map((pr) => ({
                            value: pr.id,
                            label: pr.requested_by ? `${pr.pr_no} — ${pr.requested_by}` : pr.pr_no,
                            pr_no: pr.pr_no,
                            pr_date: pr.pr_date,
                            status: pr.status,
                            requested_by: pr.requested_by,
                          }))}
                        />
                      </Form.Item>
                      {selectedPrId && !prLocked && (
                        <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => setPrModalOpen(true)}>
                          เลือกรายการจาก PR
                        </Button>
                      )}
                    </Col>

                    {/* ประเภทการสั่งซื้อ */}
                    <Col xs={24}>
                      <Form.Item
                        label={<span style={labelStyle}>ประเภทการสั่งซื้อ</span>}
                        name="order_type"
                        initialValue="stock"
                      >
                        <Select
                          placeholder="- เลือกประเภท -"
                          allowClear
                          options={[
                            { value: 'stock', label: 'คลังสินค้า (Stock)' },
                            { value: 'cost', label: 'โครงการ (Cost)' },
                          ]}
                        />
                      </Form.Item>
                    </Col>

                    {/* ประเภทงาน */}
                    <Col xs={24}>
                      <Form.Item
                        label={<span style={labelStyle}>ประเภทงาน</span>}
                        name="work_type"
                      >
                        <Select
                          placeholder="- เลือกประเภทงาน -"
                          allowClear
                          options={Object.entries(PO_WORK_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
                        />
                      </Form.Item>
                    </Col>

                    {/* ผู้อนุมัติ */}
                    <Col xs={24}>
                      <Form.Item
                        label={<span style={labelStyle}>ผู้อนุมัติ</span>}
                        name="approver"
                        rules={[{ required: true, message: 'กรุณาเลือกผู้อนุมัติ' }]}
                      >
                        <Select
                          placeholder="- เลือกรายการ -"
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

                    {/* Ref — moved here, right before เงื่อนไขชำระเงิน */}
                    <Col xs={24}>
                      <Form.Item label={<span style={labelStyle}>Ref QUO</span>} name="ref">
                        <Input />
                      </Form.Item>
                    </Col>

                  </Row>
                </Col>

              </Row>
            </Form>
          </Card>
        </Col>

        {/* ── Items Table Card ── */}
        <Col span={24}>
          <Card
            title={<span style={cardTitleStyle}>เลือกรายการ วัสดุและบริการ</span>}
            style={cardStyle}
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 1, minWidth: 0, padding: 24 }}>
                <POItemsTable
                  items={items}
                  onChange={setItems}
                  taxOpen={taxOpen}
                  onTaxToggle={() => setTaxOpen((v) => !v)}
                  useDisc={useDisc}
                  discType={discType}
                  useVat={useVat}
                  useWht={useWht}
                />
              </div>
              <TaxSidebarPanel
                open={taxOpen}
                onClose={() => setTaxOpen(false)}
                useDisc={useDisc}
                onUseDiscChange={setUseDisc}
                discType={discType}
                onDiscTypeChange={handleDiscTypeChange}
                useVat={useVat}
                onUseVatChange={setUseVat}
                useWht={useWht}
                onUseWhtChange={setUseWht}
              />
            </div>
          </Card>
        </Col>

        {/* ── Note Card ── */}
        <Col span={24}>
          <Card style={cardStyle}>
            <div style={{ color: '#cc0000', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              หมายเหตุ
            </div>
            <Input.TextArea
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              disabled={isEdit && !canEdit}
            />
          </Card>
        </Col>

        {/* ── Saved Attachments Card (files already uploaded to this PO, grouped by source doc) ── */}
        {(savedAttachments.po.length > 0 || savedAttachments.pr.length > 0 || savedAttachments.memo.length > 0) && (
          <Col span={24}>
            <Card title={<span style={cardTitleStyle}>ไฟล์แนบที่บันทึกไว้</span>} style={cardStyle}>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                {([
                  ['po', 'จาก PO', savedAttachments.po],
                  ['pr', 'จาก PR', savedAttachments.pr],
                  ['memo', 'จาก Memo', savedAttachments.memo],
                ] as const).map(([key, label, list]) =>
                  list.length === 0 ? null : (
                    <div key={key}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#60a5fa',
                        textTransform: 'uppercase',
                        letterSpacing: '.04em',
                        marginBottom: 6,
                      }}>
                        {label}
                      </div>
                      <Space direction="vertical" style={{ width: '100%' }} size={8}>
                        {list.map((a) => (
                          <div
                            key={a.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '8px 12px',
                              border: '0.5px solid #e5e7eb',
                              borderRadius: 8,
                            }}
                          >
                            <Space>
                              <PaperClipOutlined style={{ color: '#2563eb' }} />
                              <a
                                href={a.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: 13, color: '#1e40af' }}
                                className="attachment-filename-link"
                              >
                                {a.fileName}
                              </a>
                              <span style={{ fontSize: 12, color: '#9ca3af' }}>{formatSize(a.fileSize)}</span>
                            </Space>
                          </div>
                        ))}
                      </Space>
                    </div>
                  )
                )}
              </Space>
            </Card>
          </Col>
        )}

        {/* ── File Attachment Card ── */}
        <Col span={24}>
          <Card
            title={<span style={cardTitleStyle}>แนบไฟล์</span>}
            style={cardStyle}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              style={{ display: 'none' }}
              onChange={(e) => addFiles(e.target.files)}
              onClick={(e) => { ;(e.target as HTMLInputElement).value = '' }}
            />

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
                  รองรับไฟล์ JPG, PDF, DOC, XLS — สามารถเลือกได้หลายไฟล์พร้อมกัน
                </div>
              </div>
            </div>

            {attachedFiles.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {attachedFiles.map((f) => (
                  <div
                    key={f.uid}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#eff6ff',
                      border: '0.5px solid #bfdbfe',
                      borderRadius: 8,
                      padding: '5px 10px',
                      fontSize: 13,
                      color: '#1e40af',
                      maxWidth: 280,
                    }}
                  >
                    <FileOutlined style={{ fontSize: 14, flexShrink: 0 }} />
                    <span
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}
                      title={f.name}
                    >
                      {f.name}
                    </span>
                    <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>
                      ({formatSize(f.size)})
                    </span>
                    <CloseCircleFilled
                      onClick={(e) => { e.stopPropagation(); removeFile(f.uid) }}
                      style={{ fontSize: 14, color: '#93c5fd', cursor: 'pointer', flexShrink: 0, transition: 'color 0.15s' }}
                      onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#2563eb')}
                      onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#93c5fd')}
                    />
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
        </Col>

        {/* ── Action Bar Card ── */}
        <Col span={24}>
          <Card
            style={{
              ...cardStyle,
              position: 'sticky',
              bottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

              {/* Left: พิมพ์ + กลับ */}
              <Space>
                <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrint}>พิมพ์</Button>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/po/status')}>กลับหน้าหลัก</Button>
              </Space>

              {/* Right: action buttons.
                  Editing a PENDING_APPROVAL PO in place gets a single plain
                  "บันทึก" — it must NOT reuse the DRAFT/PENDING_APPROVAL
                  two-button pair below, since clicking "บันทึกร่าง" there
                  would explicitly send status:'DRAFT' and wrongly demote an
                  already-submitted PO back to draft. handleSubmit() with no
                  arg omits `status` from the payload entirely, so the
                  backend's default-to-current-status keeps it at
                  PENDING_APPROVAL. */}
              {isEdit && poStatus.toUpperCase() === 'PENDING_APPROVAL' ? (
                <PermissionButton
                  menuCode={MENU_CODE}
                  action="edit"
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={submitting}
                  disabled={submitting || !canEdit}
                  onClick={() => handleSubmit()}
                >
                  บันทึก
                </PermissionButton>
              ) : (
                <Space>
                  <PermissionButton
                    menuCode={MENU_CODE}
                    action={isEdit ? 'edit' : 'write'}
                    icon={<SaveOutlined />}
                    loading={submitting}
                    disabled={submitting || (isEdit && !canEdit)}
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
                    disabled={submitting || (isEdit && !canEdit)}
                    onClick={() => handleSubmit('PENDING_APPROVAL')}
                  >
                    ส่งใบสั่งซื้อ
                  </PermissionButton>
                </Space>
              )}

            </div>
          </Card>
        </Col>

      </Row>

      {/* Only mounted once real print-data has been fetched for a saved PO */}
      {printData && (
        <PurchaseOrderPrint
          data={printData}
          onReady={() => {
            window.print()
            setPrintData(null)
          }}
        />
      )}

      {/* TEMP DIAGNOSTIC — remove after PR-modal investigation */}
      {(() => {
        console.log('[POCreatePage] render — isEdit:', isEdit, 'canEdit:', canEdit, 'formDisabled:', isEdit && !canEdit, 'prModalOpen:', prModalOpen, 'selectedPrId:', selectedPrId)
        return null
      })()}
      <PRItemSelectionModal
        open={prModalOpen}
        prId={selectedPrId}
        existingPrLineIds={existingPrLineIds}
        onClose={() => setPrModalOpen(false)}
        onConfirm={handlePrItemsConfirm}
      />
    </div>
  )
}

export default POCreatePage
