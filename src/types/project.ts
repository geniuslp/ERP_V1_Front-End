export type ProjectStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED'

export interface Project {
  id: number
  projectCode: string
  projectName: string
  // Free-text project address (no longer an FK/lookup against the location
  // master) — `locationName` no longer exists in the API response.
  locationCode?: string
  ownerId?: number
  ownerName?: string
  // "เจ้าของโครงการ" — free text, distinct from ownerId/ownerName ("ผู้รับผิดชอบหลัก", FK to users)
  projectOwnerName?: string
  jobCodes?: string[]
  credit?: string
  budgetAmount: number
  consultantName?: string
  startDate?: string
  endDate?: string
  status: ProjectStatus
  isActive: boolean
  createdAt: string
  updatedAt: string
}
