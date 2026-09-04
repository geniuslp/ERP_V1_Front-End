// Hardcoded job-type list for the PR create page — no master table backs this.
// filterSubjectCode + filterJobCode are matched together against each CostCode
// row's `subject_code` + `job_code` (from GET /master/cost-code/full, joined
// from cost_job) to narrow the CostCode picker's options. cost_job.job_code
// values repeat across multiple cost_subject (M/S/L) — e.g. job_code='P'
// exists once under subject M, once under S, once under L — so job_code alone
// is NOT a unique filter key; subject_code must be constrained too.
// `filterJobCode: null` means "show all CostCode options, unfiltered".
//
// FS/FP/FB/DE/RE added per the PR+PO "ประเภท Job" requirement — these are
// stock/dead-stock/return classifications, not cost-code-linked job types,
// so filterSubjectCode/filterJobCode are null (unfiltered CostCode picker),
// same as 'G'.
export interface JobTypeOption {
  code: string
  label: string
  filterSubjectCode: string | null
  filterJobCode: string | null
}

export const JOB_TYPES: JobTypeOption[] = [
  { code: 'MP', label: 'MP - Metal Structure', filterSubjectCode: 'M', filterJobCode: 'P' },
  { code: 'ME', label: 'ME - Electrical system work', filterSubjectCode: 'M', filterJobCode: 'E' },
  { code: 'MS', label: 'MS - Sanitary System', filterSubjectCode: 'M', filterJobCode: 'S' },
  { code: 'MF', label: 'MF - Fire Protection', filterSubjectCode: 'M', filterJobCode: 'F' },
  { code: 'MG', label: 'MG - GAS System', filterSubjectCode: 'M', filterJobCode: 'G' },
  { code: 'MH', label: 'MH - HVAC / BAS / Clean Room-Cold Room', filterSubjectCode: 'M', filterJobCode: 'H' },
  { code: 'FS', label: 'FS - Stock FAC-S', filterSubjectCode: null, filterJobCode: null },
  { code: 'FP', label: 'FP - Stock FAC-P', filterSubjectCode: null, filterJobCode: null },
  { code: 'FB', label: 'FB - Stock FAC-BO', filterSubjectCode: null, filterJobCode: null },
  { code: 'DE', label: 'DE - Dead Stock', filterSubjectCode: null, filterJobCode: null },
  { code: 'RE', label: 'RE - Return Project', filterSubjectCode: null, filterJobCode: null },
  { code: 'G', label: 'G - General Code', filterSubjectCode: null, filterJobCode: null },
]
