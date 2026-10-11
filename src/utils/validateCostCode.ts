// Shared submit-time cost-code check for PR and PO (both create and edit).
// Draft saves never call this. Returns the 0-based indexes of lines that have
// no cost code; an empty array means every line is fine.
export const COST_CODE_REQUIRED_MESSAGE = 'กรุณาระบุ Cost Code ให้ครบทุกรายการก่อนส่ง'

export const findLinesMissingCostCode = (
  lines: ReadonlyArray<{ cost_subgroup_id?: number | null }>,
): number[] => {
  const missing: number[] = []
  lines.forEach((l, i) => {
    if (l.cost_subgroup_id == null) missing.push(i)
  })
  return missing
}

// Row props for antd Table `onRow`: red tint + a marker attribute that
// scrollToFirstMissingCostCode() looks up.
export const missingCostRowProps = (highlight: boolean, missing: boolean) =>
  highlight && missing
    ? { style: { background: '#fef2f2' }, 'data-cost-missing': '1' }
    : {}

export const scrollToFirstMissingCostCode = () => {
  // Wait one tick so the highlighted rows have rendered.
  setTimeout(() => {
    document
      .querySelector('[data-cost-missing="1"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 50)
}
