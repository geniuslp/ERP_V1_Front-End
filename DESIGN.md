# DESIGN.md — ERP Frontend Design System

> คู่มือ Design System สำหรับโปรเจกต์นี้
> อ่านก่อนแก้ไข UI ทุกครั้ง เพื่อให้ Design สอดคล้องกัน

---

## 🎨 Color Palette

### Primary Colors (ธีมน้ำเงิน-กรมท่า)

| ชื่อ | Hex | ใช้ที่ไหน |
|------|-----|---------|
| `primary-950` | `#172554` | สีเข้มสุด (ไม่ค่อยใช้) |
| `navy-dark` | `#09203f` | Sidebar submenu background |
| `navy` | `#0f2d5e` | **Sidebar background หลัก** |
| `navy-light` | `#1a3f7a` | Sidebar hover, Header logo |
| `primary-800` | `#1e40af` | Table header text, Title text |
| `primary-700` | `#1d4ed8` | **Primary color (Ant Design token)** |
| `primary-600` | `#2563eb` | **Link color, Button gradient start** |
| `primary-500` | `#3b82f6` | Logo gradient, accent |
| `primary-400` | `#60a5fa` | Sidebar item color, subtitle text |
| `primary-300` | `#93c5fd` | Scrollbar, footer text |
| `primary-200` | `#bfdbfe` | Sidebar item color (default) |
| `primary-100` | `#dbeafe` | Border color |
| `primary-50` | `#eff6ff` | Table header bg, hover bg |
| `#f0f5ff` | — | **Page background (Layout bg)** |

### Semantic Colors

| ชื่อ | Hex | ใช้กับ |
|------|-----|--------|
| Success | `#16a34a` | อนุมัติ, completed |
| Warning | `#d97706` | รออนุมัติ, pending |
| Error | `#dc2626` | ปฏิเสธ, rejected, danger |
| Info | `#0ea5e9` | ข้อมูลทั่วไป |
| Purple | `#7c3aed` | StatCard มูลค่าเงิน |

### สีสถานะ PR/PO (StatusBadge)

> ⚠️ list ด้านล่างเป็นแค่ตัวอย่างโทนสีเท่านั้น ไม่ใช่ enum ค่าจริงครบทุกตัว — สถานะจริงทั้งหมด
> (`PARTIALLY_RECEIVED`, `PENDING_REAPPROVAL`, `IN_PROGRESS`, `PARTIALLY_RETURNED` ฯลฯ) ดูที่
> `CLAUDE.md` (frontend) หัวข้อ "StatusBadge — สถานะที่ต้อง map สี" แทน ที่นี่บอกแค่ว่าแต่ละ
> "กลุ่มความหมาย" ควรใช้โทนสีอะไร

```
draft     → default (เทา)
pending   → orange
approved  → green
rejected  → red
cancelled → gray
sent      → blue
partial   → cyan
completed → green
```

---

## ✍️ Typography

### Fonts
- **Body / UI:** `IBM Plex Sans Thai` + `IBM Plex Sans` (fallback sans-serif)
- **Title / Display:** `Sarabun` (ใช้กับ Title, Logo, PageHeader)
- โหลดจาก Google Fonts ใน `index.html`

### Font Sizes (Ant Design tokens)
- Base: `14px`
- Small: `12px` (subtitle, breadcrumb, caption)
- Medium: `13px` (table cell, form label)
- Large: `15–16px` (header title, section title)
- XL: `28px` (StatCard value)

### Font Weights
- Normal: 400
- Medium: 500 (button text)
- SemiBold: 600 (column header, nav item)
- Bold: 700 (stat value, logo, page title)
- ExtraBold: 800 (logo letter)

---

## 📐 Spacing & Layout

### Layout Dimensions
- **Sidebar width:** 260px (expanded) / 72px (collapsed)
- **Header height:** 64px (sticky)
- **Content margin:** 24px (all sides)
- **Footer height:** ~45px

### Border Radius
- Button, Input, Select: `8px`
- Card: `12px`
- StatCard bar: `2–3px`
- Logo box: `10–16px`
- Gradient accent bar: `3px`

### Box Shadow
- Card default: `0 2px 12px rgba(15,45,94,0.08)`
- Card hover: `0 8px 30px rgba(15,45,94,0.18)`
- Header: `0 2px 12px rgba(15,45,94,0.08)`
- Sidebar: `4px 0 20px rgba(15,45,94,0.3)`
- Login card: `0 25px 60px rgba(9,32,63,0.4)`
- Button primary: `0 4px 16px rgba(37,99,235,0.4)`

---

## 🧩 Components

### PageHeader
ใช้บนทุกหน้า — ประกอบด้วย:
- เส้นสีน้ำเงินซ้าย (border-left 4px `#2563eb`)
- Title (Sarabun, bold, `#1e3a8a`)
- Subtitle (`#60a5fa`, 13px)
- Breadcrumb (optional)
- Extra slot ขวา (สำหรับปุ่ม action)

```tsx
<PageHeader
  title="สร้างใบขอซื้อ (PR)"
  subtitle="กรอกข้อมูล..."
  breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'PR' }, { title: 'สร้าง' }]}
  extra={<Button type="primary">...</Button>}
/>
```

### StatCard
ใช้ใน Dashboard — มี gradient bar ด้านล่าง:
```tsx
<StatCard
  title="PR รออนุมัติ"
  value="24"
  icon={<ClockCircleOutlined />}


  
  color="#f59e0b"
  trend={{ value: 12, label: 'จากเดือนที่แล้ว' }}
/>
```

### StatusBadge
```tsx
<StatusBadge status="pending" />  // → Tag สีส้ม "รออนุมัติ"
```

### Card (Ant Design)
Style มาตรฐานทุก Card:
```tsx
<Card style={{
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)'
}}>
```

### Button
- Primary: gradient น้ำเงิน (override ใน index.css)
- Default: border ปกติ
- Danger: สีแดง
- Link: สีน้ำเงิน ไม่มี border

### Table
- Header bg: `#eff6ff` | Header text: `#1e40af`
- Border: `#dbeafe`
- Row hover: `#f0f5ff`
- เลขที่ PR/PO: `color: #2563eb, fontWeight: 600`

---

## 🗃️ Layout Patterns

### หน้าทั่วไป (List Page)
```
PageHeader (title + breadcrumb + [ปุ่มสร้าง])
Card {
  Row: Search + Filter + DatePicker + Reset
  Table
}
```

### หน้าสร้าง (Create Page)
```
PageHeader (title + [บันทึกร่าง] [ส่งอนุมัติ])
Card: ข้อมูลทั่วไป (Form)
Card: รายการ (Table แบบ editable + total)
```

### Dashboard
```
PageHeader
Row (4 StatCards)
Row: Col-16 (Table ล่าสุด) + Col-8 (Progress สถานะ)
```

---

## 🖼️ Sidebar Design

```
Background: #0f2d5e (navy)
Submenu bg: #09203f (navy-dark)
Item color: #bfdbfe (primary-200)
Item hover: rgba(255,255,255,0.08)
Item selected: linear-gradient(135deg, #2563eb, #1d4ed8)

Logo area:
  - กล่องสีน้ำเงิน gradient ตัว "E" (36x36px, borderRadius 10)
  - ชื่อ "ERP System" สีขาว bold
  - "Enterprise Resource" สีน้ำเงินอ่อน
```

---

## 🔐 Login Page Design

```
Background: linear-gradient(135deg, #0f2d5e → #1a3f7a → #2563eb)
  + วงกลม blur ตกแต่ง (position absolute)
  + เส้นเฉียง subtle

Card:
  background: rgba(255,255,255,0.97)
  borderRadius: 20px
  padding: 48px 40px
  boxShadow: 0 25px 60px rgba(9,32,63,0.4)

Logo: กล่อง 64x64 gradient น้ำเงิน shadow ใหญ่
Button: gradient + height 48px + borderRadius 10px + shadow
```

---

## 🎨 Tailwind CSS Usage

Tailwind ใช้เสริม Ant Design — ห้ามใช้ `preflight` (ปิดไว้ใน config)

**ใช้ Tailwind สำหรับ:**
- Utility classes ที่ Ant Design ไม่มี (เช่น gradient, positioning)
- Responsive layout เพิ่มเติม
- Spacing เสริม

**ใช้ Ant Design สำหรับ:**
- Component หลักทั้งหมด (Card, Table, Form, Button, Modal ฯลฯ)
- Color tokens (ใน theme)

**อย่าผสมกัน:** เช่น อย่าใช้ `className="bg-blue-500"` บน Ant Design component หลัก ให้ใช้ `style` หรือ `token` แทน

---

## 📏 Do & Don't

### ✅ Do
- ใช้ `style` prop กับ Ant Design components
- ใช้ `borderRadius: 12` กับ Card ทุกใบ
- ใช้ `border: 'none'` กับ Card (border อยู่ที่ shadow แทน)
- ใช้ `fontFamily: 'Sarabun'` กับ Title ใหญ่
- ใช้ `color: '#1e3a8a'` กับ heading/title
- ใช้ `color: '#60a5fa'` กับ subtitle/caption

### ❌ Don't
- อย่าใช้สีที่ไม่อยู่ใน palette นี้โดยไม่มีเหตุผล
- อย่าใช้ shadow แบบดำ `rgba(0,0,0,x)` — ให้ใช้ navy `rgba(15,45,94,x)` แทน
- อย่าเปลี่ยน Sidebar background ออกจาก `#0f2d5e`
- อย่าใช้ font อื่นนอกจาก IBM Plex Sans Thai และ Sarabun
- อย่า import `lucide-react` — ใช้ `@ant-design/icons` เท่านั้น
