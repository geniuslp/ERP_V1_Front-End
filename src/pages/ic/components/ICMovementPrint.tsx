import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import dayjs from 'dayjs'
import logo from '../../../components/asset/Genius Logo-01.jpg'
import { formatCostCodeDisplay } from '@/utils/costCode'
import { IC_PRINT_CSS, ICPrintHeader, icInfoGridStyle, icInfoCellStyle, icInfoLeftCellStyle } from './ICPrintLayout'

// IC Project Movement print (ISSUE "เอกสารตัดเบิก" / TRANSFER "เอกสารโอน"). One component for both.
// Data: GET /ic/projects/:code/movements/:id (+ /lines). Shares the A4 shell pieces of
// ICPrintLayout (CSS, letterhead header, logo-preload gating) but owns its table and footer: the
// 7-column table needs real per-row heights (Thai text wraps), so pages are split from measured
// row heights instead of one sample row.

export interface ICMovementPrintLine {
  no: string
  matCode: string
  costCode: string
  desc: string
  unit: string
  qty: number
  remark: string
  toProject: string
  toCostCode: string
}

export interface ICMovementPrintData {
  docType: 'ISSUE' | 'TRANSFER'
  jobCode: string
  jobName: string
  docNo: string
  project: string
  requestedBy: string
  docDate: string
  remarks: string
  lines: ICMovementPrintLine[]
}

const dash = (v?: string | null) => (v && String(v).trim() ? String(v).trim() : '-')

// GET header + lines -> print data. A line with no destination prints "-" in both destination
// columns (the columns are never hidden).
export const buildMovementPrintData = (headerRaw: any, linesRaw: any): ICMovementPrintData => {
  const h = headerRaw?.data ?? headerRaw ?? {}
  const rawLines = linesRaw?.data ?? linesRaw
  const list: any[] = Array.isArray(rawLines) ? rawLines : rawLines?.data ?? []
  const projectCode = h.project_code
  const projectName = h.project_name
  return {
    docType: h.doc_type === 'TRANSFER' ? 'TRANSFER' : 'ISSUE',
    jobCode: h.job_code ?? '',
    jobName: h.job_name ?? '',
    docNo: h.doc_no ?? '',
    project: projectCode && projectName ? `${projectCode} — ${projectName}` : (projectName ?? projectCode ?? ''),
    requestedBy: h.requested_by_name ?? '',
    docDate: h.doc_date ? dayjs(h.doc_date).format('DD/MM/YYYY') : '',
    remarks: h.remarks ?? h.remark ?? '',
    lines: list.map((l, i) => {
      const toCode = l.to_project_code
      const toName = l.to_project_name
      return {
        no: String(l.line_no ?? i + 1),
        matCode: l.mat_code ?? '',
        costCode: l.cost_code ?? '',
        desc: l.mat_name ?? l.item_name ?? '',
        unit: l.unit ?? '',
        qty: Number(l.qty ?? 0),
        remark: l.remarks ?? l.remark ?? '',
        toProject: toCode && toName ? `${toCode} — ${toName}` : (toName ?? toCode ?? ''),
        toCostCode: l.to_cost_code ?? '',
      }
    }),
  }
}

const TITLE: Record<'ISSUE' | 'TRANSFER', string> = {
  ISSUE: 'เอกสารตัดเบิก (Issue)',
  TRANSFER: 'เอกสารโอน (Transfer)',
}
const TYPE_TEXT: Record<'ISSUE' | 'TRANSFER', string> = { ISSUE: 'Issue', TRANSFER: 'Transfer' }

const MM_TO_PX = 96 / 25.4
const PAGE_H_MM = 275
const BOTTOM_BUFFER_MM = 8

const EXTRA_CSS = `
  .icm-tbl td,.icm-tbl th{overflow-wrap:anywhere;word-break:break-word;}
  .icm-blank{display:flex;align-items:flex-end;gap:4px;font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.1;}
  .icm-blank .icm-line{flex:1;border-bottom:1px dotted #000;height:1em;min-width:10mm;}
`

const Cols = () => (
  <colgroup>
    <col style={{ width: '15mm' }} /><col style={{ width: '30mm' }} /><col style={{ width: '24mm' }} />
    <col /><col style={{ width: '16mm' }} /><col style={{ width: '32mm' }} /><col style={{ width: '26mm' }} />
  </colgroup>
)

const HeadCells = () => (
  <tr>
    <th style={{ whiteSpace: 'nowrap' }}>ลำดับ</th>
    <th style={{ whiteSpace: 'nowrap' }}>Mat Code</th>
    <th>Cost Code</th>
    <th style={{ textAlign: 'left' }}>รายการ</th>
    <th style={{ textAlign: 'right' }}>Qty</th>
    <th>เบิกไปโครงการ</th>
    <th>Cost Code<br />โครงการปลายทาง</th>
  </tr>
)

const Row = React.forwardRef<HTMLTableRowElement, { row: ICMovementPrintLine }>(({ row }, ref) => (
  <tr ref={ref}>
    <td style={{ textAlign: 'center' }}>{row.no}</td>
    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{dash(row.matCode)}</td>
    <td style={{ textAlign: 'center', color: '#444' }}>{formatCostCodeDisplay(row.costCode) || '-'}</td>
    <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>
      {row.desc}
      {row.unit ? <div style={{ fontSize: '10.5pt', color: '#444' }}>หน่วย: {row.unit}</div> : null}
      {row.remark ? <div style={{ fontSize: '10.5pt', color: '#444' }}>หมายเหตุ: {row.remark}</div> : null}
    </td>
    <td style={{ textAlign: 'right' }}>{row.qty || ''}</td>
    <td style={{ textAlign: 'left' }}>{dash(row.toProject)}</td>
    <td style={{ textAlign: 'center', color: '#444' }}>{formatCostCodeDisplay(row.toCostCode) || '-'}</td>
  </tr>
))
Row.displayName = 'ICMovementPrintRow'

// "<code> - <name>"; the backend falls back to the code as the name for unknown codes, so skip the repeat.
const jobLabel = (code: string, name: string) => {
  const c = code?.trim(), n = name?.trim()
  if (c && n && n !== c) return `${c} - ${n}`
  return dash(c || n)
}

const InfoBox = ({ data }: { data: ICMovementPrintData }) => (
  <div className="icr-box" style={icInfoGridStyle}>
    <div style={icInfoLeftCellStyle}><b>โครงการ :</b>&nbsp;{dash(data.project)}</div>
    <div style={icInfoCellStyle}><b>เลขที่ :</b>&nbsp;{dash(data.docNo)}</div>
    <div style={icInfoLeftCellStyle}><b>ผู้ขอเบิก :</b>&nbsp;{dash(data.requestedBy)}</div>
    <div style={icInfoCellStyle}><b>วันที่ :</b>&nbsp;{dash(data.docDate)}</div>
    <div style={icInfoLeftCellStyle}><b>ประเภท :</b>&nbsp;{TYPE_TEXT[data.docType]}</div>
    <div style={{ ...icInfoCellStyle, overflowWrap: 'anywhere', wordBreak: 'break-word' }}><b>ระบบ :</b>&nbsp;{jobLabel(data.jobCode, data.jobName)}</div>
  </div>
)

// "label ........" blank for handwriting.
const Blank = ({ label }: { label: string }) => (
  <div className="icm-blank" style={{ flex: 1 }}><span>{label} :</span><span className="icm-line" /></div>
)

const SIGN_LABELS = ['ผู้จัดทำ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ', 'ผู้รับสินค้า']

// Remark box + delivery blanks + 4 signature boxes. Always rendered together on the last page.
const Tail = ({ remarks }: { remarks: string }) => (
  <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
    <div className="icr-box" style={{ minHeight: '16mm', padding: '3px 8px', fontFamily: "'Cordia New',sans-serif", fontSize: '12pt', lineHeight: 1.2 }}>
      <b>Remark :</b>&nbsp;
      <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{remarks.trim()}</span>
    </div>
    <div className="icr-box" style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 14 }}>
        <Blank label="จัดส่ง" /><Blank label="ขนส่งโดย" /><Blank label="คนขับรถ" /><Blank label="หมายเลขทะเบียน" />
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <Blank label="โรงงาน" /><Blank label="หัวหน้าขนส่ง" />
        <div style={{ flex: 2 }} />
      </div>
    </div>
    <div className="icr-box" style={{ display: 'flex', height: '28mm' }}>
      {SIGN_LABELS.map((label) => (
        <div key={label} className="auth-col">
          <div className="auth-head" />
          <div className="auth-body"><div style={{ fontWeight: 600 }}>{label}</div></div>
          <div className="auth-date" />
        </div>
      ))}
    </div>
  </div>
)

interface Props { data: ICMovementPrintData; onReady?: () => void }

const ICMovementPrint: React.FC<Props> = ({ data, onReady }) => {
  const [pages, setPages] = useState<ICMovementPrintLine[][] | null>(null)
  const [logoReady, setLogoReady] = useState(false)
  const refHeader = useRef<HTMLDivElement>(null)
  const refInfo = useRef<HTMLDivElement>(null)
  const refThead = useRef<HTMLTableSectionElement>(null)
  const refTail = useRef<HTMLDivElement>(null)
  const refBody = useRef<HTMLTableSectionElement>(null)

  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'icm-print-style'; s.textContent = IC_PRINT_CSS + EXTRA_CSS
    document.head.appendChild(s)
    return () => { document.getElementById('icm-print-style')?.remove() }
  }, [])

  // Preload the logo so window.print() never fires before it has loaded (same gate as ICPrintLayout).
  useEffect(() => {
    const img = new Image()
    img.onload = () => setLogoReady(true)
    img.onerror = () => { console.warn('[ICMovementPrint] logo failed to load, printing without it'); setLogoReady(true) }
    img.src = logo
  }, [])

  // Measure every row's real height, then fill pages greedily. The last page must also fit the tail
  // (remark + delivery + signatures); if it doesn't, one row moves with the tail so the tail is
  // never alone on a page and never split.
  useLayoutEffect(() => {
    if (pages !== null) return
    if (!refHeader.current || !refInfo.current || !refThead.current || !refTail.current || !refBody.current) return
    const mm = (px: number) => px / MM_TO_PX
    const limit = PAGE_H_MM - BOTTOM_BUFFER_MM
      - mm(refHeader.current.getBoundingClientRect().height)
      - mm(refInfo.current.getBoundingClientRect().height)
      - mm(refThead.current.getBoundingClientRect().height)
    const tailH = mm(refTail.current.getBoundingClientRect().height)
    const heights = Array.from(refBody.current.rows).map((r) => mm(r.getBoundingClientRect().height))

    const result: ICMovementPrintLine[][] = []
    let cur: ICMovementPrintLine[] = []
    let used = 0
    data.lines.forEach((line, i) => {
      const h = heights[i] ?? 0
      if (cur.length > 0 && used + h > limit) {
        result.push(cur)
        cur = []
        used = 0
      }
      cur.push(line)
      used += h
    })
    if (cur.length > 0 && used + tailH > limit) {
      const moved = cur.length > 1 ? [cur[cur.length - 1]] : cur
      const rest = cur.length > 1 ? cur.slice(0, -1) : []
      if (rest.length > 0) result.push(rest)
      cur = moved
    }
    result.push(cur)
    setPages(result)
  })

  useEffect(() => {
    if (pages !== null && logoReady) onReady?.()
  }, [pages, logoReady])

  const header = (n: number, total: number) => (
    <ICPrintHeader pageNum={n} totalPages={total} titleTh={TITLE[data.docType]} titleEn="" docType={data.docType} />
  )

  if (pages === null) {
    return ReactDOM.createPortal(
      <div className="icr-portal">
        <div style={{ width: '194mm' }}>
          <div ref={refHeader}>{header(1, 1)}</div>
          <div ref={refInfo}><InfoBox data={data} /></div>
          <table className="icr-tbl icm-tbl"><Cols />
            <thead ref={refThead}><HeadCells /></thead>
            <tbody ref={refBody}>{data.lines.map((l, i) => <Row key={i} row={l} />)}</tbody>
          </table>
          <div ref={refTail}><Tail remarks={data.remarks} /></div>
        </div>
      </div>, document.body,
    )
  }

  return ReactDOM.createPortal(
    <div className="icr-portal">
      {pages.map((pageLines, idx) => {
        const isLast = idx === pages.length - 1
        return (
          <div key={idx} className="icr-page">
            {header(idx + 1, pages.length)}
            <InfoBox data={data} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <table className="icr-tbl icm-tbl" style={{ height: '100%' }}><Cols />
                <thead><HeadCells /></thead>
                <tbody>
                  {pageLines.map((l, i) => <Row key={i} row={l} />)}
                  <tr style={{ height: '100%' }}><td /><td /><td /><td /><td /><td /><td /></tr>
                </tbody>
              </table>
            </div>
            {isLast && <Tail remarks={data.remarks} />}
          </div>
        )
      })}
    </div>, document.body,
  )
}

export default ICMovementPrint
