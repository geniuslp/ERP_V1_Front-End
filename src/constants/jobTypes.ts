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
// fix). Selecting Job Type 'MP' must show ALL THREE subjects' rows for job P
// together in the CostCode picker — confirmed via user's Excel reference —
// so MP/ME/MS/MF/MG/MH list filterSubjectCodes: ['M', 'S', 'L']. There are no
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

export const JOB_TYPES: JobTypeOption[] = [
  { code: 'MP', label: 'MP - Metal Structure', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'P' },
  { code: 'ME', label: 'ME - Electrical system work', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'E' },
  { code: 'MS', label: 'MS - Sanitary System', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'S' },
  { code: 'MF', label: 'MF - Fire Protection', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'F' },
  { code: 'MG', label: 'MG - GAS System', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'G' },
  { code: 'MH', label: 'MH - HVAC / BAS / Clean Room-Cold Room', filterSubjectCodes: ['M', 'S', 'L'], filterJobCode: 'H' },
  { code: 'FS', label: 'FS - Stock FAC-S', filterSubjectCodes: ['F'], filterJobCode: 'S' },
  // TBD — waiting on backend query result for the correct subject_code.
  { code: 'FP', label: 'FP - Stock FAC-P', filterSubjectCodes: null, filterJobCode: null },
  { code: 'FB', label: 'FB - Stock FAC-BO', filterSubjectCodes: null, filterJobCode: null },
  { code: 'DE', label: 'DE - Dead Stock', filterSubjectCodes: null, filterJobCode: null },
  { code: 'RE', label: 'RE - Return Project', filterSubjectCodes: null, filterJobCode: null },
  { code: 'OH', label: 'OH - General Code', filterSubjectCodes: null, filterJobCode: null },
]
