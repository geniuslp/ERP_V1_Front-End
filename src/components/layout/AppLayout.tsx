import React, { useState } from 'react'
import { Layout, Avatar, Dropdown, Badge, Button, Grid } from 'antd'
import { BellOutlined, UserOutlined, LogoutOutlined, SettingOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store'
import { logout } from '@/store/slices/authSlice'
import TopNavMenu from './TopNavMenu'
import { resetTopNavWidths } from './topNavData'
import BrandLogo from '@/components/common/BrandLogo'
import ChangePasswordModal from './ChangePasswordModal'
import { APP_ENV } from '@/config/env'
import { useMyPendingApprovalCount } from '@/hooks/useMyPendingApprovalCount'

const { Content } = Layout
const { useBreakpoint } = Grid

interface AppLayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [pwModalOpen, setPwModalOpen] = useState(false)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAppSelector((state) => state.auth)
  const screens = useBreakpoint()
  // The top bar's desktop layout starts at 992px (antd `lg`); below that the menu becomes a drawer.
  const isNarrow = screens.lg === false
  const pendingCounts = useMyPendingApprovalCount(location.pathname)

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'โปรไฟล์' },
    { key: 'settings', icon: <SettingOutlined />, label: 'ตั้งค่า' },
    { key: 'change-password', icon: <LockOutlined />, label: 'เปลี่ยนรหัสผ่าน', onClick: () => setPwModalOpen(true) },
    // Menu item widths only exist on the desktop bar.
    ...(isNarrow ? [] : [{ key: 'reset-nav-widths', label: 'รีเซ็ตความกว้างเมนู', onClick: resetTopNavWidths }]),
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: 'ออกจากระบบ', danger: true, onClick: handleLogout },
  ]

  // Logo + title are one link to the home route ("/", the dashboard — same for every role).
  const brand = (
    <Link
      to="/"
      className="erp-brand-link"
      title="กลับหน้าหลัก"
      aria-label="กลับหน้าหลัก"
      style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
    >
      <BrandLogo variant="sidebar" />
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <div style={{
          color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2, fontFamily: 'Sarabun',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>ERP System</div>
      </div>
      {APP_ENV === 'uat' && (
        <span style={{
          flexShrink: 0, padding: '1px 8px', borderRadius: 6,
          background: 'rgba(217,119,6,0.18)', border: '1px solid rgba(251,191,36,0.5)',
          color: '#fbbf24', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, lineHeight: '18px',
        }}>UAT</span>
      )}
    </Link>
  )

  const right = (
    <>
      <Badge count={pendingCounts.total} size="small" overflowCount={99}>
        <Button
          type="text"
          className="tn-icon-btn"
          aria-label="การแจ้งเตือน"
          icon={<BellOutlined style={{ fontSize: 18 }} />}
        />
      </Badge>

      <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
        <div
          className="tn-icon-btn"
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, transition: 'background 0.2s' }}
        >
          <Avatar
            size={34}
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontSize: 13, fontWeight: 600 }}
          >
            {user?.fullName?.charAt(0) || 'U'}
          </Avatar>
          {!isNarrow && (
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#fff' }}>{user?.fullName || 'Admin'}</div>
              <div style={{ fontSize: 11, color: '#93c5fd' }}>{user?.roles?.[0] ?? 'ไม่มีตำแหน่ง'}</div>
            </div>
          )}
        </div>
      </Dropdown>
    </>
  )

  const drawerFooter = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar size={40} style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontWeight: 600 }}>
          {user?.fullName?.charAt(0) || 'U'}
        </Avatar>
        <div style={{ lineHeight: 1.3, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>{user?.fullName || 'Admin'}</div>
          <div style={{ fontSize: 12, color: '#93c5fd' }}>{user?.roles?.[0] ?? 'ไม่มีตำแหน่ง'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button style={{ flex: 1, minHeight: 44 }} icon={<LockOutlined />} onClick={() => setPwModalOpen(true)}>
          เปลี่ยนรหัสผ่าน
        </Button>
        <Button style={{ flex: 1, minHeight: 44 }} danger icon={<LogoutOutlined />} onClick={handleLogout}>
          ออกจากระบบ
        </Button>
      </div>
    </div>
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <TopNavMenu isNarrow={isNarrow} brand={brand} right={right} drawerFooter={drawerFooter} />

      {/* Content */}
      <Content style={{
        margin: isNarrow ? 12 : 24,
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
        © 2026 ERP System — Genius Engineering
      </div>
      <ChangePasswordModal open={pwModalOpen} onClose={() => setPwModalOpen(false)} />
    </Layout>
  )
}

export default AppLayout
