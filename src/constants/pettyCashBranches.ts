// No branch master endpoint exists in erp-api. These are the codes the frontend already uses for
// the branch dropdown elsewhere (WO employer_branch: HO/FAC-S/FAC-P/BO). Swap this for a fetch
// when a real branch source exists — branch_code is varchar(20) server-side.
export const PC_BRANCH_OPTIONS = [
  { value: 'HO', label: 'HO — สำนักงานใหญ่ (บางแค)' },
  { value: 'FAC-S', label: 'FAC-S — ศาลายา' },
  { value: 'FAC-P', label: 'FAC-P — ปราจีนบุรี' },
  { value: 'FAC-B', label: 'FAC-B — บางบ่อ' },
]

/** "HO — สำนักงานใหญ่ (บางแค)" for a known code, the raw code otherwise, '' when empty. */
export const pcBranchLabel = (code?: string | null): string =>
  code ? PC_BRANCH_OPTIONS.find((b) => b.value === code)?.label ?? code : ''
