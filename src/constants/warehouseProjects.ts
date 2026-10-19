// Dedicated "warehouse projects" (บางแค/ศาลายา/บางบ่อ/ปราจีน) — stock-holding pseudo-projects,
// not real customer projects. Excluded from the Work Order project picker.
// TODO: replace with a backend flag (GET /master/projects has no field that distinguishes
// warehouse projects yet). PRCreatePage.tsx and POCreatePage.tsx keep their own local copies
// of this list; they are intentionally not migrated here.
export const WAREHOUSE_PROJECT_CODES = ['2026-WH-001', '2026-WH-002', '2026-WH-003', '2026-WH-004']
