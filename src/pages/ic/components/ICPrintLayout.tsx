import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import logo from '../../../components/asset/Genius Logo-01.jpg'
import { IC_DOC_TYPE_STYLE, type ICDocType } from './ICDocTypeTag'

// Shared A4 print shell for the IC PO documents (PO Receive / PO Return): CSS, letterhead header,
// 3-box signature footer, the line-items table (no vertical column lines, header alignment follows
// the body) and the page-splitting + logo-preload gating (onReady fires only after the logo loaded).
// Each document supplies its own title, info block (`infoBox`), and items.

const BK = '#000000'

/** Call from <ICPrintLayout onReady>: opens the print dialog and calls onFinish once it closes
 *  (with a 10s fallback so the UI is never stuck if 'afterprint' doesn't fire). */
export const runBrowserPrint = (onFinish: () => void) => {
  let finished = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const finish = () => {
    if (finished) return
    finished = true
    window.removeEventListener('afterprint', finish)
    if (timer) clearTimeout(timer)
    onFinish()
  }
  window.addEventListener('afterprint', finish)
  window.print()
  timer = setTimeout(finish, 10000)
}

export interface ICPrintItem {
  no: string
  costCode?: string
  desc: string
  qty: number
  /** Optional per-line remark, printed small under the description. */
  remark?: string
}

export const normalizePrintItem = (raw: Partial<ICPrintItem> & Record<string, any>): ICPrintItem => ({
  no: raw.no ?? '',
  costCode: raw.costCode ?? '',
  desc: raw.desc ?? '',
  qty: raw.qty ?? 0,
  remark: raw.remark ?? '',
})

const MM_TO_PX = 96 / 25.4
const PAGE_H_MM = 275
const BOTTOM_BUFFER_MM = 8

export const IC_PRINT_CSS = `
  .icr-portal { font-family:'Sarabun',sans-serif; color:#000; background:#fff;
    position:fixed; top:-9999px; left:-9999px; visibility:hidden; }
  .icr-portal * { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @media print {
    body>*:not(.icr-portal){display:none !important;}
    .icr-portal{position:static !important;visibility:visible !important;}
    .icr-page{page-break-after:always;}
    .icr-page:last-child{page-break-after:avoid;}
    @page{size:A4 portrait;margin:0;}
  }
  .icr-page{width:210mm;height:297mm;padding:6mm 8mm 12mm 8mm;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;position:relative;}
  .icr-box-first{border-bottom:1px solid #000;}
  .icr-box{border:1px solid #000;border-top:none;}

  .icr-tbl{width:100%;border-collapse:collapse;table-layout:fixed;
    border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}
  .icr-tbl-inner{width:100%;border-collapse:collapse;table-layout:fixed;
    border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}
  .icr-tbl thead,.icr-tbl-inner thead{display:table-header-group;}
  .icr-tbl th,.icr-tbl-inner th{font-family:'Cordia New',sans-serif;font-weight:700;font-size:12pt;text-align:center;padding:2px 5px;height:7mm;
    border-bottom:1px solid #000;background:#fff;}
  .icr-tbl td,.icr-tbl-inner td{font-family:'Cordia New',sans-serif;font-size:12pt;padding:6px 5px;vertical-align:top;border:none;overflow:hidden;line-height:1.2;}
  .icr-tbl-spaced td{padding-top:9px;padding-bottom:9px;}
  .icr-tbl tbody.stretch,.icr-tbl-inner tbody.stretch{height:100%;}
  .icr-tbl tbody.stretch tr,.icr-tbl-inner tbody.stretch tr{height:1%;}

  .auth-col{flex:1;border-right:1px solid #000;display:flex;flex-direction:column;}
  .auth-col:last-child{border-right:none;}
  .auth-body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;text-align:center;padding:2px 3px;height:6mm;}
  .auth-head{flex:1;display:flex;flex-direction:column;justify-content:flex-end;
    padding:2px 4px;font-family:'Cordia New',sans-serif;font-size:12pt;border-top:none;border-bottom:1px solid #000;}
  .auth-date{text-align:center;font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;padding:1px 4px;height:6mm;}
`

// Info-block building blocks: ONE frame, two cells in the same grid row, one vertical line, no
// horizontal divider. Both cells stretch to the taller one.
export const icInfoGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  fontSize: '12pt',
  fontFamily: "'Cordia New',sans-serif",
}
export const icInfoCellStyle: React.CSSProperties = { padding: '3px 8px', lineHeight: '1.2', minWidth: 0 }
export const icInfoLeftCellStyle: React.CSSProperties = { ...icInfoCellStyle, borderRight: '1px solid #000' }

// 3 side-by-side signature blocks, date line left blank for the signer.
const AUTH_COLS = [
  { label: 'ผู้รับจัดทำ' },
  { label: 'ผู้จัดสินค้าเข้าคลัง' },
  { label: 'ผู้ตรวจสอบ' },
]

const TableCols = () => (
  <colgroup>
    <col style={{ width: '14mm' }} /><col style={{ width: '30mm' }} />
    <col /><col style={{ width: '24mm' }} />
  </colgroup>
)

// Header alignment follows the body: ลำดับ/CostCode centered, รายการ left, จำนวน = qtyAlign.
const headCells = (qtyAlign: 'center' | 'right') => [
  <th key="no" style={{ textAlign: 'center' }}>ลำดับ</th>,
  <th key="cc" style={{ textAlign: 'center' }}>CostCode</th>,
  <th key="desc" style={{ textAlign: 'left' }}>รายการ</th>,
  <th key="qty" style={{ textAlign: qtyAlign }}>จำนวน</th>,
]

const FillerTr = () => (
  <tr style={{ height: '100%' }}>
    <td /><td /><td /><td />
  </tr>
)

const ItemRow = ({ row, qtyAlign }: { row: ICPrintItem; qtyAlign: 'center' | 'right' }) => (
  <tr>
    <td style={{ textAlign: 'center' }}>{row.no}</td>
    <td style={{ color: '#444', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.costCode || '-'}</td>
    <td style={{ textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      {row.desc}
      {row.remark ? <div style={{ fontSize: '10.5pt', color: '#444' }}>หมายเหตุ: {row.remark}</div> : null}
    </td>
    <td style={{ textAlign: qtyAlign }}>{row.qty || ''}</td>
  </tr>
)

const ICPrintHeader = (
  { pageNum, totalPages, titleTh, titleEn, docType }:
  { pageNum: number; totalPages: number; titleTh: string; titleEn: string; docType: ICDocType },
) => {
  const tag = IC_DOC_TYPE_STYLE[docType]
  return (
    <div className="icr-box-first" style={{ display: 'flex', alignItems: 'flex-start', minHeight: '26mm' }}>
      <div style={{ width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0px' }}>
        <img
          src={logo}
          alt="Logo"
          width={4248}
          height={1844}
          style={{ marginTop: '1px', height: '22mm', width: 'auto', objectFit: 'contain', flexShrink: 0 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '14.5pt', color: '#02276e', lineHeight: 1, marginLeft: '3px', marginBottom: '0px', fontFamily: 'Cordia New', whiteSpace: 'nowrap' }}>บริษัท จีเนียส เอนจิเนียริง จำกัด (สำนักงานใหญ่)</div>
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
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18pt', fontWeight: 700, color: BK, lineHeight: 1.1, marginTop: '4px' }}>{titleTh}</div>
          <div style={{ fontSize: '13pt', fontWeight: 600, color: BK, marginTop: '6px' }}>
            {titleEn}
            <span
              style={{
                marginLeft: 8, padding: '0 6px', fontSize: '9pt', fontWeight: 600, borderRadius: 3,
                color: tag.color, background: tag.bg, border: `1px solid ${tag.border}`, verticalAlign: 'middle',
              }}
            >
              {tag.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const ICPrintFooter = () => (
  <div style={{ height: '28mm', display: 'flex', flexDirection: 'column' }}>
    <div className="icr-box" style={{ display: 'flex', flex: 1 }}>
      {AUTH_COLS.map((col, i) => (
        <div key={i} className="auth-col">
          <div className="auth-head" />
          <div className="auth-body">
            <div style={{ fontWeight: 600 }}>{col.label}</div>
          </div>
          <div className="auth-date" />
        </div>
      ))}
    </div>
  </div>
)

interface Props {
  titleTh: string
  titleEn: string
  docType: ICDocType
  infoBox: React.ReactNode
  items: ICPrintItem[]
  /** Quantity column alignment (body and header together). */
  qtyAlign?: 'center' | 'right'
  onReady?: () => void
}

const ICPrintLayout: React.FC<Props> = ({ titleTh, titleEn, docType, infoBox, items: rawItems, qtyAlign = 'center', onReady }) => {
  const items = rawItems.map(normalizePrintItem)
  const refHeader = useRef<HTMLDivElement>(null)
  const refInfo = useRef<HTMLDivElement>(null)
  const refFooter = useRef<HTMLDivElement>(null)
  const refRow = useRef<HTMLTableRowElement>(null)
  const refThead = useRef<HTMLTableSectionElement>(null)

  const [pages, setPages] = useState<ICPrintItem[][] | null>(null)
  const [logoReady, setLogoReady] = useState(false)

  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'icr-print-style'; s.textContent = IC_PRINT_CSS
    document.head.appendChild(s)
    return () => { document.getElementById('icr-print-style')?.remove() }
  }, [])

  // Preload the logo so onReady (and window.print()) never fires before the browser has finished
  // loading/decoding the image.
  useEffect(() => {
    const img = new Image()
    img.onload = () => setLogoReady(true)
    img.onerror = () => { console.warn('[ICPrint] logo image failed to load, printing without it'); setLogoReady(true) }
    img.src = logo
  }, [])

  useEffect(() => {
    if (pages !== null) return
    if (!refHeader.current || !refInfo.current || !refFooter.current || !refRow.current || !refThead.current) return
    const px2mm = (px: number) => px / MM_TO_PX
    const hMm = px2mm(refHeader.current.getBoundingClientRect().height)
    const iMm = px2mm(refInfo.current.getBoundingClientRect().height)
    const fMm = px2mm(refFooter.current.getBoundingClientRect().height)
    const tMm = px2mm(refThead.current.getBoundingClientRect().height)
    const rMm = px2mm(refRow.current.getBoundingClientRect().height)
    const fixed = hMm + iMm + tMm
    const rOther = Math.floor((PAGE_H_MM - BOTTOM_BUFFER_MM - fixed) / rMm)
    const rLast = Math.floor((PAGE_H_MM - BOTTOM_BUFFER_MM - fixed - fMm) / rMm)
    const result: ICPrintItem[][] = []
    let idx = 0
    while (idx < items.length) {
      const last = idx + rOther >= items.length
      result.push(items.slice(idx, idx + (last ? rLast : rOther)))
      idx += last ? rLast : rOther
    }
    if (result.length === 0) result.push([])
    setPages(result)
  })

  useEffect(() => {
    if (pages !== null && logoReady) onReady?.()
  }, [pages, logoReady])

  if (pages === null) {
    return ReactDOM.createPortal(
      <div className="icr-portal">
        <div className="icr-page" style={{ visibility: 'hidden' }}>
          <div ref={refHeader}><ICPrintHeader pageNum={1} totalPages={1} titleTh={titleTh} titleEn={titleEn} docType={docType} /></div>
          <div ref={refInfo}>{infoBox}</div>
          <table className="icr-tbl"><TableCols />
            <thead ref={refThead}><tr>{headCells(qtyAlign)}</tr></thead>
            <tbody><tr ref={refRow}>
              <td>1</td><td>CC-001</td><td>Sample desc</td><td>10</td>
            </tr></tbody>
          </table>
          <div ref={refFooter}><ICPrintFooter /></div>
        </div>
      </div>, document.body,
    )
  }

  const totalPages = pages.length
  return ReactDOM.createPortal(
    <div className="icr-portal">
      {pages.map((pageItems, pageIdx) => {
        const isLast = pageIdx === totalPages - 1
        return (
          <div key={pageIdx} className="icr-page">
            <ICPrintHeader pageNum={pageIdx + 1} totalPages={totalPages} titleTh={titleTh} titleEn={titleEn} docType={docType} />
            {infoBox}
            {isLast ? (
              <>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <table className="icr-tbl-inner icr-tbl-spaced" style={{ width: '100%', height: '100%' }}><TableCols />
                    <thead><tr>{headCells(qtyAlign)}</tr></thead>
                    <tbody>
                      {pageItems.map((row, i) => <ItemRow key={i} row={row} qtyAlign={qtyAlign} />)}
                      <FillerTr />
                    </tbody>
                  </table>
                </div>
                <ICPrintFooter />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <table className="icr-tbl" style={{ flex: 1, height: '100%' }}><TableCols />
                  <thead><tr>{headCells(qtyAlign)}</tr></thead>
                  <tbody className="stretch">{pageItems.map((row, i) => <ItemRow key={i} row={row} qtyAlign={qtyAlign} />)}</tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>, document.body,
  )
}

export default ICPrintLayout
