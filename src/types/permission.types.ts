export type PermField = 'read' | 'write' | 'update' | 'delete'

export interface PermRole {
  id: number
  role_code: string
  role_name: string
  level: number
  department: string | null
  dept_code: string | null
  is_active: boolean
}

export interface PermMenu {
  id: number
  menu_code: string
  menu_name: string
  menu_path?: string
  parent_id: number | null
  order: number
  is_active: boolean
}

export interface RoleMenuPermission {
  id?: number | null
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

export interface DeptMenuPermission {
  id?: number
  dept_code: string
  department?: string
  menu_id: number
  can_read: boolean
  can_write: boolean
  can_update: boolean
  can_delete: boolean
}

export interface EffectivePermission {
  menu_id: number
  menu_code: string
  menu_name: string
  parent_id: number | null
  dept_can_read: boolean | null
  dept_can_write: boolean | null
  dept_can_update: boolean | null
  dept_can_delete: boolean | null
  role_can_read: boolean | null
  role_can_write: boolean | null
  role_can_update: boolean | null
  role_can_delete: boolean | null
  user_can_read: boolean | null
  user_can_write: boolean | null
  user_can_update: boolean | null
  user_can_delete: boolean | null
}

export interface UserPermBatchPayload {
  user_id: number
  permissions: {
    menu_id: number
    can_read: boolean
    can_write: boolean
    can_update: boolean
    can_delete: boolean
  }[]
}

export interface DeptBatchPayload {
  permissions: DeptMenuPermission[]
}

export interface Department {
  id: number
  dept_code: string
  dept_name: string
  sort_order: number
  is_active: boolean
}
