export type ProjectStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED'

export interface Project {
  id: number
  projectCode: string
  projectName: string
  locationCode?: string
  locationName?: string
  ownerId?: number
  ownerName?: string
  budgetAmount: number
  consultantName?: string
  startDate?: string
  endDate?: string
  status: ProjectStatus
  isActive: boolean
  createdAt: string
  updatedAt: string
}
