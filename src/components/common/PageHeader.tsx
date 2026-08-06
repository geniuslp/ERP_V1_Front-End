import React from 'react'
import { Breadcrumb, Typography, Grid } from 'antd'

const { useBreakpoint } = Grid

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
  const screens = useBreakpoint()
  const isMobile = screens.md === false

  return (
    <div
      className="page-header-extra"
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: isMobile ? '16px 16px' : '20px 24px',
        marginBottom: 20,
        boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: isMobile ? 12 : 0,
        borderLeft: '4px solid #2563eb',
      }}
    >
      <div style={{ minWidth: 0 }}>
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
      {extra && (
        <div
          style={
            isMobile
              ? { display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%' }
              : undefined
          }
        >
          {extra}
        </div>
      )}
    </div>
  )
}

export default PageHeader
