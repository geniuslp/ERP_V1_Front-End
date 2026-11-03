import FormattedNote from '@/components/common/FormattedNote'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import dayjs from 'dayjs'
import { formatNote, type NoteLine } from '@/utils/formatNote'
import logo from '@/components/asset/Genius Logo-01.jpg'
import { numberToThaiText } from '@/utils/thaiBahtText'
import { WO_CONTRACT_DESCRIPTION_LABEL, WO_CONTRACT_TYPE_LABEL, formatWorkSystem, formatWOProject } from '@/types/workOrder'
import type { WorkOrder } from '@/types/workOrder'
import { useJobTypeNames } from '@/hooks/useJobTypeNames'
import { formatPoNoWithRevision } from '@/utils/poNo'

// Restored to the original numbered-fields (1–10) paper-form-replica layout,
// matching the physical "หนังสือสั่งจ้าง" document — completely distinct from
// PO_HEADER's PO-style layout. This file previously mirrored PO's item-table
// structure (inherited from an earlier "duplicate PO's print file" pass
// applied too broadly); no git commit existed with the numbered-fields
// version to restore verbatim (confirmed via `git log -- WorkOrderPrintStandard.tsx`
// — the file has never been committed), so this rebuild uses the real WO data
// model (types/workOrder.ts) and the field labels/order/option lists actually
// used on WorkOrderCreatePage.tsx as the source of truth, rather than
// reconstructing anything from memory. Flag back if any wording/order here
// doesn't match the physical form — this wasn't checked against an actual
// scan/photo of it.

const thb = (n?: number) => (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d?: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '')

const CSS = `
  .wo-std-portal { font-family:'Sarabun',sans-serif; color:#000; background:#fff;
    position:fixed; top:-9999px; left:-9999px; visibility:hidden; }
  .wo-std-portal * { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @media print {
    body>*:not(.wo-std-portal){display:none !important;}
    .wo-std-portal{position:static !important;visibility:visible !important;}
    @page{size:A4 portrait;margin:0;}
    .wo-std-page{page-break-after:always;}
    .wo-std-page:last-child{page-break-after:avoid;}
  }
  .wo-std-page{width:210mm;height:297mm;padding:6mm 8mm 12mm 8mm;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;position:relative;}
  .po-watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-38deg);
    font-size:130pt;font-weight:800;letter-spacing:10px;color:#000;opacity:0.12;
    white-space:nowrap;pointer-events:none;user-select:none;z-index:0;font-family:'Sarabun',sans-serif;}

  /* Header — PO-print style (logo + company block left, WORK ORDER / หนังสือสั่งจ้าง right), no line under it. */
  .wo-std-head{display:flex;align-items:flex-start;}

  /* Party line — plain text, single thin black bottom border only, tight
     spacing between it and the section label above. */
  .wo-std-section-label{font-family:'Cordia New',sans-serif;font-weight:700;font-size:12.5pt;margin:6px 0 1px 0;}
  .wo-std-party-line{font-family:'Cordia New',sans-serif;font-size:12.5pt;font-weight:700;line-height:1.5;
    border-bottom:1px solid #000;padding-bottom:4px;}

  /* Numbered fields 1–10 — label/value table, matching work_order_print_reference.html. */
  /* Fixed column widths (see WO_COLS) so every table on every page — items 1–9 and item 10 chunks — shares the same value
     column width; the pagination measures the item 10 lines with exactly this width. */
  table.wo-table{width:100%;border-collapse:collapse;table-layout:fixed;font-family:'Cordia New',sans-serif;}
  table.wo-table td{vertical-align:top;padding:5px 4px;font-size:12pt;}
  td.wo-no{font-weight:700;}
  td.wo-value{font-weight:700;}
  td.wo-label{font-weight:600;white-space:nowrap;}
  td.wo-value{}
  .sub{padding-left:20px;font-size:11.5pt;color:#000;font-weight:700;}
  .wo-std-underline{border-bottom:1px solid #000;padding:0 2px;min-width:60px;display:inline-block;}

  /* Cost Code line — simple text display, not a full item table. */

  /* Signature block — 4 equal-width columns, fixed height, pinned to bottom. */
  .wo-std-auth{border:1px solid #000;display:flex;height:26mm;margin-top:auto;}
  .wo-std-auth-col{flex:1;border-right:1px solid #000;display:flex;flex-direction:column;}
  .wo-std-auth-col:last-child{border-right:none;}
  .wo-std-auth-sign{flex:1;}
  .wo-std-auth-label{border-top:1px solid #000;text-align:center;font-family:'Cordia New',sans-serif;
    font-size:11.5pt;line-height:1.3;padding:3px 4px;}
`

// The signature block's 4 columns per the finalized spec — replaces PO's
// English placeholder labels ("Supply Chain Department"/"Section Head"/etc.)
// with WO_STANDARD's own Thai labels.
const AUTH_COLS = ['ผู้จัดทำ / ผู้ตรวจสอบ', 'หัวหน้าส่วน', 'ผู้มีอำนาจลงนามอนุมัติ', 'ผู้รับเหมาช่วง']

// Same header as the PO print (PurchaseOrderPrint.tsx's POHeader) minus the logo: company block on the left,
// "WORK ORDER" / "หนังสือสั่งจ้าง" on the right with the document number and date under it.
const Header = ({ data, pageNum, totalPages, divider = false, agreement = false }: { data: WOPrintDataLite; pageNum: number; totalPages: number; divider?: boolean; agreement?: boolean }) => (
  // divider: continuation pages (2, 3 ...) get a rule under the header; page 1 has none.
  <div className="wo-std-head" style={{ minHeight: '26mm', padding: '4px 0', position: 'relative', ...(divider ? { borderBottom: '1px solid #000', marginBottom: '4px' } : {}) }}>
    <div style={{ width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <img src={logo} alt="Logo" width={4248} height={1844} style={{ marginTop: '1px', height: '22mm', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
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
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '2px 8px 4px 8px' }}>
      <div style={{ fontSize: '7.5pt', color: '#444' }}>Page {pageNum}/{totalPages}</div>
      <div style={{ textAlign: 'right' }}>
        {/* Same size / weight / font (inherited Sarabun) as "PURCHASE ORDER" / "ใบสั่งซื้อ" in the PO print. */}
        <div style={{ fontSize: '18pt', fontWeight: 700, lineHeight: 1.1, marginTop: '4px' }}>WORK ORDER</div>
        <div style={{ fontSize: '13pt', fontWeight: 600, marginTop: '6px' }}>หนังสือสั่งจ้าง</div>
        <div style={{ fontSize: '12pt', marginTop: '6px', fontFamily: "'Cordia New',sans-serif" }}>
          <div>เลขที่ : <b>{formatPoNoWithRevision(data.wo_no ?? '', data.revision_round)}</b></div>
          <div>วันที่ : <b>{fmtDate(data.wo_date)}</b></div>
        </div>
      </div>
    </div>
    {/* Page 1: "ข้อตกลงในสัญญา" sits in the header, on the same line as the date (bottom left). */}
    {agreement && <div className="wo-std-section-label" style={{ position: 'absolute', left: 3, bottom: 8, margin: 0 }}>ข้อตกลงในสัญญา</div>}
  </div>
)

const PartyLine = ({ data }: { data: WOPrintDataLite }) => (
  <>
    {/* Text before the company is left-aligned; "บริษัท … ผู้ว่าจ้าง" sits flush right on the same line (wraps below, still right-aligned, when too long).
        employer_name is stored with "บริษัท" already in it, so the word is added only when it is missing (no "บริษัท บริษัท"). */}
    {/* marginTop pulls the line up toward the "ข้อตกลงในสัญญา" label in the header (which stays level with the date). */}
    <div className="wo-std-party-line" style={{ display: 'flex', flexWrap: 'wrap', columnGap: 12, marginTop: -6 }}>
      <span>ผู้รับจ้าง สัญญาว่าจะทำตามรายละเอียดที่ระบุไว้ต่อไปนี้ทั้งหมด โดยรับผิดชอบต่อ</span>
      <span style={{ marginLeft: 'auto', textAlign: 'right' }}>
        {data.employer_name?.trim().startsWith('บริษัท') ? data.employer_name.trim() : <>บริษัท {val(data.employer_name)}</>} ผู้ว่าจ้าง
      </span>
    </div>
  </>
)

interface WOPrintDataLite extends Partial<WorkOrder> {}

// Renders a value cell; falls back to a blank single-underline fill-in space
// (no placeholder dots) when the bound field is empty, per the reference
// file's blank-fill treatment.
const val = (v: React.ReactNode) =>
  v === undefined || v === null || v === '' ? <span className="wo-std-underline">&nbsp;</span> : v
// Long free text (notes / other terms): "1." "2." items and "-" bullets each start a new line.
const noteVal = (v?: string | null, inline = false) =>
  val(v ? <FormattedNote value={v} style={inline ? { display: 'inline-block', verticalAlign: 'top' } : undefined} /> : v)

// 7.2: the first line stays right after "7.2 เงินงวดสัญญา :"; the lines under it (7.2.1, 7.2.2 ...) start on their own
// line, indented by ONE tab only (not pushed under the label's text).
const InstallmentNote = ({ value }: { value?: string | null }) => {
  const lines = formatNote(value)
  if (lines.length === 0) return val('')
  const [first, ...rest] = lines
  return (
    <span style={{ overflowWrap: 'anywhere', fontWeight: 700 }}>
      {first.text}
      {rest.map((l, i) => (
        <div key={i} style={{ paddingLeft: l.indent ? '3.4em' : '2em', minHeight: l.text === '' ? '0.8em' : undefined }}>{l.text}</div>
      ))}
    </span>
  )
}

const NumberedFields = ({ data }: { data: WOPrintDataLite }) => {
  const jobNames = useJobTypeNames()
  return <NumberedFieldsInner data={data} jobNames={jobNames} />
}

const WO_COLS = (
  <colgroup>
    <col style={{ width: '26px' }} /><col style={{ width: '165px' }} /><col style={{ width: '14px' }} /><col />
  </colgroup>
)

// Items 1–9. Item 10 (เงื่อนไขอื่นๆ) is paginated separately — see OtherTermsTable.
const NumberedFieldsInner = ({ data, jobNames }: { data: WOPrintDataLite; jobNames: Record<string, string> }) => (
  <table className="wo-table">
    {WO_COLS}
    <tbody>
      <tr>
        <td className="wo-no">1.</td>
        <td className="wo-label">เจ้าของโครงการ</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.employer_name)}</td>
      </tr>
      <tr>
        <td />
        <td className="wo-label">ชื่อโครงการ</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(formatWOProject(data))}</td>
      </tr>

      <tr>
        <td className="wo-no">2.</td>
        <td className="wo-label">ผู้รับจ้าง / ผู้ให้เช่า</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.supplier_name)}</td>
      </tr>
      <tr>
        <td />
        <td className="wo-label">&nbsp;&nbsp;ผู้ลงลายมือชื่อ</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.contact_person)}</td>
      </tr>
      <tr>
        <td />
        <td className="wo-label">&nbsp;&nbsp;ที่อยู่ตามหนังสือรับรอง</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.supplier_address)}</td>
      </tr>
      <tr>
        <td />
        <td className="wo-label">&nbsp;&nbsp;โทรศัพท์ติดต่อได้ที่</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.supplier_phone)}</td>
      </tr>

      <tr>
        <td className="wo-no">3.</td>
        <td className="wo-label">สัญญานี้เป็นสัญญา</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.contract_type ? (WO_CONTRACT_TYPE_LABEL[data.contract_type] ?? data.contract_type) : '')}</td>
      </tr>
      <tr>
        <td className="wo-no">4.</td>
        <td className="wo-label">งานระบบ</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(formatWorkSystem(data.work_system, jobNames))}</td>
      </tr>
      <tr>
        <td className="wo-no">5.</td>
        <td className="wo-label">ลักษณะของสัญญา</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">
          {val(
            data.contract_description
              ? (WO_CONTRACT_DESCRIPTION_LABEL[data.contract_description as keyof typeof WO_CONTRACT_DESCRIPTION_LABEL] ?? data.contract_description)
              : ''
          )}
        </td>
      </tr>

      <tr>
        <td className="wo-no">6.</td>
        <td className="wo-label">มูลค่าสัญญา (ไม่รวม VAT)</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">
          {thb(data.contract_amount)} บาท{data.contract_amount ? ` (${numberToThaiText(data.contract_amount)})` : ''} &nbsp;&nbsp;VAT {data.vat_rate ?? 0}% &nbsp;&nbsp;หัก ณ ที่จ่าย {data.wht_rate ?? 0}%
        </td>
      </tr>

      <tr>
        <td className="wo-no">7.</td>
        <td className="wo-label">เงื่อนไขการจ่ายเงิน</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">กำหนดจ่ายตามงวดงาน</td>
      </tr>
      <tr>
        <td />
        <td colSpan={2} />
        <td className="sub">7.1 เงินล่วงหน้า {data.advance_pct ?? 0}% (เป็นเงิน {thb(data.advance_amount)} บาท)</td>
      </tr>
      <tr>
        <td />
        <td colSpan={2} />
        <td className="sub">7.2 เงินงวดสัญญา : <InstallmentNote value={data.progress_payment_note} /></td>
      </tr>
      <tr>
        <td />
        <td colSpan={2} />
        <td className="sub">7.3 หักเงินประกันผลงาน {data.retention_pct ?? 0}%{data.retention_remarks ? ` ${data.retention_remarks}` : ''}</td>
      </tr>
      <tr>
        <td />
        <td colSpan={2} />
        <td className="sub">7.4 หักคืนเงินล่วงหน้า {data.advance_deduct_pct ?? 0}%</td>
      </tr>
      <tr>
        <td />
        <td colSpan={2} />
        <td className="sub">7.5 หักอื่นๆ : <span style={{ fontWeight: 700 }}>{noteVal(data.other_deduction_note, true)}</span></td>
      </tr>

      <tr>
        <td className="wo-no">8.</td>
        <td className="wo-label">ระยะเวลาสัญญา</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">
          เริ่ม {fmtDate(data.start_date) || <span className="wo-std-underline">&nbsp;</span>} ถึง{' '}
          {fmtDate(data.end_date) || <span className="wo-std-underline">&nbsp;</span>} ({data.duration_days ?? 0} วัน)
        </td>
      </tr>
      <tr>
        <td />
        <td colSpan={2} />
        <td className="sub">8.1 เบี้ยปรับ {data.has_penalty ? 'ปรับวันละ 1.00% ของมูลค่างาน' : 'ไม่มี'}</td>
      </tr>
      <tr>
        <td />
        <td colSpan={2} />
        <td className="sub">8.2 ประกันผลงาน{data.warranty_years ? ` ${data.warranty_years} ปี` : ''}</td>
      </tr>

      <tr>
        <td className="wo-no">9.</td>
        <td className="wo-label">อ้างอิงสัญญา</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.ref_no)}</td>
      </tr>
    </tbody>
  </table>
)

// Item 10 as one table: a chunk of the note's lines. Every page after the first one that carries part of the note
// is labelled "… (ต่อ)". lineRef is only used by the hidden measuring pass.
const OtherTermsTable = ({ lines, cont, lineRef }: { lines: NoteLine[]; cont: boolean; lineRef?: (i: number, el: HTMLDivElement | null) => void }) => (
  <table className="wo-table">
    {WO_COLS}
    <tbody>
      <tr>
        <td className="wo-no">10.</td>
        <td className="wo-label">เงื่อนไขอื่นๆ ระบุเพิ่มเติม{cont ? ' (ต่อ)' : ''}</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">
          {lines.length === 0 ? val('') : (
            <div style={{ overflowWrap: 'anywhere' }}>
              {lines.map((l, i) => (
                <div
                  key={i}
                  ref={lineRef ? (el) => lineRef(i, el) : undefined}
                  style={{ minHeight: l.text === '' ? '0.8em' : undefined, paddingLeft: l.indent ? '1.4em' : undefined }}
                >
                  {l.text}
                </div>
              ))}
            </div>
          )}
        </td>
      </tr>
    </tbody>
  </table>
)

const AuthBlock = ({ data }: { data: WOPrintDataLite }) => (
  <div className="wo-std-auth">
    {AUTH_COLS.map((label) => (
      <div key={label} className="wo-std-auth-col">
        <div className="wo-std-auth-sign" />
        <div className="wo-std-auth-label">
          <div>{label}</div>
          <div>({fmtDate(data.wo_date)})</div>
        </div>
      </div>
    ))}
  </div>
)

interface Props { data: Partial<WorkOrder>; onReady?: () => void }

const MM_TO_PX = 96 / 25.4
// Room for header + content + footer on one page: A4 297mm minus the 6mm top / 12mm bottom padding, minus a safety margin.
const PAGE_INNER_MM = 273

// Item 10 is split at the big numbers: a group starts at every "1." "2." ... line (a leading unnumbered paragraph is a
// group of its own) and holds the "-" bullets under it. A group is never cut between pages.
const NUMBER_START = /^\d{1,2}\./
const groupNoteLines = (lines: NoteLine[]): number[][] => {
  const groups: number[][] = []
  lines.forEach((l, i) => {
    if (groups.length === 0 || (l.indent === 0 && NUMBER_START.test(l.text))) groups.push([i])
    else groups[groups.length - 1].push(i)
  })
  return groups
}

// Packs whole groups onto pages (page 1 has less room: items 1–9 sit above). A group that is taller than a whole
// continuation page cannot be kept together, so only then it is split line by line. Page 1 may end up with no
// group at all (item 10 then starts on page 2).
const packNote = (heights: number[], groups: number[][], avail1: number, availC: number): number[][] => {
  const units: { idx: number[]; h: number }[] = []
  groups.forEach((g) => {
    const h = g.reduce((a, i) => a + heights[i], 0)
    if (h <= availC) units.push({ idx: g, h })
    else g.forEach((i) => units.push({ idx: [i], h: heights[i] }))
  })
  const pages: number[][] = [[]]
  let used = 0
  let avail = avail1
  units.forEach((u) => {
    const cur = pages[pages.length - 1]
    if (used + u.h > avail && (cur.length > 0 || pages.length === 1)) {
      pages.push([])
      used = 0
      avail = availC
    }
    pages[pages.length - 1].push(...u.idx)
    used += u.h
  })
  return pages
}

// Renders straight from the raw GET /work-order/:id response (not PO's WOPOData mapping), since the numbered-fields
// layout needs WO's own fields (contract_type, retention_pct, advance_pct, dates, etc.) that the PO-shaped mapper
// doesn't carry. Header and the signature footer are on EVERY page; the long item 10 (เงื่อนไขอื่นๆ) flows onto
// further pages, each continuation labelled "10. เงื่อนไขอื่นๆ ระบุเพิ่มเติม (ต่อ)".
const WorkOrderPrintStandard: React.FC<Props> = ({ data, onReady }) => {
  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'wo-std-style'; s.textContent = CSS
    document.head.appendChild(s)
    return () => { document.getElementById('wo-std-style')?.remove() }
  }, [])

  const noteLines = useMemo(() => formatNote(data.other_terms), [data.other_terms])
  const refHeader = useRef<HTMLDivElement>(null)
  const refMain = useRef<HTMLDivElement>(null)
  const refTable = useRef<HTMLDivElement>(null)
  const refFooter = useRef<HTMLDivElement>(null)
  const refLines = useRef<(HTMLDivElement | null)[]>([])
  const [pages, setPages] = useState<NoteLine[][] | null>(null)

  // Preload the logo so onReady (and window.print()) never fires before the
  // browser has actually finished loading/decoding the image — the source of
  // an intermittent missing-logo-on-print bug.
  const [logoReady, setLogoReady] = useState(false)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setLogoReady(true)
    img.onerror = () => { console.warn('[WO] logo image failed to load, printing without it'); setLogoReady(true) }
    img.src = logo
  }, [])

  // Measuring pass: item 10 is laid out once, hidden, at its real width; every line's real height decides the pages.
  useEffect(() => {
    if (pages !== null) return
    if (!refHeader.current || !refMain.current || !refTable.current || !refFooter.current) return
    const lineEls = noteLines.map((_, i) => refLines.current[i])
    if (lineEls.some((el) => !el)) return
    const mm = (el: HTMLElement) => el.getBoundingClientRect().height / MM_TO_PX
    const heights = lineEls.map((el) => mm(el as HTMLElement))
    const overhead = Math.max(mm(refTable.current) - heights.reduce((a, b) => a + b, 0), 0) // cell padding of the item 10 row
    const hdr = mm(refHeader.current)
    const ftr = mm(refFooter.current)
    const avail1 = PAGE_INNER_MM - hdr - mm(refMain.current) - ftr - overhead
    const availC = PAGE_INNER_MM - hdr - ftr - overhead
    const packed = packNote(heights, groupNoteLines(noteLines), avail1, availC)
    setPages(packed.map((ids) => ids.map((i) => noteLines[i])))
  })

  useEffect(() => { if (pages !== null && logoReady) onReady?.() }, [pages, logoReady])

  if (pages === null) {
    return ReactDOM.createPortal(
      <div className="wo-std-portal">
        <div className="wo-std-page" style={{ height: 'auto', visibility: 'hidden' }}>
          <div ref={refHeader}><Header data={data} pageNum={1} totalPages={1} agreement /></div>
          <div ref={refMain}>
            <PartyLine data={data} />
            <NumberedFields data={data} />
          </div>
          <div ref={refTable}>
            <OtherTermsTable lines={noteLines} cont lineRef={(i, el) => { refLines.current[i] = el }} />
          </div>
          <div ref={refFooter}><AuthBlock data={data} /></div>
        </div>
      </div>, document.body
    )
  }

  const totalPages = pages.length
  return ReactDOM.createPortal(
    <div className="wo-std-portal">
      {pages.map((chunk, pi) => {
        // Page 1 shows item 10 even when blank (no note at all); later pages only when they carry lines.
        const showTerms = chunk.length > 0 || noteLines.length === 0
        const cont = pi > 0 && pages.slice(0, pi).some((c) => c.length > 0)
        return (
          <div key={pi} className="wo-std-page">
            {data.status === 'DRAFT' && <div className="po-watermark">DRAFT</div>}
            <Header data={data} pageNum={pi + 1} totalPages={totalPages} divider={pi > 0} agreement={pi === 0} />
            {pi === 0 && (
              <>
                <PartyLine data={data} />
                <NumberedFields data={data} />
              </>
            )}
            {showTerms && <OtherTermsTable lines={chunk} cont={cont} />}
            <AuthBlock data={data} />
          </div>
        )
      })}
    </div>, document.body
  )
}

export default WorkOrderPrintStandard
