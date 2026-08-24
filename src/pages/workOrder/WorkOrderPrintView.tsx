import React from 'react'
import dayjs from 'dayjs'
import { WO_WORK_SYSTEM_LABEL } from '@/types/workOrder'
import type { WorkOrder } from '@/types/workOrder'
// Both templates are now literal PurchaseOrderPrint.tsx duplicates edited in
// place, per explicit instruction not to reimplement PO's layout from a
// description — WorkOrderPrintStandard.tsx (WO_STANDARD, own logo-box header)
// and WorkOrderPrintPOStyle.tsx (PO_HEADER, CompanyLetterhead header). See
// each file's own comments for the full field-by-field mapping/flags; this
// file is just the template-picker dispatch + the shared data mapper.
import WorkOrderPrintStandard from './WorkOrderPrintStandard'
import WorkOrderPrintPOStyle, { type WOPOData, type WOPOItem } from './WorkOrderPrintPOStyle'

export type WOPrintTemplate = 'WO_STANDARD' | 'PO_HEADER'

// Partial because the "print current unsaved form state" path (see
// WorkOrderPrintTrigger) feeds this straight from antd Form.getFieldsValue(),
// which never has id/status/created_by_name/etc.
export type WOPrintData = Partial<WorkOrder>

// Maps WO's own data onto the PO-derived WOPOData/WOPOItem shape both
// WorkOrderPrintStandard.tsx and WorkOrderPrintPOStyle.tsx consume (the two
// files declare structurally identical WOPOData/WOPOItem types, so one mapper
// here feeds either). Field-by-field reasoning/flags for every slot live as
// comments on WOPOData itself in those files — this function is just the
// plumbing that fills those slots from GET /work-order/:id's actual response
// shape, same underlying data source both templates already share.
function mapWorkOrderToPOStyle(data: WOPrintData): WOPOData {
  const useDisc = Boolean(data.use_discount)
  const items: WOPOItem[] = (data.lines ?? []).map((l) => ({
    no: String(l.line_no ?? ''),
    code: l.cost_code,
    desc: l.description ?? '',
    qty: l.qty,
    unit: '', // no per-line unit field on WorkOrderLine — left blank, not guessed
    pricePerUnit: l.unit_price,
    disc: useDisc ? (l.disc ?? 0) : 0,
    discType: l.disc_type ?? 'pct',
    vatPct: data.use_vat ? 7 : 0,
    whtPct: data.use_wht ? (l.wht_rate ?? 0) : 0,
  }))

  return {
    poNo: data.wo_no ?? '',
    poDate: data.wo_date ? dayjs(data.wo_date).format('DD/MM/YYYY') : '',
    prNo: data.ref_no ?? '',
    deliveryDate: '', // no WO equivalent (delivery concept doesn't apply)
    project: data.project_scope_text ?? '',
    deliveryPlace: '', // no WO equivalent
    job: (data.work_system && (WO_WORK_SYSTEM_LABEL[data.work_system] ?? data.work_system)) || '',
    contractDelivery: '', // no WO equivalent
    quotationNo: (data.contract_description as string) ?? '',
    tel: data.supplier_phone ?? '',
    supplier: {
      name: data.supplier_name ?? '',
      address1: data.supplier_address ?? '',
      // employer_name has no clean box slot (see WOPOData comment) — placed
      // in the termOfPayment slot, relabeled "Employer :" in POInfoBox.
      termOfPayment: data.employer_name ?? '',
      contact: [data.contact_person, data.supplier_phone].filter(Boolean).join(' , '),
    },
    items,
    extraDiscAmt: 0, // WO has no separate header-level override discount
    shippingAmt: 0, // WO has no shipping concept
    remark: data.other_terms ?? '',
    useDiscount: useDisc,
    useVat: Boolean(data.use_vat),
    useWht: Boolean(data.use_wht),
    status: data.status,
  }
}

interface Props {
  data: WOPrintData
  template: WOPrintTemplate
  onReady?: () => void
}

// Thin dispatcher — both templates manage their own portal/CSS injection/
// pagination/onReady internally (same as PO's own component does for
// itself), so this component just picks which one to mount, fed by the
// shared mapper above. No wrapping portal or shared CSS lives here anymore.
const WorkOrderPrintView: React.FC<Props> = ({ data, template, onReady }) => {
  // WO_STANDARD (the numbered-fields paper-form replica) renders straight
  // from the raw WO response — it needs fields (contract_type, retention_pct,
  // advance_pct, dates, etc.) the PO-shaped mapper below doesn't carry.
  // PO_HEADER is untouched and still consumes the PO-mapped shape.
  if (template === 'WO_STANDARD') return <WorkOrderPrintStandard data={data} onReady={onReady} />
  const mapped = mapWorkOrderToPOStyle(data)
  return <WorkOrderPrintPOStyle data={mapped} onReady={onReady} />
}

export default WorkOrderPrintView
