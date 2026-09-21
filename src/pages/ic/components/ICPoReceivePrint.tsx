import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import logo from '../../../components/asset/Genius Logo-01.jpg'

// Standalone IC PO Receive print component, modeled structurally on
// PurchaseOrderPrint.tsx (page setup/print CSS/two-column info box/
// signature block) and PRPrint.tsx (simpler footer with no financial
// summary). NOT shared with either — same reasoning as PRPrint.tsx's own
// header comment: keep independent so a layout change to one document can
// never accidentally affect another.

const BK = '#000000'

export interface ICReceivePrintItem {
  no: string
  costCode?: string
  desc: string
  qty: number
}

export interface ICReceivePrintData {
  poNo: string
  projectName: string
  tempDeliveryNo?: string | null
  tempDeliveryDate?: string | null
  receiveNo: string
  receivedDate: string
  jobCode?: string | null
  items: ICReceivePrintItem[]
}

export const MOCK_DATA: ICReceivePrintData = {
  poNo: 'FACS-6906-0001',
  projectName: 'โครงการก่อสร้างโรงงานนครปฐม',
  tempDeliveryNo: 'DN-2026-0012',
  tempDeliveryDate: '20/06/2026',
  receiveNo: 'POR-202609-0001',
  receivedDate: '21/06/2026',
  jobCode: 'CIVIL-01',
  items: [
    { no: '1', costCode: 'CC-001', desc: 'Equal Angles Steel (เหล็กฉาก) 1-1/2"×1-1/2"×3mm×6M.', qty: 40 },
    { no: '2', costCode: 'CC-002', desc: 'Equal Angles Steel (เหล็กฉาก) 2"×2"×3mm×6M.', qty: 10 },
    { no: '3', costCode: '', desc: 'Flat Bar Steel (เหล็กแบน) 50×5mm×6M.', qty: 8 },
  ],
}

function normalizeItem(raw: Partial<ICReceivePrintItem> & Record<string, any>): ICReceivePrintItem {
  return {
    no: raw.no ?? '',
    costCode: raw.costCode ?? '',
    desc: raw.desc ?? '',
    qty: raw.qty ?? 0,
  }
}

function normalizeData(raw: ICReceivePrintData): ICReceivePrintData {
  return {
    ...raw,
    items: (raw.items ?? []).map(normalizeItem),
  }
}

const MM_TO_PX = 96 / 25.4
const PAGE_H_MM = 275
const BOTTOM_BUFFER_MM = 8

const CSS = `
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
  .icr-tbl th,.icr-tbl-inner th{font-family:'Cordia New',sans-serif;font-weight:700;font-size:12pt;text-align:center;padding:2px 3px;height:7mm;
    border-bottom:1px solid #000;border-right:1px solid #000;background:#fff;}
  .icr-tbl th:last-child,.icr-tbl-inner th:last-child{border-right:none;}
  .icr-tbl td,.icr-tbl-inner td{font-family:'Cordia New',sans-serif;font-size:12pt;padding:6px 5px;vertical-align:top;border:none;border-right:1px solid #000;overflow:hidden;line-height:1.2;}
  .icr-tbl td:last-child,.icr-tbl-inner td:last-child{border-right:none;}
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

// 3 side-by-side signature blocks, no auto-filled name/date — the date line
// stays blank for the signer to fill by hand, unlike PR/PO's auto-filled
// "(doc date)" footer, per explicit spec for this document.
const AUTH_COLS = [
  { label: 'ผู้รับจัดทำ' },
  { label: 'ผู้จัดสินค้าเข้าคลัง' },
  { label: 'ผู้ตรวจสอบ' },
]

const FillerTr = () => (
  <tr style={{ height: '100%' }}>
    <td /><td /><td /><td />
  </tr>
)

const TABLE_COLS = (
  <colgroup>
    <col style={{ width: '14mm' }} /><col style={{ width: '30mm' }} />
    <col /><col style={{ width: '24mm' }} />
  </colgroup>
)
const TABLE_HEAD = (
  <thead><tr>
    {['ลำดับ', 'CostCode', 'รายการ', 'จำนวน'].map((h) => <th key={h}>{h}</th>)}
  </tr></thead>
)

const ICReceiveHeader = ({ pageNum, totalPages }: { pageNum: number; totalPages: number }) => (
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
        <div style={{ fontSize: '18pt', fontWeight: 700, color: BK, lineHeight: 1.1, marginTop: '4px' }}>ใบรับสินค้า</div>
        <div style={{ fontSize: '13pt', fontWeight: 600, color: BK, marginTop: '6px' }}>PO Receive</div>
      </div>
    </div>
  </div>
)

const ICReceiveInfoBox = ({ data }: { data: ICReceivePrintData }) => (
  <div className="icr-box" style={{ display: 'flex', fontSize: '12pt', fontFamily: "'Cordia New',sans-serif" }}>
    <div style={{ width: '50%', borderRight: '1px solid #000', padding: '3px 8px', display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
      <div><b>เลขที่ใบสั่งซื้อ :</b>&nbsp;{data.poNo}</div>
      <div><b>โครงการ :</b>&nbsp;{data.projectName || '-'}</div>
      <div><b>เลขที่ใบส่งของ :</b>&nbsp;{data.tempDeliveryNo || '-'}</div>
      <div><b>วันที่ส่งของ :</b>&nbsp;{data.tempDeliveryDate || '-'}</div>
    </div>
    <div style={{ flex: 1, padding: '3px 8px', display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ fontSize: '14pt', fontWeight: 700 }}><b>เลขที่ใบรับสินค้า :</b>&nbsp;{data.receiveNo}</span>
      </div>
      <div><b>วันที่รับ :</b>&nbsp;{data.receivedDate}</div>
      <div><b>ระบบงาน :</b>&nbsp;{data.jobCode || '-'}</div>
    </div>
  </div>
)

const ItemRow = ({ row }: { row: ICReceivePrintItem }) => (
  <tr>
    <td style={{ textAlign: 'center' }}>{row.no}</td>
    <td style={{ color: '#444', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.costCode || '-'}</td>
    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{row.desc}</td>
    <td style={{ textAlign: 'center' }}>{row.qty || ''}</td>
  </tr>
)

const ICReceiveFooter = () => (
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

interface Props { data: ICReceivePrintData; onReady?: () => void }

const ICPoReceivePrint: React.FC<Props> = ({ data: rawData, onReady }) => {
  const data = normalizeData(rawData)
  const refHeader = useRef<HTMLDivElement>(null)
  const refInfo = useRef<HTMLDivElement>(null)
  const refFooter = useRef<HTMLDivElement>(null)
  const refRow = useRef<HTMLTableRowElement>(null)
  const refThead = useRef<HTMLTableSectionElement>(null)

  const [pages, setPages] = useState<ICReceivePrintItem[][] | null>(null)
  const [rowsLast, setRowsLast] = useState(10)
  const [logoReady, setLogoReady] = useState(false)

  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'icr-print-style'; s.textContent = CSS
    document.head.appendChild(s)
    return () => { document.getElementById('icr-print-style')?.remove() }
  }, [])

  // Preload the logo so onReady (and window.print()) never fires before the
  // browser has actually finished loading/decoding the image — mirrors
  // PRPrint.tsx/PurchaseOrderPrint.tsx's fix for the same intermittent
  // missing-logo-on-print bug.
  useEffect(() => {
    const img = new Image()
    img.onload = () => setLogoReady(true)
    img.onerror = () => { console.warn('[ICReceive] logo image failed to load, printing without it'); setLogoReady(true) }
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
    const result: ICReceivePrintItem[][] = []
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
      <div className="icr-portal">
        <div className="icr-page" style={{ visibility: 'hidden' }}>
          <div ref={refHeader}><ICReceiveHeader pageNum={1} totalPages={1} /></div>
          <div ref={refInfo}><ICReceiveInfoBox data={data} /></div>
          <table className="icr-tbl">{TABLE_COLS}
            <thead ref={refThead}>{TABLE_HEAD.props.children}</thead>
            <tbody><tr ref={refRow}>
              <td>1</td><td>CC-001</td><td>Sample desc</td><td>10</td>
            </tr></tbody>
          </table>
          <div ref={refFooter}><ICReceiveFooter /></div>
        </div>
      </div>, document.body,
    )
  }

  const totalPages = pages.length
  return ReactDOM.createPortal(
    <div className="icr-portal">
      {pages.map((pageItems, pageIdx) => {
        const isLast = pageIdx === totalPages - 1
        const rows = [...pageItems]
        return (
          <div key={pageIdx} className="icr-page">
            <ICReceiveHeader pageNum={pageIdx + 1} totalPages={totalPages} />
            <ICReceiveInfoBox data={data} />
            {isLast ? (
              <>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <table className="icr-tbl-inner icr-tbl-spaced" style={{ width: '100%', height: '100%' }}>{TABLE_COLS}{TABLE_HEAD}
                    <tbody>
                      {rows.map((row, i) => <ItemRow key={i} row={row} />)}
                      <FillerTr />
                    </tbody>
                  </table>
                </div>
                <ICReceiveFooter />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <table className="icr-tbl" style={{ flex: 1, height: '100%' }}>{TABLE_COLS}{TABLE_HEAD}
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

export default ICPoReceivePrint
