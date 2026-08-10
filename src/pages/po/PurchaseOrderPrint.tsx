import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import logo from '../../components/asset/Genius Logo-01.jpg'
import { calcDisc, type DiscType } from '@/utils/poCalc'
import { formatPoNoWithRevision } from '@/utils/poNo'

const NAVY = '#1F4E79'
const BK   = '#000000'

export interface POItem {
  no: string; code?: string; desc: string; subDesc?: string
  qty: number; unit: string; pricePerUnit: number
  // `disc` is the raw number entered on the line; its unit (percent vs baht)
  // is given by `discType` — never assume percent.
  disc: number; discType?: DiscType; vatPct: number; whtPct: number
}
export interface POData {
  poNo: string; poDate: string; prNo: string; deliveryDate: string
  project: string; deliveryPlace: string; job: string
  contractDelivery: string; quotationNo: string; tel: string
  supplier: { name:string; address1:string; address2?:string; address3?:string; termOfPayment:string; contact:string }
  items: POItem[]
  extraDiscAmt: number; shippingAmt: number; remark: string
  useDiscount: boolean; useVat: boolean; useWht: boolean
  // COUNT of po_edit_log rows — 0 if never edited-and-resent for re-approval.
  // poNo itself never changes; compose the "#R{n}" suffix from this instead.
  revisionRound?: number
}

// Dev-only fixture — use for isolated preview/testing only, never as a silent
// production fallback. Real usage must always pass real `data` from the API.
export const MOCK_DATA: POData = {
  poNo:'FACS-6906-0001', poDate:'15/06/2026', prNo:'PR6906-0001',
  deliveryDate:'25/06/2569', project:'GNS-033', deliveryPlace:'โรงงานนครปฐม',
  job:'CIVIL-01', contractDelivery:'ภายใน 14 วัน', quotationNo:'QT-2568-0042', tel:'02-805-6820',
  supplier:{ name:'บริษัท เหล็กไทย จำกัด', address1:'99/9 ถนนพระราม 2 แขวงบางมด',
    address2:'เขตจอมทอง กรุงเทพฯ 10150', termOfPayment:'Credit 30 Days', contact:'คุณสมชาย , 081-234-5678' },
  items:[
    {no:'1',code:'1001001',desc:'Equal Angles Steel (เหล็กฉาก) 1-1/2"×1-1/2"×3mm×6M.',subDesc:'มาตรฐาน JIS G3101 SS400',qty:40,unit:'เส้น',pricePerUnit:239,disc:0,discType:'pct',vatPct:7,whtPct:0},
    {no:'2',code:'1001002',desc:'Equal Angles Steel (เหล็กฉาก) 2"×2"×3mm×6M.',subDesc:'Zone A อาคาร 2',qty:10,unit:'เส้น',pricePerUnit:298,disc:0,discType:'pct',vatPct:7,whtPct:0},
    {no:'3',code:'1001003',desc:'Flat Bar Steel (เหล็กแบน) 50×5mm×6M.',subDesc:'สี Primer สีแดง 1 ชั้น',qty:8,unit:'เส้น',pricePerUnit:310,disc:0,discType:'pct',vatPct:7,whtPct:0},
    {no:'4',code:'1001004',desc:'Round Bar Steel (เหล็กกลม) Dia 16mm×6M.',subDesc:'',qty:20,unit:'เส้น',pricePerUnit:220,disc:0,discType:'pct',vatPct:7,whtPct:0},
    {no:'5',code:'1001005',desc:'Round Bar Steel (เหล็กกลม) Dia 20mm×6M.',subDesc:'ส่วนลดพิเศษ GNS-033',qty:10,unit:'เส้น',pricePerUnit:340,disc:5,discType:'pct',vatPct:7,whtPct:3},
    {no:'6',code:'1001006',desc:'Steel Plate (เหล็กแผ่น) 4mm×1,200×2,400mm.',subDesc:'',qty:5,unit:'แผ่น',pricePerUnit:1850,disc:0,discType:'pct',vatPct:7,whtPct:0},
    {no:'7',code:'1001007',desc:'Steel Plate (เหล็กแผ่น) 6mm×1,200×2,400mm.',subDesc:'Drawing No. STR-06-Rev2',qty:5,unit:'แผ่น',pricePerUnit:2700,disc:0,discType:'pct',vatPct:7,whtPct:3},
    {no:'8',code:'1001008',desc:'Square Tube Steel (เหล็กท่อสี่เหลี่ยม) 50×50×2mm×6M.',subDesc:'ระบุ Heat No.',qty:6,unit:'เส้น',pricePerUnit:430,disc:0,discType:'pct',vatPct:7,whtPct:0},
    {no:'9',code:'1001009',desc:'Channel Steel (เหล็กรางน้ำ) 100×50×5mm×6M.',subDesc:'Purlin Zone B',qty:12,unit:'เส้น',pricePerUnit:1240,disc:0,discType:'pct',vatPct:7,whtPct:3},
    {no:'10',code:'1001010',desc:'I-Beam Steel (เหล็กไอ) 150×75×7mm×6M.',subDesc:'Main Beam Drawing STR-15',qty:6,unit:'เส้น',pricePerUnit:4500,disc:500,discType:'amt',vatPct:7,whtPct:3},
    {no:'11',code:'1001011',desc:'Welding Rod (ลวดเชื่อม) AWS E6013 Ø3.2mm.',subDesc:'',qty:50,unit:'กก.',pricePerUnit:85,disc:0,discType:'pct',vatPct:7,whtPct:0},
    {no:'12',code:'1001012',desc:'Galvanized Sheet 0.5mm×1,200×2,400mm.',subDesc:'Zone C หุ้มผนัง',qty:30,unit:'แผ่น',pricePerUnit:420,disc:2,discType:'pct',vatPct:7,whtPct:3},
    {no:'13',code:'1001013',desc:'Channel Steel (เหล็กรางน้ำ) 75×40×5mm×6M.',subDesc:'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',qty:8,unit:'เส้น',pricePerUnit:890,disc:0,discType:'pct',vatPct:7,whtPct:0},
    {no:'14',code:'1001014',desc:'I-Beam Steel (เหล็กไอ) 100×50×5mm×6M.',subDesc:'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',qty:4,unit:'เส้น',pricePerUnit:2100,disc:0,discType:'pct',vatPct:7,whtPct:0},
    {no:'15',code:'1001015',desc:'Equal Angles Steel (เหล็กฉาก) 1-1/2"×1-1/2"×5mm×6M.',subDesc:'',qty:20,unit:'เส้น',pricePerUnit:378,disc:0,discType:'pct',vatPct:7,whtPct:0},
   
  ],
  extraDiscAmt:500, shippingAmt:0,
  remark:'1. การส่งสินค้า และการวางบิล จะต้องแนบใบสั่งซื้อทุกครั้ง\n2. บริษัทฯ จะรับวางบิลค่าสินค้าหรือค่าบริการ เมื่อได้รับสินค้าถูกต้องตามใบสั่งซื้อเท่านั้น\n3. กรุณาระบุเลขที่ PO ในใบส่งสินค้าทุกครั้ง',
  useDiscount:true, useVat:true, useWht:true,
}

// The print view's `data` prop comes straight from GET /po/:id/print-data,
// not from the live form's state — its per-line fields (disc/discType) and
// header flags (useDiscount/useVat/useWht) may be missing, null, or absent
// depending on backend response shape. calcDisc has no null-guards (the
// live form always feeds it clean numbers), so normalize at this call site
// before anything touches the shared calc function.
function normalizeItem(raw: Partial<POItem> & Record<string, any>): POItem {
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

function normalizeData(raw: POData): POData {
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

const lineAmt = (it:POItem) => { const b=it.qty*it.pricePerUnit; return b-calcDisc(b,it.disc,it.discType??'pct') }
const lineVat = (it:POItem) => lineAmt(it)*it.vatPct/100
const lineWht = (it:POItem) => lineAmt(it)*it.whtPct/100
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

function calcSummary(data:POData) {
  const subtotal = data.items.reduce((s,it)=>s+lineAmt(it),0)
  const totalVat = data.useVat ? data.items.reduce((s,it)=>s+lineVat(it),0) : 0
  const disc = data.useDiscount ? data.extraDiscAmt : 0
  const afterDisc = subtotal - disc
  const whtRates = [...new Set(data.items.filter(i=>i.whtPct>0).map(i=>i.whtPct))]
  const whtRate = whtRates.length>0 ? whtRates[0] : 0
  const totalWht = data.useWht ? afterDisc*whtRate/100 : 0
  const grand = afterDisc + totalVat + data.shippingAmt
  return { subtotal, totalVat, totalWht, disc, afterDisc, grand, netPay: grand-totalWht }
}

const MM_TO_PX = 96/25.4
const PAGE_H_MM = 275
const BOTTOM_BUFFER_MM = 8

const CSS = `
  .po-portal { font-family:'Sarabun',sans-serif; color:#000; background:#fff;
    position:fixed; top:-9999px; left:-9999px; visibility:hidden; }
  .po-portal * { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @media print {
    body>*:not(.po-portal){display:none !important;}
    .po-portal{position:static !important;visibility:visible !important;}
    .po-page{page-break-after:always;}
    .po-page:last-child{page-break-after:avoid;}
    @page{size:A4 portrait;margin:0;}
  }
  .po-page{width:210mm;height:297mm;padding:6mm 8mm 12mm 8mm;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;}
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
  {label:'Supplier Signature',sublabel:'Supplier Signature'},
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

const POHeader = ({data,pageNum,totalPages}:{data:POData;pageNum:number;totalPages:number}) => (
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
        <div style={{fontSize:'18pt',fontWeight:700,color:BK,lineHeight:1.1,marginTop:'4px'}}>PURCHASE ORDER</div>
        <div style={{fontSize:'13pt',fontWeight:600,color:BK,marginTop:'6px'}}>ใบสั่งซื้อ</div>
      </div>
    </div>
  </div>
)

const POInfoBox = ({data}:{data:POData}) => (
  <div className="po-box" style={{display:'flex',fontSize:'12pt',fontFamily:"'Cordia New',sans-serif"}}>
    <div style={{width:'50%',borderRight:'1px solid #000',padding:'3px 8px',display:'flex',flexDirection:'column',lineHeight:'1.2'}}>
      <div><b>Supplier :</b>&nbsp;{data.supplier.name}</div>
      <div style={{display:'flex'}}><span style={{whiteSpace:'nowrap'}}><b>Address :&nbsp;</b></span><span>{data.supplier.address1}</span></div>
      {data.supplier.address2&&<div style={{paddingLeft:52}}>{data.supplier.address2}</div>}
      {data.supplier.address3&&<div style={{paddingLeft:52}}>{data.supplier.address3}</div>}
      <div><b>Term of Payment :</b>&nbsp;{data.supplier.termOfPayment}</div>
      <div><b>Contact :</b>&nbsp;{data.supplier.contact}</div>
    </div>
    <div style={{flex:1,padding:'3px 8px',display:'flex',flexDirection:'column',lineHeight:'1.2'}}>
      <div style={{display:'flex',gap:8}}>
        <span><b>Po No :</b>&nbsp;{formatPoNoWithRevision(data.poNo, data.revisionRound)}</span>
        <span style={{marginLeft:'auto'}}><b>Date Doc. :</b>&nbsp;{data.poDate}</span>
      </div>
      <div><b>PR No. :</b>&nbsp;{data.prNo}</div>
      <div><b>Quotation No. :</b>&nbsp;{data.quotationNo}</div>
      <div style={{display:'flex',gap:8}}>
        <b>Project Code :</b>&nbsp;{data.project}
        
      </div>
      <div style={{display:'flex',gap:8}}>
        <b>Job Type :</b>&nbsp;{data.job}
      </div>
    </div>
  </div>
)

const ItemRow = ({row}:{row:POItem}) => (
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

const POFooter = ({data}:{data:POData}) => {
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
            <div style={{marginTop:4,lineHeight:'1.2'}}>
              <div><b>Delivery Date :</b>&nbsp;{data.deliveryDate}&nbsp;&nbsp;<b>Delivery Place :</b>&nbsp;{data.deliveryPlace}</div>
              <div><b>Contract Delivery :</b>&nbsp;{data.contractDelivery}&nbsp;&nbsp;<b>TEL :</b>&nbsp;{data.tel}</div>
            </div>
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

const EMPTY_ROW: POItem = {no:'',code:'',desc:'',qty:0,unit:'',pricePerUnit:0,disc:0,discType:'pct',vatPct:0,whtPct:0}

interface Props { data: POData; onReady?: () => void }

const PurchaseOrderPrint: React.FC<Props> = ({ data: rawData, onReady }) => {
  // rawData is whatever GET /po/:id/print-data returned — normalize once,
  // here, so every downstream read of `data` sees complete, correctly-typed
  // fields regardless of backend response shape.
  const data = normalizeData(rawData)
  const refHeader = useRef<HTMLDivElement>(null)
  const refInfo   = useRef<HTMLDivElement>(null)
  const refFooter = useRef<HTMLDivElement>(null)
  const refRow    = useRef<HTMLTableRowElement>(null)
  const refThead  = useRef<HTMLTableSectionElement>(null)

  const [pages,    setPages]    = useState<POItem[][]|null>(null)
  const [rowsLast, setRowsLast] = useState(10)

  useEffect(()=>{
    const s = document.createElement('style')
    s.id='po-style'; s.textContent=CSS
    document.head.appendChild(s)
    return ()=>{ document.getElementById('po-style')?.remove() }
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
    console.log(`[PO] h:${hMm.toFixed(1)} i:${iMm.toFixed(1)} f:${fMm.toFixed(1)} t:${tMm.toFixed(1)} r:${rMm.toFixed(1)} → other:${rOther} last:${rLast}`)
    const result:POItem[][] = []
    let idx=0
    while(idx<data.items.length){
      const last = idx+rOther>=data.items.length
      result.push(data.items.slice(idx,idx+(last?rLast:rOther)))
      idx+=last?rLast:rOther
    }
    setRowsLast(rLast)
    setPages(result)
  })

  useEffect(() => {
    if (pages !== null) onReady?.()
  }, [pages])

  if(pages===null){
    return ReactDOM.createPortal(
      <div className="po-portal">
        <div className="po-page" style={{visibility:'hidden'}}>
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
    <div className="po-portal">
      {pages.map((pageItems,pageIdx)=>{
        const isLast = pageIdx===totalPages-1
        const rows = [...pageItems]
        return (
          <div key={pageIdx} className="po-page">
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

export default PurchaseOrderPrint