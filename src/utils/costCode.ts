// Display-only helper for cost codes. Subject OH codes are stored with the 2-letter "OH" prefix
// (e.g. OHG100100) but shown to users without it (G100100). Never use this for payloads, row keys,
// comparisons, server-side search or the cost-code master Excel export - those keep the stored code.
export const formatCostCodeDisplay = (costCode?: string | null): string => {
  if (!costCode) return ''
  return costCode.startsWith('OH') ? costCode.slice(2) : costCode
}
