import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import { formatMoney } from '@/utils/formatMoney'
import { formatCostCodeDisplay } from '@/utils/costCode'
import { poApprovalStatusLabel } from '@/components/po/POStatusBadge'
import type { POStatus } from '@/types/po'

// Print layout of the รายงานการสั่งซื้อ result (A4 landscape). The browser's print dialog is the PDF
// export ("Save as PDF"), same approach as the other print components. Rendered in a portal that is
// the only thing visible while printing; onDone fires after the dialog closes.

export interface POReportPrintLine {
  job_code: string | null
  cost_code: string | null
  mat_code: string | null
  description: string
  qty: number
  unit_name: string | null
  unit_price: number
  amount: number
  remarks: string | null
}
export interface POReportPrintGroup {
  po_no: string
  status: POStatus
  supplier_name: string | null
  subtotal: number
  lines: POReportPrintLine[]
}
export interface POReportPrintData {
  title: string
  conditions: string[] // "โครงการ : …", "ระบบ (Job) : …" …
  pending: boolean
  groups: POReportPrintGroup[]
  grandTotal: number
}

const CSS = `
  .por-portal { font-family:'Sarabun',sans-serif; color:#000; background:#fff;
    position:fixed; top:-9999px; left:-9999px; visibility:hidden; }
  .por-portal * { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @media print {
    body>*:not(.por-portal){display:none !important;}
    .por-portal{position:static !important;visibility:visible !important;}
    @page{size:A4 landscape;margin:10mm;}
  }
  .por-title{font-size:16pt;font-weight:700;color:#0f2d5e;margin-bottom:2mm;}
  .por-cond{font-size:11pt;line-height:1.35;margin-bottom:4mm;}
  .por-band{background:#eff6ff;border:1px solid #888;border-bottom:none;padding:1.5mm 3mm;font-size:11pt;margin-top:4mm;
    page-break-after:avoid;break-after:avoid;}
  .por-tbl{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5pt;}
  .por-tbl th,.por-tbl td{border:1px solid #888;padding:1mm 2mm;vertical-align:top;overflow-wrap:anywhere;}
  .por-tbl th{background:#f3f4f6;font-weight:700;text-align:center;}
  .por-tbl thead{display:table-header-group;}
  .por-tbl tr{page-break-inside:avoid;break-inside:avoid;}
  .por-r{text-align:right;white-space:nowrap;}
  .por-tot td{font-weight:700;border-top:1.5px solid #000;}
`

const POReportPrint: React.FC<{ data: POReportPrintData; onDone: () => void }> = ({ data, onDone }) => {
  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'por-print-style'
    s.textContent = CSS
    document.head.appendChild(s)
    const after = () => onDone()
    window.addEventListener('afterprint', after, { once: true })
    // let the portal paint (and fonts settle) before opening the dialog
    const t = setTimeout(() => window.print(), 300)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', after)
      document.getElementById('por-print-style')?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const qtyHead = data.pending ? 'Qty (ค้างรับ)' : 'Qty'
  const amtHead = data.pending ? 'Amount ค้างรับ (Exc. VAT)' : 'Amount (Exc. VAT)'
  const COLS = (
    <colgroup>
      <col style={{ width: '10mm' }} /><col style={{ width: '14mm' }} /><col style={{ width: '24mm' }} /><col style={{ width: '34mm' }} /><col />
      <col style={{ width: '24mm' }} /><col style={{ width: '24mm' }} /><col style={{ width: '32mm' }} /><col style={{ width: '40mm' }} />
    </colgroup>
  )

  return ReactDOM.createPortal(
    <div className="por-portal">
      <div className="por-title">{data.title}</div>
      <div className="por-cond">{data.conditions.map((c) => <div key={c}>{c}</div>)}</div>
      {data.groups.map((g) => (
        <div key={g.po_no}>
          <div className="por-band">
            <b>ชื่อร้านค้า</b> {g.supplier_name ?? '—'}&nbsp;&nbsp;&nbsp;<b>PO</b> {g.po_no}&nbsp;&nbsp;&nbsp;
            <b>สถานะ</b> {poApprovalStatusLabel(g.status)}
          </div>
          <table className="por-tbl">
            {COLS}
            <thead>
              <tr><th>No.</th><th>Job</th><th>Cost Code</th><th>MatCode</th><th>Description</th><th>{qtyHead}</th><th>Unit/Price</th><th>{amtHead}</th><th>Remark</th></tr>
            </thead>
            <tbody>
              {g.lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ textAlign: 'center' }}>{l.job_code ?? '-'}</td>
                  <td>{l.cost_code ? formatCostCodeDisplay(l.cost_code) : '-'}</td>
                  <td>{l.mat_code ?? '-'}</td>
                  <td>{l.description}</td>
                  <td className="por-r">{`${Number(l.qty).toLocaleString()} ${l.unit_name ?? ''}`}</td>
                  <td className="por-r">{(l.unit_price ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                  <td className="por-r">{formatMoney(l.amount)}</td>
                  <td>{l.remarks ?? ''}</td>
                </tr>
              ))}
              <tr className="por-tot">
                <td colSpan={7} className="por-r">รวม</td>
                <td className="por-r">{formatMoney(g.subtotal)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ))}
      {data.groups.length > 0 && (
        <table className="por-tbl" style={{ marginTop: '4mm' }}>
          {COLS}
          <tbody>
            <tr className="por-tot">
              <td colSpan={7} className="por-r">รวมทั้งสิ้น</td>
              <td className="por-r">{formatMoney(data.grandTotal)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      )}
    </div>,
    document.body,
  )
}

export default POReportPrint
