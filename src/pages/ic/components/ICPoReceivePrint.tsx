import React from 'react'
import ICPrintLayout, { icInfoGridStyle, icInfoCellStyle, icInfoLeftCellStyle, type ICPrintItem } from './ICPrintLayout'

// Standalone IC PO Receive print component, modeled structurally on
// PurchaseOrderPrint.tsx (page setup/print CSS/two-column info box/
// signature block) and PRPrint.tsx (simpler footer with no financial
// summary). NOT shared with either — same reasoning as PRPrint.tsx's own
// header comment: keep independent so a layout change to one document can
// never accidentally affect another.

export type ICReceivePrintItem = ICPrintItem

export interface ICReceivePrintData {
  poNo: string
  projectName: string
  taxInvoiceNo?: string | null
  taxInvoiceDate?: string | null
  tempDeliveryNo?: string | null
  tempDeliveryDate?: string | null
  remarks?: string | null
  receiveNo: string
  receivedDate: string
  jobCode?: string | null
  items: ICReceivePrintItem[]
}

export const MOCK_DATA: ICReceivePrintData = {
  poNo: 'FACS-6906-0001',
  projectName: 'โครงการก่อสร้างโรงงานนครปฐม',
  taxInvoiceNo: 'INV-2026-0099',
  taxInvoiceDate: '19/06/2026',
  tempDeliveryNo: 'DN-2026-0012',
  tempDeliveryDate: '20/06/2026',
  remarks: 'ส่งของครบตามจำนวน\nกล่องบางใบบุบเล็กน้อย',
  receiveNo: 'RC-202609-0001',
  receivedDate: '21/06/2026',
  jobCode: 'CIVIL-01',
  items: [
    { no: '1', costCode: 'CC-001', desc: 'Equal Angles Steel (เหล็กฉาก) 1-1/2"×1-1/2"×3mm×6M.', qty: 40 },
    { no: '2', costCode: 'CC-002', desc: 'Equal Angles Steel (เหล็กฉาก) 2"×2"×3mm×6M.', qty: 10 },
    { no: '3', costCode: '', desc: 'Flat Bar Steel (เหล็กแบน) 50×5mm×6M.', qty: 8 },
  ],
}

const ICReceiveInfoBox = ({ data }: { data: ICReceivePrintData }) => {
  // ONE "เลขที่ใบส่งของ" cell: only the numbers that exist, delivery note (tax_invoice_no)
  // first then temp delivery note, joined by " , ".
  const deliveryNos = [data.taxInvoiceNo, data.tempDeliveryNo]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v)
    .join(' , ')

  return (
    <div className="icr-box" style={icInfoGridStyle}>
      <div style={icInfoLeftCellStyle}>
        <div><b>เลขที่ใบสั่งซื้อ :</b>&nbsp;{data.poNo}</div>
        <div><b>โครงการ :</b>&nbsp;{data.projectName || '-'}</div>
        <div style={{ overflowWrap: 'anywhere' }}><b>เลขที่ใบส่งของ :</b>&nbsp;{deliveryNos || '-'}</div>
        <div><b>วันที่ส่งของ :</b>&nbsp;{data.tempDeliveryDate || '-'}</div>
      </div>
      <div style={icInfoCellStyle}>
        <div style={{ fontSize: '14pt', fontWeight: 700 }}><b>เลขที่ใบรับสินค้า :</b>&nbsp;{data.receiveNo}</div>
        <div><b>วันที่รับ :</b>&nbsp;{data.receivedDate}</div>
        <div><b>ระบบงาน :</b>&nbsp;{data.jobCode || '-'}</div>
        <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          <b>หมายเหตุ :</b>&nbsp;{data.remarks?.trim() || '-'}
        </div>
      </div>
    </div>
  )
}

interface Props { data: ICReceivePrintData; onReady?: () => void }

const ICPoReceivePrint: React.FC<Props> = ({ data, onReady }) => (
  <ICPrintLayout
    titleTh="ใบรับสินค้า"
    titleEn="PO Receive"
    docType="RECEIVE"
    infoBox={<ICReceiveInfoBox data={data} />}
    items={data.items ?? []}
    onReady={onReady}
  />
)

export default ICPoReceivePrint
