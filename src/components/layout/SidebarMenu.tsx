import React from 'react'
import { Menu } from 'antd'
import {
  DashboardOutlined, FileTextOutlined, ShoppingCartOutlined,
  SettingOutlined, PlusOutlined, SearchOutlined, HistoryOutlined,
  TeamOutlined, ApartmentOutlined, AppstoreOutlined, SafetyOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '@/store'
import type { MenuProps } from 'antd'

const iconMap: Record<string, React.ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  ShoppingCartOutlined: <ShoppingCartOutlined />,
  SettingOutlined: <SettingOutlined />,
  PlusOutlined: <PlusOutlined />,
  SearchOutlined: <SearchOutlined />,
  HistoryOutlined: <HistoryOutlined />,
  TeamOutlined: <TeamOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  SafetyOutlined: <SafetyOutlined />,
}

const subIconMap: Record<string, React.ReactNode> = {
  'memo-list': <SearchOutlined />,
  'memo-create': <PlusOutlined />,
  'memo-approval': <CheckCircleOutlined />,
  'pr-create': <PlusOutlined />,
  'pr-status': <SearchOutlined />,
  'pr-history': <HistoryOutlined />,
  'pr-approval': <CheckCircleOutlined />,
  'po-create': <PlusOutlined />,
  'po-status': <SearchOutlined />,
  'po-history': <HistoryOutlined />,
  'po-approval': <CheckCircleOutlined />,
  'system-config': <SettingOutlined />,
  'system-users': <TeamOutlined />,
  'system-roles': <ApartmentOutlined />,
  'system-menus': <AppstoreOutlined />,
  'system-permissions': <SafetyOutlined />,
  'admin-permission-matrix': <SafetyOutlined />,
}

interface SidebarMenuProps {
  collapsed: boolean
}

const SidebarMenu: React.FC<SidebarMenuProps> = ({ collapsed }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { menus } = useAppSelector((state) => state.menu)

  const buildMenuItems = (): MenuProps['items'] => {
    return menus
      .filter((m) => m.isActive && !m.parentId)
      .sort((a, b) => a.order - b.order)
      .map((menu) => {
        if (menu.children?.length) {
          return {
            key: menu.id,
            icon: iconMap[menu.icon || ''] || <AppstoreOutlined />,
            label: menu.label,
            children: menu.children
              .filter((c) => c.isActive)
              .sort((a, b) => a.order - b.order)
              .map((child) => ({
                key: child.path || child.id,
                icon: subIconMap[child.id] || null,
                label: child.label,
                onClick: () => child.path && navigate(child.path),
              })),
          }
        }
        return {
          key: menu.path || menu.id,
          icon: iconMap[menu.icon || ''] || <AppstoreOutlined />,
          label: menu.label,
          onClick: () => menu.path && navigate(menu.path),
        }
      })
  }

  const getSelectedKeys = () => {
    const path = location.pathname
    return [path]
  }

  const getOpenKeys = () => {
    const path = location.pathname
    if (path.startsWith('/memo')) return ['memo']
    if (path.startsWith('/pr')) return ['pr']
    if (path.startsWith('/po')) return ['po']
    if (path.startsWith('/master')) return ['master']
    if (path.startsWith('/admin')) return ['admin']
    if (path.startsWith('/system')) return ['system']
    return []
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
