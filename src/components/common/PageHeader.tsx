import React from 'react'
import { Breadcrumb, Typography } from 'antd'

interface BreadcrumbItem {
  title: string
  href?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: BreadcrumbItem[]
  extra?: React.ReactNode
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, breadcrumbs, extra }) => {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 20,
      boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderLeft: '4px solid #2563eb',
    }}>
      <div>
        {breadcrumbs && (
          <Breadcrumb
            items={breadcrumbs.map((b) => ({ title: b.title }))}
            style={{ marginBottom: 4, fontSize: 12 }}
          />
        )}
        <Typography.Title level={4} style={{ margin: 0, color: '#1e3a8a', fontFamily: 'Sarabun' }}>
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text style={{ color: '#60a5fa', fontSize: 13 }}>{subtitle}</Typography.Text>
        )}
      </div>
      {extra && <div>{extra}</div>}
    </div>
  )
}

export default PageHeader
