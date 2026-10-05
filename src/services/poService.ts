import api from '@/services/api'
import type { AvailablePR } from '@/types/po'

// only_orderable=true: backend returns only PRs that still have at least one line
// with something left to order (qty_to_order - qty_ordered > 0).
export const getAvailablePRs = async (): Promise<AvailablePR[]> => {
  const res = await api.get('/po/available-prs', { params: { only_orderable: true } })
  return res.data.data
}
