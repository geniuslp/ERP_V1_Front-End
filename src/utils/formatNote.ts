// Lays out a free-text note (remarks, other terms ...) as a list so long notes stay readable on screen and in print.
//
//   "1.ซื้อของ -ซื้ออาหาร -ซื้อยา 2. จ่ายส่วนตัว"   or the same text typed on separate lines, becomes
//
//   1.ซื้อของ
//      -ซื้ออาหาร
//      -ซื้อยา
//   2. จ่ายส่วนตัว
//
// Rules:
//  - a line break the user typed is always kept (blank lines too — they stay as spacing);
//  - a numbered item "1." "2." "3." starts a new line, but only when the numbers run 1, 2, 3 ... in order
//    (so "ตามข้อ 3. ของสัญญา" or "ราคา 5.5" in a sentence never breaks);
//  - a "-" that starts a word (at the start of a line or after a space) and is followed by a letter starts a
//    new, indented line; a hyphen inside a word ("A-B", "ซื้อ-ขาย") or before a digit ("-5%") is left alone.

export interface NoteLine {
  text: string
  /** 0 = normal / numbered line, 1 = "-" bullet (shown indented). */
  indent: 0 | 1
}

const BULLET = /(^|\s)-(?=[^\s\d-])/g
// "1." / "2." ... : a 1-2 digit number and a dot, not part of a decimal ("1.5") and not glued to a previous word.
const NUMBERED = /(^|\s)(\d{1,2})\.(?!\d)/g

const splitNumbered = (line: string): string[] => {
  const cuts: number[] = []
  let expected = 1
  NUMBERED.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = NUMBERED.exec(line)) !== null) {
    if (Number(m[2]) === expected) {
      cuts.push(m.index + m[1].length) // start of the number itself
      expected += 1
    }
  }
  if (cuts.length === 0) return [line]
  const parts: string[] = []
  let prev = 0
  for (const c of cuts) {
    if (c > prev) parts.push(line.slice(prev, c))
    prev = c
  }
  parts.push(line.slice(prev))
  return parts
}

const splitBullets = (line: string): string[] => {
  const cuts: number[] = []
  BULLET.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = BULLET.exec(line)) !== null) cuts.push(m.index + m[1].length)
  if (cuts.length === 0) return [line]
  const parts: string[] = []
  let prev = 0
  for (const c of cuts) {
    if (c > prev) parts.push(line.slice(prev, c))
    prev = c
  }
  parts.push(line.slice(prev))
  return parts
}

export const formatNote = (text?: string | null): NoteLine[] => {
  if (!text) return []
  const out: NoteLine[] = []
  for (const raw of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    if (raw.trim() === '') {
      out.push({ text: '', indent: 0 })
      continue
    }
    for (const numbered of splitNumbered(raw)) {
      for (const piece of splitBullets(numbered)) {
        const t = piece.trim()
        if (t === '') continue
        out.push({ text: t, indent: t.startsWith('-') ? 1 : 0 })
      }
    }
  }
  return out
}
