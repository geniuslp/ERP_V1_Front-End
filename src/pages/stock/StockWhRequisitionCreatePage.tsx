import React from 'react'
import StockTransferForm from '@/components/stock/StockTransferForm'

const StockWhRequisitionCreatePage: React.FC = () => (
  <StockTransferForm
    transferType="WH_TO_PROJECT"
    menuCode="MENU_WH_REQUISITION"
    title="สร้างใบเบิกของ"
    breadcrumbLabel="ใบเบิกของ"
    listPath="/stock/wh-requisition"
    detailPathPrefix="/stock/wh-requisition"
  />
)

export default StockWhRequisitionCreatePage
