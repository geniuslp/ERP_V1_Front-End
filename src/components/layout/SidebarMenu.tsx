import React, { useMemo } from 'react'
import { Menu, Skeleton } from 'antd'
import {
  DashboardOutlined, FileTextOutlined, ShoppingCartOutlined,
  SettingOutlined, PlusOutlined, SearchOutlined, HistoryOutlined,
  TeamOutlined, ApartmentOutlined, AppstoreOutlined, SafetyOutlined,
  CheckCircleOutlined, DatabaseOutlined, SwapOutlined, ExportOutlined,
  CalendarOutlined, QrcodeOutlined, CheckOutlined, UserOutlined,
  InboxOutlined, RetweetOutlined, FundOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePermissionContext } from '@/contexts/PermissionContext'
import type { PermMenu } from '@/types/permission.types'
import type { MenuProps } from 'antd'

// Top-level menu_code values that are role-locked to ADMIN_CENTER regardless
// of what the permission matrix grants — mirrors the RequireRole route
// guards on /admin and /system so the nav doesn't show entries the route
// itself will block. Per CLAUDE.md's documented DB convention (e.g. the
// confirmed "MENU_STOCK_BORROW" example), top-level codes follow MENU_<NAME>.
const ADMIN_CENTER_ONLY_MENU_CODES = ['MENU_ADMIN', 'MENU_SYSTEM']

// CREATE routes are route-guarded with action="write" via RequirePermission
// (see App.tsx) — the sidebar must gate on the same action per menu, or a
// role with can_read=true/can_write=false would see a nav entry that 403s.
const isCreateMenu = (menuCode: string) => menuCode.endsWith('_CREATE')

const topIconMap: Record<string, React.ReactNode> = {
  MENU_DASHBOARD: <DashboardOutlined />,
  MENU_MEMO: <FileTextOutlined />,
  MENU_PR: <FileTextOutlined />,
  MENU_PO: <ShoppingCartOutlined />,
  MENU_MASTER: <AppstoreOutlined />,
  MENU_ADMIN: <SafetyOutlined />,
  MENU_STOCK: <AppstoreOutlined />,
  MENU_SYSTEM: <SettingOutlined />,
}

const subIconMap: Record<string, React.ReactNode> = {
  MENU_MEMO_LIST: <SearchOutlined />,
  MENU_MEMO_CREATE: <PlusOutlined />,
  MENU_MEMO_APPROVAL: <CheckCircleOutlined />,
  MENU_PR_CREATE: <PlusOutlined />,
  MENU_PR_STATUS: <SearchOutlined />,
  MENU_PR_HISTORY: <HistoryOutlined />,
  MENU_PO_CREATE: <PlusOutlined />,
  MENU_PO_STATUS: <SearchOutlined />,
  MENU_PO_HISTORY: <HistoryOutlined />,
  MENU_PO_APPROVAL: <CheckCircleOutlined />,
  MENU_PO_LINE_ITEMS: <SearchOutlined />,
  MENU_PO_MY: <UserOutlined />,
  MENU_SYSTEM_CONFIG: <SettingOutlined />,
  MENU_SYSTEM_USERS: <TeamOutlined />,
  MENU_SYSTEM_ROLES: <ApartmentOutlined />,
  MENU_SYSTEM_MENUS: <AppstoreOutlined />,
  MENU_SYSTEM_PERMISSIONS: <SafetyOutlined />,
  MENU_ADMIN_APPROVAL_MATRIX: <CheckCircleOutlined />,
  MENU_ADMIN_PERMISSION_MATRIX: <SafetyOutlined />,
  MENU_STOCK_ITEMS: <AppstoreOutlined />,
  MENU_STOCK_INVENTORY: <DatabaseOutlined />,
  MENU_STOCK_TRANSACTIONS: <SwapOutlined />,
  MENU_STOCK_BORROW: <ExportOutlined />,
  MENU_STOCK_BORROW_APPROVAL: <CheckOutlined />,
  MENU_STOCK_RESERVATIONS: <CalendarOutlined />,
  MENU_STOCK_QRCODE: <QrcodeOutlined />,
  MENU_STOCK_RECEIVING: <InboxOutlined />,
  MENU_STOCK_RECEIVING_HISTORY: <HistoryOutlined />,
  // New two-step (draft/confirm) receiving flow, separate menu rows from the
  // legacy MENU_STOCK_RECEIVING pages above — DB menu rows for these
  // (menu_code, menu_path=/stock/receivable and /stock/grn) still need to be
  // created by an admin; this only maps the icon once that row exists.
  MENU_STOCK_RECEIVABLE: <InboxOutlined />,
  MENU_STOCK_GRN: <HistoryOutlined />,
  MENU_STOCK_REQUISITION: <ExportOutlined />,
  MENU_STOCK_REQUISITION_APPROVAL: <CheckOutlined />,
  // Warehouse Stock Transfer module (ใบเบิกของ / ย้ายคลัง / ประวัติการเคลื่อนไหว). Menu rows
  // are live in the DB; menu_path values (confirmed, must match the registered routes in
  // App.tsx exactly since navigation below uses menu.menu_path, not a hardcoded string):
  // MENU_WH_REQUISITION=/stock/wh-requisition, MENU_STOCK_WH_TRANSFER=/stock/wh-transfer,
  // MENU_WH_REQUISITION_HISTORY=/stock/wh-requisition-history,
  // MENU_STOCK_PROJECT_BALANCE=/stock/project-balance.
  MENU_WH_REQUISITION: <ExportOutlined />,
  MENU_STOCK_WH_TRANSFER: <RetweetOutlined />,
  MENU_WH_REQUISITION_HISTORY: <HistoryOutlined />,
  MENU_STOCK_PROJECT_BALANCE: <FundOutlined />,
}

interface VisibleMenuNode extends PermMenu {
  children: PermMenu[]
}

interface SidebarMenuProps {
  collapsed: boolean
}

const SidebarMenu: React.FC<SidebarMenuProps> = ({ collapsed }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { can, hasRole, loading, menus } = usePermissionContext()

  const visibleMenuTree = useMemo<VisibleMenuNode[]>(() => {
    const topLevel = menus.filter((m) => m.parent_id === null && m.is_active)

    // ── DEBUG (remove after diagnosis) ─────────────────────────────
    console.log('[sidebar-debug] total menus received:', menus.length)
    console.log('[sidebar-debug] topLevel count:', topLevel.length, topLevel.map((m) => m.menu_code))
    // ────────────────────────────────────────────────────────────────

    const result = topLevel
      .map((top) => {
        const isAdminOnly = ADMIN_CENTER_ONLY_MENU_CODES.includes(top.menu_code)
        if (isAdminOnly && !hasRole('ADMIN_CENTER')) return null

        const children = menus.filter((m) => m.parent_id === top.id && m.is_active)
        if (children.length > 0) {
          const visibleChildren = children
            .filter((c) => (isCreateMenu(c.menu_code) ? can(c.menu_code, 'write') : can(c.menu_code, 'read')))
            .sort((a, b) => a.order - b.order)

          // ── DEBUG (remove after diagnosis) ─────────────────────────
          console.log(
            `[sidebar-debug] top=${top.menu_code} children total=${children.length} visible=${visibleChildren.length}`,
            children.map((c) => ({
              code: c.menu_code,
              isCreate: isCreateMenu(c.menu_code),
              checkedAction: isCreateMenu(c.menu_code) ? 'write' : 'read',
              result: isCreateMenu(c.menu_code) ? can(c.menu_code, 'write') : can(c.menu_code, 'read'),
            })),
          )
          
          // ────────────────────────────────────────────────────────────

          if (visibleChildren.length === 0) return null
          return { ...top, children: visibleChildren }
        }
        const standaloneVisible = isCreateMenu(top.menu_code)
          ? can(top.menu_code, 'write')
          : can(top.menu_code, 'read')

        // ── DEBUG (remove after diagnosis) ───────────────────────────
        console.log(`[sidebar-debug] standalone top=${top.menu_code} visible=${standaloneVisible}`)
        // ──────────────────────────────────────────────────────────────

        return standaloneVisible ? { ...top, children: [] } : null
      })
      .filter((m): m is VisibleMenuNode => m !== null)
      .sort((a, b) => a.order - b.order)
      // Frontend-only override: Memo must appear before PR regardless of the
      // DB-configured `order` value (DB order not changed as part of this task).
      .sort((a, b) => {
        if (a.menu_code === 'MENU_MEMO' && b.menu_code === 'MENU_PR') return -1
        if (a.menu_code === 'MENU_PR' && b.menu_code === 'MENU_MEMO') return 1
        return 0
      })

    // ── DEBUG (remove after diagnosis) ─────────────────────────────
    console.log('[sidebar-debug] final visibleMenuTree:', result.length, result.map((m) => m.menu_code))
    // ────────────────────────────────────────────────────────────────

    return result
  }, [menus, can, hasRole])

  const buildMenuItems = (): MenuProps['items'] => {
    return visibleMenuTree.map((top) => {
      if (top.children.length > 0) {
        return {
          key: String(top.id),
          icon: topIconMap[top.menu_code] || <AppstoreOutlined />,
          label: top.menu_name,
          children: top.children.map((child) => ({
            key: child.menu_path || child.menu_code,
            icon: subIconMap[child.menu_code] || null,
            label: child.menu_name,
            onClick: () => child.menu_path && navigate(child.menu_path),
          })),
        }
      }
      return {
        key: top.menu_path || top.menu_code,
        icon: topIconMap[top.menu_code] || <AppstoreOutlined />,
        label: top.menu_name,
        onClick: () => top.menu_path && navigate(top.menu_path),
      }
    })
  }

  const getSelectedKeys = () => {
    const path = location.pathname
    return [path]
  }

  const getOpenKeys = () => {
    const path = location.pathname
    const match = visibleMenuTree.find((top) =>
      top.children.some((c) => c.menu_path && path.startsWith(c.menu_path)),
    )
    return match ? [String(match.id)] : []
  }

  if (loading) {
    return (
      <div style={{ padding: '16px 12px' }}>
        <Skeleton active title={false} paragraph={{ rows: 6 }} />
      </div>
    )
  }

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={getSelectedKeys()}
      defaultOpenKeys={getOpenKeys()}
      items={buildMenuItems()}
      style={{ background: 'transparent', border: 'none', marginTop: 8, padding: '0 8px' }}
    />
  )
}

export default SidebarMenu