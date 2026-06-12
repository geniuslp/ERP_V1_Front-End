import type { ThemeConfig } from 'antd'

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1d4ed8',
    colorLink: '#2563eb',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorInfo: '#0ea5e9',
    borderRadius: 8,
    fontFamily: "'IBM Plex Sans Thai', 'IBM Plex Sans', sans-serif",
    fontSize: 14,
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f0f5ff',
    colorBorder: '#dbeafe',
    colorBorderSecondary: '#eff6ff',
    controlHeight: 38,
  },
  components: {
    Layout: {
      siderBg: '#0f2d5e',
      triggerBg: '#1a3f7a',
      triggerColor: '#ffffff',
    },
    Menu: {
      darkItemBg: '#0f2d5e',
      darkItemHoverBg: '#1a3f7a',
      darkItemSelectedBg: '#2563eb',
      darkItemColor: '#bfdbfe',
      darkItemHoverColor: '#ffffff',
      darkItemSelectedColor: '#ffffff',
      darkSubMenuItemBg: '#09203f',
      itemBorderRadius: 8,
    },
    Button: { borderRadius: 8, fontWeight: 500 },
    Table: {
      headerBg: '#eff6ff',
      headerColor: '#1e40af',
      borderColor: '#dbeafe',
      rowHoverBg: '#f0f5ff',
    },
    Card: { borderRadiusLG: 12 },
    Input: { borderRadius: 8 },
    Select: { borderRadius: 8 },
  },
}
