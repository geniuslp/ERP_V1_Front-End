// Same conversion algorithm as PurchaseOrderPrint.tsx's private thaiBahtText() —
// extracted here so other pages (Work Order, etc.) can reuse it instead of
// re-implementing bahttext logic.
const THAI_NUM = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const THAI_POS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

export function numberToThaiText(amount: number): string {
  amount = Math.round(Math.abs(amount) * 100) / 100
  const [intStr, decStr] = amount.toFixed(2).split('.')
  const intClean = intStr.replace(/^0+(?=\d)/, '')

  const convertInt = (numStr: string): string => {
    if (numStr === '0') return 'ศูนย์'
    const len = numStr.length
    let out = ''
    for (let i = 0; i < len; i++) {
      const digit = parseInt(numStr[i], 10)
      if (digit === 0) continue
      const pos = len - i - 1
      const posInGroup = pos % 6
      if (posInGroup === 0 && digit === 1 && pos !== len - 1) {
        out += 'เอ็ด'
      } else if (posInGroup === 1 && digit === 2) {
        out += 'ยี่' + THAI_POS[1]
      } else if (posInGroup === 1 && digit === 1) {
        out += THAI_POS[1]
      } else {
        out += THAI_NUM[digit] + THAI_POS[posInGroup]
      }
      if (posInGroup === 0 && pos !== 0) out += 'ล้าน'
    }
    return out
  }

  const bahtWords = convertInt(intClean) + 'บาท'
  const satang = parseInt(decStr, 10)
  const satangWords = satang === 0 ? 'ถ้วน' : convertInt(String(satang)) + 'สตางค์'
  return bahtWords + satangWords
}
