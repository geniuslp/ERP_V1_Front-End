import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import FormattedNote from '@/components/common/FormattedNote'
import { paginateRows } from '@/utils/printPagination'
import { signerNameFontPt } from '@/utils/signerName'
import { formatCostCodeDisplay } from '@/utils/costCode'
import logo from '../../../components/asset/Genius Logo-01.jpg'

// Standalone print of ONE PR reduction ("ลดยอดใบขอซื้อ/ขอจ้าง") — the lines that were just reduced, with the quantity
// taken off. Own file on purpose (same rule as PRPrint / PurchaseOrderPrint): a change here must never touch another
// document's layout. Same print pattern as the others: portal, measured pagination, logo preloaded and window.print()
// gated on onReady().

const BK = '#000000'

export interface PRReducePrintItem {
  no: string
  costCode: string
  matCode: string
  desc: string // material name + spec
  qty: number // quantity reduced
  unit: string
}

export interface PRReducePrintData {
  prNo: string
  date: string // DD/MM/YYYY — the day the reduction was saved
  project: string // "{code} {name}"
  dept: string
  system: string // job type, "{code} {name}"
  orderType: string
  reason: string
  preparedBy: string // the user who saved the reduction
  items: PRReducePrintItem[]
}

const MM_TO_PX = 96 / 25.4
const PAGE_H_MM = 275
const BOTTOM_BUFFER_MM = 8

const CSS = `
  .prr-portal { font-family:'Sarabun',sans-serif; color:#000; background:#fff;
    position:fixed; top:-9999px; left:-9999px; visibility:hidden; }
  .prr-portal * { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @media print {
    body>*:not(.prr-portal){display:none !important;}
    .prr-portal{position:static !important;visibility:visible !important;}
    .prr-page{page-break-after:always;}
    .prr-page:last-child{page-break-after:avoid;}
    @page{size:A4 portrait;margin:0;}
  }
  .prr-page{width:210mm;height:297mm;padding:6mm 8mm 12mm 8mm;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;position:relative;}
  .prr-box-first{border:1px solid #000;}
  .prr-box{border:1px solid #000;border-top:none;}
  .prr-tbl{width:100%;border-collapse:collapse;table-layout:fixed;border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}
  .prr-tbl thead{display:table-header-group;}
  .prr-tbl th{font-family:'Cordia New',sans-serif;font-weight:700;font-size:12pt;text-align:center;padding:2px 3px;height:7mm;
    border-bottom:1px solid #000;border-right:1px solid #000;background:#fff;}
  .prr-tbl th:last-child{border-right:none;}
  .prr-tbl td{font-family:'Cordia New',sans-serif;font-size:12pt;padding:6px 5px;vertical-align:top;border:none;border-right:1px solid #000;overflow:hidden;line-height:1.2;}
  .prr-tbl td:last-child{border-right:none;}
  .prr-sign-col{flex:1;border-right:1px solid #000;display:flex;flex-direction:column;}
  .prr-sign-col:last-child{border-right:none;}
  .prr-sign-head{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:2px 4px;font-family:'Cordia New',sans-serif;
    font-size:12pt;border-bottom:1px solid #000;}
  .prr-sign-body{display:flex;align-items:center;justify-content:center;font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;
    text-align:center;padding:2px 3px;height:6mm;font-weight:600;}
  .prr-sign-date{text-align:center;font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;padding:1px 4px;}
`

const COLS = (
  <colgroup>
    <col style={{ width: '11mm' }} /><col style={{ width: '28mm' }} /><col style={{ width: '30mm' }} />
    <col /><col style={{ width: '20mm' }} /><col style={{ width: '16mm' }} />
  </colgroup>
)
const HEAD_LABELS = ['ลำดับ', 'รหัสต้นทุน', 'รหัสวัสดุ', 'รายการ', 'จำนวน', 'หน่วย']
const HEAD = <thead><tr>{HEAD_LABELS.map((h) => <th key={h}>{h}</th>)}</tr></thead>

const FillerTr = () => <tr style={{ height: '100%' }}><td /><td /><td /><td /><td /><td /></tr>

const cleanItemName = (desc: string): string => desc.replace(/\s*--\s*/g, ' ').trim()
const fmtQty = (v: number): string => Number(v).toLocaleString('th-TH', { maximumFractionDigits: 4 })

const Header = ({ pageNum, totalPages }: { pageNum: number; totalPages: number }) => (
  <div className="prr-box-first" style={{ display: 'flex', alignItems: 'flex-start', minHeight: '26mm' }}>
    {/* Logo + company name / address / tel — same block as the PR print header. */}
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0px' }}>
      <img src={logo} alt="Logo" style={{ marginTop: '1px', height: '22mm', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
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
    <div style={{ flex: 1, minWidth: 0, textAlign: 'right', padding: '2px 10px 4px 8px' }}>
      <div style={{ fontSize: '7.5pt', color: '#444' }}>Page {pageNum}/{totalPages}</div>
      <div style={{ fontSize: '17pt', fontWeight: 700, color: BK, lineHeight: 1.15, marginTop: 4 }}>ลดยอด PR/WO</div>
    </div>
  </div>
)

const infoRow = (label: string, value: string) => (
  <div style={{ display: 'flex', gap: 4 }}>
    <b style={{ flexShrink: 0 }}>{label} :</b>
    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
  </div>
)

const InfoBox = ({ data }: { data: PRReducePrintData }) => (
  <div className="prr-box" style={{ display: 'flex', fontSize: '12pt', fontFamily: "'Cordia New',sans-serif", lineHeight: '1.2' }}>
    <div style={{ width: '58%', borderRight: '1px solid #000', padding: '3px 8px', display: 'flex', flexDirection: 'column' }}>
      {infoRow('Project', data.project)}
      {infoRow('แผนก', data.dept)}
      {infoRow('ระบบ', data.system)}
    </div>
    <div style={{ flex: 1, padding: '3px 8px', display: 'flex', flexDirection: 'column' }}>
      {infoRow('PR NO.', data.prNo)}
      {infoRow('DATE', data.date)}
      {infoRow('ประเภท', data.orderType)}
    </div>
  </div>
)

const ItemRow = ({ row, rowRef }: { row: PRReducePrintItem; rowRef?: React.Ref<HTMLTableRowElement> }) => (
  <tr ref={rowRef}>
    <td style={{ textAlign: 'center' }}>{row.no}</td>
    <td style={{ textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCostCodeDisplay(row.costCode)}</td>
    <td style={{ textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.matCode}</td>
    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{cleanItemName(row.desc)}</td>
    <td style={{ textAlign: 'center' }}>{fmtQty(row.qty)}</td>
    <td style={{ textAlign: 'center' }}>{row.unit}</td>
  </tr>
)

const SIGNERS = ['ผู้จัดทำ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ']

const Footer = ({ data }: { data: PRReducePrintData }) => (
  <>
    <div className="prr-box" style={{ minHeight: '24mm', padding: '3px 8px', fontSize: '12pt', fontFamily: "'Cordia New',sans-serif", lineHeight: '1.2', display: 'flex', gap: 4 }}>
      <b style={{ flexShrink: 0 }}>หมายเหตุ :</b>
      <span style={{ minWidth: 0 }}><FormattedNote value={data.reason} /></span>
    </div>
    <div className="prr-box" style={{ height: '26mm', display: 'flex' }}>
      {SIGNERS.map((label, i) => (
        <div key={label} className="prr-sign-col">
          <div className="prr-sign-head">
            {i === 0 && data.preparedBy && (
              <div style={{ textAlign: 'center', fontSize: `${signerNameFontPt(data.preparedBy, 60)}pt` }}>{data.preparedBy}</div>
            )}
          </div>
          <div className="prr-sign-body">{label}</div>
          <div className="prr-sign-date">({data.date})</div>
        </div>
      ))}
    </div>
  </>
)

interface Props { data: PRReducePrintData; onReady?: () => void }

const PRReducePrint: React.FC<Props> = ({ data, onReady }) => {
  const refHeader = useRef<HTMLDivElement>(null)
  const refInfo = useRef<HTMLDivElement>(null)
  const refFooter = useRef<HTMLDivElement>(null)
  const refThead = useRef<HTMLTableSectionElement>(null)
  const refRows = useRef<(HTMLTableRowElement | null)[]>([])

  const [pages, setPages] = useState<PRReducePrintItem[][] | null>(null)
  const [imagesReady, setImagesReady] = useState(false)

  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'pr-reduce-print-style'; s.textContent = CSS
    document.head.appendChild(s)
    return () => { document.getElementById('pr-reduce-print-style')?.remove() }
  }, [])

  // Logo preloaded so window.print() never fires before it is decoded (a failed load still counts, printing without it).
  useEffect(() => {
    const img = new Image()
    img.onload = () => setImagesReady(true)
    img.onerror = () => { console.warn('[PR reduce] logo failed to load, printing without it'); setImagesReady(true) }
    img.src = logo
  }, [])

  useEffect(() => {
    if (pages !== null) return
    if (!refHeader.current || !refInfo.current || !refFooter.current || !refThead.current) return
    const px2mm = (px: number) => px / MM_TO_PX
    const fixed =
      px2mm(refHeader.current.getBoundingClientRect().height) +
      px2mm(refInfo.current.getBoundingClientRect().height) +
      px2mm(refThead.current.getBoundingClientRect().height)
    const footerMm = px2mm(refFooter.current.getBoundingClientRect().height)
    const avail = PAGE_H_MM - BOTTOM_BUFFER_MM - fixed
    const rowEls = data.items.map((_, i) => refRows.current[i])
    if (rowEls.some((el) => !el)) return
    const heights = rowEls.map((el) => px2mm(el!.getBoundingClientRect().height))
    const idxPages = paginateRows(heights, avail, footerMm, true)
    const result = idxPages.map((ids) => ids.map((i) => data.items[i]))
    if (result.length === 0) result.push([])
    setPages(result)
  })

  useEffect(() => {
    if (pages !== null && imagesReady) onReady?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, imagesReady])

  if (pages === null) {
    return ReactDOM.createPortal(
      <div className="prr-portal">
        <div className="prr-page" style={{ visibility: 'hidden' }}>
          <div ref={refHeader}><Header pageNum={1} totalPages={1} /></div>
          <div ref={refInfo}><InfoBox data={data} /></div>
          <table className="prr-tbl">{COLS}
            <thead ref={refThead}>{HEAD.props.children}</thead>
            <tbody>{data.items.map((row, i) => <ItemRow key={i} row={row} rowRef={(el) => { refRows.current[i] = el }} />)}</tbody>
          </table>
          <div ref={refFooter}><Footer data={data} /></div>
        </div>
      </div>, document.body,
    )
  }

  const totalPages = pages.length
  return ReactDOM.createPortal(
    <div className="prr-portal">
      {pages.map((rows, pageIdx) => {
        const isLast = pageIdx === totalPages - 1
        return (
          <div key={pageIdx} className="prr-page">
            <Header pageNum={pageIdx + 1} totalPages={totalPages} />
            <InfoBox data={data} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <table className="prr-tbl" style={{ width: '100%', height: '100%' }}>{COLS}{HEAD}
                <tbody>
                  {rows.map((row, i) => <ItemRow key={i} row={row} />)}
                  <FillerTr />
                </tbody>
              </table>
            </div>
            {isLast && <Footer data={data} />}
          </div>
        )
      })}
    </div>, document.body,
  )
}

export default PRReducePrint
