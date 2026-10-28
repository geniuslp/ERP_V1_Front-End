// Brand is shown only when it carries a real value — blank, "-" and "--" (the placeholder some
// legacy rows hold) are treated as "no brand".
export const cleanBrand = (brand?: string | null): string => {
  const b = (brand ?? '').trim()
  return /^-+$/.test(b) ? '' : b
}

// Merge item name + spec + brand for display, e.g. "รายการ" column and print echo.
// Joined by exactly one space; parts that are null/undefined/blank are skipped.
// Never emits "null"/"undefined" or a double space.
export const formatItemLabel = (name?: string | null, spec?: string | null, brand?: string | null): string =>
  [(name ?? '').trim(), (spec ?? '').trim(), cleanBrand(brand)].filter(Boolean).join(' ')
