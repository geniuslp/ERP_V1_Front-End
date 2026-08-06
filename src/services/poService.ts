import api from '@/services/api'
import type { AvailablePR } from '@/types/po'

export const getAvailablePRs = async (): Promise<AvailablePR[]> => {
  const res = await api.get('/po/available-prs')
  return res.data.data
}
