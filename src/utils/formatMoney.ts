// Money for list tables: 2 decimals + thousands separators. Accepts numbers or numeric strings
// (some endpoints serialize NUMERIC columns as strings); null/undefined/NaN → '-'.
export const formatMoney = (v?: number | string | null): string => {
  if (v == null || v === '') return '-'
  const n = Number(v)
  return Number.isNaN(n) ? '-' : n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
