// Shared credit/payment term options — the single source of truth for both
// Supplier's payment_terms and Customer's credit_term dropdowns, so they
// never drift apart. Customer's form filters out "เงินสด" at render time
// (it does not apply to Customer's credit_term) without altering this list.
export const PAYMENT_TERM_OPTIONS = [
  { label: 'เงินสด', value: 'เงินสด' },
  ...[7, 15, 30, 45, 60, 90].map((d) => ({ label: `${d} วัน`, value: `${d} วัน` })),
]
