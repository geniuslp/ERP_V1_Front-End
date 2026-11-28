import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import dayjs from 'dayjs'
import logo from '../../components/asset/Genius Logo-01.jpg'
import type { PettyCashRequisition } from '@/types/pettyCash'
import { paginateLines } from './PettyCashPrint'

// ใบปะหน้าเงินสดย่อย (Cover Page Petty Cash) — A4 landscape. One table row per LINE of every selected
// petty cash document. The header "Project" is the documents' branch codes (สาขา, e.g. "FAC-S, FAC-B" —
// codes only, no branch names); each row shows its line's project name. Print only, nothing is saved.
// Same logo-preload + onReady()-gated window.print() pattern as the other print components.

export interface CoverLine {
  no: number
  pcNo: string
  project: string // the line's project name (code when it has no name)
  supplier: string
  netPay: number // before WHT (amount - discount + VAT)
  whtRate: number | null // % shown in the WH column
  wht: number
  amount: number // what is paid = netPay - wht
}

export interface CoverData {
  project: string // Subject: branch codes of the documents, e.g. "FAC-S, FAC-B"
  date: string // DD/MM/YYYY (print date)
  job: string // job codes of the lines' cost codes, e.g. "MS, EE"
  payee: string
  dept: string
  requester: string
  lines: CoverLine[]
  totalWht: number
  totalAmount: number
}

// A cost code starts with its subject + job letters (MP01010...). Mapped to the current job codes the same
// way erp-api's job_cost_key / poReportLineJobSQL do; overhead (OH...) codes have no job of their own.
const COST_KEY_TO_JOB: Record<string, string> = { MP: 'MS', ME: 'EE', MS: 'SN', MF: 'FF', MG: 'GS', MH: 'AC', MC: 'CS', MA: 'AR' }
const jobOfCostCode = (code?: string | null): string => {
  const k = (code ?? '').trim().slice(0, 2).toUpperCase()
  if (k.length < 2 || k === 'OH') return ''
  return COST_KEY_TO_JOB[k] ?? k
}

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.map((x) => (x ?? '').trim()).filter(Boolean))]

/** The selected documents (GET /petty-cash/:id, with lines) → cover data. */
export function buildCoverData(pcs: PettyCashRequisition[], requester: string): CoverData {
  const lines: CoverLine[] = []
  for (const pc of pcs) {
    for (const l of pc.lines ?? []) {
      const base = (l.amount ?? l.qty * l.unit_price) - (l.line_discount ?? 0)
      const wht = l.line_wht ?? 0
      const amount = l.line_net ?? base + (l.line_vat ?? 0) - wht
      const whtBase = l.wht_base_amount ?? base
      const rate = l.wht_rate ?? (wht > 0 && whtBase > 0 ? Math.round((wht / whtBase) * 1000) / 10 : null)
      lines.push({
        no: lines.length + 1,
        pcNo: pc.pc_no,
        project: (l.project_name ?? '').trim() || (l.project_code ?? pc.project_name ?? pc.project_code ?? ''),
        supplier: l.supplier_name ?? '',
        netPay: amount + wht,
        whtRate: wht > 0 ? rate : null,
        wht,
        amount,
      })
    }
  }
  return {
    project: uniq(pcs.map((p) => p.branch_code)).join(', '),
    date: dayjs().format('DD/MM/YYYY'),
    job: uniq(pcs.flatMap((p) => (p.lines ?? []).map((l) => jobOfCostCode(l.cost_code)))).join(', '),
    payee: uniq(pcs.map((p) => p.payee_name)).join(', '),
    dept: uniq(pcs.map((p) => p.dept_name)).join(', '),
    requester,
    lines,
    totalWht: lines.reduce((s, l) => s + l.wht, 0),
    totalAmount: lines.reduce((s, l) => s + l.amount, 0),
  }
}

const MM_TO_PX = 96 / 25.4
// A4 landscape page 297x210mm with 8mm padding => 194mm usable height; keep a small safety buffer.
const PAGE_H_MM = 194
const BOTTOM_BUFFER_MM = 4

const CSS = `
  .pcc-portal { font-family:'Cordia New','Sarabun',sans-serif; color:#000; background:#fff;
    position:fixed; top:-9999px; left:-9999px; visibility:hidden; }
  .pcc-portal * { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @media print {
    body>*:not(.pcc-portal){display:none !important;}
    .pcc-portal{position:static !important;visibility:visible !important;}
    .pcc-page{page-break-after:always;}
    .pcc-page:last-child{page-break-after:avoid;}
    @page{size:A4 landscape;margin:0;}
  }
  .pcc-page{width:297mm;height:210mm;padding:8mm;display:flex;flex-direction:column;overflow:hidden;}
  .pcc-measure{width:281mm;}
  .pcc-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #000;padding-bottom:2mm;}
  .pcc-title{text-align:right;font-size:18pt;font-weight:700;color:#02276e;line-height:1.1;}
  .pcc-info{display:grid;grid-template-columns:1fr 1fr;gap:1mm 10mm;font-size:13pt;margin:3mm 0;}
  .pcc-info b{display:inline-block;min-width:34mm;}
  .pcc-tbl{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12pt;}
  .pcc-tbl th,.pcc-tbl td{border:1px solid #000;padding:1mm 2mm;vertical-align:top;overflow-wrap:anywhere;line-height:1.15;}
  .pcc-tbl th{font-weight:700;text-align:center;background:#f3f4f6;}
  .pcc-r{text-align:right;white-space:nowrap;}
  .pcc-c{text-align:center;}
  .pcc-sub{font-size:10.5pt;color:#333;}
  .pcc-tot td{font-weight:700;}
  .pcc-sign{display:flex;justify-content:space-around;margin-top:auto;padding-top:8mm;font-size:13pt;text-align:center;}
  .pcc-sign > div{width:70mm;}
  .pcc-line{border-bottom:1px dotted #000;height:12mm;margin-bottom:1mm;}
`

const COLS = (
  <colgroup>
    <col style={{ width: '12mm' }} /><col /><col style={{ width: '70mm' }} />
    <col style={{ width: '32mm' }} /><col style={{ width: '26mm' }} /><col style={{ width: '32mm' }} />
  </colgroup>
)
const THEAD = (
  <thead>
    <tr>
      <th>No.</th><th>Project</th><th>Supplier</th>
      <th>Net Pay</th><th>WH</th><th>Amount</th>
    </tr>
  </thead>
)

const Head = ({ data, pageNum, totalPages }: { data: CoverData; pageNum: number; totalPages: number }) => (
  <>
    <div className="pcc-head">
      {/* Company block copied from PurchaseOrderPrint.tsx's POHeader (same logo size, fonts and lines). */}
      <div style={{ width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0px' }}>
        <img src={logo} alt="Logo" width={4248} height={1844}
          style={{ marginTop: '1px', height: '22mm', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '14.5pt', color: '#02276e', lineHeight: 1, marginLeft: '3px', fontFamily: 'Cordia New', whiteSpace: 'nowrap' }}>บริษัท จีเนียส เอนจิเนียริง จำกัด (สำนักงานใหญ่)</div>
          <div style={{ fontSize: '13.5pt', color: '#02276e', lineHeight: 1, borderBottom: '0.1px solid #000', marginLeft: '3px', paddingBottom: '1px', marginBottom: '3px', fontFamily: 'Cordia New', whiteSpace: 'nowrap' }}>Genius Engineering Co., Ltd. (Head Office)</div>
          <div style={{ fontSize: '11pt', color: '#02276e', lineHeight: 1.05, fontFamily: 'Cordia New', marginLeft: '3px' }}>
            <div style={{ whiteSpace: 'nowrap' }}>1467 ถนนกาญจนาภิเษก แขวงบางแคเหนือ เขตบางแค กรุงเทพฯ 10160</div>
            <div style={{ whiteSpace: 'nowrap' }}>1467 Kanjanapisek Rd., Bangkaenua, Bangkae, Bangkok 10160</div>
            <div style={{ whiteSpace: 'nowrap' }}>Tel. (66)2 805 6820&nbsp;&nbsp;TaxID.&nbsp;0105554142442&nbsp;&nbsp;www.geniuslp.com</div>
          </div>
        </div>
      </div>
      <div className="pcc-title">
        <div style={{ fontSize: '8pt', fontWeight: 400, color: '#444' }}>Page {pageNum}/{totalPages}</div>
        Cover Page Petty Cash
        <div style={{ fontSize: '13pt', fontWeight: 400 }}>ใบปะหน้าเงินสดย่อย</div>
      </div>
    </div>
    <div className="pcc-info">
      <div><b>Subject :</b> {data.project || '-'}</div>
      <div><b>Date :</b> {data.date}</div>
      <div><b>Job :</b> {data.job || '-'}</div>
      <div><b>ผู้ขอเบิก :</b> {data.payee || '-'}</div>
      <div><b>แผนก :</b> {data.dept || '-'}</div>
      <div><b>มูลค่าเบิกเงินสดย่อย :</b> {fmt(data.totalAmount)} บาท</div>
    </div>
  </>
)

const Row = ({ l }: { l: CoverLine }) => (
  <tr>
    <td className="pcc-c">{l.no}</td>
    <td>
      {l.project || '-'}
      <div className="pcc-sub">{l.pcNo}</div>
    </td>
    <td>{l.supplier || '-'}</td>
    <td className="pcc-r">{fmt(l.netPay)}</td>
    <td className="pcc-r">
      {l.whtRate != null ? `${l.whtRate}%` : '-'}
      {l.wht > 0 && <div className="pcc-sub">{fmt(l.wht)}</div>}
    </td>
    <td className="pcc-r">{fmt(l.amount)}</td>
  </tr>
)

const TotalRow = ({ data }: { data: CoverData }) => (
  <tr className="pcc-tot">
    <td colSpan={4} className="pcc-r">Sum Total</td>
    <td className="pcc-r">{fmt(data.totalWht)}</td>
    <td className="pcc-r">{fmt(data.totalAmount)}</td>
  </tr>
)

const Sign = ({ data }: { data: CoverData }) => (
  <div className="pcc-sign">
    <div>
      <div className="pcc-line" />
      <div>( {data.requester || '................................'} )</div>
      <div>Requester / ผู้ขอเบิก</div>
      <div>วันที่ {data.date}</div>
    </div>
    <div>
      <div className="pcc-line" />
      <div>( ................................ )</div>
      <div>Approver / ผู้อนุมัติ</div>
      <div>วันที่ ......../......../........</div>
    </div>
  </div>
)

// Fixed A4-landscape pages: header + info + column header on every page, rows split by measured height,
// and the Sum Total row + signatures only on the LAST page, the signatures pinned to its bottom edge.
// Same measure-then-paginate approach as PettyCashPrint.tsx (and its paginateLines rule: the last page
// always keeps room for the bottom block, so it never runs onto an extra page by itself).
const PettyCashCoverPrint: React.FC<{ data: CoverData; onReady?: () => void }> = ({ data, onReady }) => {
  const refHead = useRef<HTMLDivElement>(null)
  const refThead = useRef<HTMLTableSectionElement>(null)
  const refBottom = useRef<HTMLDivElement>(null)
  const refRows = useRef<(HTMLTableSectionElement | null)[]>([])
  const [pages, setPages] = useState<number[][] | null>(null)
  const [logoReady, setLogoReady] = useState(false)

  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'pcc-print-style'
    s.textContent = CSS
    document.head.appendChild(s)
    return () => { document.getElementById('pcc-print-style')?.remove() }
  }, [])

  // Preload the logo so window.print() never fires before it has loaded; a failed load still counts as ready.
  useEffect(() => {
    const img = new Image()
    img.onload = () => setLogoReady(true)
    img.onerror = () => setLogoReady(true)
    img.src = logo
  }, [])

  // Measure the real rendered heights (after fonts are ready), then paginate.
  useEffect(() => {
    if (pages !== null) return
    let cancelled = false
    const run = async () => {
      try { await (document as any).fonts?.ready } catch { /* ignore */ }
      if (cancelled || !refHead.current || !refThead.current || !refBottom.current) return
      const mm = (el: Element) => el.getBoundingClientRect().height / MM_TO_PX
      const avail = PAGE_H_MM - BOTTOM_BUFFER_MM - mm(refHead.current) - mm(refThead.current)
      const heights = data.lines.map((_, i) => (refRows.current[i] ? mm(refRows.current[i]!) : 10))
      setPages(paginateLines(heights, avail, mm(refBottom.current)))
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (pages !== null && logoReady) onReady?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, logoReady])

  if (pages === null) {
    // Hidden measuring pass, same widths / fonts as the real pages.
    return ReactDOM.createPortal(
      <div className="pcc-portal">
        <div className="pcc-measure">
          <div ref={refHead}><Head data={data} pageNum={1} totalPages={1} /></div>
          <table className="pcc-tbl">{COLS}<thead ref={refThead}>{THEAD.props.children}</thead></table>
          {data.lines.map((l, i) => (
            <table key={l.no} className="pcc-tbl">
              {COLS}
              <tbody ref={(el) => { refRows.current[i] = el }}><Row l={l} /></tbody>
            </table>
          ))}
          <div ref={refBottom}>
            <table className="pcc-tbl">{COLS}<tbody><TotalRow data={data} /></tbody></table>
            <Sign data={data} />
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  const totalPages = pages.length
  return ReactDOM.createPortal(
    <div className="pcc-portal">
      {pages.map((idxs, p) => {
        const isLast = p === totalPages - 1
        return (
          <div key={p} className="pcc-page">
            <Head data={data} pageNum={p + 1} totalPages={totalPages} />
            <table className="pcc-tbl">
              {COLS}
              {THEAD}
              <tbody>
                {idxs.map((i) => <Row key={data.lines[i].no} l={data.lines[i]} />)}
                {isLast && <TotalRow data={data} />}
              </tbody>
            </table>
            {isLast && <Sign data={data} />}
          </div>
        )
      })}
    </div>,
    document.body,
  )
}

export default PettyCashCoverPrint
