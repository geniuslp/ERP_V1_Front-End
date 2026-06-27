import React from 'react'
import { Card, Typography } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  trend?: { value: number; label: string }
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, trend }) => (
  <Card
    style={{
      borderRadius: 12,
      border: 'none',
      boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
      overflow: 'hidden',
    }}
    bodyStyle={{ padding: 20 }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <Typography.Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </Typography.Text>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#1e3a8a', marginTop: 4, fontFamily: 'Sarabun' }}>
          {value}
        </div>
        {trend && (
          <div style={{ marginTop: 6, fontSize: 12, color: trend.value > 0 ? '#22c55e' : '#dc2626' }}>
            {trend.value > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {' '}{Math.abs(trend.value)}% {trend.label}
          </div>
        )}
      </div>
      <div style={{
        width: 52, height: 52, borderRadius: 12,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, color,
      }}>
        {icon}
      </div>
    </div>
    <div style={{
      height: 3, borderRadius: 2, marginTop: 16,
      background: `linear-gradient(90deg, ${color}, ${color}44)`,
    }} />
  </Card>
)

export default StatCard
