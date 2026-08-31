import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import logo from '../../components/asset/Genius Logo-01.jpg'

// Standalone PR print component. NOT shared with PurchaseOrderPrint.tsx —
// PurchaseOrderPrint.tsx was only used as a visual/structural reference
// (page setup, print CSS, signature block) when building this file. Do not
// merge the two behind conditional PR/PO logic; keep them independent so a
// change to one document's layout can never accidentally affect the other.

const BK = '#000000'

export type PROrderType = 'stock' | 'cost' | ''

export interface PRItem {
  no: string
  // Pre-resolved display label, e.g. "CC-001 — Subgroup Name" — resolve the
  // same way PRItemsTable/PRDetailPage already do:
  // `${cost_code}${cost_subgroup_name ? ` — ${cost_subgroup_name}` : ''}`
  costCode?: string
  matCode?: string
  desc: string
  // Item spec/specification text — shown as a second line under the
  // description in the print table. Source: PR line's `spec_name` field
  // (see types/pr.ts PRLine.spec_name) — NOT currently wired through by
  // PRDetailPage.tsx's handlePrint, which this file was told not to touch.
  spec?: string
  qty: number
  unit: string
  remark?: string
}

export interface PRData {
  prNo: string
  prDate: string
  // Header fields (independent field set from PO's header):
  projectDept: string   // purchase_request.project_code
  vendor: string         // no data source yet — always rendered blank
  deliveryDate: string   // purchase_request.required_date (กำหนดส่งของ)
  deliveryTo: string     // purchase_request.location_text (สถานที่ส่งของ)
  remark: string         // purchase_request.remarks
  orderType: PROrderType // purchase_request.order_type
  // purchase_request.status — drives the "DRAFT" print watermark only.
  // Not used for anything else here (PR has no approval flow on this status,
  // see CLAUDE.md); optional because older callers may not pass it.
  status?: string
  items: PRItem[]
}

// Dev-only fixture — isolated preview/testing only, never a silent production
// fallback. Real usage must always pass real `data` from the API.
export const MOCK_DATA: PRData = {
  prNo: 'PR6906-0001', prDate: '15/06/2026',
  projectDept: 'GNS-033', vendor: '', deliveryDate: '25/06/2569',
  deliveryTo: 'โรงงานนครปฐม', remark: 'ขอเบิกเร่งด่วนสำหรับงานหน้างาน Zone B',
  orderType: 'stock',
  items: [
    { no: '1', costCode: 'CC-001 — โครงสร้าง', matCode: '1001001', desc: 'Equal Angles Steel (เหล็กฉาก) 1-1/2"×1-1/2"×3mm×6M.', spec: 'SS400, Hot-dip Galvanized', qty: 40, unit: 'เส้น', remark: '' },
    { no: '2', costCode: 'CC-002 — งานหลังคา', matCode: '1001002', desc: 'Equal Angles Steel (เหล็กฉาก) 2"×2"×3mm×6M.', spec: 'SS400', qty: 10, unit: 'เส้น', remark: 'Zone A อาคาร 2' },
    { no: '3', costCode: '', matCode: '1001003', desc: 'Flat Bar Steel (เหล็กแบน) 50×5mm×6M.', spec: '', qty: 8, unit: 'เส้น', remark: '' },
  ],
}

// The print view's `data` prop comes from the caller's own fetch (e.g.
// GET /pr/:id), not from the live form's state — null-guard here so the
// print layout never breaks on a missing/absent field.
function normalizeItem(raw: Partial<PRItem> & Record<string, any>): PRItem {
  return {
    no: raw.no ?? '',
    costCode: raw.costCode ?? '',
    matCode: raw.matCode ?? '',
    desc: raw.desc ?? '',
    spec: raw.spec ?? '',
    qty: raw.qty ?? 0,
    unit: raw.unit ?? '',
    remark: raw.remark ?? '',
  }
}

function normalizeData(raw: PRData): PRData {
  return {
    ...raw,
    items: (raw.items ?? []).map(normalizeItem),
  }
}

const ORDER_TYPE_LABEL: Record<string, string> = {
  stock: 'คลังสินค้า',
  cost: 'โครงการ',
}

const MM_TO_PX = 96 / 25.4
const PAGE_H_MM = 275
const BOTTOM_BUFFER_MM = 8

const CSS = `
  .pr-portal { font-family:'Sarabun',sans-serif; color:#000; background:#fff;
    position:fixed; top:-9999px; left:-9999px; visibility:hidden; }
  .pr-portal * { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @media print {
    body>*:not(.pr-portal){display:none !important;}
    .pr-portal{position:static !important;visibility:visible !important;}
    .pr-page{page-break-after:always;}
    .pr-page:last-child{page-break-after:avoid;}
    @page{size:A4 portrait;margin:0;}
  }
  .pr-page{width:210mm;height:297mm;padding:6mm 8mm 12mm 8mm;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;position:relative;}
  .pr-watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-38deg);
    font-size:130pt;font-weight:800;letter-spacing:10px;color:#000;opacity:0.12;
    white-space:nowrap;pointer-events:none;user-select:none;z-index:0;font-family:'Sarabun',sans-serif;}
  .pr-box-first{border-bottom:1px solid #000;}
  .pr-box{border:1px solid #000;border-top:none;}

  .pr-tbl{width:100%;border-collapse:collapse;table-layout:fixed;
    border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}
  .pr-tbl-inner{width:100%;border-collapse:collapse;table-layout:fixed;
    border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}
  .pr-tbl thead,.pr-tbl-inner thead{display:table-header-group;}
  .pr-tbl th,.pr-tbl-inner th{font-family:'Cordia New',sans-serif;font-weight:700;font-size:12pt;text-align:center;padding:2px 3px;height:7mm;
    border-bottom:1px solid #000;border-right:1px solid #000;background:#fff;}
  .pr-tbl th:last-child,.pr-tbl-inner th:last-child{border-right:none;}
  .pr-tbl td,.pr-tbl-inner td{font-family:'Cordia New',sans-serif;font-size:12pt;padding:6px 5px;vertical-align:top;border:none;border-right:1px solid #000;overflow:hidden;line-height:1.2;}
  .pr-tbl td:last-child,.pr-tbl-inner td:last-child{border-right:none;}
  .pr-tbl-spaced td{padding-top:9px;padding-bottom:9px;}
  .pr-tbl tbody.stretch,.pr-tbl-inner tbody.stretch{height:100%;}
  .pr-tbl tbody.stretch tr,.pr-tbl-inner tbody.stretch tr{height:1%;}

  .auth-col{flex-shrink:0;border-right:1px solid #000;display:flex;flex-direction:column;}
  .auth-col:last-child{border-right:none;}
  .auth-body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;text-align:center;padding:2px 3px;height:6mm;}
  .auth-head{flex:1;display:flex;flex-direction:column;justify-content:flex-end;
    padding:2px 4px;font-family:'Cordia New',sans-serif;font-size:12pt;border-top:none;border-bottom:1px solid #000;}
  .auth-date{text-align:center;font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;padding:1px 4px;}
`

// Same structure/labels/styling as PO's four-column auth block, minus
// "Supplier Signature" — a PR is an internal document created before any
// supplier is selected (that happens later, at RFQ/PO stage), so that box
// has no PR equivalent.
const AUTH_COLS = [
  { label: 'Supply Chain Department', width: '6.3cm' },
  { label: 'Section Head', width: '6.69cm' },
  { label: 'Authorized Signature', width: '6.41cm' },
]

const FillerTr = () => (
  <tr style={{ height: '100%' }}>
    <td /><td /><td /><td /><td /><td /><td />
  </tr>
)

const TABLE_COLS = (
  <colgroup>
    <col style={{ width: '11mm' }} /><col style={{ width: '28mm' }} /><col style={{ width: '24mm' }} />
    <col /><col style={{ width: '18mm' }} /><col style={{ width: '16mm' }} /><col style={{ width: '30mm' }} />
  </colgroup>
)
const TABLE_HEAD = (
  <thead><tr>
    {['No', 'Cost Code', 'Mat Code', 'รายละเอียด', 'จำนวน', 'หน่วย', 'หมายเหตุ'].map((h) => <th key={h}>{h}</th>)}
  </tr></thead>
)

const PRHeader = ({ data, pageNum, totalPages }: { data: PRData; pageNum: number; totalPages: number }) => (
  <div className="pr-box-first" style={{ display: 'flex', alignItems: 'flex-start', minHeight: '26mm' }}>
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
        <div style={{ fontSize: '18pt', fontWeight: 700, color: BK, lineHeight: 1.1, marginTop: '4px' }}>PURCHASE REQUEST</div>
        <div style={{ fontSize: '13pt', fontWeight: 600, color: BK, marginTop: '6px' }}>ใบขอซื้อ</div>
        <div style={{ fontSize: '11pt', fontWeight: 600, color: BK, textAlign: 'right', marginTop: '3px', fontFamily: "'Cordia New',sans-serif" }}>
          PR No : {data.prNo}
        </div>
      </div>
    </div>
  </div>
)

const PRInfoBox = ({ data }: { data: PRData }) => (
  <div className="pr-box" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', padding: '3px 8px', fontSize: '12pt', fontFamily: "'Cordia New',sans-serif", lineHeight: '1.2' }}>
    <div><b>Project / Dept :</b>&nbsp;{data.projectDept}</div>
    <div><b>Date Doc. :</b>&nbsp;{data.prDate}</div>
    <div><b>ประเภทการซื้อ :</b>&nbsp;{ORDER_TYPE_LABEL[data.orderType] ?? ''}</div>
    <div><b>Delivery Date :</b>&nbsp;{data.deliveryDate}</div>
    <div><b>Delivery To :</b>&nbsp;{data.deliveryTo}</div>
    <div style={{ display: 'flex', gap: 4 }}>
      <b style={{ flexShrink: 0 }}>หมายเหตุ / Remark :</b>
      <span>
        {(data.remark || '').split('\n').map((l, i) => <div key={i}>{l}</div>)}
      </span>
    </div>
  </div>
)

// `row.costCode` arrives pre-resolved as `${cost_code}${cost_subgroup_name ? " — " + name : ''}`
// (see PRItem.costCode comment above / PRDetailPage.tsx handlePrint). The subgroup-name
// separator is an EM DASH "—" (U+2014), not an ASCII hyphen "-" — splitting on "—" strips the
// subgroup name and keeps only the code, e.g. "MP01013 — Expanded Metal" -> "MP01013". This
// also correctly leaves codes containing a literal "-" (e.g. "MP-01013") untouched, since we
// only split on "—".
const formatCostCodeForPrint = (costCode?: string): string => {
  if (!costCode) return ''
  const dashIdx = costCode.indexOf('—')
  return dashIdx === -1 ? costCode.trim() : costCode.slice(0, dashIdx).trimEnd()
}

const ItemRow = ({ row }: { row: PRItem }) => (
  <tr>
    <td style={{ textAlign: 'center' }}>{row.no}</td>
    <td style={{ color: '#444', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCostCodeForPrint(row.costCode)}</td>
    <td style={{ color: '#444', textAlign: 'center', whiteSpace: 'nowrap' }}>{row.matCode}</td>
    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      {row.desc}
      {row.spec && <div style={{ color: '#444' }}>{row.spec}</div>}
    </td>
    <td style={{ textAlign: 'center' }}>{row.qty || ''}</td>
    <td style={{ textAlign: 'center' }}>{row.unit}</td>
    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{row.remark}</td>
  </tr>
)

const PRFooter = ({ data }: { data: PRData }) => (
  <>
    <div style={{ height: '28mm', display: 'flex', flexDirection: 'column' }}>
      <div className="pr-box" style={{ display: 'flex', flex: 1 }}>
        {AUTH_COLS.map((col, i) => (
          <div key={i} className="auth-col" style={{ width: col.width }}>
            <div className="auth-head" />
            <div className="auth-body">
              <div style={{ fontWeight: 600 }}>{col.label}</div>
            </div>
            <div className="auth-date">({data.prDate})</div>
          </div>
        ))}
      </div>
    </div>
  </>
)

interface Props { data: PRData; onReady?: () => void }

const PRPrint: React.FC<Props> = ({ data: rawData, onReady }) => {
  // rawData is whatever the caller fetched — normalize once, here, so every
  // downstream read of `data` sees complete, correctly-typed fields
  // regardless of backend response shape.
  const data = normalizeData(rawData)
  const refHeader = useRef<HTMLDivElement>(null)
  const refInfo = useRef<HTMLDivElement>(null)
  const refFooter = useRef<HTMLDivElement>(null)
  const refRow = useRef<HTMLTableRowElement>(null)
  const refThead = useRef<HTMLTableSectionElement>(null)

  const [pages, setPages] = useState<PRItem[][] | null>(null)
  const [rowsLast, setRowsLast] = useState(10)
  const [logoReady, setLogoReady] = useState(false)

  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'pr-print-style'; s.textContent = CSS
    document.head.appendChild(s)
    return () => { document.getElementById('pr-print-style')?.remove() }
  }, [])

  // Preload the logo so onReady (and window.print()) never fires before the
  // browser has actually finished loading/decoding the image — the source of
  // an intermittent missing-logo-on-print bug.
  useEffect(() => {
    const img = new Image()
    img.onload = () => setLogoReady(true)
    img.onerror = () => { console.warn('[PR] logo image failed to load, printing without it'); setLogoReady(true) }
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
    const result: PRItem[][] = []
    let idx = 0
    while (idx < data.items.length) {
      const last = idx + rOther >= data.items.length
      result.push(data.items.slice(idx, idx + (last ? rLast : rOther)))
      idx += last ? rLast : rOther
    }
    if (result.length === 0) result.push([])
    setRowsLast(rLast)
    setPages(result)
  })

  useEffect(() => {
    if (pages !== null && logoReady) onReady?.()
  }, [pages, logoReady])

  if (pages === null) {
    return ReactDOM.createPortal(
      <div className="pr-portal">
        <div className="pr-page" style={{ visibility: 'hidden' }}>
          <div ref={refHeader}><PRHeader data={data} pageNum={1} totalPages={1} /></div>
          <div ref={refInfo}><PRInfoBox data={data} /></div>
          <table className="pr-tbl">{TABLE_COLS}
            <thead ref={refThead}>{TABLE_HEAD.props.children}</thead>
            <tbody><tr ref={refRow}>
              <td>1</td><td>CC-001</td><td>CODE</td><td>Sample desc</td>
              <td>10</td><td>เส้น</td><td>—</td>
            </tr></tbody>
          </table>
          <div ref={refFooter}><PRFooter data={data} /></div>
        </div>
      </div>, document.body,
    )
  }

  const totalPages = pages.length
  return ReactDOM.createPortal(
    <div className="pr-portal">
      {pages.map((pageItems, pageIdx) => {
        const isLast = pageIdx === totalPages - 1
        const rows = [...pageItems]
        return (
          <div key={pageIdx} className="pr-page">
            {data.status === 'DRAFT' && <div className="pr-watermark">DRAFT</div>}
            <PRHeader data={data} pageNum={pageIdx + 1} totalPages={totalPages} />
            <PRInfoBox data={data} />
            {isLast ? (
              <>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <table className="pr-tbl-inner pr-tbl-spaced" style={{ width: '100%', height: '100%' }}>{TABLE_COLS}{TABLE_HEAD}
                    <tbody>
                      {rows.map((row, i) => <ItemRow key={i} row={row} />)}
                      <FillerTr />
                    </tbody>
                  </table>
                </div>
                <PRFooter data={data} />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <table className="pr-tbl" style={{ flex: 1, height: '100%' }}>{TABLE_COLS}{TABLE_HEAD}
                  <tbody className="stretch">{rows.map((row, i) => <ItemRow key={i} row={row} />)}</tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>, document.body,
  )
}

export default PRPrint
