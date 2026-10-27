// Hardcoded job-type list for the PR create page — no master table backs this.
// filterSubjectCodes + filterJobCode are matched together against each CostCode
// row's `subject_code` + `job_code` (from GET /master/cost-code/full, joined
// from cost_job) to narrow the CostCode picker's options. cost_job.job_code
// values repeat across multiple cost_subject (M/S/L) — e.g. job_code='P'
// exists once under subject M, once under S, once under L — so job_code alone
// is NOT a unique filter key; subject_code must be constrained too.
// `filterJobCode: null` means "show all CostCode options, unfiltered".
//
// filterSubjectCodes is an ARRAY (not a single code) because M (Material),
// S (Subcontract), and L (Labour) share the same 6 job_code letters
// (P/E/S/F/G/H, same job_name per letter) but have different
// cost_group/cost_subgroup data underneath (e.g. job P: M's group 01
// 'Plates & Coils', S's group 30 'Subcontractor', L's group named
// 'Dialy Labour' — that spelling is intentional per the user, not a typo to
// fix). Selecting Job Type 'MS' (Metal Structure) must show ALL THREE subjects' rows for job P
// together in the CostCode picker — confirmed via user's Excel reference —
// so MS/EE/SN/FF/GS/AC list filterSubjectCodes: ['M', 'S', 'L']. There are no
// separate SP/SE/.../LP/LE/... entries — a previous attempt added
// subject-specific codes but was reverted in favor of this merged-array
// approach.
//
// FS/FP/FB/DE/RE added per the PR+PO "ประเภท Job" requirement — these are
// stock/dead-stock/return classifications. FS confirmed against the live DB
// (subject_code='F', job_code='S' — resolves to FS10101 post-rename).
// FP/FB/DE/RE are still unconfirmed (TBD, pending backend query result) —
// left null for now, which means those four still hit the `unbacked`
// early-return in CostCodeJobTypeModal.tsx until real values are filled in
// here; 'G' stays genuinely unfiltered by design, not a placeholder.
export interface JobTypeOption {
  code: string
  label: string
  filterSubjectCodes?: string[] | null
  filterJobCode: string | null
}

// The six engineering-system jobs (formerly the "M*" codes). Use this instead of a prefix check: the
// new codes (MS, EE, SN, FF, GS, AC) share no common prefix. Mirrors tradeJobCodes in erp-api job_type.go.
export const TRADE_JOB_CODES = ['MS', 'EE', 'SN', 'FF', 'GS', 'AC', 'CS', 'AR']
export const isTradeJobCode = (code: string): boolean => TRADE_JOB_CODES.includes(code)

export const JOB_TYPES: JobTypeOption[] = [
  { code: 'MS', label: 'MS - Metal Structure', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'P' },
  { code: 'EE', label: 'EE - Electrical System', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'E' },
  { code: 'SN', label: 'SN - Sanitary System', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'S' },
  { code: 'FF', label: 'FF - Fire Protection', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'F' },
  { code: 'GS', label: 'GS - Gas System', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'G' },
  { code: 'AC', label: 'AC - HVAC / BAS / Clean-R.', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'H' },
  // CS / AR: cost data exists under subjects M (Major) and S (Head + subcontractor) only, hence no 'L'.
  { code: 'CS', label: 'CS - Civil&Structure', filterSubjectCodes: ['M', 'S'], filterJobCode: 'C' },
  { code: 'AR', label: 'AR - Architec', filterSubjectCodes: ['M', 'S'], filterJobCode: 'A' },
  { code: 'FS', label: 'FS - Stock FAC-S', filterSubjectCodes: ['F'], filterJobCode: 'S' },
  // TBD — waiting on backend query result for the correct subject_code.
  { code: 'FP', label: 'FP - Stock FAC-P', filterSubjectCodes: ['F'], filterJobCode: 'P' },
  { code: 'FB', label: 'FB - Stock FAC-BO', filterSubjectCodes: ['F'], filterJobCode: 'B' },
  { code: 'DE', label: 'DE - Dead Stock', filterSubjectCodes: null, filterJobCode: null },
  { code: 'RE', label: 'RE - Return Project', filterSubjectCodes: null, filterJobCode: null },
  { code: 'G', label: 'G - General Code', filterSubjectCodes: ['OH'], filterJobCode: 'G' },
]
