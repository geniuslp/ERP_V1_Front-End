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
import RequireRole from '@/components/permission/RequireRole'
import RequirePermission from '@/components/permission/RequirePermission'
import { PermissionProvider } from '@/contexts/PermissionContext'
import './index.css'

// Lazy load pages
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const MemoListPage = lazy(() => import('@/pages/memo/MemoListPage'))
const MemoApprovalPage = lazy(() => import('@/pages/memo/MemoApprovalPage'))
const MemoDetailPage = lazy(() => import('@/pages/memo/MemoDetailPage'))
const MemoCreateEditPage = lazy(() => import('@/pages/memo/MemoCreateEditPage'))
const PRCreatePage = lazy(() => import('@/pages/pr/PRCreatePage'))
const PRStatusPage = lazy(() => import('@/pages/pr/PRStatusPage'))
const PRDetailPage = lazy(() => import('@/pages/pr/PRDetailPage'))
const PRHistoryPage = lazy(() => import('@/pages/pr/PRHistoryPage'))
const POCreatePage = lazy(() => import('@/pages/po/POCreatePage'))
const POStatusPage = lazy(() => import('@/pages/po/POStatusPage'))
const POHistoryPage = lazy(() => import('@/pages/po/POHistoryPage'))
const POLineItemsPage = lazy(() => import('@/pages/po/POLineItemsPage'))
const POMyListPage = lazy(() => import('@/pages/po/POMyListPage'))
const POApprovalListPage = lazy(() => import('@/pages/po/POApprovalListPage'))
const POApprovalDetailPage = lazy(() => import('@/pages/po/POApprovalDetailPage'))
const SystemConfigPage = lazy(() => import('@/pages/system/SystemConfigPage'))
const UsersPage = lazy(() => import('@/pages/system/UsersPage'))
const RolesPage = lazy(() => import('@/pages/system/RolesPage'))
const MenusPage = lazy(() => import('@/pages/system/MenusPage'))
const PermissionsPage = lazy(() => import('@/pages/system/PermissionsPage'))
const GroupPage = lazy(() => import('@/pages/master/GroupPage'))
const MaterialPage = lazy(() => import('@/pages/master/MaterialPage'))
const CostCodePage = lazy(() => import('@/pages/master/CostCodePage'))
const LocationPage = lazy(() => import('@/pages/master/LocationPage'))
const SupplierPage = lazy(() => import('@/pages/master/SupplierPage'))
const StockListPage = lazy(() => import('@/pages/master/StockListPage'))
const ProjectListPage = lazy(() => import('@/pages/master/ProjectListPage'))
const ProjectCreateEditPage = lazy(() => import('@/pages/master/ProjectCreateEditPage'))
const ApprovalMatrix = lazy(() => import('@/pages/admin/ApprovalMatrix'))
const PermissionMatrix = lazy(() => import('@/pages/admin/PermissionMatrix'))
const StockItemListPage = lazy(() => import('@/pages/stock/StockItemListPage'))
const StockItemCreateEditPage = lazy(() => import('@/pages/stock/StockItemCreateEditPage'))
const StockInventoryPage = lazy(() => import('@/pages/stock/StockInventoryPage'))
const StockTransactionPage = lazy(() => import('@/pages/stock/StockTransactionPage'))
const BorrowListPage = lazy(() => import('@/pages/stock/BorrowListPage'))
const BorrowCreatePage = lazy(() => import('@/pages/stock/BorrowCreatePage'))
const BorrowDetailPage = lazy(() => import('@/pages/stock/BorrowDetailPage'))
const BorrowApprovalPage = lazy(() => import('@/pages/stock/BorrowApprovalPage'))
const ReservationPage = lazy(() => import('@/pages/stock/ReservationPage'))
const QRCodePage = lazy(() => import('@/pages/stock/QRCodePage'))
const GoodsReceiptSearchPage = lazy(() => import('@/pages/stock/GoodsReceiptSearchPage'))
const GoodsReceiptDetailPage = lazy(() => import('@/pages/stock/GoodsReceiptDetailPage'))
const GRNHistoryPage = lazy(() => import('@/pages/stock/GRNHistoryPage'))
const ReceivingListPage = lazy(() => import('@/pages/stock/ReceivingListPage'))
const GRNCreatePage = lazy(() => import('@/pages/stock/GRNCreatePage'))
const GRNv2ListPage = lazy(() => import('@/pages/stock/GRNv2ListPage'))
const GRNv2DetailPage = lazy(() => import('@/pages/stock/GRNv2DetailPage'))
const MaterialRequisitionListPage = lazy(() => import('@/pages/stock/MaterialRequisitionListPage'))
const MaterialRequisitionCreatePage = lazy(() => import('@/pages/stock/MaterialRequisitionCreatePage'))
const MaterialRequisitionEditPage = lazy(() => import('@/pages/stock/MaterialRequisitionEditPage'))
const MaterialRequisitionDetailPage = lazy(() => import('@/pages/stock/MaterialRequisitionDetailPage'))
const StockWhRequisitionListPage = lazy(() => import('@/pages/stock/StockWhRequisitionListPage'))
const StockWhRequisitionCreatePage = lazy(() => import('@/pages/stock/StockWhRequisitionCreatePage'))
const StockWhRequisitionDetailPage = lazy(() => import('@/pages/stock/StockWhRequisitionDetailPage'))
const StockWhTransferListPage = lazy(() => import('@/pages/stock/StockWhTransferListPage'))
const StockWhTransferCreatePage = lazy(() => import('@/pages/stock/StockWhTransferCreatePage'))
const StockWhTransferDetailPage = lazy(() => import('@/pages/stock/StockWhTransferDetailPage'))
const StockMovementHistoryPage = lazy(() => import('@/pages/stock/StockMovementHistoryPage'))
const ProjectStockBalancePage = lazy(() => import('@/pages/stock/ProjectStockBalancePage'))

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
          <PermissionProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/memo" element={
                <RequirePermission menuCode="MENU_MEMO_LIST" action="read"><MemoListPage /></RequirePermission>
              } />
              <Route path="/memo/approval" element={<MemoApprovalPage />} />
              <Route path="/memo/:id/approval-detail" element={<MemoDetailPage showApproveActions={true} />} />
              <Route path="/memo/create" element={
                <RequirePermission menuCode="MENU_MEMO_CREATE" action="write"><MemoCreateEditPage key="memo-create" /></RequirePermission>
              } />
              <Route path="/memo/:id" element={<MemoDetailPage />} />
              <Route path="/memo/:id/edit" element={<MemoCreateEditPage key="memo-edit" />} />
              <Route path="/pr/create" element={
                <RequirePermission menuCode="MENU_PR_CREATE" action="write"><PRCreatePage key="pr-create" /></RequirePermission>
              } />
              <Route path="/pr/:id/edit" element={
                <RequirePermission menuCode="MENU_PR_CREATE" action="write"><PRCreatePage key="pr-edit" /></RequirePermission>
              } />
              <Route path="/pr/status" element={
                <RequirePermission menuCode="MENU_PR_STATUS" action="read"><PRStatusPage /></RequirePermission>
              } />
              <Route path="/pr/:id" element={
                <RequirePermission menuCode="MENU_PR_STATUS" action="read"><PRDetailPage /></RequirePermission>
              } />
              <Route path="/pr/history" element={
                <RequirePermission menuCode="MENU_PR_HISTORY" action="read"><PRHistoryPage /></RequirePermission>
              } />
              <Route path="/po/create" element={
                <RequirePermission menuCode="MENU_PO_CREATE" action="write"><POCreatePage key="po-create" /></RequirePermission>
              } />
              <Route path="/po/:id/edit" element={
                <RequirePermission menuCode="MENU_PO_CREATE" action="edit"><POCreatePage key="po-edit" /></RequirePermission>
              } />
              <Route path="/po/status" element={
                <RequirePermission menuCode="MENU_PO_STATUS" action="read"><POStatusPage /></RequirePermission>
              } />
              <Route path="/po/history" element={
                <RequirePermission menuCode="MENU_PO_HISTORY" action="read"><POHistoryPage /></RequirePermission>
              } />
              <Route path="/po/my" element={
                <RequirePermission menuCode="MENU_PO_MY" action="read"><POMyListPage /></RequirePermission>
              } />
              <Route path="/po/line-items" element={
                <RequirePermission menuCode="MENU_PO_LINE_ITEMS" action="read"><POLineItemsPage /></RequirePermission>
              } />
              <Route path="/po/approval" element={<POApprovalListPage />} />
              <Route path="/po/approval/:id" element={<POApprovalDetailPage />} />
              <Route path="/master/groups" element={<GroupPage />} />
              <Route path="/master/materials" element={<MaterialPage />} />
              <Route path="/master/cost-code" element={<CostCodePage />} />
              <Route path="/master/location" element={<LocationPage />} />
              <Route path="/master/supplier" element={<SupplierPage />} />
              <Route path="/master/stock" element={<StockListPage />} />
              <Route path="/master/projects" element={<ProjectListPage />} />
              <Route path="/master/projects/create" element={<ProjectCreateEditPage key="create" />} />
              <Route path="/master/projects/:id/edit" element={<ProjectCreateEditPage key="edit" />} />
              <Route path="/admin/approval-matrix" element={
                <RequireRole roleCode="ADMIN_CENTER"><ApprovalMatrix /></RequireRole>
              } />
              <Route path="/admin/permission-matrix" element={
                <RequireRole roleCode="ADMIN_CENTER"><PermissionMatrix /></RequireRole>
              } />
              <Route path="/stock/items" element={<StockItemListPage />} />
              <Route path="/stock/items/create" element={<StockItemCreateEditPage key="create" />} />
              <Route path="/stock/items/:id/edit" element={<StockItemCreateEditPage key="edit" />} />
              <Route path="/stock/inventory" element={<StockInventoryPage />} />
              <Route path="/stock/transactions" element={<StockTransactionPage />} />
              <Route path="/stock/borrow/create" element={<BorrowCreatePage />} />
              <Route path="/stock/borrow/approval" element={<BorrowApprovalPage />} />
              <Route path="/stock/borrow/:id" element={<BorrowDetailPage />} />
              <Route path="/stock/borrow" element={<BorrowListPage />} />
              <Route path="/stock/reservations" element={<ReservationPage />} />
              <Route path="/stock/qrcode" element={<QRCodePage />} />
              <Route path="/stock/receiving/history" element={<GRNHistoryPage />} />
              <Route path="/stock/receiving/:poId" element={<GoodsReceiptDetailPage />} />
              <Route path="/stock/receiving" element={<GoodsReceiptSearchPage />} />
              {/* New two-step (draft/confirm) receiving flow — GET /po/receivable +
                  GET /po/:id/receivable-lines, mocked until backend deploys them.
                  Kept on separate paths from the legacy /stock/receiving flow above
                  since both call different backend endpoints. */}
              <Route path="/stock/receivable" element={<ReceivingListPage />} />
              <Route path="/stock/grn/create/:poId" element={<GRNCreatePage />} />
              <Route path="/stock/grn/:grnId" element={<GRNv2DetailPage />} />
              <Route path="/stock/grn" element={<GRNv2ListPage />} />
              <Route path="/stock/requisition/create" element={<MaterialRequisitionCreatePage />} />
              <Route path="/stock/requisition/:id/edit" element={<MaterialRequisitionEditPage />} />
              <Route path="/stock/requisition/:id" element={<MaterialRequisitionDetailPage />} />
              <Route path="/stock/requisition" element={<MaterialRequisitionListPage />} />

              {/* Warehouse Stock Transfer module — new `stock_transfer` table, distinct from the
                  Material Requisition module above (/stock/requisition/*, backed by /borrow).
                  Routed under /stock/wh-requisition and /stock/wh-transfer to avoid colliding
                  with that existing feature — see conversation decision. */}
              <Route path="/stock/wh-requisition/create" element={
                <RequirePermission menuCode="MENU_WH_REQUISITION" action="write"><StockWhRequisitionCreatePage /></RequirePermission>
              } />
              <Route path="/stock/wh-requisition/:id" element={
                <RequirePermission menuCode="MENU_WH_REQUISITION" action="read"><StockWhRequisitionDetailPage /></RequirePermission>
              } />
              <Route path="/stock/wh-requisition" element={
                <RequirePermission menuCode="MENU_WH_REQUISITION" action="read"><StockWhRequisitionListPage /></RequirePermission>
              } />
              <Route path="/stock/wh-transfer/create" element={
                <RequirePermission menuCode="MENU_STOCK_WH_TRANSFER" action="write"><StockWhTransferCreatePage /></RequirePermission>
              } />
              <Route path="/stock/wh-transfer/:id" element={
                <RequirePermission menuCode="MENU_STOCK_WH_TRANSFER" action="read"><StockWhTransferDetailPage /></RequirePermission>
              } />
              <Route path="/stock/wh-transfer" element={
                <RequirePermission menuCode="MENU_STOCK_WH_TRANSFER" action="read"><StockWhTransferListPage /></RequirePermission>
              } />
              {/* Path confirmed against menus.menu_path for menu_id=50 (MENU_WH_REQUISITION_HISTORY)
                  — the sidebar navigates via menu.menu_path from the API, not a hardcoded string,
                  so this route must match that DB value exactly or the link 404s into the "*"
                  catch-all and lands on the dashboard. */}
              <Route path="/stock/wh-requisition-history" element={
                <RequirePermission menuCode="MENU_WH_REQUISITION_HISTORY" action="read"><StockMovementHistoryPage /></RequirePermission>
              } />
              <Route path="/stock/project-balance" element={
                <RequirePermission menuCode="MENU_STOCK_PROJECT_BALANCE" action="read"><ProjectStockBalancePage /></RequirePermission>
              } />
              <Route path="/system/config" element={
                <RequireRole roleCode="ADMIN_CENTER"><SystemConfigPage /></RequireRole>
              } />
              <Route path="/system/users" element={
                <RequireRole roleCode="ADMIN_CENTER"><UsersPage /></RequireRole>
              } />
              <Route path="/system/roles" element={
                <RequireRole roleCode="ADMIN_CENTER"><RolesPage /></RequireRole>
              } />
              <Route path="/system/menus" element={
                <RequireRole roleCode="ADMIN_CENTER"><MenusPage /></RequireRole>
              } />
              <Route path="/system/permissions" element={
                <RequireRole roleCode="ADMIN_CENTER"><PermissionsPage /></RequireRole>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
          </PermissionProvider>
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
