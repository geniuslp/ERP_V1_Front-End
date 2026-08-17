import React from 'react'
import StockTransferListView from '@/components/stock/StockTransferListView'

const StockWhTransferListPage: React.FC = () => (
  <StockTransferListView
    transferType="WH_TO_WH"
    menuCode="MENU_STOCK_WH_TRANSFER"
    title="ย้ายคลัง"
    subtitle="ย้ายวัสดุระหว่างคลัง"
    createLabel="สร้างรายการย้าย"
    breadcrumbLabel="ย้ายคลัง"
    createPath="/stock/wh-transfer/create"
    detailPathPrefix="/stock/wh-transfer"
    fromLabel="คลังต้นทาง"
    toLabel="คลังปลายทาง"
  />
)

export default StockWhTransferListPage
