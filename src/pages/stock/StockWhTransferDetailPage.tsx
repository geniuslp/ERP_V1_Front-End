import React from 'react'
import StockTransferDetailView from '@/components/stock/StockTransferDetailView'

const StockWhTransferDetailPage: React.FC = () => (
  <StockTransferDetailView
    transferType="WH_TO_WH"
    menuCode="MENU_STOCK_WH_TRANSFER"
    breadcrumbLabel="ย้ายคลัง"
    listPath="/stock/wh-transfer"
    fromLabel="คลังต้นทาง"
    toLabel="คลังปลายทาง"
  />
)

export default StockWhTransferDetailPage
