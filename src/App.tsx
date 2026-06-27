import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { App as AntApp, ConfigProvider, Spin } from 'antd'
import thTH from 'antd/locale/th_TH'
import { Provider } from 'react-redux'
import { store } from '@/store'
import { antdTheme } from '@/config/antd.theme'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import LoginPage from '@/components/auth/LoginPage'
import './index.css'

// Lazy load pages
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const MemoListPage = lazy(() => import('@/pages/memo/MemoListPage'))
const MemoApprovalPage = lazy(() => import('@/pages/memo/MemoApprovalPage'))
const MemoDetailPage = lazy(() => import('@/pages/memo/MemoDetailPage'))
const MemoCreateEditPage = lazy(() => import('@/pages/memo/MemoCreateEditPage'))
const PRCreatePage = lazy(() => import('@/pages/pr/PRCreatePage'))
const PRStatusPage = lazy(() => import('@/pages/pr/PRStatusPage'))
const PRHistoryPage = lazy(() => import('@/pages/pr/PRHistoryPage'))
const PRApprovalListPage = lazy(() => import('@/pages/pr/PRApprovalListPage'))
const PRApprovalDetailPage = lazy(() => import('@/pages/pr/PRApprovalDetailPage'))
const POCreatePage = lazy(() => import('@/pages/po/POCreatePage'))
const POStatusPage = lazy(() => import('@/pages/po/POStatusPage'))
const POHistoryPage = lazy(() => import('@/pages/po/POHistoryPage'))
const POApprovalListPage = lazy(() => import('@/pages/po/POApprovalListPage'))
const POApprovalDetailPage = lazy(() => import('@/pages/po/POApprovalDetailPage'))
const SystemConfigPage = lazy(() => import('@/pages/system/SystemConfigPage'))
const UsersPage = lazy(() => import('@/pages/system/UsersPage'))
const RolesPage = lazy(() => import('@/pages/system/RolesPage'))
const MenusPage = lazy(() => import('@/pages/system/MenusPage'))
const PermissionsPage = lazy(() => import('@/pages/system/PermissionsPage'))
const GroupPage = lazy(() => import('@/pages/master/GroupPage'))
const MaterialPage = lazy(() => import('@/pages/master/MaterialPage'))
const LocationPage = lazy(() => import('@/pages/master/LocationPage'))
const SupplierPage = lazy(() => import('@/pages/master/SupplierPage'))
const ApprovalMatrix = lazy(() => import('@/pages/admin/ApprovalMatrix'))
const PermissionMatrix = lazy(() => import('@/pages/admin/PermissionMatrix'))

const LoadingFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
    <Spin size="large" />
  </div>
)

const AppRoutes: React.FC = () => (
  <Suspense fallback={<LoadingFallback />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
<Route path="/*" element={
        <ProtectedRoute>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/memo" element={<MemoListPage />} />
              <Route path="/memo/approval" element={<MemoApprovalPage />} />
              <Route path="/memo/:id/approval-detail" element={<MemoDetailPage showApproveActions={true} />} />
              <Route path="/memo/create" element={<MemoCreateEditPage key="memo-create" />} />
              <Route path="/memo/:id" element={<MemoDetailPage />} />
              <Route path="/memo/:id/edit" element={<MemoCreateEditPage key="memo-edit" />} />
              <Route path="/pr/create" element={<PRCreatePage />} />
              <Route path="/pr/status" element={<PRStatusPage />} />
              <Route path="/pr/history" element={<PRHistoryPage />} />
              <Route path="/pr/approval" element={<PRApprovalListPage />} />
              <Route path="/pr/approval/:id" element={<PRApprovalDetailPage />} />
              <Route path="/po/create" element={<POCreatePage />} />
              <Route path="/po/status" element={<POStatusPage />} />
              <Route path="/po/history" element={<POHistoryPage />} />
              <Route path="/po/approval" element={<POApprovalListPage />} />
              <Route path="/po/approval/:id" element={<POApprovalDetailPage />} />
              <Route path="/master/groups" element={<GroupPage />} />
              <Route path="/master/materials" element={<MaterialPage />} />
              <Route path="/master/location" element={<LocationPage />} />
              <Route path="/master/supplier" element={<SupplierPage />} />
              <Route path="/admin/approval-matrix" element={<ApprovalMatrix />} />
              <Route path="/admin/permission-matrix" element={<PermissionMatrix />} />
              <Route path="/system/config" element={<SystemConfigPage />} />
              <Route path="/system/users" element={<UsersPage />} />
              <Route path="/system/roles" element={<RolesPage />} />
              <Route path="/system/menus" element={<MenusPage />} />
              <Route path="/system/permissions" element={<PermissionsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </ProtectedRoute>
      } />
    </Routes>
  </Suspense>
)

const App: React.FC = () => (
  <Provider store={store}>
    <ConfigProvider theme={antdTheme} locale={thTH}>
      <AntApp>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </Provider>
)

export default App
