export type ProjectStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED'

export interface Project {
  id: number
  projectCode: string
  projectName: string
  // Free-text project address (no longer an FK/lookup against the location
  // master) — `locationName` no longer exists in the API response.
  locationCode?: string
  // "แผนก" — FK to departments.dept_code; deptName is joined for display.
  deptCode?: string
  deptName?: string
  // deprecated: superseded by responsiblePersonName, kept for backward compat only
  ownerId?: number
  ownerName?: string
  // "เจ้าของโครงการ" — free text, distinct from ownerId/ownerName
  projectOwnerName?: string
  // "ผู้รับผิดชอบหลัก" — free text, required on write; replaces the old owner_id dropdown
  responsiblePersonName?: string
  jobCodes?: string[]
  budgetAmount: number
  consultantName?: string
  // "เบอร์ติดต่อของที่ปรึกษา" — freeform, no validation
  consultantPhone?: string
  startDate?: string
  endDate?: string
  status: ProjectStatus
  isActive: boolean
  createdAt: string
  updatedAt: string
}
