// Shared row-tint class names for list/history tables (MemoListPage.tsx,
// PRHistoryPage.tsx, POHistoryPage.tsx). The actual color values live in
// src/index.css (".row-tint-*" rules) — this file only names the 4 shared
// categories so every page references the same class strings instead of
// hardcoding them. To change a color, edit index.css only; this file never
// needs to change for a palette tweak.
export const ROW_TINT_CLASS = {
  green: 'row-tint-green',
  orange: 'row-tint-orange',
  red: 'row-tint-red',
  gray: 'row-tint-gray',
} as const

// Legend swatch colors — must equal the fill / left-bar colors of the matching
// ".row-tint-*" rules in src/index.css (the one place a palette change is made;
// update both together). Used by RowTintLegend so legend and rows cannot drift.
export const ROW_TINT_SWATCH = {
  green: { color: '#d9f7be', borderColor: '#52c41a' },
  orange: { color: '#ffe7ba', borderColor: '#fa8c16' },
  red: { color: '#ffccc7', borderColor: '#f5222d' },
  gray: { color: '#e5e7eb', borderColor: '#8c8c8c' },
} as const

export type RowTintCategory = keyof typeof ROW_TINT_CLASS
