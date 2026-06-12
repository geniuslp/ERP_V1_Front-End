# CLAUDE.md — ERP Frontend Project Memory

> ไฟล์นี้เขียนขึ้นเพื่อให้ Claude อ่านก่อนทำงานกับโปรเจกต์นี้ทุกครั้ง
> อัปเดตล่าสุด: 2024-09

---

## 🗂️ โปรเจกต์คืออะไร

ระบบ **ERP Frontend** สำหรับจัดการ PR (Purchase Request) และ PO (Purchase Order)
เป็น Single Page Application ที่มี Dynamic Menu System และ Permission ต่อ User ต่อเมนู

**Stack หลัก:**
- React 18 + Vite + TypeScript
- Ant Design 5 (UI components)
- Tailwind CSS (utility styling)
- Redux Toolkit (state management)
- React Router 6 (routing)
- Axios + JWT + Refresh Token (API layer)
- Docker + Nginx (deployment)

---

## 📁 โครงสร้างไฟล์สำคัญ

```
src/
├── App.tsx                          ← Routes ทั้งหมดอยู่ที่นี่ — เพิ่ม Route ใหม่ตรงนี้
├── main.tsx                         ← Entry point
├── index.css                        ← Global styles + Tailwind + override Ant Design
│
├── types/index.ts                   ← TypeScript interfaces ทั้งหมด — แก้ type ตรงนี้ที่เดียว
│
├── config/
│   ├── antd.theme.ts                ← สีและ theme ของ Ant Design — แก้ theme ตรงนี้
│   └── routes.ts                    ← Route constants (ROUTES.PR.CREATE ฯลฯ)
│
├── store/
│   ├── index.ts                     ← Redux store setup + typed hooks
│   └── slices/
│       ├── authSlice.ts             ← Auth state, JWT tokens, login/logout actions
│       └── menuSlice.ts             ← Menu config + permissions + defaultMenus
│
├── services/
│   └── api.ts                       ← Axios instance + JWT interceptor + Auto Refresh Token
│
├── hooks/
│   └── usePermission.ts             ← Hook สำหรับเช็คสิทธิ์ต่อ menuId
│
├── components/
│   ├── auth/
│   │   ├── LoginPage.tsx            ← หน้า Login
│   │   └── ProtectedRoute.tsx       ← Guard สำหรับ route ที่ต้อง login
│   ├── common/
│   │   ├── PageHeader.tsx           ← Header บนทุกหน้า (title + breadcrumb + extra)
│   │   ├── StatCard.tsx             ← การ์ดสถิติใน Dashboard
│   │   └── StatusBadge.tsx          ← แสดงสถานะ PR/PO เป็น Tag สี
│   └── layout/
│       ├── AppLayout.tsx            ← Layout หลัก (Sidebar + Header + Content)
│       └── SidebarMenu.tsx          ← Dynamic menu จาก Redux store
│
├── pages/
│   ├── dashboard/DashboardPage.tsx  ← หน้าแรก สถิติ + ตารางล่าสุด
│   ├── pr/
│   │   ├── PRCreatePage.tsx         ← สร้าง PR + inline item table
│   │   ├── PRStatusPage.tsx         ← ตรวจสอบสถานะ + ค้นหา/filter
│   │   └── PRHistoryPage.tsx        ← ประวัติ PR
│   ├── po/
│   │   ├── POCreatePage.tsx         ← สร้าง PO + vendor + VAT calculation
│   │   ├── POStatusPage.tsx         ← ตรวจสอบสถานะ PO
│   │   └── POHistoryPage.tsx        ← ประวัติ PO
│   └── system/
│       ├── SystemConfigPage.tsx     ← Config ทั้งหมด (General / JWT / Notification)
│       ├── UsersPage.tsx            ← CRUD ผู้ใช้
│       ├── RolesPage.tsx            ← CRUD บทบาท
│       ├── MenusPage.tsx            ← เพิ่ม/แก้/ลบเมนูแบบ Dynamic
│       └── PermissionsPage.tsx      ← กำหนดสิทธิ์ per user per menu
│
└── utils/
    └── mockData.ts                  ← ข้อมูลจำลองสำหรับ PR, PO
```

---

## 🌐 API Calling Convention

### ใช้ Axios เสมอ — ห้ามใช้ `fetch` หรือ `api.*`

โปรเจกต์นี้ใช้ **Axios** ในการเรียก API ทุกจุด ห้ามใช้ `fetch()` native หรือ wrapper `api.get/api.post` อื่นๆ

### Pattern มาตรฐานสำหรับ `useEffect` + Axios

```ts
useEffect(() => {
  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/endpoint`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
      setData(list)
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'โหลดข้อมูลไม่สำเร็จ'
      message.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  fetchData()
}, [])
```

### กฎของ useEffect + async

- **ห้าม** ใส่ `async` ตรงๆ ใน `useEffect(() => async () => {...})` 
- ให้สร้าง `async function` ข้างในแล้วเรียกใช้แทน
- **ห้าม** ต่อ `.catch().finally()` ท้าย `setData(...)` เพราะ `setData` ไม่ใช่ Promise
- ใช้ `try/catch/finally` เสมอ

### ดึง Token ก่อนใช้

```ts
const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
// หรือ fallback
const accessToken = sessionStorage.getItem('accessToken')
```

### BASE_URL

```ts
const BASE_URL = (import.meta as any).env?.VITE_API_URL
```

---

## ⚠️ กฎสำคัญที่ต้องจำ

### API / Axios Rules
- **ใช้ `axios` เสมอ** — ห้ามใช้ `fetch()` หรือ `api.get/api.post` wrapper อื่น
- **ห้าม** ใช้ `async` ตรงๆ ใน `useEffect` callback — ให้สร้าง inner async function แล้วเรียกใช้
- **ห้าม** ต่อ `.catch()/.finally()` หลัง `setState()` เพราะ setState ไม่ใช่ Promise
- ใช้ `try/catch/finally` แทนเสมอ
- **Error message** ให้ดึงจาก API response ก่อนเสมอ: `err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ข้อความ fallback'`

### Type Rules
- **ห้ามเพิ่ม field ใน mockData.ts** โดยไม่เพิ่มใน `src/types/index.ts` ก่อน
- `PRItem` มี field: `id, description, quantity, unit, estimatedPrice` เท่านั้น (ไม่มี `productCode`)
- `PurchaseRequest.requester` เป็น `string` (ไม่ใช่ `requesterId`)
- `Role` ไม่มี `menuPermissions` — permission อยู่ใน `MenuPermission` interface แยกต่างหาก

### Import Rules
- ใช้ `@/` alias เสมอ (ห้ามใช้ relative path ยาวๆ)
- ห้าม import `lucide-react` — โปรเจกต์นี้ใช้ `@ant-design/icons` เท่านั้น
- ห้าม import จาก `@/stores/authStore` หรือ `@/stores/menuStore` — ใช้ `@/store` (Redux)

### Redux Rules
- `useAppSelector` และ `useAppDispatch` import จาก `@/store` เสมอ (ไม่ใช่ react-redux โดยตรง)
- Auth state: `state.auth` | Menu state: `state.menu`

### Docker Rules
- Dockerfile ใช้ `npm install --legacy-peer-deps` (ไม่ใช่ `npm ci` เพราะไม่มี package-lock.json ใน repo)
- ถ้าอยากเปลี่ยนเป็น `npm ci` ต้อง commit `package-lock.json` ขึ้น repo ก่อน

---

## 🔑 Auth & JWT Flow

### Login Flow

```ts
// LoginPage.tsx — handleLogin
const handleLogin = async (values: { username: string; password: string }) => {
  setLoading(true)
  dispatch(loginStart())
  try {
    // 1. ยิง POST /auth/login
    const res = await axios.post(
      `${BASE_URL}/auth/login`,
      { username: values.username, password: values.password },
      { withCredentials: false }
    )
    const { access_token, refresh_token } = res.data.data

    // 2. ยิง GET /auth/me เพื่อดึงข้อมูล user
    const meRes = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` }
    })
    const userData = meRes.data.data ?? meRes.data

    // 3. เก็บลง sessionStorage
    sessionStorage.setItem('accessToken', access_token)
    sessionStorage.setItem('refreshToken', refresh_token)
    sessionStorage.setItem('user', JSON.stringify(userData))

    // 4. dispatch ให้ Redux รู้
    dispatch(loginSuccess({
      user: userData,
      tokens: { accessToken: access_token, refreshToken: refresh_token }
    }))

    navigate('/')
  } catch {
    dispatch(loginFailure())
    message.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  } finally {
    setLoading(false)
  }
}
```

### Rehydrate หลัง Refresh หน้า

```ts
// App.tsx — ดึงจาก sessionStorage กลับมาใส่ Redux ตอน mount
useEffect(() => {
  const token = sessionStorage.getItem('accessToken')
  const user = JSON.parse(sessionStorage.getItem('user') ?? 'null')

  if (token && user) {
    dispatch(loginSuccess({
      user,
      tokens: {
        accessToken: token,
        refreshToken: sessionStorage.getItem('refreshToken') ?? ''
      }
    }))
  }
}, [])
```

### ดึง Token / User ในหน้าอื่น

```ts
// ดึงจาก Redux (แนะนำ)
const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
const user = useAppSelector((s) => s.auth.user)

// ดึงจาก sessionStorage (fallback)
const token = sessionStorage.getItem('accessToken')
const user = JSON.parse(sessionStorage.getItem('user') ?? '{}')
```

### Logout

```ts
const handleLogout = () => {
  sessionStorage.removeItem('accessToken')
  sessionStorage.removeItem('refreshToken')
  sessionStorage.removeItem('user')
  dispatch(logout())
  navigate('/login')
}
```

### เมื่อ API ตอบ 401

```
Axios response interceptor ดัก
  → POST /auth/refresh ด้วย refreshToken
  → dispatch(setTokens({ accessToken, refreshToken }))
  → อัปเดต sessionStorage ด้วย token ใหม่
  → Retry request เดิม
  → ถ้า refresh fail → logout() + ล้าง sessionStorage → redirect /login
```

### Storage ที่ใช้

| Key | Storage | หมายเหตุ |
|-----|---------|---------|
| `accessToken` | sessionStorage | หายตอนปิด tab |
| `refreshToken` | sessionStorage | หายตอนปิด tab |
| `user` | sessionStorage | ข้อมูล user จาก /auth/me |

**ไฟล์ที่เกี่ยวข้อง:** `src/services/api.ts`, `src/store/slices/authSlice.ts`, `src/components/auth/LoginPage.tsx`

---

## 🎯 Permission System

```ts
// กำหนดสิทธิ์ที่ System → จัดการสิทธิ์
// ข้อมูลเก็บใน store.menu.permissions[]

interface MenuPermission {
  userId: string
  menuId: string
  actions: ('read' | 'write' | 'edit' | 'delete')[]
}

// ใช้งานในหน้าต่างๆ
const { canRead, canWrite, canEdit, canDelete } = usePermission('pr-create')
```

**ข้อจำกัดปัจจุบัน:** Permissions เก็บใน Redux (memory) — หาย reload
**สิ่งที่ต้องทำถัดไป:** เชื่อม API จริงและโหลดหลัง login

---

## 🍔 Dynamic Menu System

```
defaultMenus (hardcode ใน menuSlice.ts)
  ↕ อาจถูก override ด้วย API ในอนาคต

store.menu.menus[]
  ↓ SidebarMenu.tsx อ่านและ render
  ↓ filter: isActive === true + parentId === null (เมนูหลัก)
  ↓ map children: isActive === true (submenu)
  ↓ Ant Design <Menu>

เพิ่มเมนูใหม่ runtime:
  dispatch(addMenu({...}))  ← จาก MenusPage.tsx
```

**Icon ที่ใช้ได้ (ใน SidebarMenu.tsx):**
`DashboardOutlined, FileTextOutlined, ShoppingCartOutlined, SettingOutlined,
PlusOutlined, SearchOutlined, HistoryOutlined, TeamOutlined,
ApartmentOutlined, AppstoreOutlined, SafetyOutlined`

ถ้าต้องการ icon ใหม่ → เพิ่มใน `iconMap` และ `subIconMap` ใน `SidebarMenu.tsx`

---

## ➕ วิธีเพิ่มโมดูลใหม่ (checklist)

1. **เพิ่ม Type** ใน `src/types/index.ts`
2. **เพิ่ม Route constant** ใน `src/config/routes.ts`
3. **เพิ่ม Route** ใน `src/App.tsx` (Lazy import + `<Route>`)
4. **สร้าง Page** ใน `src/pages/<module>/`
5. **เพิ่ม Menu** ใน `src/store/slices/menuSlice.ts` → `defaultMenus[]`
   หรือเพิ่มผ่าน UI ที่ System → จัดการเมนู
6. **กำหนดสิทธิ์** ที่ System → จัดการสิทธิ์
7. **เพิ่ม mock data** ใน `src/utils/mockData.ts` (ต้องตรง type เป๊ะ)

---

## 🌐 Environment Variables

```bash
# .env (copy จาก .env.example)
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_NAME=ERP System
VITE_APP_VERSION=1.0.0
```

ใช้ใน code: `(import.meta as any).env?.VITE_API_URL`
(ต้องใช้ `as any` เพราะ tsconfig อาจยังไม่ resolve vite/client ครบ)

---

## 🐳 Docker Commands

```bash
# Production
docker compose up erp-frontend -d

# Development (hot reload)
docker compose --profile dev up erp-frontend-dev

# Rebuild
docker compose build --no-cache erp-frontend
```

---

## 📌 สิ่งที่ยังไม่ได้ทำ (TODO)

- [x] เชื่อม API จริงสำหรับ Login (`POST /auth/login`) + ดึง user จาก (`GET /auth/me`)
- [ ] โหลด menus และ permissions จาก API หลัง login
- [ ] เชื่อม API สำหรับ PR CRUD (`GET/POST/PUT/DELETE /pr`)
- [ ] เชื่อม API สำหรับ PO CRUD (`GET/POST/PUT/DELETE /po`)
- [ ] หน้า PR Detail / PR Approve workflow
- [ ] หน้า PO Detail / รับสินค้า (Goods Receipt)
- [ ] Persist menu และ permissions ผ่าน API (`/system/menus`, `/system/permissions`)
- [ ] ระบบ Notification (Bell icon ยังเป็น mock)
- [ ] Export PDF / Excel สำหรับ PR, PO
- [ ] Unit tests
