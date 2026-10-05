import React from 'react'
import dayjs from 'dayjs'
import ICPrintLayout, { icInfoGridStyle, icInfoCellStyle, icInfoLeftCellStyle, type ICPrintItem } from './ICPrintLayout'

// IC PO Return print (data: GET /ic/returns/:id). Built on the same shared A4 shell as
// ICPoReceivePrint.tsx (letterhead, signature footer, items table, logo-preload gating).

export interface ICReturnPrintData {
  returnNo: string
  returnDate: string
  poNo: string
  /** Print pages keep the "code — name" em-dash project format. */
  projectName: string
  supplierName?: string | null
  remarks?: string | null
  items: ICPrintItem[]
}

// GET /ic/returns/:id -> print data. Tolerates the header being nested or flat.
export const buildReturnPrintData = (raw: any): ICReturnPrintData => {
  const d = raw?.data ?? raw ?? {}
  const h = d.header ?? d.return ?? d
  const projectCode = d.project_code ?? h.project_code
  const projectName = d.project_name ?? h.project_name
  const lines: any[] = d.lines ?? h.lines ?? []
  const when = h.return_date ?? h.created_at
  return {
    returnNo: h.return_no ?? d.return_no ?? '',
    returnDate: when ? dayjs(when).format('DD/MM/YYYY') : '',
    poNo: d.po_no ?? h.po_no ?? '',
    // Print pages keep the "code — name" em-dash project format.
    projectName: projectCode && projectName ? `${projectCode} — ${projectName}` : (projectName ?? projectCode ?? ''),
    supplierName: d.supplier_name ?? h.supplier_name ?? d.supplier?.name ?? null,
    remarks: h.remarks ?? d.remarks ?? null,
    items: lines.map((l, i) => {
      const name = l.mat_name ?? l.item_name ?? l.description ?? ''
      const spec = l.spec_name ?? l.spec ?? ''
      const mat = l.mat_code ? `${l.mat_code} ` : ''
      const unit = l.unit_name ?? l.unit
      return {
        no: String(i + 1),
        costCode: l.cost_code ?? '',
        desc: `${mat}${name}${spec ? ' ' + spec : ''}`.trim(),
        qty: Number(l.return_qty ?? l.qty ?? 0),
        remark: [l.remarks, unit ? `หน่วย: ${unit}` : ''].filter(Boolean).join(' · '),
      }
    }),
  }
}

const ICReturnInfoBox = ({ data }: { data: ICReturnPrintData }) => (
  <div className="icr-box" style={icInfoGridStyle}>
    <div style={icInfoLeftCellStyle}>
      <div><b>เลขที่ใบสั่งซื้อ :</b>&nbsp;{data.poNo}</div>
      <div><b>โครงการ :</b>&nbsp;{data.projectName || '-'}</div>
      <div><b>ผู้ขาย :</b>&nbsp;{data.supplierName || '-'}</div>
    </div>
    <div style={icInfoCellStyle}>
      <div style={{ fontSize: '14pt', fontWeight: 700 }}><b>เลขที่ใบคืน :</b>&nbsp;{data.returnNo}</div>
      <div><b>วันที่คืน :</b>&nbsp;{data.returnDate}</div>
      <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        <b>หมายเหตุ :</b>&nbsp;{data.remarks?.trim() || '-'}
      </div>
    </div>
  </div>
)

interface Props { data: ICReturnPrintData; onReady?: () => void }

const ICPoReturnPrint: React.FC<Props> = ({ data, onReady }) => (
  <ICPrintLayout
    titleTh="ใบคืนสินค้า"
    titleEn="PO Return"
    docType="RETURN"
    infoBox={<ICReturnInfoBox data={data} />}
    items={data.items ?? []}
    qtyAlign="right"
    onReady={onReady}
  />
)

export default ICPoReturnPrint
