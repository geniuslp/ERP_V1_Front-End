import React from 'react'
import StockTransferListView from '@/components/stock/StockTransferListView'

const StockWhRequisitionListPage: React.FC = () => (
  <StockTransferListView
    transferType="WH_TO_PROJECT"
    menuCode="MENU_WH_REQUISITION"
    title="ใบเบิกของ"
    subtitle="เบิกวัสดุจากคลังไปยังโครงการ"
    createLabel="สร้างใบเบิก"
    breadcrumbLabel="ใบเบิกของ"
    createPath="/stock/wh-requisition/create"
    detailPathPrefix="/stock/wh-requisition"
    fromLabel="คลัง"
    toLabel="โครงการ"
  />
)

export default StockWhRequisitionListPage
