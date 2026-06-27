import axios from 'axios'
import type { PermRole, PermMenu, RoleMenuPermission, BatchPayload } from '@/types/permission.types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

// Mutable mock stores so in-session edits persist between calls
const mockRoles: PermRole[] = [
  { id: 1, role_code: 'A',  role_name: 'Admin',             level: 1, is_active: true },
  { id: 2, role_code: 'S',  role_name: 'Staff',             level: 2, is_active: true },
  { id: 3, role_code: 'SV', role_name: 'Supervisor',        level: 3, is_active: true },
  { id: 4, role_code: 'H2', role_name: 'Section Head',      level: 4, is_active: true },
  { id: 5, role_code: 'H1', role_name: 'Department Head',   level: 5, is_active: true },
  { id: 6, role_code: 'M',  role_name: 'Manager',           level: 6, is_active: true },
  { id: 7, role_code: 'D',  role_name: 'Director',          level: 7, is_active: true },
  { id: 8, role_code: 'E',  role_name: 'Executive',         level: 8, is_active: true },
  { id: 9, role_code: 'B',  role_name: 'Board',             level: 9, is_active: true },
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
    return Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
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
}
