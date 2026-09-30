import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import logo from '../../components/asset/Genius Logo-01.jpg'

// Standalone Memo print component. NOT shared with PRPrint.tsx / PurchaseOrderPrint.tsx —
// PRPrint.tsx was only used as a visual/structural reference (page setup, print CSS,
// pagination logic, print-race fix) when building this file. Do not merge these behind
// conditional PR/Memo logic; keep them independent so a change to one document's layout
// can never accidentally affect the others. Per this project's established convention
// (see PRPrint.tsx's own top-of-file comment).

const BK = '#000000'

export interface MemoItem {
  no: string
  desc: string
  qty: number
  unit: string
  remark?: string
}

export interface MemoUserSignature {
  fullName: string
  signatureDataUrl: string
  // Only ever set on the approver's signature — a requester signature has no
  // approval date (same rule as PR's requester_signature).
  approvedAt?: string
}

export interface MemoData {
  memoNo: string
  department: string       // memo.department
  projectName: string      // memo.project_code / project_name
  requestedBy: string      // memo.requested_by_name
  note: string             // memo.note
  // "กำหนดส่งของหน้างาน" — required/target date for on-site delivery.
  // Source: memo.site_delivery_date. Distinct from createdAt (the document's
  // own creation date) the same way PR's requiredDate is distinct from prDate.
  siteDeliveryDate: string
  deliveryLocation: string // memo.delivery_location
  createdAt: string        // memo.created_at — document creation date, shown under both signatures
  approverName: string     // memo.approver_name — single signature line only, see MemoFooter comment
  // GET /memo/:id's requester_signature/approval_signature — both null unless
  // the memo is past DRAFT (requester) / actually APPROVED (approver).
  requesterSignature?: MemoUserSignature | null
  approvalSignature?: MemoUserSignature | null
  // memo.status — drives the "DRAFT" print watermark only, same as PRPrint.
  status?: string
  items: MemoItem[]
}

// Dev-only fixture — isolated preview/testing only, never a silent production fallback.
// Real usage must always pass real `data` from the API.
export const MOCK_DATA: MemoData = {
  memoNo: 'MEMO6906-0001',
  department: 'ฝ่ายวิศวกรรม', projectName: 'GNS-033', requestedBy: 'สมชาย ใจดี',
  note: 'เร่งด่วนสำหรับงานหน้างาน', siteDeliveryDate: '25/06/2569',
  deliveryLocation: 'โรงงานนครปฐม', createdAt: '24/09/2569', approverName: 'สมหญิง รักงาน',
  items: [
    { no: '1', desc: 'Equal Angles Steel (เหล็กฉาก) 1-1/2"×1-1/2"×3mm×6M.', qty: 40, unit: 'เส้น', remark: '' },
    { no: '2', desc: 'Equal Angles Steel (เหล็กฉาก) 2"×2"×3mm×6M.', qty: 10, unit: 'เส้น', remark: 'Zone A อาคาร 2' },
    { no: '3', desc: 'Flat Bar Steel (เหล็กแบน) 50×5mm×6M.', qty: 8, unit: 'เส้น', remark: '' },
  ],
}

// The print view's `data` prop comes from the caller's own fetch (e.g. GET /memo/:id),
// not from the live form's state — null-guard here so the print layout never breaks
// on a missing/absent field.
function normalizeItem(raw: Partial<MemoItem> & Record<string, any>): MemoItem {
  return {
    no: raw.no ?? '',
    desc: raw.desc ?? '',
    qty: raw.qty ?? 0,
    unit: raw.unit ?? '',
    remark: raw.remark ?? '',
  }
}

function normalizeData(raw: MemoData): MemoData {
  return {
    ...raw,
    items: (raw.items ?? []).map(normalizeItem),
  }
}

const MM_TO_PX = 96 / 25.4
const PAGE_H_MM = 275
const BOTTOM_BUFFER_MM = 8

const CSS = `
  .memo-portal { font-family:'Sarabun',sans-serif; color:#000; background:#fff;
    position:fixed; top:-9999px; left:-9999px; visibility:hidden; }
  .memo-portal * { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @media print {
    body>*:not(.memo-portal){display:none !important;}
    .memo-portal{position:static !important;visibility:visible !important;}
    .memo-page{page-break-after:always;}
    .memo-page:last-child{page-break-after:avoid;}
    @page{size:A4 portrait;margin:0;}
  }
  .memo-page{width:210mm;height:297mm;padding:6mm 8mm 12mm 8mm;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;position:relative;}
  .memo-watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-38deg);
    font-size:130pt;font-weight:800;letter-spacing:10px;color:#000;opacity:0.12;
    white-space:nowrap;pointer-events:none;user-select:none;z-index:0;font-family:'Sarabun',sans-serif;}
  .memo-box-first{border-bottom:1px solid #000;}
  .memo-box{border:1px solid #000;border-top:none;}

  .memo-tbl{width:100%;border-collapse:collapse;table-layout:fixed;
    border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}
  .memo-tbl-inner{width:100%;border-collapse:collapse;table-layout:fixed;
    border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}
  .memo-tbl thead,.memo-tbl-inner thead{display:table-header-group;}
  .memo-tbl th,.memo-tbl-inner th{font-family:'Cordia New',sans-serif;font-weight:700;font-size:12pt;text-align:center;padding:2px 3px;height:7mm;
    border-bottom:1px solid #000;border-right:1px solid #000;background:#fff;}
  .memo-tbl th:last-child,.memo-tbl-inner th:last-child{border-right:none;}
  .memo-tbl td,.memo-tbl-inner td{font-family:'Cordia New',sans-serif;font-size:12pt;padding:6px 5px;vertical-align:top;border:none;border-right:1px solid #000;overflow:hidden;line-height:1.2;}
  .memo-tbl td:last-child,.memo-tbl-inner td:last-child{border-right:none;}
  .memo-tbl-spaced td{padding-top:9px;padding-bottom:9px;}
  .memo-tbl tbody.stretch,.memo-tbl-inner tbody.stretch{height:100%;}
  .memo-tbl tbody.stretch tr,.memo-tbl-inner tbody.stretch tr{height:1%;}

  .auth-col{flex-shrink:0;border-right:1px solid #000;display:flex;flex-direction:column;}
  .auth-col:last-child{border-right:none;}
  .auth-body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;text-align:center;padding:10px 3px 2px 3px;height:6mm;}
  .auth-head{flex:1;display:flex;flex-direction:column;justify-content:flex-end;
    padding:2px 4px;font-family:'Cordia New',sans-serif;font-size:12pt;border-top:none;}
  .auth-date{text-align:center;font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;padding:1px 4px;}
`

// Two signature columns — ผู้ขอ (requestedBy) and ผู้อนุมัติ (approverName). Previously
// only the approver had a signature cell; requester was shown as a plain text line in
// the info block instead — moved here to match the approver's box/line treatment.
const AUTH_COLS: { label: string; width: string; key: 'requestedBy' | 'approverName'; sigKey: 'requesterSignature' | 'approvalSignature' }[] = [
  { label: 'ผู้ขอ / Requester', width: '9cm', key: 'requestedBy', sigKey: 'requesterSignature' },
  { label: 'ผู้อนุมัติ / Approver', width: '9cm', key: 'approverName', sigKey: 'approvalSignature' },
]

// Signature image, sized to fit inside the existing empty auth-head slot
// (flex:1, above the label/name) without growing the box — max-height keeps
// it from ever exceeding that slot's available space in the fixed 28mm
// footer, so the page layout/pagination never shifts.
const SignatureImg = ({ src, alt }: { src: string; alt: string }) => (
  <img
    src={src}
    alt={alt}
    style={{ maxHeight: 75, maxWidth: '90%', height: 'auto', width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 8px' }}
  />
)

const FillerTr = () => (
  <tr style={{ height: '100%' }}>
    <td /><td /><td /><td />
  </tr>
)

const TABLE_COLS = (
  <colgroup>
    <col style={{ width: '11mm' }} />
    <col /><col style={{ width: '18mm' }} /><col style={{ width: '16mm' }} />
  </colgroup>
)
const TABLE_HEAD = (
  <thead><tr>
    {['ลำดับ', 'รายละเอียด', 'จำนวน', 'หน่วย'].map((h) => <th key={h}>{h}</th>)}
  </tr></thead>
)

const MemoHeader = ({ data, pageNum, totalPages }: { data: MemoData; pageNum: number; totalPages: number }) => (
  <div className="memo-box-first" style={{ display: 'flex', alignItems: 'flex-start', minHeight: '26mm' }}>
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
          <div style={{ whiteSpace: 'nowrap' }}>1467 Kanjanapisek Rd., Bangkaenua, Bangkok 10160</div>
          <div style={{ whiteSpace: 'nowrap' }}>Tel. (66)2 805 6820&nbsp;&nbsp;TaxID.&nbsp;105554142442&nbsp;&nbsp;www.geniuslp.com</div>
        </div>
      </div>
    </div>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '2px 8px 4px 8px' }}>
      <div style={{ fontSize: '7.5pt', color: '#444' }}>Page {pageNum}/{totalPages}</div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '18pt', fontWeight: 700, color: BK, lineHeight: 1.1, marginTop: '4px' }}>MEMO</div>
        <div style={{ fontSize: '13pt', fontWeight: 600, color: BK, marginTop: '6px' }}>ใบบันทึกขอซื้อ (Memo)</div>
        <div style={{ fontSize: '11pt', fontWeight: 600, color: BK, textAlign: 'right', marginTop: '3px', fontFamily: "'Cordia New',sans-serif" }}>
          Memo No : {data.memoNo}
        </div>
      </div>
    </div>
  </div>
)

const MemoInfoBox = ({ data }: { data: MemoData }) => (
  <div className="memo-box" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', padding: '3px 8px', fontSize: '12pt', fontFamily: "'Cordia New',sans-serif", lineHeight: '1.2' }}>
    <div><b>โครงการ :</b>&nbsp;{data.projectName}</div>
    <div><b>สถานที่ส่งของ :</b>&nbsp;{data.deliveryLocation}</div>
    <div><b>หน่วยงาน :</b>&nbsp;{data.department}</div>
    <div style={{ display: 'flex', gap: 4 }}>
      <b style={{ flexShrink: 0 }}>หมายเหตุ :</b>
      <span>
        {(data.note || '').split('\n').map((l, i) => <div key={i}>{l}</div>)}
      </span>
    </div>
    <div><b>กำหนดส่งของหน้างาน :</b>&nbsp;{data.siteDeliveryDate}</div>
  </div>
)

const ItemRow = ({ row }: { row: MemoItem }) => (
  <tr>
    <td style={{ textAlign: 'center' }}>{row.no}</td>
    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      {row.desc}
      {row.remark && (
        <div style={{ fontSize: '10.5pt', color: '#333' }}>{row.remark}</div>
      )}
    </td>
    <td style={{ textAlign: 'center' }}>{row.qty || ''}</td>
    <td style={{ textAlign: 'center' }}>{row.unit}</td>
  </tr>
)

const MemoFooter = ({ data }: { data: MemoData }) => (
  <>
    <div style={{ height: '34mm', display: 'flex', flexDirection: 'column' }}>
      <div className="memo-box" style={{ display: 'flex', flex: 1, justifyContent: 'center' }}>
        {AUTH_COLS.map((col, i) => {
          const sig = data[col.sigKey]
          // Approver's date must reflect when it was actually approved
          // (approvalSignature.approvedAt), not the document's own createdAt —
          // requester keeps createdAt (the document's own creation date), same
          // as before.
          const dateLine = col.sigKey === 'approvalSignature'
            ? (sig?.approvedAt ? `วันที่ ${sig.approvedAt}` : '')
            : (data.createdAt ? `วันที่ ${data.createdAt}` : '')
          return (
            <div key={i} className="auth-col" style={{ width: col.width }}>
              <div className="auth-head">
                {sig?.signatureDataUrl && <SignatureImg src={sig.signatureDataUrl} alt={col.label} />}
              </div>
              <div className="auth-body">
                <div style={{ fontWeight: 600 }}>{col.label}</div>
                <div>{data[col.key]}</div>
                <div>{dateLine}</div>
              </div>
              <div className="auth-date">(...............................)</div>
            </div>
          )
        })}
      </div>
    </div>
  </>
)

interface Props { data: MemoData; onReady?: () => void }

const MemoPrint: React.FC<Props> = ({ data: rawData, onReady }) => {
  // rawData is whatever the caller fetched — normalize once, here, so every
  // downstream read of `data` sees complete, correctly-typed fields
  // regardless of backend response shape.
  const data = normalizeData(rawData)
  const refHeader = useRef<HTMLDivElement>(null)
  const refInfo = useRef<HTMLDivElement>(null)
  const refFooter = useRef<HTMLDivElement>(null)
  const refRow = useRef<HTMLTableRowElement>(null)
  const refThead = useRef<HTMLTableSectionElement>(null)

  const [pages, setPages] = useState<MemoItem[][] | null>(null)
  const [rowsLast, setRowsLast] = useState(10)
  const [imagesReady, setImagesReady] = useState(false)

  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'memo-print-style'; s.textContent = CSS
    document.head.appendChild(s)
    return () => { document.getElementById('memo-print-style')?.remove() }
  }, [])

  // Preload the logo AND both signature images (if any) so onReady (and
  // window.print()) never fires before the browser has actually finished
  // loading/decoding every image — same fix as PRPrint.tsx's, for the same
  // intermittent missing-logo/missing-signature-on-print bug. A failed load
  // still counts toward "ready" (never hangs) and just leaves that box/logo blank.
  useEffect(() => {
    const sources = [logo, data.requesterSignature?.signatureDataUrl, data.approvalSignature?.signatureDataUrl].filter(
      (s): s is string => !!s,
    )
    let loaded = 0
    const onDone = () => {
      loaded += 1
      if (loaded === sources.length) setImagesReady(true)
    }
    sources.forEach((src) => {
      const img = new Image()
      img.onload = onDone
      img.onerror = () => { console.warn('[Memo] an image failed to load, printing without it'); onDone() }
      img.src = src
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.requesterSignature?.signatureDataUrl, data.approvalSignature?.signatureDataUrl])

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
    const result: MemoItem[][] = []
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
    if (pages !== null && imagesReady) onReady?.()
  }, [pages, imagesReady])

  if (pages === null) {
    return ReactDOM.createPortal(
      <div className="memo-portal">
        <div className="memo-page" style={{ visibility: 'hidden' }}>
          <div ref={refHeader}><MemoHeader data={data} pageNum={1} totalPages={1} /></div>
          <div ref={refInfo}><MemoInfoBox data={data} /></div>
          <table className="memo-tbl">{TABLE_COLS}
            <thead ref={refThead}>{TABLE_HEAD.props.children}</thead>
            <tbody><tr ref={refRow}>
              <td>1</td><td>Sample desc</td>
              <td>10</td><td>เส้น</td>
            </tr></tbody>
          </table>
          <div ref={refFooter}><MemoFooter data={data} /></div>
        </div>
      </div>, document.body,
    )
  }

  const totalPages = pages.length
  return ReactDOM.createPortal(
    <div className="memo-portal">
      {pages.map((pageItems, pageIdx) => {
        const isLast = pageIdx === totalPages - 1
        const rows = [...pageItems]
        return (
          <div key={pageIdx} className="memo-page">
            {(data.status === 'DRAFT' || data.status === 'draft') && <div className="memo-watermark">DRAFT</div>}
            <MemoHeader data={data} pageNum={pageIdx + 1} totalPages={totalPages} />
            <MemoInfoBox data={data} />
            {isLast ? (
              <>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <table className="memo-tbl-inner memo-tbl-spaced" style={{ width: '100%', height: '100%' }}>{TABLE_COLS}{TABLE_HEAD}
                    <tbody>
                      {rows.map((row, i) => <ItemRow key={i} row={row} />)}
                      <FillerTr />
                    </tbody>
                  </table>
                </div>
                <MemoFooter data={data} />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <table className="memo-tbl" style={{ flex: 1, height: '100%' }}>{TABLE_COLS}{TABLE_HEAD}
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

export default MemoPrint
