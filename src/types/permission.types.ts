export type PermField = 'read' | 'write' | 'update' | 'delete'

export interface PermRole {
  id: number
  role_code: string
  role_name: string
  level: number
  is_active: boolean
}

export interface PermMenu {
  id: number
  menu_code: string
  menu_name: string
  parent_id: number | null
  order: number
  is_active: boolean
}

export interface RoleMenuPermission {
  id?: number
  role_id: number
  menu_id: number
  can_read: boolean
  can_write: boolean
  can_update: boolean
  can_delete: boolean
}

// POST /api/role-menu-permissions/batch — send every record that changed
export interface BatchPayload {
  permissions: RoleMenuPermission[]
}
