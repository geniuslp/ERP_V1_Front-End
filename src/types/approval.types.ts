export interface ApprovalDocType {
  id: number
  doc_type: string
  doc_label: string
  is_active: boolean
}

export interface ApprovalConfig {
  id: number
  doc_type: string
  step_no: number
  step_name: string
  approver_role_id: number
  role_name?: string
  is_active: boolean
}

export interface ApprovalRole {
  id: number
  role_code: string
  role_name: string
  description?: string
  is_active: boolean
}

// POST /api/approval-config — backend auto-generates the rest
export interface CreateRulePayload {
  doc_type: string
  approver_role_id: number
}

// POST /api/roles — backend auto-generates role_code
export interface CreateRolePayload {
  role_name: string
  description?: string
}

export interface BatchPayload {
  create: CreateRulePayload[]
  delete: number[]
}
