import React from 'react'
import { Space } from 'antd'

export interface RowTintLegendItem {
  color: string
  borderColor?: string
  label: string
}

interface Props {
  items: RowTintLegendItem[]
}

// Color legend shown above list/history tables (MemoListPage, PRHistoryPage).
// Swatch colors come from ROW_TINT_SWATCH in src/constants/rowTint.ts.
const RowTintLegend: React.FC<Props> = ({ items }) => (
  <Space size={16} style={{ marginBottom: 12 }}>
    {items.map((it) => (
      <Space size={6} key={it.label}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 2,
            background: it.color,
            border: `1px solid ${it.borderColor ?? it.color}`,
            display: 'inline-block',
          }}
        />
        <span style={{ fontSize: 13, color: '#595959' }}>{it.label}</span>
      </Space>
    ))}
  </Space>
)

export default RowTintLegend
