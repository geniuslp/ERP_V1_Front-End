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

export type RowTintCategory = keyof typeof ROW_TINT_CLASS
