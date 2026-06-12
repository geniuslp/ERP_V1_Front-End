# ERP Frontend

ระบบ ERP Frontend สร้างด้วย **React + Vite + TypeScript + Tailwind CSS + Ant Design**

## 📁 โครงสร้างโปรเจกต์

```
src/
├── components/
│   ├── auth/          # LoginPage, ProtectedRoute
│   ├── common/        # PageHeader, StatusBadge, StatCard
│   └── layout/        # AppLayout, SidebarMenu
├── config/
│   ├── antd.theme.ts  # Ant Design theme config
│   └── routes.ts      # Route constants
├── hooks/
│   └── usePermission.ts  # Permission hook
├── pages/
│   ├── dashboard/     # Dashboard
│   ├── pr/            # PR Create, Status, History
│   ├── po/            # PO Create, Status, History
│   └── system/        # Config, Users, Roles, Menus, Permissions
├── services/
│   └── api.ts         # Axios + JWT + Refresh Token
├── store/
│   ├── index.ts       # Redux store
│   └── slices/
│       ├── authSlice.ts  # Auth state + JWT management
│       └── menuSlice.ts  # Dynamic menu + permissions
└── types/
    └── index.ts       # TypeScript types
```

## 🚀 เริ่มต้นใช้งาน

### Local Development
```bash
cp .env.example .env
npm install
npm run dev
```

### Docker Production
```bash
docker compose up erp-frontend -d
```

### Docker Development
```bash
docker compose --profile dev up erp-frontend-dev
```

## 🔑 JWT & Auth Flow

- **Access Token**: หมดอายุตามที่ตั้ง (default 15 นาที)
- **Refresh Token**: ต่ออายุอัตโนมัติผ่าน `src/services/api.ts`
- **Token Storage**: `localStorage` ผ่าน Redux persist
- **Auto Logout**: เมื่อ Refresh Token หมดอายุ

## 🎯 Permission System

การจัดการสิทธิ์แต่ละเมนู:
```ts
const { canRead, canWrite, canEdit, canDelete } = usePermission('pr-create')

if (!canWrite) return <NoAccess />
```

Actions: `read | write | edit | delete`

## 🎨 Theme

- **Primary**: Blue `#1d4ed8` / Navy `#0f2d5e`
- **Font**: IBM Plex Sans Thai + Sarabun
- **Design**: Tailwind CSS + Ant Design 5

## 📦 เพิ่มเมนูใหม่

1. ไปที่ **System → จัดการเมนู**
2. กด "เพิ่มเมนู" กรอก label, key, path
3. กำหนดสิทธิ์ที่ **System → จัดการสิทธิ์**
4. เพิ่ม Route ใน `src/App.tsx`
5. สร้าง Page component ใน `src/pages/`

## 🏗️ Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | React 18 + Vite |
| Language | TypeScript |
| UI Library | Ant Design 5 |
| Styling | Tailwind CSS |
| State | Redux Toolkit |
| Routing | React Router 6 |
| HTTP | Axios + Interceptors |
| Auth | JWT + Refresh Token |
| Container | Docker + Nginx |
