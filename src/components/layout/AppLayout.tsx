import React, { useState } from 'react'
import { Layout, Avatar, Dropdown, Badge, Button, Typography } from 'antd'
import {
  BellOutlined, UserOutlined, LogoutOutlined, SettingOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store'
import { logout } from '@/store/slices/authSlice'
import SidebarMenu from './SidebarMenu'

const { Header, Sider, Content } = Layout
const { Text } = Typography

interface AppLayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'โปรไฟล์' },
    { key: 'settings', icon: <SettingOutlined />, label: 'ตั้งค่า' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: 'ออกจากระบบ', danger: true, onClick: handleLogout },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── Sidebar ── */}
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={260}
        collapsedWidth={72}
        theme="dark"
        style={{
          background: '#0f2d5e',
          boxShadow: '4px 0 20px rgba(15,45,94,0.3)',
          position: 'fixed',
          height: '100vh',
          zIndex: 100,
          overflow: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#fff', fontSize: 18, flexShrink: 0,
          }}>E</div>
          {!collapsed && (
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2, fontFamily: 'Sarabun' }}>ERP System</div>
              <div style={{ color: '#60a5fa', fontSize: 11 }}>Enterprise Resource</div>
            </div>
          )}
        </div>

        <SidebarMenu collapsed={collapsed} />

      </Sider>

      {/* ── Main ── */}
      <Layout style={{ marginLeft: collapsed ? 72 : 260, transition: 'margin 0.2s' }}>
        {/* Header */}
        <Header style={{
          position: 'sticky', top: 0, zIndex: 99,
          background: '#fff',
          padding: '0 24px',
          boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 64,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, color: '#1d4ed8', fontSize: 18,
                border: '0.5px solid #dbeafe', background: '#eff6ff',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                height: 6, width: 32, borderRadius: 3,
                background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
              }} />
              <Text style={{ color: '#1e3a8a', fontWeight: 600, fontSize: 15 }}>
                ระบบบริหารองค์กร
              </Text>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={3} size="small">
              <Button type="text" icon={<BellOutlined style={{ fontSize: 18, color: '#1d4ed8' }} />} />
            </Badge>

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '6px 12px', borderRadius: 8,
                transition: 'background 0.2s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar
                  size={34}
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontSize: 13, fontWeight: 600 }}
                >
                  {user?.fullName?.charAt(0) || 'U'}
                </Avatar>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1e3a8a' }}>{user?.fullName || 'Admin'}</div>
                  <div style={{ fontSize: 11, color: '#60a5fa' }}>{user?.roles?.[0] ?? 'ไม่มีตำแหน่ง'}</div>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* Content */}
        <Content style={{
          margin: 24,
          minHeight: 'calc(100vh - 112px)',
        }}>
          {children}
        </Content>

        {/* Footer */}
        <div style={{
          textAlign: 'center', padding: '12px 24px',
          color: '#93c5fd', fontSize: 12,
          borderTop: '1px solid #dbeafe',
          background: '#fff',
        }}>
          © 2024 ERP System — Enterprise Resource Planning
        </div>
      </Layout>
    </Layout>
  )
}

export default AppLayout
