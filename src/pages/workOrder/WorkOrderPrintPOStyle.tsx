import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import logo from '../../components/asset/Genius Logo-01.jpg'
import { calcDisc, type DiscType } from '@/utils/poCalc'

const NAVY = '#1F4E79'
const BK   = '#000000'

// Renamed from PO's own POItem/POData to WOPOItem/WOPOData (mechanical
// identifier rename only — no shape/layout change) since the fields now hold
// WO's own data, not PO's. See field-by-field mapping notes below on each field.
export interface WOPOItem {
  no: string; code?: string; desc: string; subDesc?: string
  qty: number; unit: string; pricePerUnit: number
  // `disc` is the raw number entered on the line; its unit (percent vs baht)
  // is given by `discType` — never assume percent.
  disc: number; discType?: DiscType; vatPct: number; whtPct: number
}
export interface WOPOData {
  // po_no/po_date → wo_no/wo_date (task-specified swap).
  poNo: string; poDate: string
  // PO's prNo/quotationNo have no WO equivalent (WO has no PR or quotation
  // concept) — flagged per the task's explicit instruction rather than
  // guessed. Repurposed to WO's closest actual fields instead of leaving
  // them meaningless: prNo → ref_no (WO's own reference no.), quotationNo →
  // contract_description (WO's "ลักษณะของสัญญา" — the closest available
  // descriptive field).
  prNo: string
  deliveryDate: string
  // PO's `project`/`job` map cleanly enough: project → project_scope_text,
  // job → the P/E/S work_system label.
  project: string; deliveryPlace: string; job: string
  contractDelivery: string; quotationNo: string; tel: string
  // PO's single `supplier` box only ever represents ONE counterparty (the
  // external party — PO's own company is the buyer, shown in the fixed
  // header). WO's employer (ผู้ว่าจ้าง) is the same Genius Engineering entity
  // already shown in the header (see the WO_STANDARD party-line's own
  // wording), NOT a second box-level party — so `supplier` here holds WO's
  // ผู้รับจ้าง (contractor) fields, and employer_name has no natural slot in
  // this box. Flagged: employer_name is placed in the `termOfPayment` slot
  // (relabeled "Employer :" in POInfoBox below) since none of PO's other 4
  // box rows fit it without being misleading.
  supplier: { name:string; address1:string; address2?:string; address3?:string; termOfPayment:string; contact:string }
  items: WOPOItem[]
  // PO's extraDiscAmt is a separate HEADER-level override discount on top of
  // per-line discounts (subtotal already nets per-line disc via lineAmt).
  // WO has no such separate header-level discount field — only per-line
  // discount + a use_discount toggle — so this is always 0 for WO (flagged;
  // not a data-loss bug, WO's per-line discounts already reduce `subtotal`
  // the same way PO's per-line discounts do).
  extraDiscAmt: number
  // WO has no shipping/transport concept at all — always 0, so the "ค่าขนส่ง"
  // row simply never renders (flagged, not applicable to WO).
  shippingAmt: number
  remark: string
  useDiscount: boolean; useVat: boolean; useWht: boolean
  // PO's vatAmt/whtAmt/totalAmt/netAmt come from a backend print-data endpoint
  // WO doesn't have — always left undefined for WO, so calcSummary's fallback
  // branches (client-computed from items) are what actually run. One
  // necessary (non-cosmetic) fix was required here: PO's `totalVat` formula
  // reads `data.vatAmt ?? 0` with NO client-side fallback computation at all
  // (unlike totalAmt/netAmt, which do have real fallbacks) — for WO this
  // would silently show ฿0.00 VAT even with useVat on. Fixed in calcSummary
  // below to compute 7% client-side, matching how WO's own WOItemsTable
  // already computes VAT.
  vatAmt?: number; whtAmt?: number; totalAmt?: number; netAmt?: number
  // WO has no revision/edit-log concept on this print template — always
  // undefined, so formatPoNoWithRevision's "#R{n}" suffix logic never
  // triggers (harmless, matches "no revision" behavior).
  revisionRound?: number
  status?: string
}

// The print view's `data` prop comes straight from GET /work-order/:id, not
// header flags (useDiscount/useVat/useWht) may be missing, null, or absent
// depending on backend response shape. calcDisc has no null-guards (the
// live form always feeds it clean numbers), so normalize at this call site
// before anything touches the shared calc function.
function normalizeItem(raw: Partial<WOPOItem> & Record<string, any>): WOPOItem {
  return {
    no: raw.no ?? '',
    code: raw.code,
    desc: raw.desc ?? '',
    subDesc: raw.subDesc,
    qty: raw.qty ?? 0,
    unit: raw.unit ?? '',
    pricePerUnit: raw.pricePerUnit ?? 0,
    disc: raw.disc ?? 0,
    discType: raw.discType ?? 'pct',
    vatPct: raw.vatPct ?? 0,
    whtPct: raw.whtPct ?? 0,
  }
}

function normalizeData(raw: WOPOData): WOPOData {
  return {
    ...raw,
    items: (raw.items ?? []).map(normalizeItem),
    extraDiscAmt: raw.extraDiscAmt ?? 0,
    shippingAmt: raw.shippingAmt ?? 0,
    useDiscount: raw.useDiscount ?? false,
    useVat: raw.useVat ?? false,
    useWht: raw.useWht ?? false,
  }
}

const lineAmt = (it:WOPOItem) => { const b=it.qty*it.pricePerUnit; return b-calcDisc(b,it.disc,it.discType??'pct') }
const lineVat = (it:WOPOItem) => lineAmt(it)*it.vatPct/100
const lineWht = (it:WOPOItem) => lineAmt(it)*it.whtPct/100
const thb = (n:number) => n.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})

const THAI_NUM = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า']
const THAI_POS = ['','สิบ','ร้อย','พัน','หมื่น','แสน']

function thaiBahtText(amount:number):string {
  amount = Math.round(Math.abs(amount)*100)/100
  const [intStr, decStr] = amount.toFixed(2).split('.')
  const intClean = intStr.replace(/^0+(?=\d)/, '')

  const convertInt = (numStr:string):string => {
    if(numStr==='0') return 'ศูนย์'
    const len = numStr.length
    let out = ''
    for(let i=0;i<len;i++){
      const digit = parseInt(numStr[i],10)
      if(digit===0) continue
      const pos = len-i-1
      const posInGroup = pos%6
      if(posInGroup===0 && digit===1 && pos!==len-1){
        out += 'เอ็ด'
      } else if(posInGroup===1 && digit===2){
        out += 'ยี่'+THAI_POS[1]
      } else if(posInGroup===1 && digit===1){
        out += THAI_POS[1]
      } else {
        out += THAI_NUM[digit]+THAI_POS[posInGroup]
      }
      if(posInGroup===0 && pos!==0) out += 'ล้าน'
    }
    return out
  }

  const bahtWords = convertInt(intClean)+'บาท'
  const satang = parseInt(decStr,10)
  const satangWords = satang===0 ? 'ถ้วน' : convertInt(String(satang))+'สตางค์'
  return bahtWords+satangWords
}

function calcSummary(data:WOPOData) {
  // Same drift-avoidance as netPay below — prefer the backend's authoritative
  // pre-discount/VAT/WHT total_amount over summing possibly-paginated/rounded
  // client-side line amounts, falling back for responses/mock data without it.
  const subtotal = data.totalAmt ?? data.items.reduce((s,it)=>s+lineAmt(it),0)
  const disc = data.useDiscount ? data.extraDiscAmt : 0
  const afterDisc = subtotal - disc
  // PO prefers the backend's authoritative header-level vat_amount here with
  // no client-side fallback — WO has no such backend field (data.vatAmt is
  // always undefined), so that formula would silently show ฿0.00 VAT even
  // with useVat on. This is the one necessary (non-cosmetic) calc fix:
  // compute the flat 7% client-side from afterDisc, same as WOItemsTable's
  // own calcTotals already does on the create form.
  const totalVat = data.useVat ? (data.vatAmt ?? afterDisc * 0.07) : 0
  const whtRates = [...new Set(data.items.filter(i=>i.whtPct>0).map(i=>i.whtPct))]
  const whtRate = whtRates.length>0 ? whtRates[0] : 0
  const totalWht = data.useWht ? afterDisc*whtRate/100 : 0
  const grand = afterDisc + totalVat + data.shippingAmt
  // Prefer the backend's authoritative net_amount when present, so the printed
  // total can never drift from what's actually stored/approved on the PO —
  // fall back to the client-recomputed figure for older responses/mock data
  // that don't carry netAmt yet.
  const netPay = data.netAmt ?? (grand - totalWht)
  return { subtotal, totalVat, totalWht, disc, afterDisc, grand, netPay }
}

const MM_TO_PX = 96/25.4
const PAGE_H_MM = 275
const BOTTOM_BUFFER_MM = 8

const CSS = `
  .wo-po-portal { font-family:'Sarabun',sans-serif; color:#000; background:#fff;
    position:fixed; top:-9999px; left:-9999px; visibility:hidden; }
  .wo-po-portal * { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @media print {
    body>*:not(.wo-po-portal){display:none !important;}
    .wo-po-portal{position:static !important;visibility:visible !important;}
    .wo-po-page{page-break-after:always;}
    .wo-po-page:last-child{page-break-after:avoid;}
    @page{size:A4 portrait;margin:0;}
  }
  .wo-po-page{width:210mm;height:297mm;padding:6mm 8mm 12mm 8mm;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;position:relative;}
  .po-watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-38deg);
    font-size:130pt;font-weight:800;letter-spacing:10px;color:#000;opacity:0.12;
    white-space:nowrap;pointer-events:none;user-select:none;z-index:0;font-family:'Sarabun',sans-serif;}
  .po-box-first{border-bottom:1px solid #000;}
  .po-box{border:1px solid #000;border-top:none;}

  .po-tbl{width:100%;border-collapse:collapse;table-layout:fixed;
    border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}
  .po-tbl-inner{width:100%;border-collapse:collapse;table-layout:fixed;
    border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}
  .po-tbl thead,.po-tbl-inner thead{display:table-header-group;}
  .po-tbl th,.po-tbl-inner th{font-family:'Cordia New',sans-serif;font-weight:700;font-size:12pt;text-align:center;padding:2px 3px;height:7mm;
    border-bottom:1px solid #000;border-right:1px solid #000;background:#fff;}
  .po-tbl th:last-child,.po-tbl-inner th:last-child{border-right:none;}
  .po-tbl td,.po-tbl-inner td{font-family:'Cordia New',sans-serif;font-size:12pt;padding:6px 5px;vertical-align:top;border:none;border-right:1px solid #000;overflow:hidden;line-height:1.2;}
  .po-tbl td:last-child,.po-tbl-inner td:last-child{border-right:none;}
  .po-tbl-spaced td{padding-top:9px;padding-bottom:9px;}
  .po-tbl tbody.stretch,.po-tbl-inner tbody.stretch{height:100%;}
  .po-tbl tbody.stretch tr,.po-tbl-inner tbody.stretch tr{height:1%;}

  .sum-row{display:flex;align-items:center;height:6mm;}
  .sum-l{flex:1;padding:0 5px;font-family:'Cordia New',sans-serif;font-size:12pt;display:flex;align-items:center;}
  .sum-v{width:28mm;padding:0 5px;font-family:'Cordia New',sans-serif;font-size:12pt;border-left:1px solid #000;height:100%;display:flex;align-items:center;justify-content:flex-end;}
  .sum-bold{border-top:1px solid #000;border-bottom:1px solid #000;}
  .sum-bold .sum-l,.sum-bold .sum-v{font-weight:700;}
  .sum-net{border-bottom:1px solid #000;}
  .sum-net .sum-l,.sum-net .sum-v{font-weight:700;color:#1F4E79;}

  .auth-col{flex:1;border-right:1px solid #000;display:flex;flex-direction:column;}
  .auth-col:last-child{border-right:none;}
  .auth-body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;text-align:center;padding:2px 3px;height:6mm;}
  .auth-head{flex:1;display:flex;flex-direction:column;justify-content:flex-end;
    padding:2px 4px;font-family:'Cordia New',sans-serif;font-size:12pt;border-top:none;border-bottom:1px solid #000;}
  .auth-date{text-align:center;font-family:'Cordia New',sans-serif;font-size:12pt;line-height:1.0;padding:1px 4px;}
`

const AUTH_COLS = [
  {label:'Supply Chain Department',sublabel:'Supply Chain Department'},
  {label:'Section Head',sublabel:'Section Head'},
  {label:'Authorized Signature',sublabel:'Authorized Signature'},
  // Only this 4th column's label changed — WO has "ผู้รับเหมาช่วง" (subcontractor),
  // which PO's own 4-column signature row doesn't have. Rest of AUTH_COLS and
  // all of the surrounding auth-col/auth-head/auth-body/auth-date structure
  // below is untouched.
  {label:'ผู้รับเหมาช่วง (Subcontractor)',sublabel:'ผู้รับเหมาช่วง (Subcontractor)'},
]

const FillerTr = () => (
  <tr style={{height:'100%'}}>
    <td/><td/><td/><td/><td/><td/><td/><td/>
  </tr>
)

const TABLE_COLS = (
  <colgroup>
    <col style={{width:'11mm'}}/><col style={{width:'19mm'}}/><col/>
    <col style={{width:'13mm'}}/><col style={{width:'14.16mm'}}/>
    <col style={{width:'22mm'}}/><col style={{width:'19.84mm'}}/><col style={{width:'28mm'}}/>
  </colgroup>
)
const TABLE_HEAD = (
  <thead><tr>
    {["ITEM","COST CODE","DESCRIPTION","QTY","UNIT","PRICE/UNIT","DISCOUNT","TOTAL (BAHT)"].map(h=><th key={h}>{h}</th>)}
  </tr></thead>
)

const POHeader = ({data,pageNum,totalPages}:{data:WOPOData;pageNum:number;totalPages:number}) => (
  <div className="po-box-first" style={{display:'flex',alignItems:'flex-start',minHeight:'26mm'}}>
    <div style={{width:'auto',flexShrink:0,display:'flex',alignItems:'flex-start',gap:8,padding:'4px 0px'}}>
             <img
          src={logo}
          alt="Logo"
         style={{
          marginTop: "1px",
          height: "22mm",
          width: "auto",
          objectFit: "contain",
          flexShrink: 0,
        }}
        />
      <div style={{display:'flex',flexDirection:'column',justifyContent:'center'}}>
        <div style={{fontSize:'14.5pt',color:'#02276e',lineHeight: 1,paddingBottom:'0px',marginLeft:'3px',marginBottom:'0px',fontFamily: "Cordia New",whiteSpace:'nowrap'}}>บริษัท จีเนียส เอนจิเนียริง จำกัด (สำนักงานใหญ่)</div>
        <div style={{fontSize:'13.5pt',color:'#02276e',lineHeight: 1,borderBottom:'0.1px solid #000',marginLeft:'3px',paddingBottom:'1px',marginBottom:'3px',fontFamily: "Cordia New",whiteSpace:'nowrap'}}>Genius Engineering Co., Ltd. (Head Office)</div>
        <div style={{fontSize:'11pt',color:'#02276e',lineHeight:1.05,fontFamily: "Cordia New",marginLeft:'3px'}}>
          <div style={{whiteSpace:'nowrap'}}>1467 ถนนกาญจนาภิเษก แขวงบางแคเหนือ เขตบางแค กรุงเทพฯ 10160</div>
          <div style={{whiteSpace:'nowrap'}}>1467 Kanjanapisek Rd., Bangkaenua, Bangkae, Bangkok 10160</div>
          <div style={{whiteSpace:'nowrap'}}>Tel. (66)2 805 6820&nbsp;&nbsp;TaxID.&nbsp;105554142442&nbsp;&nbsp;www.geniuslp.com</div>
        </div>
      </div>
    </div>
    <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',alignItems:'flex-end',padding:'2px 8px 4px 8px'}}>
      <div style={{fontSize:'7.5pt',color:'#444'}}>Page {pageNum}/{totalPages}</div>
      <div style={{textAlign:'right'}}>
        <div style={{fontSize:'18pt',fontWeight:700,color:BK,lineHeight:1.1,marginTop:'4px'}}>WORK ORDER</div>
        <div style={{fontSize:'13pt',fontWeight:600,color:BK,marginTop:'6px'}}>หนังสือสั่งจ้าง</div>
      </div>
    </div>
  </div>
)

// Trimmed to exactly 3 fields per task: ผู้รับจ้าง (supplier_name), WO No.,
// Currency. PO's original print never rendered a currency field of its own
// (no `currency` on POData, nothing in PurchaseOrderPrint's info box) and WO
// has no currency field either — "THB" here is a fixed constant, matching
// how PO would display it if it had one at all.
const CURRENCY = 'THB'

const POInfoBox = ({data}:{data:WOPOData}) => (
  <div className="po-box" style={{display:'flex',fontSize:'12pt',fontFamily:"'Cordia New',sans-serif"}}>
    <div style={{width:'50%',borderRight:'1px solid #000',padding:'3px 8px',display:'flex',flexDirection:'column',lineHeight:'1.2'}}>
      <div><b>ผู้รับจ้าง :</b>&nbsp;{data.supplier.name}</div>
    </div>
    <div style={{flex:1,padding:'3px 8px',display:'flex',flexDirection:'column',lineHeight:'1.2'}}>
      <div><b>WO No :</b>&nbsp;{data.poNo}</div>
      <div><b>Currency :</b>&nbsp;{CURRENCY}</div>
    </div>
  </div>
)

const ItemRow = ({row}:{row:WOPOItem}) => (
  <tr>
    <td style={{textAlign:'center'}}>{row.no}</td>
    <td style={{color:'#444',textAlign:'center',whiteSpace:'nowrap'}}>{row.code}</td>
    <td style={{whiteSpace:'normal',wordBreak:'break-word',overflowWrap:'anywhere'}}>
      <div>{row.desc}</div>
      {row.subDesc&&<div style={{color:'#555',marginTop:'1px'}}>{row.subDesc}</div>}
    </td>
    <td style={{textAlign:'center'}}>{row.qty||''}</td>
    <td style={{textAlign:'center'}}>{row.unit}</td>
    <td style={{textAlign:'right'}}>{row.pricePerUnit?thb(row.pricePerUnit):''}</td>
    <td style={{textAlign:'center'}}>{row.disc?(row.discType==='amt'?thb(row.disc):`${row.disc}%`):''}</td>
    <td style={{textAlign:'right'}}>{row.desc?thb(lineAmt(row)):''}</td>
  </tr>
)

const POFooter = ({data}:{data:WOPOData}) => {
  const s = calcSummary(data)
  const vatPcts = [...new Set(data.items.filter(i=>i.vatPct>0).map(i=>i.vatPct))]
  const whtPcts = [...new Set(data.items.filter(i=>i.whtPct>0).map(i=>i.whtPct))]
  return (
    <>
      <div className="po-box" style={{display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',borderBottom:'1px solid #000'}}>
          <div style={{flex:1,padding:'4px 8px',borderRight:'1px solid #000',fontSize:'12pt',fontFamily:"'Cordia New',sans-serif"}}>
            <div style={{fontWeight:700,marginBottom:2}}>หมายเหตุ / Remark</div>
            {data.remark.split('\n').map((l,i)=><div key={i} style={{lineHeight:'1.2'}}>{l}</div>)}
          </div>
          <div style={{width:'69.50mm',display:'flex',flexDirection:'column',fontSize:'12pt',fontFamily:"'Cordia New',sans-serif"}}>
            <div className="sum-row"><span className="sum-l">Subtotal</span><span className="sum-v">{thb(s.subtotal)}</span></div>
            <div className="sum-row"><span className="sum-l">Special Discount</span><span className="sum-v">-{thb(s.disc)}</span></div>
            <div className="sum-row"><span className="sum-l">After Discount</span><span className="sum-v">{thb(s.afterDisc)}</span></div>
            {(vatPcts.length>0?vatPcts:[0]).map(v=><div key={v} className="sum-row"><span className="sum-l">Value Added Tax {v}%</span><span className="sum-v">+{thb(s.totalVat)}</span></div>)}
            {data.shippingAmt>0&&<div className="sum-row"><span className="sum-l">ค่าขนส่ง</span><span className="sum-v">+{thb(data.shippingAmt)}</span></div>}
            {(whtPcts.length>0?whtPcts:[0]).map(w=><div key={w} className="sum-row"><span className="sum-l">Withholding Tax {w}%</span><span className="sum-v">-{thb(s.totalWht)}</span></div>)}
            <div style={{flex:1,display:'flex'}}>
              <span style={{flex:1}}/>
              <span style={{width:'28mm',borderLeft:'1px solid #000'}}/>
            </div>
          </div>
        </div>
        <div style={{display:'flex'}}>
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'6px 8px',borderRight:'1px solid #000',fontSize:'12pt',fontWeight:600,fontFamily:"'Cordia New',sans-serif"}}>
            ( {thaiBahtText(s.grand)} )
          </div>
          <div style={{width:'69.50mm',display:'flex',alignItems:'center',fontSize:'12pt',fontFamily:"'Cordia New',sans-serif"}}>
            <div className="sum-row" style={{width:'100%'}}>
              <span className="sum-l" style={{color:NAVY,fontWeight:700}}>Net Amount</span>
              <span className="sum-v" style={{color:NAVY,fontWeight:700,borderLeft:'none'}}>{thb(s.netPay)}</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{height:'28mm',display:'flex',flexDirection:'column'}}>
        <div className="po-box" style={{display:'flex',flex:1}}>
          {AUTH_COLS.map((col,i)=>(
            <div key={i} className="auth-col">
              <div className="auth-head">
                
              </div>
              <div className="auth-body">
                <div style={{fontWeight:600}}>{col.label}</div>
              </div>
              <div className="auth-date">({data.poDate})</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

const EMPTY_ROW: WOPOItem = {no:'',code:'',desc:'',qty:0,unit:'',pricePerUnit:0,disc:0,discType:'pct',vatPct:0,whtPct:0}

interface Props { data: WOPOData; onReady?: () => void }

// Renamed from PO's PurchaseOrderPrint (mechanical rename, matches filename).
const WorkOrderPrintPOStyle: React.FC<Props> = ({ data: rawData, onReady }) => {
  // rawData now comes from the WOPOData mapper (see mapWorkOrderToPOStyle in
  // WorkOrderPrintView.tsx) fed by GET /work-order/:id — same normalize-once
  // pattern PO uses, just a different upstream data source.
  const data = normalizeData(rawData)
  const refHeader = useRef<HTMLDivElement>(null)
  const refInfo   = useRef<HTMLDivElement>(null)
  const refFooter = useRef<HTMLDivElement>(null)
  const refRow    = useRef<HTMLTableRowElement>(null)
  const refThead  = useRef<HTMLTableSectionElement>(null)

  const [pages,    setPages]    = useState<WOPOItem[][]|null>(null)
  const [rowsLast, setRowsLast] = useState(10)

  useEffect(()=>{
    const s = document.createElement('style')
    // Own id (not PO's "po-style") so the two print views can never collide
    // if somehow mounted at the same time.
    s.id='wo-po-style'; s.textContent=CSS
    document.head.appendChild(s)
    return ()=>{ document.getElementById('wo-po-style')?.remove() }
  },[])

  useEffect(()=>{
    if(pages!==null) return
    if(!refHeader.current||!refInfo.current||!refFooter.current||!refRow.current||!refThead.current) return
    const px2mm = (px:number)=>px/MM_TO_PX
    const hMm = px2mm(refHeader.current.getBoundingClientRect().height)
    const iMm = px2mm(refInfo.current.getBoundingClientRect().height)
    const fMm = px2mm(refFooter.current.getBoundingClientRect().height)
    const tMm = px2mm(refThead.current.getBoundingClientRect().height)
    const rMm = px2mm(refRow.current.getBoundingClientRect().height)
    const fixed = hMm+iMm+tMm
    const rOther = Math.floor((PAGE_H_MM-BOTTOM_BUFFER_MM-fixed)/rMm)
    const rLast  = Math.floor((PAGE_H_MM-BOTTOM_BUFFER_MM-fixed-fMm)/rMm)
    console.log(`[WO-PO] h:${hMm.toFixed(1)} i:${iMm.toFixed(1)} f:${fMm.toFixed(1)} t:${tMm.toFixed(1)} r:${rMm.toFixed(1)} → other:${rOther} last:${rLast}`)
    const result:WOPOItem[][] = []
    let idx=0
    while(idx<data.items.length){
      const last = idx+rOther>=data.items.length
      result.push(data.items.slice(idx,idx+(last?rLast:rOther)))
      idx+=last?rLast:rOther
    }
    // Zero items would otherwise leave `result` empty, rendering no page at
    // all (blank print output) — always emit at least one page so header/
    // totals/signature block still show for layout preview purposes.
    if(result.length===0) result.push([])
    setRowsLast(rLast)
    setPages(result)
  })

  useEffect(() => {
    if (pages !== null) onReady?.()
  }, [pages])

  if(pages===null){
    return ReactDOM.createPortal(
      <div className="wo-po-portal">
        <div className="wo-po-page" style={{visibility:'hidden'}}>
          <div ref={refHeader}><POHeader data={data} pageNum={1} totalPages={1}/></div>
          <div ref={refInfo}><POInfoBox data={data}/></div>
          <table className="po-tbl">{TABLE_COLS}
            <thead ref={refThead}>{TABLE_HEAD.props.children}</thead>
            <tbody><tr ref={refRow}>
              <td>1</td><td>CODE</td><td><div>Sample desc</div><div>sub</div></td>
              <td>10</td><td>เส้น</td><td>1,000.00</td><td>5%</td><td>9,500.00</td>
            </tr></tbody>
          </table>
          <div ref={refFooter}><POFooter data={data}/></div>
        </div>
      </div>, document.body
    )
  }

  const totalPages = pages.length
  return ReactDOM.createPortal(
    <div className="wo-po-portal">
      {pages.map((pageItems,pageIdx)=>{
        const isLast = pageIdx===totalPages-1
        const rows = [...pageItems]
        return (
          <div key={pageIdx} className="wo-po-page">
            {data.status === 'DRAFT' && <div className="po-watermark">DRAFT</div>}
            <POHeader data={data} pageNum={pageIdx+1} totalPages={totalPages}/>
            <POInfoBox data={data}/>
            {isLast?(
              <>
                <div style={{flex:1,display:'flex',flexDirection:'column'}}>
                  <table className="po-tbl-inner po-tbl-spaced" style={{width:'100%',height:'100%'}}>{TABLE_COLS}{TABLE_HEAD}
                    <tbody>
                      {rows.map((row,i)=><ItemRow key={i} row={row}/>)}
                      <FillerTr/>
                    </tbody>
                  </table>
                </div>
                <POFooter data={data}/>
              </>
            ):(
              <div style={{flex:1,display:'flex',flexDirection:'column'}}>
                <table className="po-tbl" style={{flex:1,height:'100%'}}>{TABLE_COLS}{TABLE_HEAD}
                  <tbody className="stretch">{rows.map((row,i)=><ItemRow key={i} row={row}/>)}</tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>, document.body
  )
}

export default WorkOrderPrintPOStyle