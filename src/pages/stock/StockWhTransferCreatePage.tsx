import React from 'react'
import StockTransferForm from '@/components/stock/StockTransferForm'

const StockWhTransferCreatePage: React.FC = () => (
  <StockTransferForm
    transferType="WH_TO_WH"
    menuCode="MENU_STOCK_WH_TRANSFER"
    title="สร้างรายการย้ายคลัง"
    breadcrumbLabel="ย้ายคลัง"
    listPath="/stock/wh-transfer"
    detailPathPrefix="/stock/wh-transfer"
  />
)

export default StockWhTransferCreatePage
