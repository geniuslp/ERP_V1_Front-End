import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import dayjs from 'dayjs'
import logo from '@/components/asset/Genius Logo-01.jpg'
import { numberToThaiText } from '@/utils/thaiBahtText'
import { WO_WORK_SYSTEM_LABEL, WO_CONTRACT_DESCRIPTION_LABEL } from '@/types/workOrder'
import type { WorkOrder, WOContractType } from '@/types/workOrder'

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

const CONTRACT_TYPE_LABEL: Record<WOContractType, string> = {
  LABOR_MATERIAL: 'ทั้งค่าแรง และค่าของ',
  LABOR_ONLY: 'ค่าแรงอย่างเดียว',
}

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
  }
  .wo-std-page{width:210mm;height:297mm;padding:6mm 8mm 12mm 8mm;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;position:relative;}
  .po-watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-38deg);
    font-size:130pt;font-weight:800;letter-spacing:10px;color:#000;opacity:0.12;
    white-space:nowrap;pointer-events:none;user-select:none;z-index:0;font-family:'Sarabun',sans-serif;}

  /* Header — logo box + red-bordered "หนังสือสั่งจ้าง" title, matching the paper form. */
  .wo-std-head{display:grid;grid-template-columns:190px 1fr 190px;align-items:flex-start;border-bottom:1px solid #000;}
  .wo-std-logo-block{display:flex;flex-direction:column;align-items:flex-start;gap:2px;}
  .wo-std-doc-title-wrap{display:flex;justify-content:center;align-items:center;}
  .wo-std-doc-title{text-align:center;font-family:'Sarabun',sans-serif;font-weight:700;font-size:20px;
    border:2px solid #b91c1c;color:#b91c1c;padding:4px 22px;display:inline-block;}
  .wo-std-doc-meta{width:100%;padding-right:10mm;text-align:right;font-size:12.5px;font-family:'Cordia New',sans-serif;}
  .wo-std-doc-meta div{margin-bottom:2px;}

  /* Party line — plain text, single thin black bottom border only, tight
     spacing between it and the section label above. */
  .wo-std-section-label{font-family:'Cordia New',sans-serif;font-weight:700;font-size:12.5pt;margin:6px 0 1px 0;}
  .wo-std-party-line{font-family:'Cordia New',sans-serif;font-size:12.5pt;line-height:1.5;
    border-bottom:1px solid #000;padding-bottom:4px;}

  /* Numbered fields 1–10 — label/value table, matching work_order_print_reference.html. */
  table.wo-table{width:100%;border-collapse:collapse;font-family:'Cordia New',sans-serif;}
  table.wo-table td{vertical-align:top;padding:5px 4px;font-size:12pt;}
  td.wo-no{width:26px;font-weight:700;}
  td.wo-label{width:190px;font-weight:600;white-space:nowrap;}
  td.wo-colon{width:14px;}
  td.wo-value{}
  .sub{padding-left:20px;font-size:11.5pt;color:#333;}
  .wo-std-underline{border-bottom:1px solid #000;padding:0 2px;min-width:60px;display:inline-block;}

  /* Cost Code line — simple text display, not a full item table. */
  .wo-std-costcode{font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.5;margin-top:6px;}

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
const AUTH_COLS = ['ผู้จัดทำ/ผู้กรอกเอกสาร', 'ส่วนหัวงาน', 'ผู้มีอำนาจลงนาม', 'ผู้รับเหมาช่วง']

const Header = ({ data }: { data: WOPrintDataLite }) => (
  <div className="wo-std-head" style={{ minHeight: '26mm', padding: '4px 0' }}>
    <div className="wo-std-logo-block">
      <img src={logo} alt="Logo" width={4248} height={1844} style={{ height: '20mm', width: 'auto', objectFit: 'contain' }} />
    </div>
    <div className="wo-std-doc-title-wrap"><span className="wo-std-doc-title">หนังสือสั่งจ้าง</span></div>
    <div className="wo-std-doc-meta">
      <div>เลขที่ : <b>{data.wo_no ?? ''}</b></div>
      <div>วันที่ : <b>{fmtDate(data.wo_date)}</b></div>
    </div>
  </div>
)

const PartyLine = ({ data }: { data: WOPrintDataLite }) => (
  <>
    <div className="wo-std-section-label">ข้อตกลงในสัญญา</div>
    <div className="wo-std-party-line">
      ผู้รับจ้าง สัญญาว่าจะทำตามรายละเอียดที่ระบุไว้ต่อไปนี้ทั้งหมด บริษัท {val(data.employer_name)} ผู้ว่าจ้าง
    </div>
  </>
)

interface WOPrintDataLite extends Partial<WorkOrder> {}

// Renders a value cell; falls back to a blank single-underline fill-in space
// (no placeholder dots) when the bound field is empty, per the reference
// file's blank-fill treatment.
const val = (v: React.ReactNode) =>
  v === undefined || v === null || v === '' ? <span className="wo-std-underline">&nbsp;</span> : v

const NumberedFields = ({ data }: { data: WOPrintDataLite }) => (
  <table className="wo-table">
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
        <td className="wo-value">{val(data.project_scope_text)}</td>
      </tr>

      <tr>
        <td className="wo-no">2.</td>
        <td className="wo-label">ผู้รับจ้าง / ผู้ให้เช่า</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.supplier_name)}</td>
      </tr>
      <tr>
        <td />
        <td className="wo-label">ผู้ควบคุมงาน</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.contact_person)}</td>
      </tr>
      <tr>
        <td />
        <td className="wo-label">ที่อยู่ตามหนังสือรับรอง</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.supplier_address)}</td>
      </tr>
      <tr>
        <td />
        <td className="wo-label">โทรศัพท์ติดต่อได้ที่</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.supplier_phone)}</td>
      </tr>

      <tr>
        <td className="wo-no">3.</td>
        <td className="wo-label">สัญญานี้เป็นสัญญา</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.contract_type ? CONTRACT_TYPE_LABEL[data.contract_type] : '')}</td>
      </tr>
      <tr>
        <td className="wo-no">4.</td>
        <td className="wo-label">งานระบบ</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.work_system ? (WO_WORK_SYSTEM_LABEL[data.work_system] ?? data.work_system) : '')}</td>
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
          {thb(data.contract_amount)} บาท &nbsp;&nbsp;VAT {data.vat_rate ?? 0}% &nbsp;&nbsp;หัก ณ ที่จ่าย {data.wht_rate ?? 0}%
          <div className="sub">( {data.contract_amount ? numberToThaiText(data.contract_amount) : ''} )</div>
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
        <td className="sub">7.2 เงินงวดสัญญา : {val(data.progress_payment_note)}</td>
      </tr>
      <tr>
        <td />
        <td colSpan={2} />
        <td className="sub">7.3 หักเงินประกันผลงาน {data.retention_pct ?? 0}%</td>
      </tr>
      <tr>
        <td />
        <td colSpan={2} />
        <td className="sub">7.4 หักคืนเงินล่วงหน้า {data.advance_deduct_pct ?? 0}%</td>
      </tr>
      <tr>
        <td />
        <td colSpan={2} />
        <td className="sub">7.5 หักอื่นๆ : {val(data.other_deduction_note)}</td>
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
        <td className="sub">8.1 เบี้ยปรับ {data.penalty_pct_per_day ?? 0}% ของมูลค่างาน ต่อวัน</td>
      </tr>
      <tr>
        <td />
        <td colSpan={2} />
        <td className="sub">8.2 ประกันผลงาน {data.warranty_years ?? 0} ปี</td>
      </tr>

      <tr>
        <td className="wo-no">9.</td>
        <td className="wo-label">อ้างอิงสัญญา</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.ref_no)}</td>
      </tr>
      <tr>
        <td className="wo-no">10.</td>
        <td className="wo-label">เงื่อนไขอื่นๆ ระบุเพิ่มเติม</td>
        <td className="wo-colon">:</td>
        <td className="wo-value">{val(data.other_terms)}</td>
      </tr>
    </tbody>
  </table>
)

// Simple text display, not the full item table PO_HEADER uses — per the
// most recent cost-code revert decision. No pagination needed (this is a
// single fixed-length form, not an itemized table), so an empty `lines`
// array is a non-issue here: it just renders the "ไม่มีรายการ" fallback text
// inline, same page, same as any other empty field.
const CostCodeLine = ({ data }: { data: WOPrintDataLite }) => {
  const codes = (data.lines ?? []).map(l => l.cost_code).filter(Boolean)
  return (
    <div className="wo-std-costcode">
      <b>Cost Code :</b> {codes.length > 0 ? codes.join(', ') : 'ไม่มีรายการ'}
    </div>
  )
}

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

// Single fixed-length A4 page — no pagination/measurement machinery, unlike
// PO_HEADER's multi-page item table. Renders straight from the raw
// GET /work-order/:id response (not PO's WOPOData mapping), since the
// numbered-fields layout needs WO's own fields (contract_type, retention_pct,
// advance_pct, dates, etc.) that the PO-shaped mapper doesn't carry.
const WorkOrderPrintStandard: React.FC<Props> = ({ data, onReady }) => {
  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'wo-std-style'; s.textContent = CSS
    document.head.appendChild(s)
    return () => { document.getElementById('wo-std-style')?.remove() }
  }, [])

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

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

  useEffect(() => { if (mounted && logoReady) onReady?.() }, [mounted, logoReady])

  return ReactDOM.createPortal(
    <div className="wo-std-portal">
      <div className="wo-std-page">
        {data.status === 'DRAFT' && <div className="po-watermark">DRAFT</div>}
        <Header data={data} />
        <PartyLine data={data} />
        <NumberedFields data={data} />
        <CostCodeLine data={data} />
        <AuthBlock data={data} />
      </div>
    </div>, document.body
  )
}

export default WorkOrderPrintStandard
