import React from 'react'
import StockTransferDetailView from '@/components/stock/StockTransferDetailView'

const StockWhRequisitionDetailPage: React.FC = () => (
  <StockTransferDetailView
    transferType="WH_TO_PROJECT"
    menuCode="MENU_WH_REQUISITION"
    breadcrumbLabel="ใบเบิกของ"
    listPath="/stock/wh-requisition"
    fromLabel="คลัง"
    toLabel="โครงการ"
  />
)

export default StockWhRequisitionDetailPage
