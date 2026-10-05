import React from 'react'
import { Tabs } from 'antd'
import type { TabsProps } from 'antd'
import './PanelTabs.css'

/** antd Tabs with the shared prominent card style. Same props as antd Tabs. */
const PanelTabs: React.FC<TabsProps> = ({ className, ...rest }) => (
  <Tabs type="card" {...rest} className={['panel-tabs', className].filter(Boolean).join(' ')} />
)

export default PanelTabs
