import axios from 'axios'
import type {
  PermRole, PermMenu, RoleMenuPermission, BatchPayload,
  DeptMenuPermission, DeptBatchPayload, EffectivePermission, UserPermBatchPayload,
  Department,
} from '@/types/permission.types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

// Mutable mock stores so in-session edits persist between calls
const mockRoles: PermRole[] = [
  { id: 1, role_code: 'A',  role_name: 'Admin',             level: 1, department: 'System',        dept_code: 'SYSTEM',   is_active: true },
  { id: 2, role_code: 'S',  role_name: 'Staff',             level: 2, department: 'Purchase',      dept_code: 'PURCHASE', is_active: true },
  { id: 3, role_code: 'SV', role_name: 'Supervisor',        level: 3, department: 'Purchase',      dept_code: 'PURCHASE', is_active: true },
  { id: 4, role_code: 'H2', role_name: 'Section Head',      level: 4, department: 'Stock',         dept_code: 'STOCK',    is_active: true },
  { id: 5, role_code: 'H1', role_name: 'Department Head',   level: 5, department: 'Stock',         dept_code: 'STOCK',    is_active: true },
  { id: 6, role_code: 'M',  role_name: 'Manager',           level: 6, department: 'Finance',       dept_code: 'FINANCE',  is_active: true },
  { id: 7, role_code: 'D',  role_name: 'Director',          level: 7, department: 'Finance',       dept_code: 'FINANCE',  is_active: true },
  { id: 8, role_code: 'E',  role_name: 'Executive',         level: 8, department: null,            dept_code: null,       is_active: true },
  { id: 9, role_code: 'B',  role_name: 'Board',             level: 9, department: null,            dept_code: null,       is_active: true },
]

const mockMenus: PermMenu[] = [
  { id: 1,  menu_code: 'PR',                 menu_name: 'ใบขอซื้อ (PR)',      parent_id: null, order: 0, is_active: true },
  { id: 11, menu_code: 'PR-CREATE',          menu_name: 'สร้างใบขอซื้อ',       parent_id: 1, order: 0, is_active: true },
  { id: 12, menu_code: 'PR-STATUS',          menu_name: 'ตรวจสอบสถานะ',       parent_id: 1, order: 1, is_active: true },
  { id: 13, menu_code: 'PR-HISTORY',         menu_name: 'ประวัติใบขอซื้อ',     parent_id: 1, order: 2, is_active: true },
  { id: 14, menu_code: 'PR-APPROVAL',        menu_name: 'อนุมัติ PR',          parent_id: 1, order: 3, is_active: true },

  { id: 2,  menu_code: 'PO',                 menu_name: 'ใบสั่งซื้อ (PO)',     parent_id: null, order: 1, is_active: true },
  { id: 21, menu_code: 'PO-CREATE',          menu_name: 'สร้างใบสั่งซื้อ',     parent_id: 2, order: 0, is_active: true },
  { id: 22, menu_code: 'PO-STATUS',          menu_name: 'ตรวจสอบสถานะ',       parent_id: 2, order: 1, is_active: true },
  { id: 23, menu_code: 'PO-HISTORY',         menu_name: 'ประวัติใบสั่งซื้อ',   parent_id: 2, order: 2, is_active: true },
  { id: 24, menu_code: 'PO-APPROVAL',        menu_name: 'อนุมัติ PO',          parent_id: 2, order: 3, is_active: true },

  { id: 3,  menu_code: 'MASTER',             menu_name: 'ข้อมูลหลัก (Master)', parent_id: null, order: 2, is_active: true },
  { id: 31, menu_code: 'MASTER-GROUPS',      menu_name: 'กลุ่ม',              parent_id: 3, order: 0, is_active: true },
  { id: 32, menu_code: 'MASTER-MATERIALS',   menu_name: 'วัสดุ (Material)',    parent_id: 3, order: 1, is_active: true },
  { id: 33, menu_code: 'MASTER-LOCATION',    menu_name: 'สถานที่ (Location)',  parent_id: 3, order: 2, is_active: true },
  { id: 34, menu_code: 'MASTER-SUPPLIER',    menu_name: 'ผู้ขาย (Supplier)',   parent_id: 3, order: 3, is_active: true },

  { id: 4,  menu_code: 'SYSTEM',             menu_name: 'System',             parent_id: null, order: 3, is_active: true },
  { id: 41, menu_code: 'SYSTEM-CONFIG',      menu_name: 'Config',             parent_id: 4, order: 0, is_active: true },
  { id: 42, menu_code: 'SYSTEM-USERS',       menu_name: 'จัดการผู้ใช้',        parent_id: 4, order: 1, is_active: true },
  { id: 43, menu_code: 'SYSTEM-ROLES',       menu_name: 'จัดการบทบาท',         parent_id: 4, order: 2, is_active: true },
  { id: 44, menu_code: 'SYSTEM-MENUS',       menu_name: 'จัดการเมนู',          parent_id: 4, order: 3, is_active: true },
  { id: 45, menu_code: 'SYSTEM-PERMISSIONS', menu_name: 'จัดการสิทธิ์',        parent_id: 4, order: 4, is_active: true },
]

// Seed: Admin gets full RWUD everywhere; lower levels taper off by module depth
const leafMenus = mockMenus.filter((m) => m.parent_id !== null)
const mockPermissions: RoleMenuPermission[] = mockRoles.flatMap((role) =>
  leafMenus.map((menu) => ({
    id: role.id * 100 + menu.id,
    role_id: role.id,
    menu_id: menu.id,
    can_read: role.level <= 6,
    can_write: role.level <= 4,
    can_update: role.level <= 2,
    can_delete: role.level === 1,
  })),
)

const mockDepts = ['Supply Chain', 'BD', 'Finance', 'System']

const mockDeptPermissions: DeptMenuPermission[] = mockDepts.flatMap((dept) =>
  leafMenus.map((menu) => ({
    dept_code: dept,
    menu_id: menu.id,
    can_read: true,
    can_write: dept === 'Supply Chain',
    can_update: false,
    can_delete: false,
  }))
)

const mockUsers = [
  { id: 1, username: 'admin',   full_name: 'Administrator',   department: 'System' },
  { id: 2, username: 'somchai', full_name: 'สมชาย ใจดี',      department: 'Supply Chain' },
  { id: 3, username: 'malee',   full_name: 'มาลี รักงาน',     department: 'BD' },
]

const mockUserPermissions: Map<string, { menu_id: number; can_read: boolean; can_write: boolean; can_update: boolean; can_delete: boolean; user_id: number }> = new Map()

const mockDepartments: Department[] = [
  { id: 1, dept_code: 'STOCK',    dept_name: 'Stock',            sort_order: 1, is_active: true },
  { id: 2, dept_code: 'LOGISTIC', dept_name: 'Logistic',         sort_order: 2, is_active: true },
  { id: 3, dept_code: 'PURCHASE', dept_name: 'Purchase',         sort_order: 3, is_active: true },
  { id: 4, dept_code: 'PROJECT',  dept_name: 'Project',          sort_order: 4, is_active: true },
  { id: 5, dept_code: 'PRODUCT',  dept_name: 'Product',          sort_order: 5, is_active: true },
  { id: 6, dept_code: 'DOC_CTRL', dept_name: 'Document Control', sort_order: 6, is_active: true },
  { id: 7, dept_code: 'HR',       dept_name: 'HR',               sort_order: 7, is_active: true },
  { id: 8, dept_code: 'FINANCE',  dept_name: 'Finance',          sort_order: 8, is_active: true },
]

const useMock = !BASE_URL

export const permissionMatrixService = {
  getRoles: async (token: string): Promise<PermRole[]> => {
    if (useMock) return [...mockRoles].sort((a, b) => a.level - b.level)
    const res = await axios.get(`${BASE_URL}/roles`, { headers: authHeader(token) })
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  },

  getMenus: async (token: string): Promise<PermMenu[]> => {
    if (useMock) return [...mockMenus]
    const res = await axios.get(`${BASE_URL}/menus`, { headers: authHeader(token) })
    const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])

    // parent_id/id can arrive as strings (e.g. Postgres bigint serialized over JSON) —
    // buildModuleGroups groups menus with strict `===` on these fields, so a numeric
    // id on one row and a string id on another silently breaks grouping with no error.
    // Coerce both to Number at the source so every consumer compares like-for-like.
    const normalizeId = (v: unknown): number | null =>
      v === null || v === undefined ? null : Number(v)

    const flat: PermMenu[] = []
    for (const item of raw) {
      if (import.meta.env.DEV && String(item.menu_code).startsWith('MENU_WO')) {
        console.log(`[getMenus] ${item.menu_code} raw parent_id:`, item.parent_id, 'typeof:', typeof item.parent_id, '| raw id:', item.id, 'typeof:', typeof item.id)
      }
      flat.push({
        id: normalizeId(item.id)!,
        menu_code: item.menu_code,
        menu_name: item.menu_name,
        menu_path: item.menu_path,
        parent_id: normalizeId(item.parent_id),
        order: item.sort_order ?? 0,
        is_active: item.is_active ?? true,
      })
      if (Array.isArray(item.children)) {
        for (const child of item.children) {
          if (import.meta.env.DEV && String(child.menu_code).startsWith('MENU_WO')) {
            console.log(`[getMenus] ${child.menu_code} raw parent_id:`, child.parent_id, 'typeof:', typeof child.parent_id, '| raw id:', child.id, 'typeof:', typeof child.id)
          }
          flat.push({
            id: normalizeId(child.id)!,
            menu_code: child.menu_code,
            menu_name: child.menu_name,
            menu_path: child.menu_path,
            parent_id: normalizeId(child.parent_id),
            order: child.sort_order ?? 0,
            is_active: child.is_active ?? true,
          })
        }
      }
    }
    return flat
  },

  getPermissions: async (token: string): Promise<RoleMenuPermission[]> => {
    if (useMock) return mockPermissions.map((p) => ({ ...p }))
    const res = await axios.get(`${BASE_URL}/role-menu-permissions`, { headers: authHeader(token) })
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  },

  batchUpdate: async (token: string, payload: BatchPayload): Promise<void> => {
    if (useMock) {
      for (const p of payload.permissions) {
        const idx = mockPermissions.findIndex((mp) => mp.role_id === p.role_id && mp.menu_id === p.menu_id)
        if (idx !== -1) {
          mockPermissions[idx] = { ...mockPermissions[idx], ...p }
        } else {
          mockPermissions.push({ ...p, id: p.role_id * 100 + p.menu_id })
        }
      }
      return
    }
    await axios.post(`${BASE_URL}/role-menu-permissions/batch`, payload, { headers: authHeader(token) })
  },

  getDeptPermissions: async (token: string): Promise<DeptMenuPermission[]> => {
    if (useMock) return mockDeptPermissions.map((p) => ({ ...p }))
    const res = await axios.get(`${BASE_URL}/dept-menu-permissions`, { headers: authHeader(token) })
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  },

  batchUpdateDept: async (token: string, payload: DeptBatchPayload): Promise<void> => {
    if (useMock) {
      for (const p of payload.permissions) {
        const idx = mockDeptPermissions.findIndex((dp) => dp.department === p.department && dp.menu_id === p.menu_id)
        if (idx !== -1) {
          mockDeptPermissions[idx] = { ...mockDeptPermissions[idx], ...p }
        } else {
          mockDeptPermissions.push({ ...p })
        }
      }
      return
    }
    await axios.post(`${BASE_URL}/dept-menu-permissions/batch`, payload, { headers: authHeader(token) })
  },

  getUsers: async (token: string): Promise<{ id: number; username: string; full_name: string; department: string }[]> => {
    if (useMock) return [...mockUsers]
    const res = await axios.get(`${BASE_URL}/users/allUser`, { headers: authHeader(token) })
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  },

  getEffectivePermissions: async (token: string, userId: number): Promise<EffectivePermission[]> => {
    if (useMock) {
      const user = mockUsers.find((u) => u.id === userId)
      return leafMenus.map((menu) => {
        const deptPerm = mockDeptPermissions.find((dp) => dp.department === user?.department && dp.menu_id === menu.id)
        const rolePerm = mockPermissions.find((rp) => rp.menu_id === menu.id)
        const userKey = `${userId}:${menu.id}`
        const userPerm = mockUserPermissions.get(userKey)
        return {
          menu_id: menu.id,
          menu_code: menu.menu_code,
          menu_name: menu.menu_name,
          parent_id: menu.parent_id,
          dept_can_read: deptPerm?.can_read ?? null,
          dept_can_write: deptPerm?.can_write ?? null,
          dept_can_update: deptPerm?.can_update ?? null,
          dept_can_delete: deptPerm?.can_delete ?? null,
          role_can_read: rolePerm?.can_read ?? null,
          role_can_write: rolePerm?.can_write ?? null,
          role_can_update: rolePerm?.can_update ?? null,
          role_can_delete: rolePerm?.can_delete ?? null,
          user_can_read: userPerm?.can_read ?? null,
          user_can_write: userPerm?.can_write ?? null,
          user_can_update: userPerm?.can_update ?? null,
          user_can_delete: userPerm?.can_delete ?? null,
        }
      })
    }
    const res = await axios.get(`${BASE_URL}/permissions/effective?user_id=${userId}`, { headers: authHeader(token) })
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  },

  batchUpdateUser: async (token: string, payload: UserPermBatchPayload): Promise<void> => {
    if (useMock) {
      for (const p of payload.permissions) {
        const key = `${payload.user_id}:${p.menu_id}`
        mockUserPermissions.set(key, { ...p, user_id: payload.user_id })
      }
      return
    }
    await axios.post(`${BASE_URL}/user-menu-permissions/batch`, payload, { headers: authHeader(token) })
  },

  getDepartments: async (token: string): Promise<Department[]> => {
    if (useMock) return [...mockDepartments]
    const res = await axios.get(`${BASE_URL}/departments`, { headers: authHeader(token) })
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  },

  resetUserPermissions: async (token: string, userId: number): Promise<void> => {
    if (useMock) {
      for (const key of Array.from(mockUserPermissions.keys())) {
        if (key.startsWith(`${userId}:`)) mockUserPermissions.delete(key)
      }
      return
    }
    await axios.delete(`${BASE_URL}/user-menu-permissions?user_id=${userId}`, { headers: authHeader(token) })
  },
}
