import React from 'react'
import { Tag } from 'antd'

interface Props {
  qty: number
  minQty: number
}

const StockStatusTag: React.FC<Props> = ({ qty, minQty }) => {
  if (qty === 0) return <Tag color="red">ZERO</Tag>
  if (qty <= minQty) return <Tag color="orange">LOW</Tag>
  return <Tag color="green">OK</Tag>
}

export default StockStatusTag
