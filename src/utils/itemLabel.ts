// Merge item name + spec for display, e.g. "รายการ" column and print echo.
// Joined by exactly one space; falls back to just the name when spec is
// null/undefined/blank. Never emits "null"/"undefined" or a double space.
export const formatItemLabel = (name?: string | null, spec?: string | null): string => {
  const n = (name ?? '').trim()
  const s = (spec ?? '').trim()
  return s ? `${n} ${s}` : n
}
