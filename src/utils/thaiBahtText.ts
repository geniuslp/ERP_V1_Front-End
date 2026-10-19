// Single shared Thai baht-in-words conversion (Work Order page/prints, PO print, Petty Cash print).
// Do not copy this into pages — import it.
const THAI_NUM = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const THAI_POS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

// One chunk of up to 6 digits (หลักล้าน). A chunk longer than 1 digit uses "เอ็ด" for a final 1:
// a top chunk is stripped of leading zeros, lower chunks are always 6 digits wide.
const convertChunk = (chunk: string): string => {
  const len = chunk.length
  let out = ''
  for (let i = 0; i < len; i++) {
    const digit = Number(chunk[i])
    if (digit === 0) continue
    const pos = len - i - 1
    if (pos === 0 && digit === 1 && len > 1) out += 'เอ็ด'
    else if (pos === 1 && digit === 2) out += 'ยี่' + THAI_POS[1]
    else if (pos === 1 && digit === 1) out += THAI_POS[1]
    else out += THAI_NUM[digit] + THAI_POS[pos]
  }
  return out
}

// Non-negative integer digit string -> words. Every non-zero higher chunk is followed by "ล้าน",
// recursively (1,000,000,000,000 -> หนึ่งล้านล้าน).
const convertInt = (digits: string): string => {
  const s = digits.replace(/^0+(?=\d)/, '')
  if (s === '0') return THAI_NUM[0]
  if (s.length <= 6) return convertChunk(s)
  const head = s.slice(0, -6)
  const tail = s.slice(-6)
  return convertInt(head) + 'ล้าน' + (/^0+$/.test(tail) ? '' : convertChunk(tail))
}

// Amount -> "<integer digits>.<2-digit satang>" using integer math only. Accepts the numeric(18,2)
// string form as well as a number; returns null for empty / NaN / negative / unparsable input.
const toBahtSatang = (amount: number | string | null | undefined): { baht: string; satang: number } | null => {
  if (amount === null || amount === undefined || amount === '') return null
  let str: string
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount) || amount < 0) return null
    const cents = Math.round(amount * 100)
    str = Number.isSafeInteger(cents)
      ? `${BigInt(cents) / 100n}.${String(BigInt(cents) % 100n).padStart(2, '0')}`
      : amount.toFixed(2) // beyond 2^53 satang: use the exact decimal expansion of the double
  } else {
    str = amount.trim().replace(/,/g, '')
    if (!/^\d+(\.\d+)?$/.test(str)) return null
  }
  const [intPart, frac = ''] = str.split('.')
  const cents = BigInt(intPart) * 100n + BigInt(frac.slice(0, 2).padEnd(2, '0')) + (Number(frac[2] ?? 0) >= 5 ? 1n : 0n)
  return { baht: String(cents / 100n), satang: Number(cents % 100n) }
}

export function thaiBahtText(amount: number | string | null | undefined): string {
  const parsed = toBahtSatang(amount)
  if (!parsed) return ''
  const bahtWords = convertInt(parsed.baht) + 'บาท'
  const satangWords = parsed.satang === 0 ? 'ถ้วน' : convertInt(String(parsed.satang)) + 'สตางค์'
  // Satang-only amounts ("0.5") read just "ห้าสิบสตางค์".
  return parsed.baht === '0' && parsed.satang !== 0 ? satangWords : bahtWords + satangWords
}

// Kept for existing imports (Work Order create page / print).
export const numberToThaiText = thaiBahtText
