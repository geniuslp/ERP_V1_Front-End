import SignerId from '@/components/print/SignerId'
import { paginateRows } from '@/utils/printPagination'
import FormattedNote from '@/components/common/FormattedNote'
import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import logo from '../../components/asset/Genius Logo-01.jpg'

// Print of เอกสารแจ้งซ่อม > 5.1 ใบบันทึกการแจ้งซ่อม (MAINTENANCE). Standalone — the header block is the same as
// MemoPrint.tsx's (company block + logo), but the file is independent so a change to one document never moves the
// other (project convention). Same logo-preload + onReady()-gated window.print() pattern as every print here.

export interface RepairPrintItem {
  no: string
  machineName: string
  machineCode: string
  symptom: string
  qty: number
  unit: string
}

export interface RepairPrintData {
  requestNo: string
  project: string        // "{code} {name}"
  dept: string
  branch: string
  priority: string       // ด่วนมาก / ด่วน / ปกติ
  requestDate: string    // DD/MM/YYYY
  needDate: string       // DD/MM/YYYY
  requester: string      // ผู้แจ้งซ่อม (full name)
  requesterUsername: string
  approverUsername: string   // empty until the approval step (5.2) exists
  approvedDate: string
  status?: string        // DRAFT -> watermark
  items: RepairPrintItem[]
}

const MM_TO_PX = 96 / 25.4
const PAGE_H_MM = 275
const BOTTOM_BUFFER_MM = 8

const CSS = `
  .rep-portal { font-family:'Cordia New','Sarabun',sans-serif; color:#000; background:#fff;
    position:fixed; top:-9999px; left:-9999px; visibility:hidden; }
  .rep-portal * { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @media print {
    body>*:not(.rep-portal){display:none !important;}
    .rep-portal{position:static !important;visibility:visible !important;}
    .rep-page{page-break-after:always;}
    .rep-page:last-child{page-break-after:avoid;}
    @page{size:A4 portrait;margin:0;}
  }
  .rep-page{width:210mm;height:297mm;padding:6mm 8mm 12mm 8mm;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;position:relative;}
  .rep-watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-38deg);
    font-size:205pt;font-weight:800;letter-spacing:10px;color:#000;opacity:0.12;
    white-space:nowrap;pointer-events:none;user-select:none;z-index:0;}
  .rep-box-first{border-bottom:1px solid #000;}
  .rep-box{border:1px solid #000;border-top:none;}
  .rep-tbl{width:100%;border-collapse:collapse;table-layout:fixed;
    border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}
  .rep-tbl thead{display:table-header-group;}
  .rep-tbl th{font-family:'Cordia New',sans-serif;font-weight:700;font-size:12pt;text-align:center;padding:2px 3px;height:7mm;
    border-bottom:1px solid #000;border-right:1px solid #000;background:#fff;}
  .rep-tbl th:last-child{border-right:none;}
  .rep-tbl td{font-family:'Cordia New',sans-serif;font-size:12pt;padding:6px 5px;vertical-align:top;border:none;border-right:1px solid #000;overflow:hidden;line-height:1.2;}
  .rep-tbl td:last-child{border-right:none;}
  .rep-auth-col{flex-shrink:0;border-right:1px solid #000;display:flex;flex-direction:column;}
  .rep-auth-col:last-child{border-right:none;}
  .rep-auth-head{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:2px 4px;}
  .rep-auth-body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;text-align:center;padding:10px 3px 2px 3px;height:6mm;}
  .rep-auth-date{text-align:center;font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;padding:1px 4px;}
`

const TABLE_COLS = (
  <colgroup>
    <col style={{ width: '11mm' }} />
    <col /><col style={{ width: '18mm' }} /><col style={{ width: '18mm' }} />
  </colgroup>
)
const TABLE_HEAD = (
  <thead><tr>
    {['ลำดับ', 'รายละเอียด', 'QTY', 'UNIT'].map((h) => <th key={h}>{h}</th>)}
  </tr></thead>
)

const FillerTr = () => (
  <tr style={{ height: '100%' }}><td /><td /><td /><td /></tr>
)

const Header = ({ data, pageNum, totalPages }: { data: RepairPrintData; pageNum: number; totalPages: number }) => (
  <div className="rep-box-first" style={{ display: 'flex', alignItems: 'flex-start', minHeight: '26mm' }}>
    <div style={{ width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0px' }}>
      <img src={logo} alt="Logo" width={4248} height={1844}
        style={{ marginTop: '1px', height: '22mm', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: '14.5pt', color: '#02276e', lineHeight: 1, marginLeft: '3px', fontFamily: 'Cordia New', whiteSpace: 'nowrap' }}>บริษัท จีเนียส เอนจิเนียริง จำกัด (สำนักงานใหญ่)</div>
        <div style={{ fontSize: '13.5pt', color: '#02276e', lineHeight: 1, borderBottom: '0.1px solid #000', marginLeft: '3px', paddingBottom: '1px', marginBottom: '3px', fontFamily: 'Cordia New', whiteSpace: 'nowrap' }}>Genius Engineering Co., Ltd. (Head Office)</div>
        <div style={{ fontSize: '11pt', color: '#02276e', lineHeight: 1.05, fontFamily: 'Cordia New', marginLeft: '3px' }}>
          <div style={{ whiteSpace: 'nowrap' }}>1467 ถนนกาญจนาภิเษก แขวงบางแคเหนือ เขตบางแค กรุงเทพฯ 10160</div>
          <div style={{ whiteSpace: 'nowrap' }}>1467 Kanjanapisek Rd., Bangkaenua, Bangkok 10160</div>
          <div style={{ whiteSpace: 'nowrap' }}>Tel. (66)2 805 6820&nbsp;&nbsp;TaxID.&nbsp;0105554142442&nbsp;&nbsp;www.geniuslp.com</div>
        </div>
      </div>
    </div>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '2px 8px 4px 8px' }}>
      <div style={{ fontSize: '7.5pt', color: '#444' }}>Page {pageNum}/{totalPages}</div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '18pt', fontWeight: 700, lineHeight: 1.1, marginTop: '4px' }}>MAINTENANCE</div>
        <div style={{ fontSize: '13pt', fontWeight: 600, marginTop: '6px' }}>ใบบันทึกการแจ้งซ่อม</div>
        <div style={{ fontSize: '11pt', fontWeight: 600, marginTop: '3px', fontFamily: "'Cordia New',sans-serif" }}>No : {data.requestNo}</div>
      </div>
    </div>
  </div>
)

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', gap: 4 }}>
    <b style={{ flexShrink: 0 }}>{label} :</b>
    <span style={{ wordBreak: 'break-word' }}>{value || '-'}</span>
  </div>
)

const InfoBox = ({ data }: { data: RepairPrintData }) => (
  <div className="rep-box" style={{ display: 'flex', gap: 12, padding: '4px 8px', fontSize: '12pt', fontFamily: "'Cordia New',sans-serif", lineHeight: '1.25' }}>
    <div style={{ flex: '1 1 58%', minWidth: 0 }}>
      <InfoRow label="โครงการ" value={data.project} />
      <InfoRow label="แผนก" value={data.dept} />
      <InfoRow label="สาขา" value={data.branch} />
      <InfoRow label="ระดับความสำคัญ" value={data.priority} />
    </div>
    <div style={{ flex: '1 1 42%', minWidth: 0 }}>
      <InfoRow label="วันที่แจ้งซ่อม" value={data.requestDate} />
      <InfoRow label="วันที่ต้องใช้งาน" value={data.needDate} />
      <InfoRow label="ผู้แจ้งซ่อม" value={data.requester} />
    </div>
  </div>
)

// Description = machine name (+ code), then "- อาการเสีย : …" underneath (as on the paper form).
const ItemRow = ({ row, rowRef }: { row: RepairPrintItem; rowRef?: React.Ref<HTMLTableRowElement> }) => (
  <tr ref={rowRef}>
    <td style={{ textAlign: 'center' }}>{row.no}</td>
    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      <div style={{ fontWeight: 600 }}>{row.machineName}{row.machineCode ? ` (รหัสเครื่อง ${row.machineCode})` : ''}</div>
      {row.symptom && (
        <div style={{ display: 'flex', gap: 4, paddingLeft: 8 }}>
          <span style={{ flexShrink: 0 }}>- อาการเสีย :</span>
          <span><FormattedNote value={row.symptom} /></span>
        </div>
      )}
    </td>
    <td style={{ textAlign: 'center' }}>{row.qty || ''}</td>
    <td style={{ textAlign: 'center' }}>{row.unit}</td>
  </tr>
)

const Footer = ({ data }: { data: RepairPrintData }) => {
  const cols = [
    { label: 'Requester', name: data.requesterUsername, date: data.requestDate },
    { label: 'Approver', name: data.approverUsername, date: data.approvedDate },
  ]
  return (
    <div style={{ height: '34mm', display: 'flex', flexDirection: 'column' }}>
      <div className="rep-box" style={{ display: 'flex', flex: 1 }}>
        {cols.map((col) => (
          <div key={col.label} className="rep-auth-col" style={{ width: '50%' }}>
            <div className="rep-auth-head"><SignerId name={col.name} boxMm={90} /></div>
            <div className="rep-auth-body">
              <div style={{ fontWeight: 600 }}>{col.label}</div>
              <div>{col.date || ''}</div>
            </div>
            <div className="rep-auth-date">(...............................)</div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props { data: RepairPrintData; onReady?: () => void }

const RepairRequestPrint: React.FC<Props> = ({ data, onReady }) => {
  const refHeader = useRef<HTMLDivElement>(null)
  const refInfo = useRef<HTMLDivElement>(null)
  const refFooter = useRef<HTMLDivElement>(null)
  const refThead = useRef<HTMLTableSectionElement>(null)
  const refRows = useRef<(HTMLTableRowElement | null)[]>([])
  const [pages, setPages] = useState<RepairPrintItem[][] | null>(null)
  const [logoReady, setLogoReady] = useState(false)

  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'repair-print-style'; s.textContent = CSS
    document.head.appendChild(s)
    return () => { document.getElementById('repair-print-style')?.remove() }
  }, [])

  // Preload the logo so window.print() never fires before it is decoded (a failed load still counts as ready).
  useEffect(() => {
    const img = new Image()
    img.onload = () => setLogoReady(true)
    img.onerror = () => setLogoReady(true)
    img.src = logo
  }, [])

  // Measure every row as it really renders, then split into A4 pages (footer only on the last page).
  useEffect(() => {
    if (pages !== null) return
    if (!refHeader.current || !refInfo.current || !refFooter.current || !refThead.current) return
    const px2mm = (px: number) => px / MM_TO_PX
    const used = px2mm(refHeader.current.getBoundingClientRect().height)
      + px2mm(refInfo.current.getBoundingClientRect().height)
      + px2mm(refThead.current.getBoundingClientRect().height)
    const footer = px2mm(refFooter.current.getBoundingClientRect().height)
    const rowEls = data.items.map((_, i) => refRows.current[i])
    if (rowEls.some((el) => !el)) return
    const heights = rowEls.map((el) => px2mm(el!.getBoundingClientRect().height))
    const idx = paginateRows(heights, PAGE_H_MM - BOTTOM_BUFFER_MM - used, footer, true)
    const result = idx.map((ids) => ids.map((i) => data.items[i]))
    if (result.length === 0) result.push([])
    setPages(result)
  })

  useEffect(() => {
    if (pages !== null && logoReady) onReady?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, logoReady])

  if (pages === null) {
    return ReactDOM.createPortal(
      <div className="rep-portal">
        <div className="rep-page" style={{ visibility: 'hidden' }}>
          <div ref={refHeader}><Header data={data} pageNum={1} totalPages={1} /></div>
          <div ref={refInfo}><InfoBox data={data} /></div>
          <table className="rep-tbl">{TABLE_COLS}
            <thead ref={refThead}>{TABLE_HEAD.props.children}</thead>
            <tbody>{data.items.map((row, i) => <ItemRow key={i} row={row} rowRef={(el) => { refRows.current[i] = el }} />)}</tbody>
          </table>
          <div ref={refFooter}><Footer data={data} /></div>
        </div>
      </div>, document.body,
    )
  }

  const totalPages = pages.length
  return ReactDOM.createPortal(
    <div className="rep-portal">
      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="rep-page">
          {data.status === 'DRAFT' && <div className="rep-watermark">DRAFT</div>}
          <Header data={data} pageNum={pageIdx + 1} totalPages={totalPages} />
          <InfoBox data={data} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <table className="rep-tbl" style={{ width: '100%', height: '100%' }}>{TABLE_COLS}{TABLE_HEAD}
              <tbody>
                {pageItems.map((row, i) => <ItemRow key={i} row={row} />)}
                <FillerTr />
              </tbody>
            </table>
          </div>
          {pageIdx === totalPages - 1 && <Footer data={data} />}
        </div>
      ))}
    </div>, document.body,
  )
}

export default RepairRequestPrint
