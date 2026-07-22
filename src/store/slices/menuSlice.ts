import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { MenuConfig, MenuPermission } from '@/types'

interface MenuState {
  menus: MenuConfig[]
  permissions: MenuPermission[]
  isLoading: boolean
}

const defaultMenus: MenuConfig[] = [
  { id: 'dashboard', key: 'dashboard', label: 'Dashboard', icon: 'DashboardOutlined', path: '/', parentId: null, order: 0, isActive: true },
  { id: 'pr', key: 'pr', label: 'ใบขอซื้อ (PR)', icon: 'FileTextOutlined', parentId: null, order: 2, isActive: true, children: [
    { id: 'pr-create', key: 'pr-create', label: 'สร้างใบขอซื้อ', path: '/pr/create', parentId: 'pr', order: 0, isActive: true },
    { id: 'pr-status', key: 'pr-status', label: 'ตรวจสอบสถานะ', path: '/pr/status', parentId: 'pr', order: 1, isActive: true },
    { id: 'pr-history', key: 'pr-history', label: 'ประวัติใบขอซื้อ', path: '/pr/history', parentId: 'pr', order: 2, isActive: true },
  ]},
  { id: 'memo', key: 'memo', label: 'ใบบันทึก (Memo)', icon: 'FileTextOutlined', parentId: null, order: 1, isActive: true, children: [
    { id: 'memo-list', key: 'memo-list', label: 'รายการใบบันทึก', path: '/memo', parentId: 'memo', order: 0, isActive: true },
    { id: 'memo-create', key: 'memo-create', label: 'สร้างใบบันทึก', path: '/memo/create', parentId: 'memo', order: 1, isActive: true },
    { id: 'memo-approval', key: 'memo-approval', label: 'อนุมัติ Memo', path: '/memo/approval', parentId: 'memo', order: 2, isActive: true },
  ]},
  { id: 'po', key: 'po', label: 'ใบสั่งซื้อ (PO)', icon: 'ShoppingCartOutlined', parentId: null, order: 3, isActive: true, children: [
    { id: 'po-create', key: 'po-create', label: 'สร้างใบสั่งซื้อ', path: '/po/create', parentId: 'po', order: 0, isActive: true },
    { id: 'po-status', key: 'po-status', label: 'ตรวจสอบสถานะ', path: '/po/status', parentId: 'po', order: 1, isActive: true },
    { id: 'po-history', key: 'po-history', label: 'ประวัติใบสั่งซื้อ', path: '/po/history', parentId: 'po', order: 2, isActive: true },
    { id: 'po-approval', key: 'po-approval', label: 'อนุมัติ PO', path: '/po/approval', parentId: 'po', order: 3, isActive: true },
  ]},
  { id: 'master', key: 'master', label: 'ข้อมูลหลัก (Master)', icon: 'AppstoreOutlined', parentId: null, order: 3, isActive: true, children: [
    { id: 'master-groups', key: 'master-groups', label: 'กลุ่ม', path: '/master/groups', parentId: 'master', order: 0, isActive: true },
    { id: 'master-materials', key: 'master-materials', label: 'วัสดุ (Material)', path: '/master/materials', parentId: 'master', order: 1, isActive: true },
    { id: 'master-cost-code', key: 'master-cost-code', label: 'Group Cost Code', path: '/master/cost-code', parentId: 'master', order: 2, isActive: true },
    { id: 'master-location', key: 'master-location', label: 'สถานที่ (Location)', path: '/master/location', parentId: 'master', order: 3, isActive: true },
    { id: 'master-supplier', key: 'master-supplier', label: 'ผู้ขาย (Supplier)', path: '/master/supplier', parentId: 'master', order: 4, isActive: true },
    { id: 'master-stock', key: 'master-stock', label: 'พัสดุ (Stock)', path: '/master/stock', parentId: 'master', order: 5, isActive: true },
    { id: 'master-projects', key: 'master-projects', label: 'โครงการ (Project)', path: '/master/projects', parentId: 'master', order: 6, isActive: true },
  ]},
  { id: 'admin', key: 'admin', label: 'Admin', icon: 'SafetyOutlined', parentId: null, order: 98, isActive: true, children: [
    { id: 'admin-approval-matrix', key: 'admin-approval-matrix', label: 'Approval Matrix', path: '/admin/approval-matrix', parentId: 'admin', order: 0, isActive: true },
    { id: 'admin-permission-matrix', key: 'admin-permission-matrix', label: 'Permission Matrix', path: '/admin/permission-matrix', parentId: 'admin', order: 1, isActive: true },
  ]},
  { id: 'stock', key: 'stock', label: 'คลังพัสดุ (Stock)', icon: 'AppstoreOutlined', parentId: null, order: 30, isActive: true, children: [
    { id: 'stock-items',        key: 'stock-items',        label: 'ข้อมูลพัสดุ',         icon: 'AppstoreOutlined',  path: '/stock/items',           parentId: 'stock', order: 1, isActive: true },
    { id: 'stock-inventory',    key: 'stock-inventory',    label: 'ยอดคงเหลือ',          icon: 'DatabaseOutlined',  path: '/stock/inventory',       parentId: 'stock', order: 2, isActive: true },
    { id: 'stock-transactions', key: 'stock-transactions', label: 'รับ-จ่ายพัสดุ',       icon: 'SwapOutlined',      path: '/stock/transactions',    parentId: 'stock', order: 3, isActive: true },
    { id: 'stock-borrow',       key: 'stock-borrow',       label: 'ยืม-คืนพัสดุ',        icon: 'ExportOutlined',    path: '/stock/borrow',          parentId: 'stock', order: 4, isActive: true },
    { id: 'stock-approval',     key: 'stock-approval',     label: 'อนุมัติการยืม',       icon: 'CheckOutlined',     path: '/stock/borrow/approval', parentId: 'stock', order: 5, isActive: true },
    { id: 'stock-reservation',  key: 'stock-reservation',  label: 'จองพัสดุ',            icon: 'CalendarOutlined',  path: '/stock/reservations',    parentId: 'stock', order: 6, isActive: true },
    { id: 'stock-qrcode',       key: 'stock-qrcode',       label: 'QR Code พัสดุ',       icon: 'QrcodeOutlined',    path: '/stock/qrcode',          parentId: 'stock', order: 7, isActive: true },
  ]},
  { id: 'system', key: 'system', label: 'System', icon: 'SettingOutlined', parentId: null, order: 99, isActive: true, children: [
    { id: 'system-config', key: 'system-config', label: 'Config', path: '/system/config', parentId: 'system', order: 0, isActive: true },
    { id: 'system-users', key: 'system-users', label: 'จัดการผู้ใช้', path: '/system/users', parentId: 'system', order: 1, isActive: true },
    { id: 'system-roles', key: 'system-roles', label: 'จัดการบทบาท', path: '/system/roles', parentId: 'system', order: 2, isActive: true },
    { id: 'system-menus', key: 'system-menus', label: 'จัดการเมนู', path: '/system/menus', parentId: 'system', order: 3, isActive: true },
    { id: 'system-permissions', key: 'system-permissions', label: 'จัดการสิทธิ์', path: '/system/permissions', parentId: 'system', order: 4, isActive: true },
  ]},
]

const initialState: MenuState = {
  menus: defaultMenus,
  permissions: [],
  isLoading: false,
}

const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    setMenus(state, action: PayloadAction<MenuConfig[]>) {
      state.menus = action.payload
    },
    setPermissions(state, action: PayloadAction<MenuPermission[]>) {
      state.permissions = action.payload
    },
    addMenu(state, action: PayloadAction<MenuConfig>) {
      state.menus.push(action.payload)
    },
    updateMenu(state, action: PayloadAction<MenuConfig>) {
      const idx = state.menus.findIndex((m) => m.id === action.payload.id)
      if (idx !== -1) state.menus[idx] = action.payload
    },
    deleteMenu(state, action: PayloadAction<string>) {
      state.menus = state.menus.filter((m) => m.id !== action.payload)
    },
  },
})

export const { setMenus, setPermissions, addMenu, updateMenu, deleteMenu } = menuSlice.actions
export default menuSlice.reducer
