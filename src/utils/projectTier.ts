// Project tier from the project value. Mirrors project.project_tier in the database (generated
// column, migration 038) — the server value is what lists show; this is only the live preview on
// the project form. 1: < 1M, 2: 1M - < 10M, 3: 10M - < 100M, 4: 100M - < 500M, 5: >= 500M.
// The project value wins; the contract amount is the fallback; neither set -> null.
export const PROJECT_TIER_RANGE: Record<number, string> = {
  1: '< 1 ล้าน',
  2: '1 - 10 ล้าน',
  3: '10 - 100 ล้าน',
  4: '100 - 500 ล้าน',
  5: '500 ล้านขึ้นไป',
}

export const calcProjectTier = (projectValue?: number | null, contractAmount?: number | null): number | null => {
  const v = Number(projectValue) > 0 ? Number(projectValue) : Number(contractAmount) > 0 ? Number(contractAmount) : 0
  if (!(v > 0)) return null
  if (v < 1_000_000) return 1
  if (v < 10_000_000) return 2
  if (v < 100_000_000) return 3
  if (v < 500_000_000) return 4
  return 5
}

export const formatProjectTier = (tier?: number | null): string => (tier ? `Tier ${tier}` : '-')
