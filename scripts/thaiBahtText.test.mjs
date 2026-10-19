// Plain node test (the project has no test runner): node scripts/thaiBahtText.test.mjs
import assert from 'node:assert/strict'
import { thaiBahtText } from '../src/utils/thaiBahtText.ts'

const cases = [
  [0, 'ศูนย์บาทถ้วน'],
  [1, 'หนึ่งบาทถ้วน'],
  [11, 'สิบเอ็ดบาทถ้วน'],
  [21, 'ยี่สิบเอ็ดบาทถ้วน'],
  [101, 'หนึ่งร้อยเอ็ดบาทถ้วน'],
  [1000, 'หนึ่งพันบาทถ้วน'],
  [100000, 'หนึ่งแสนบาทถ้วน'],
  [1000000, 'หนึ่งล้านบาทถ้วน'],
  [1000001, 'หนึ่งล้านเอ็ดบาทถ้วน'],
  [21000000, 'ยี่สิบเอ็ดล้านบาทถ้วน'],
  [395000000, 'สามร้อยเก้าสิบห้าล้านบาทถ้วน'],
  [1000000000, 'หนึ่งพันล้านบาทถ้วน'],
  [1000000000000, 'หนึ่งล้านล้านบาทถ้วน'],
  [1234567.89, 'หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ดบาทแปดสิบเก้าสตางค์'],
  [0.5, 'ห้าสิบสตางค์'],
  [1.01, 'หนึ่งบาทหนึ่งสตางค์'],
  // extras: 10, string input (numeric(18,2) form), 16-digit value, empty/invalid input
  [2000000000, 'สองพันล้านบาทถ้วน'],
  [10, 'สิบบาทถ้วน'],
  [20, 'ยี่สิบบาทถ้วน'],
  ['9999999999999999.99', 'เก้าพันเก้าร้อยเก้าสิบเก้าล้านเก้าแสนเก้าหมื่นเก้าพันเก้าร้อยเก้าสิบเก้าล้านเก้าแสนเก้าหมื่นเก้าพันเก้าร้อยเก้าสิบเก้าบาทเก้าสิบเก้าสตางค์'],
  [null, ''], [undefined, ''], ['', ''], [NaN, ''], [-5, ''],
]
let failed = 0
for (const [input, expected] of cases) {
  const actual = thaiBahtText(input)
  try { assert.equal(actual, expected); console.log('PASS', JSON.stringify(input), '->', actual) }
  catch { failed++; console.log('FAIL', JSON.stringify(input), '\n  expected:', expected, '\n  actual:  ', actual) }
}
console.log(failed ? `${failed} FAILED` : `all ${cases.length} passed`)
process.exit(failed ? 1 : 0)
