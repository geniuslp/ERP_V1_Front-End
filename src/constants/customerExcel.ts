// Customer Excel columns — the single source for the downloadable import template
// and the import parser (and any future export). Header text is matched literally
// (sheet cells are keyed by the exact header text, case/space sensitive), and the
// order here is the order of the template columns.
export type CustomerExcelField =
  | 'customer_code' | 'customer_name' | 'tax_id' | 'contact' | 'contact_phone'
  | 'address' | 'credit_term' | 'remarks'

export interface CustomerExcelColumn {
  header: string
  field: CustomerExcelField
  required: boolean
  width: number
  // Older header spellings still accepted when parsing (never written to the template).
  aliases?: string[]
}

export const CUSTOMER_EXCEL_COLUMNS: CustomerExcelColumn[] = [
  { header: 'รหัสลูกค้า', field: 'customer_code', required: true, width: 18 },
  { header: 'ชื่อลูกค้า', field: 'customer_name', required: true, width: 40 },
  { header: 'เลขประจำตัวผู้เสียภาษี', field: 'tax_id', required: false, width: 24 },
  { header: 'ผู้ติดต่อ', field: 'contact', required: false, width: 24 },
  { header: 'เบอร์โทร', field: 'contact_phone', required: false, width: 18 },
  { header: 'ที่อยู่', field: 'address', required: false, width: 40 },
  { header: 'เครดิต', field: 'credit_term', required: false, width: 18, aliases: ['เครดิต (วัน)'] },
  { header: 'หมายเหตุ', field: 'remarks', required: false, width: 30 },
]

export const CUSTOMER_EXCEL_HEADERS = CUSTOMER_EXCEL_COLUMNS.map((c) => c.header)
