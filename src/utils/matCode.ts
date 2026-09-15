// Codes matching this pattern (e.g. x01, x02, X15, x99) are exempt from
// duplicate-mat_code checks in the PR flow — they're allowed to repeat freely
// across multiple lines in the same PR. Shared between PRCreatePage.tsx
// (submit-time check) and PRItemsTable.tsx (Material Picker dedupe + manual
// Code input warning) so the exemption rule can't drift out of sync between
// the two.
const EXEMPT_MAT_CODE_RE = /^x\d{2}/i

export const isExemptMatCode = (matCode: string): boolean => EXEMPT_MAT_CODE_RE.test(matCode)
