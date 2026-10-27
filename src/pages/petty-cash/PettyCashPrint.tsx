import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import dayjs from 'dayjs'
import logo from '../../components/asset/Genius Logo-01.jpg'
import { getOrderTypeLabel } from '@/constants/orderTypes'
import { thaiBahtText } from '@/utils/thaiBahtText'
import type { PettyCashRequisition } from '@/types/pettyCash'
import { formatCostCodeDisplay } from '@/utils/costCode'

// Standalone Petty Cash print component, paginated the way PRPrint.tsx does it: fixed A4 pages
// (210x297mm, flex column), page header + info grid + column header repeated on every page, rows
// split by measured height, and the bottom block (summary + signatures) only on the LAST page,
// pinned to its bottom edge by a flex:1 items area. NOT shared with PRPrint — keep independent.

const BK = '#000000'

export interface PettyCashPrintLine {
  no: string
  costCode: string
  desc: string
  amount: number
  vat: number
  wht: number
  net: number
  vendor: string
  remark: string
  invoiceNo: string
  invoiceDate: string // DD/MM/YYYY or ''
  taxInvoiceNo: string
  taxInvoiceDate: string // DD/MM/YYYY or ''
  whtLabel: string
}

export interface PettyCashPrintData {
  status?: string
  pcNo: string
  pcDate: string // DD/MM/YYYY
  project: string // "{code} — {name}"
  deptCode: string
  dept: string // dept_name
  orderType: string
  payee: string
  subtotal: number
  discount: number
  vat: number
  wht: number
  netAmount: number
  requester: string
  approver: string
}

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dmy = (d?: string | null) => (d ? dayjs(d).format('DD/MM/YYYY') : '')

// One line's item text: material name + free-text description on one line (deduped when equal).
export const pettyCashLineDesc = (matName?: string | null, description?: string | null) => {
  const a = (matName ?? '').trim()
  const b = (description ?? '').trim()
  return a && b && a !== b ? `${a} ${b}` : a || b
}

export const projectLabel = (code?: string | null, name?: string | null) =>
  code ? (name ? `${code} — ${name}` : code) : ''

// GET /petty-cash/:id → print data.
export const buildPettyCashPrintData = (pc: PettyCashRequisition): PettyCashPrintData => ({
  status: pc.status,
  pcNo: pc.pc_no ?? '',
  pcDate: dmy(pc.pc_date),
  project: projectLabel(pc.project_code, pc.project_name),
  deptCode: pc.dept_code ?? '',
  dept: pc.dept_name ?? '',
  orderType: pc.order_type ? getOrderTypeLabel(pc.order_type) : '',
  payee: [pc.payee_emp_code, pc.payee_name].filter(Boolean).join(' '),
  subtotal: pc.total_amount ?? 0,
  discount: pc.discount_amount ?? 0,
  vat: pc.vat_amount ?? 0,
  wht: pc.wht_amount ?? 0,
  netAmount: pc.net_amount ?? 0,
  requester: pc.requested_by_username || pc.requested_by_name || '',
  approver: pc.approver_name ?? '',
})

export const buildPettyCashPrintLines = (lines: NonNullable<PettyCashRequisition['lines']>): PettyCashPrintLine[] =>
  lines.map((l, i) => {
    const amount = l.amount ?? l.qty * l.unit_price
    return {
      no: String(i + 1),
      costCode: l.cost_code ?? '',
      desc: pettyCashLineDesc(l.mat_name_th, l.description),
      amount,
      vat: l.line_vat ?? 0,
      wht: l.line_wht ?? 0,
      net: l.line_net ?? amount,
      vendor: l.supplier_name ?? '',
      remark: l.remarks ?? '',
      invoiceNo: l.invoice_no ?? '',
      invoiceDate: dmy(l.invoice_date),
      taxInvoiceNo: l.has_tax_invoice ? l.tax_invoice_no ?? '' : '',
      taxInvoiceDate: l.has_tax_invoice ? dmy(l.tax_invoice_date) : '',
      whtLabel: l.has_wht ? l.wht_income_label ?? '' : '',
    }
  })

const MM_TO_PX = 96 / 25.4
// Same page budget as PRPrint.tsx: usable height of an A4 page and a safety buffer at the bottom.
const PAGE_H_MM = 275
const BOTTOM_BUFFER_MM = 8

const CSS = `
  .pcp-portal { font-family:'Sarabun',sans-serif; color:#000; background:#fff;
    position:fixed; top:-9999px; left:-9999px; visibility:hidden; }
  .pcp-portal * { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @media print {
    body>*:not(.pcp-portal){display:none !important;}
    .pcp-portal{position:static !important;visibility:visible !important;}
    .pcp-page{page-break-after:always;}
    .pcp-page:last-child{page-break-after:avoid;}
    @page{size:A4 portrait;margin:0;}
  }
  .pcp-page{width:210mm;height:297mm;padding:6mm 8mm 12mm 8mm;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;position:relative;}
  .pcp-measure{width:194mm;}
  .pcp-watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-38deg);
    font-size:130pt;font-weight:800;letter-spacing:10px;color:#000;opacity:0.12;
    white-space:nowrap;pointer-events:none;user-select:none;z-index:0;font-family:'Sarabun',sans-serif;}
  .pcp-box-first{border-bottom:1px solid #000;}
  .pcp-info{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none;
    font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.2;}
  .pcp-info > div{padding:3px 8px;}
  .pcp-info > div:nth-child(even){border-left:1px solid #000;text-align:left;}
  .pcp-tbl{width:100%;border-collapse:collapse;table-layout:fixed;
    border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}
  .pcp-tbl thead{display:table-header-group;}
  .pcp-tbl th{font-family:'Cordia New',sans-serif;font-weight:700;font-size:12pt;text-align:center;padding:2px 3px;height:7mm;
    border-bottom:1px solid #000;border-right:none;background:#fff;}
  .pcp-tbl td{font-family:'Cordia New',sans-serif;font-size:12pt;padding:1px 5px;vertical-align:top;border:none;line-height:1.15;overflow-wrap:anywhere;}
  .pcp-tbl tr.pcp-main td{padding-top:5px;}
  .pcp-tbl tr.pcp-last td{padding-bottom:5px;}
  .pcp-sub{font-size:11pt !important;color:#222;}
  .pcp-num{text-align:right;white-space:nowrap;}
  .pcp-sum{border:1px solid #000;border-top:none;padding:4px 8px;
    font-family:'Cordia New',sans-serif;font-size:12pt;display:flex;justify-content:space-between;gap:12px;}
  .pcp-sum-rows{min-width:80mm;}
  .pcp-sum-row{display:flex;justify-content:space-between;gap:16px;line-height:1.3;}
  .pcp-auth{display:flex;height:26mm;border:1px solid #000;border-top:none;}
  .pcp-auth-col{flex:1;border-right:1px solid #000;display:flex;flex-direction:column;}
  .pcp-auth-col:last-child{border-right:none;}
  .pcp-auth-head{flex:1;border-bottom:1px solid #000;}
  .pcp-auth-body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;text-align:center;padding:2px 3px;min-height:9mm;}
  .pcp-auth-date{text-align:center;font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;padding:1px 4px;}
`

const COLS = (
  <colgroup>
    <col style={{ width: '11mm' }} /><col style={{ width: '25mm' }} /><col />
    <col style={{ width: '26mm' }} /><col style={{ width: '24mm' }} /><col style={{ width: '24mm' }} /><col style={{ width: '26mm' }} />
  </colgroup>
)

const HEAD_LABELS = ['ลำดับ', 'รหัสต้นทุน', 'รายการ', 'จำนวนเงิน', 'ภาษีมูลค่าเพิ่ม', 'หัก ณ ที่จ่าย', 'จำนวนสุทธิ']
const TABLE_HEAD = (
  <thead><tr>{HEAD_LABELS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
)

const FillerTr = () => (
  <tr style={{ height: '100%' }}>
    <td /><td /><td /><td /><td /><td /><td />
  </tr>
)

const Header = ({ pageNum, totalPages }: { pageNum: number; totalPages: number }) => (
  <div className="pcp-box-first" style={{ display: 'flex', alignItems: 'flex-start', minHeight: '26mm' }}>
    <div style={{ width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0px' }}>
      <img src={logo} alt="Logo" width={4248} height={1844}
        style={{ marginTop: '1px', height: '22mm', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: '14.5pt', color: '#02276e', lineHeight: 1, marginLeft: '3px', fontFamily: 'Cordia New', whiteSpace: 'nowrap' }}>บริษัท จีเนียส เอนจิเนียริง จำกัด (สำนักงานใหญ่)</div>
        <div style={{ fontSize: '13.5pt', color: '#02276e', lineHeight: 1, borderBottom: '0.1px solid #000', marginLeft: '3px', paddingBottom: '1px', marginBottom: '3px', fontFamily: 'Cordia New', whiteSpace: 'nowrap' }}>Genius Engineering Co., Ltd. (Head Office)</div>
        <div style={{ fontSize: '11pt', color: '#02276e', lineHeight: 1.05, fontFamily: 'Cordia New', marginLeft: '3px' }}>
          <div style={{ whiteSpace: 'nowrap' }}>1467 ถนนกาญจนาภิเษก แขวงบางแคเหนือ เขตบางแค กรุงเทพฯ 10160</div>
          <div style={{ whiteSpace: 'nowrap' }}>1467 Kanjanapisek Rd., Bangkaenua, Bangkae, Bangkok 10160</div>
          <div style={{ whiteSpace: 'nowrap' }}>Tel. (66)2 805 6820&nbsp;&nbsp;TaxID.&nbsp;105554142442&nbsp;&nbsp;www.geniuslp.com</div>
        </div>
      </div>
    </div>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '2px 8px 4px 8px' }}>
      <div style={{ fontSize: '7.5pt', color: '#444' }}>Page {pageNum}/{totalPages}</div>
      <div style={{ alignSelf: 'stretch', textAlign: 'center', marginTop: '4px' }}>
        <div style={{ fontSize: '16pt', fontWeight: 700, color: BK, lineHeight: 1.1 }}>ใบเบิกเงินสดย่อย</div>
        <div style={{ fontSize: '14pt', fontWeight: 600, color: BK, lineHeight: 1.1, marginTop: '2px' }}>Petty Cash</div>
      </div>
    </div>
  </div>
)

const InfoBox = ({ data }: { data: PettyCashPrintData }) => (
  <div className="pcp-info">
    <div>
      <div><b>โครงการ :</b>&nbsp;{data.project || '-'}</div>
      <div>
        <b>แผนก :</b>&nbsp;{[data.deptCode, data.dept].filter(Boolean).join(' ') || '-'}
      </div>
    </div>
    <div>
      <b>เลขที่ :</b>{' '}
      <span style={{ fontSize: '15pt', fontWeight: 700 }}>{data.pcNo || '-'}</span>
    </div>
    <div><b>ประเภทการสั่งซื้อ :</b>&nbsp;{data.orderType || '-'}</div>
    <div><b>วันที่ :</b>&nbsp;{data.pcDate || '-'}</div>
    <div><b>จ่ายให้ :</b>&nbsp;{data.payee || '-'}</div>
    <div><b>จำนวนสุทธิ :</b>&nbsp;{fmt(data.netAmount)} บาท</div>
  </div>
)

// One line = its main row plus its sub-rows (vendor, remark, tax invoice, withholding tax). Rendered
// as a unit and paginated as a unit, so sub-rows never get separated from their line.
const LineRows = ({ line }: { line: PettyCashPrintLine }) => {
  const subs: string[] = []
  if (line.vendor) subs.push(`ผู้ขาย: ${line.vendor}`)
  if (line.remark) subs.push(`หมายเหตุ: ${line.remark}`)
  if (line.invoiceNo || line.invoiceDate) subs.push(`ใบแจ้งหนี้เลขที่ ${line.invoiceNo || '-'}  วันที่ ${line.invoiceDate || '-'}`)
  if (line.taxInvoiceNo) subs.push(`ใบกำกับภาษีเลขที่ ${line.taxInvoiceNo}${line.taxInvoiceDate ? `  วันที่ ${line.taxInvoiceDate}` : ''}`)
  if (line.wht > 0) subs.push(`หัก ณ ที่จ่าย ${fmt(line.wht)} บาท${line.whtLabel ? ` (${line.whtLabel})` : ''}`)
  return (
    <>
      <tr className={subs.length === 0 ? 'pcp-main pcp-last' : 'pcp-main'}>
        <td style={{ textAlign: 'center' }}>{line.no}</td>
        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', color: '#444' }}>{formatCostCodeDisplay(line.costCode)}</td>
        <td>{line.desc}</td>
        <td className="pcp-num">{fmt(line.amount)}</td>
        <td className="pcp-num">{fmt(line.vat)}</td>
        <td className="pcp-num">{fmt(line.wht)}</td>
        <td className="pcp-num">{fmt(line.net)}</td>
      </tr>
      {subs.map((text, i) => (
        <tr key={i} className={i === subs.length - 1 ? 'pcp-last' : undefined}>
          <td /><td />
          {/* Text stays inside the item column (no vertical column lines). */}
          <td className="pcp-sub">{text}</td>
          <td /><td /><td /><td />
        </tr>
      ))}
    </>
  )
}

const Summary = ({ data }: { data: PettyCashPrintData }) => (
  <div className="pcp-sum">
    <div style={{ flex: 1, alignSelf: 'flex-end' }}>
      <b>จำนวนเงิน (ตัวอักษร) :</b>&nbsp;{thaiBahtText(data.netAmount)}
    </div>
    <div className="pcp-sum-rows">
      <div className="pcp-sum-row"><span>รวมเงิน</span><span>{fmt(data.subtotal)}</span></div>
      {data.discount > 0 && <div className="pcp-sum-row"><span>ส่วนลด</span><span>- {fmt(data.discount)}</span></div>}
      <div className="pcp-sum-row"><span>ภาษีมูลค่าเพิ่ม</span><span>{fmt(data.vat)}</span></div>
      <div className="pcp-sum-row"><span>หัก ณ ที่จ่าย</span><span>- {fmt(data.wht)}</span></div>
      <div className="pcp-sum-row" style={{ fontWeight: 700, borderTop: '1px solid #000', marginTop: 2, paddingTop: 2 }}>
        <span>จำนวนสุทธิ</span><span>{fmt(data.netAmount)} บาท</span>
      </div>
    </div>
  </div>
)

const Footer = ({ data }: { data: PettyCashPrintData }) => (
  <div className="pcp-auth">
    <div className="pcp-auth-col">
      <div className="pcp-auth-head" />
      <div className="pcp-auth-body">
        <div style={{ fontWeight: 600 }}>ผู้ขอเบิก / Requester</div>
        {data.requester && <div>{data.requester}</div>}
      </div>
      <div className="pcp-auth-date">({data.pcDate || '-'})</div>
    </div>
    <div className="pcp-auth-col">
      <div className="pcp-auth-head" />
      <div className="pcp-auth-body">
        <div style={{ fontWeight: 600 }}>ผู้อนุมัติ / Approver</div>
        {data.approver && <div>{data.approver}</div>}
      </div>
      <div className="pcp-auth-date">(-)</div>
    </div>
  </div>
)

const BottomBlock = ({ data }: { data: PettyCashPrintData }) => (
  <>
    <Summary data={data} />
    <Footer data={data} />
  </>
)

// Pagination. `heights` are the measured heights (mm) of each line's rows; `avail` is the room for
// rows on a page (page budget minus header, info grid and column header); `bottomH` is the height of
// the summary + signature block. Lines are packed greedily into pages (a line is never split). The
// LAST page must additionally leave room for the bottom block: if it doesn't, its trailing lines
// (as many as fit together with the block) become the final page and the rest stay on the page
// before it, so the block can never overlap the items.
export const paginateLines = (heights: number[], avail: number, bottomH: number): number[][] => {
  const pages: number[][] = []
  let cur: number[] = []
  let used = 0
  heights.forEach((h, i) => {
    if (cur.length > 0 && used + h > avail) {
      pages.push(cur)
      cur = []
      used = 0
    }
    cur.push(i)
    used += h
  })
  pages.push(cur)

  const last = pages[pages.length - 1]
  const lastUsed = last.reduce((a, i) => a + heights[i], 0)
  if (last.length > 0 && lastUsed + bottomH > avail) {
    const tail: number[] = []
    let t = bottomH
    for (let k = last.length - 1; k >= 0; k--) {
      if (tail.length > 0 && t + heights[last[k]] > avail) break
      tail.unshift(last[k])
      t += heights[last[k]]
    }
    const head = last.slice(0, last.length - tail.length)
    pages.pop()
    if (head.length > 0) pages.push(head)
    pages.push(tail)
  }
  return pages
}

interface Props { data: PettyCashPrintData; lines: PettyCashPrintLine[]; onReady?: () => void }

const PettyCashPrint: React.FC<Props> = ({ data, lines, onReady }) => {
  const refHeader = useRef<HTMLDivElement>(null)
  const refInfo = useRef<HTMLDivElement>(null)
  const refThead = useRef<HTMLTableSectionElement>(null)
  const refBottom = useRef<HTMLDivElement>(null)
  const refLines = useRef<(HTMLTableSectionElement | null)[]>([])

  // pages = indexes into `lines`; null until measured.
  const [pages, setPages] = useState<number[][] | null>(null)
  const [imagesReady, setImagesReady] = useState(false)

  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'pcp-print-style'; s.textContent = CSS
    document.head.appendChild(s)
    return () => { document.getElementById('pcp-print-style')?.remove() }
  }, [])

  // Preload the logo so window.print() never fires before it has loaded/decoded. A failed load
  // still counts as ready (never hangs) and just prints without the logo.
  useEffect(() => {
    const img = new Image()
    img.onload = () => setImagesReady(true)
    img.onerror = () => { console.warn('[PettyCash] logo failed to load, printing without it'); setImagesReady(true) }
    img.src = logo
  }, [])

  // Measure the real rendered heights (after fonts are ready), then paginate.
  useEffect(() => {
    if (pages !== null) return
    let cancelled = false
    const run = async () => {
      try { await (document as any).fonts?.ready } catch { /* ignore */ }
      if (cancelled) return
      if (!refHeader.current || !refInfo.current || !refThead.current || !refBottom.current) return
      const mm = (el: Element) => el.getBoundingClientRect().height / MM_TO_PX
      const fixed = mm(refHeader.current) + mm(refInfo.current) + mm(refThead.current)
      const avail = PAGE_H_MM - BOTTOM_BUFFER_MM - fixed
      const heights = lines.map((_, i) => {
        const el = refLines.current[i]
        return el ? mm(el) : 8
      })
      setPages(paginateLines(heights, avail, mm(refBottom.current)))
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (pages !== null && imagesReady) onReady?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, imagesReady])

  if (pages === null) {
    // Hidden measuring pass, same column widths / fonts as the real pages.
    return ReactDOM.createPortal(
      <div className="pcp-portal">
        <div className="pcp-measure">
          <div ref={refHeader}><Header pageNum={1} totalPages={1} /></div>
          <div ref={refInfo}><InfoBox data={data} /></div>
          <table className="pcp-tbl">
            {COLS}
            <thead ref={refThead}>{TABLE_HEAD.props.children}</thead>
          </table>
          {lines.map((l, i) => (
            <table key={l.no} className="pcp-tbl">
              {COLS}
              <tbody ref={(el) => { refLines.current[i] = el }}><LineRows line={l} /></tbody>
            </table>
          ))}
          <div ref={refBottom}><BottomBlock data={data} /></div>
        </div>
      </div>, document.body,
    )
  }

  const totalPages = pages.length
  return ReactDOM.createPortal(
    <div className="pcp-portal">
      {pages.map((idxs, pageIdx) => {
        const isLast = pageIdx === totalPages - 1
        return (
          <div key={pageIdx} className="pcp-page">
            {data.status === 'DRAFT' && <div className="pcp-watermark">DRAFT</div>}
            <Header pageNum={pageIdx + 1} totalPages={totalPages} />
            <InfoBox data={data} />
            {/* Items area fills everything between the header and the bottom block; the filler row
                absorbs the leftover height so the frame runs to the bottom. */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <table className="pcp-tbl" style={{ width: '100%', height: '100%' }}>
                {COLS}
                {TABLE_HEAD}
                <tbody>
                  {idxs.map((i) => <LineRows key={lines[i].no} line={lines[i]} />)}
                  <FillerTr />
                </tbody>
              </table>
            </div>
            {isLast && <BottomBlock data={data} />}
          </div>
        )
      })}
    </div>, document.body,
  )
}

export default PettyCashPrint
