import React, { useEffect, useMemo, useState } from 'react'
import { Menu, Skeleton, Tooltip } from 'antd'
import {
  DashboardOutlined, FileTextOutlined, ShoppingCartOutlined,
  SettingOutlined, PlusOutlined, SearchOutlined, HistoryOutlined,
  TeamOutlined, ApartmentOutlined, AppstoreOutlined, SafetyOutlined,
  CheckCircleOutlined, DatabaseOutlined, SwapOutlined, ExportOutlined,
  CalendarOutlined, QrcodeOutlined, CheckOutlined, UserOutlined,
  InboxOutlined, RetweetOutlined, FundOutlined, FileProtectOutlined,
  DollarOutlined, CalculatorOutlined, RollbackOutlined, ContainerOutlined,
} from '@ant-design/icons'
import { Link, useLocation } from 'react-router-dom'
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
  // icon_name on MENU_WO in the DB is FileProtectOutlined per the WO module spec.
  MENU_WO: <FileProtectOutlined />,
  MENU_MASTER: <AppstoreOutlined />,
  MENU_ADMIN: <SafetyOutlined />,
  MENU_STOCK: <AppstoreOutlined />,
  MENU_SYSTEM: <SettingOutlined />,
  MENU_FINANCE: <DollarOutlined />,
  MENU_PROJECT_OVERVIEW: <FundOutlined />,
  MENU_IC: <DatabaseOutlined />,
}

// Sub-menu codes whose child route requires a param (:projectId) with no
// standalone target — clicking them directly from the sidebar has nowhere
// meaningful to go. Rendered as disabled labels with a tooltip instead of a
// real Link; the actual navigation only happens from ICProjectListPage's
// row actions once a project is picked. See CLAUDE.md task note.
const PARAM_REQUIRED_MENU_CODES = ['MENU_IC_PO_RECEIVE', 'MENU_IC_PO_RETURN']

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
  MENU_PR_APPROVAL: <CheckCircleOutlined />,
  MENU_PO_LINE_ITEMS: <SearchOutlined />,
  MENU_PO_MY: <UserOutlined />,
  MENU_PO_COST_BUDGET: <CalculatorOutlined />,
  MENU_WO_LIST: <SearchOutlined />,
  MENU_WO_CREATE: <PlusOutlined />,
  MENU_WO_APPROVAL: <CheckCircleOutlined />,
  MENU_SYSTEM_CONFIG: <SettingOutlined />,
  MENU_SYSTEM_USERS: <TeamOutlined />,
  MENU_SYSTEM_ROLES: <ApartmentOutlined />,
  MENU_SYSTEM_MENUS: <AppstoreOutlined />,
  MENU_SYSTEM_PERMISSIONS: <SafetyOutlined />,
  MENU_ADMIN_DEPARTMENTS: <ApartmentOutlined />,
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
  MENU_MASTER_WAREHOUSE_STOCK: <InboxOutlined />,
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
  MENU_WH_REQUISITION_APPROVAL: <CheckOutlined />,
  MENU_STOCK_WH_TRANSFER: <RetweetOutlined />,
  MENU_WH_REQUISITION_HISTORY: <HistoryOutlined />,
  MENU_STOCK_PROJECT_BALANCE: <FundOutlined />,
  // MENU_FINANCE_PAYMENTS intentionally unmapped — falls back to `null` below
  // (no sub-icon), per explicit instruction.
  MENU_PETTY_CASH_LIST: <SearchOutlined />,
  MENU_PETTY_CASH_CREATE: <PlusOutlined />,
  MENU_PETTY_CASH_APPROVAL: <CheckCircleOutlined />,
  // MENU_MASTER_CUSTOMER (ลูกค้า) intentionally unmapped — renders without an icon,
  // like its Master siblings (กลุ่ม, วัสดุ, สถานที่, ผู้ขาย, โครงการ, Group Cost Code).
  MENU_IC_PROJECT: <SearchOutlined />,
  MENU_IC_PO_RECEIVE: <InboxOutlined />,
  MENU_IC_PO_RETURN: <RollbackOutlined />,
  // คลัง (Stock) — child of MENU_IC in the DB (menu_path /master/stock). Its menu_code is not
  // MENU_-prefixed; the permission key stays 'master-stock'.
  'master-stock': <ContainerOutlined />,
}

// Colour variants for children inside a top-level group, matched by menu_code PREFIX so future
// children (new petty cash / WO menus) pick the colour up automatically. Keys are the top-level
// group's menu_code; anything not listed stays 'default' (current look). 'blue' items get the
// .erp-menu-blue class (styles in index.css).
type MenuColorVariant = 'default' | 'blue'
const MENU_COLOR_GROUPS: Record<string, { prefix: string; variant: MenuColorVariant }[]> = {
  MENU_PR: [{ prefix: 'MENU_PETTY_CASH', variant: 'blue' }],
  MENU_PO: [{ prefix: 'MENU_WO', variant: 'blue' }],
}

const menuColorClass = (rootCode: string, menuCode: string): string | undefined => {
  const rule = MENU_COLOR_GROUPS[rootCode]?.find((r) => menuCode.startsWith(r.prefix))
  return rule?.variant === 'blue' ? 'erp-menu-blue' : undefined
}

interface VisibleMenuNode extends PermMenu {
  children: VisibleMenuNode[]
}

interface SidebarMenuProps {
  collapsed: boolean
}

// Frontend-only override: PR/PO "ตรวจสอบสถานะ" pages were consolidated into the history
// pages — hide these two menu entries regardless of the backend is_active/permission flags.
const HIDDEN_MENU_CODES = ['MENU_PR_STATUS', 'MENU_PO_STATUS']

// First Latin letter or Thai consonant of a menu name (skips leading Thai vowels/marks like เ แ โ);
// falls back to the first character.
const menuInitial = (name: string): string => {
  const m = name.match(/[A-Za-zก-ฮ]/)
  return (m ? m[0] : name.trim().charAt(0)).toUpperCase()
}

const SidebarMenu: React.FC<SidebarMenuProps> = ({ collapsed }) => {
  const location = useLocation()
  const { can, hasRole, loading, menus } = usePermissionContext()

  // Recursive tree of any depth. A leaf is shown when the user can read it (write for *_CREATE);
  // a group is shown only when at least one descendant is visible.
  const visibleMenuTree = useMemo<VisibleMenuNode[]>(() => {
    const byParent = new Map<number | null, PermMenu[]>()
    for (const m of menus) {
      if (!m.is_active || HIDDEN_MENU_CODES.includes(m.menu_code)) continue
      const list = byParent.get(m.parent_id) ?? []
      list.push(m)
      byParent.set(m.parent_id, list)
    }

    const build = (parentId: number | null, depth: number, seen: Set<number>): VisibleMenuNode[] => {
      const out: VisibleMenuNode[] = []
      for (const m of (byParent.get(parentId) ?? []).slice().sort((a, b) => a.order - b.order)) {
        if (seen.has(m.id)) continue // guard against a parent_id cycle
        if (depth === 0 && ADMIN_CENTER_ONLY_MENU_CODES.includes(m.menu_code) && !hasRole('ADMIN_CENTER')) continue
        const kids = build(m.id, depth + 1, new Set(seen).add(m.id))
        if (byParent.has(m.id)) {
          if (kids.length > 0) out.push({ ...m, children: kids })
        } else if (isCreateMenu(m.menu_code) ? can(m.menu_code, 'write') : can(m.menu_code, 'read')) {
          out.push({ ...m, children: [] })
        }
      }
      return out
    }

    return build(null, 0, new Set())
      // Frontend-only override: Memo must appear before PR regardless of the
      // DB-configured `order` value (DB order not changed as part of this task).
      .sort((a, b) => {
        if (a.menu_code === 'MENU_MEMO' && b.menu_code === 'MENU_PR') return -1
        if (a.menu_code === 'MENU_PR' && b.menu_code === 'MENU_MEMO') return 1
        return 0
      })
  }, [menus, can, hasRole])

  // Menu items render their label as a real react-router <Link> (an actual
  // <a href>) so Ctrl/Cmd/middle-click and "Open in new tab" keep working.
  // Items without a menu_path (grouping-only) fall back to a plain label.
  // Top-level items show no icon when expanded; the collapsed (icon-only) sidebar shows the menu
  // name's first letter in the same slot instead. topIconMap is kept for future use / sub-items.
  const topLevelIcon = (name: string): React.ReactNode =>
    collapsed ? (
      <span style={{ display: 'inline-block', minWidth: '1em', textAlign: 'center', fontWeight: 600, fontSize: 16, lineHeight: 1 }}>
        {menuInitial(name)}
      </span>
    ) : undefined

  const buildItems = (nodes: VisibleMenuNode[], depth: number, rootCode = ''): MenuProps['items'] =>
    nodes.map((node) => {
      // Top-level group the node lives under (a top-level node is its own root; the group itself keeps its style).
      const root = depth === 0 ? node.menu_code : rootCode
      const className = depth === 0 ? undefined : menuColorClass(root, node.menu_code)
      if (node.children.length > 0) {
        return {
          key: String(node.id),
          icon: depth === 0 ? topLevelIcon(node.menu_name) : (subIconMap[node.menu_code] || topIconMap[node.menu_code] || null),
          label: node.menu_name,
          title: node.menu_name,
          className,
          children: buildItems(node.children, depth + 1, root),
        }
      }
      if (PARAM_REQUIRED_MENU_CODES.includes(node.menu_code)) {
        return {
          key: node.menu_code,
          icon: subIconMap[node.menu_code] || null,
          disabled: true,
          className,
          label: (
            <Tooltip title="กรุณาเลือกโครงการก่อน" placement="right">
              <span>{node.menu_name}</span>
            </Tooltip>
          ),
        }
      }
      return {
        key: node.menu_path || node.menu_code,
        icon: depth === 0 ? topLevelIcon(node.menu_name) : (subIconMap[node.menu_code] || null),
        label: node.menu_path ? <Link to={node.menu_path}>{node.menu_name}</Link> : node.menu_name,
        title: node.menu_name,
        className,
      }
    })

  // Active leaf = the visible leaf whose path matches the URL (exact, else longest prefix), plus
  // the ids of all its ancestor groups so they can be opened automatically.
  const { selectedKeys, activeAncestors } = useMemo(() => {
    const path = location.pathname
    let best: { key: string; ancestors: string[]; len: number } | null = null
    const visit = (nodes: VisibleMenuNode[], ancestors: string[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) {
          visit(n.children, [...ancestors, String(n.id)])
        } else if (n.menu_path && (path === n.menu_path || path.startsWith(n.menu_path + '/'))) {
          if (!best || n.menu_path.length > best.len) {
            best = { key: n.menu_path, ancestors, len: n.menu_path.length }
          }
        }
      }
    }
    visit(visibleMenuTree, [])
    const b = best as { key: string; ancestors: string[] } | null
    return { selectedKeys: b ? [b.key] : [path], activeAncestors: b ? b.ancestors : [] }
  }, [visibleMenuTree, location.pathname])

  // Controlled open state: the active leaf's ancestor groups are opened on navigation / first
  // load, while groups the user toggled by hand stay as they are.
  const [openKeys, setOpenKeys] = useState<string[]>([])
  useEffect(() => {
    if (activeAncestors.length === 0) return
    setOpenKeys((prev) => Array.from(new Set([...prev, ...activeAncestors])))
  }, [activeAncestors])

  if (loading) {
    return (
      <div style={{ padding: '16px 12px' }}>
        <Skeleton active title={false} paragraph={{ rows: 6 }} />
      </div>
    )
  }

  return (
    <Menu
      className="erp-sidebar-menu"
      theme="dark"
      mode="inline"
      selectedKeys={selectedKeys}
      openKeys={collapsed ? undefined : openKeys}
      onOpenChange={setOpenKeys}
      items={buildItems(visibleMenuTree, 0)}
      style={{ background: 'transparent', border: 'none', marginTop: 8, padding: '0 8px' }}
    />
  )
}

export default SidebarMenu
