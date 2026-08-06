# ERP Frontend — Claude Code Context (FRONTEND: erp-web)

> ⚠️ ไฟล์นี้เป็นไฟล์ใหม่ — เดิมมีแค่ `DESIGN.md` (design system) ไม่มี `CLAUDE.md` แยกสำหรับ frontend
> อ่าน `DESIGN.md` ควบคู่เสมอก่อนแก้ UI ทุกครั้ง — ไฟล์นี้เน้น "โครงสร้าง/วิธีทำงาน" ส่วน DESIGN.md เน้น "หน้าตา"
> 🔴 สมมติฐานที่ยังไม่ยืนยัน: React + Vite + Ant Design + Tailwind (ไม่ preflight) — อนุมานจาก DESIGN.md
> ยังไม่มีไฟล์ `package.json` / source code frontend ให้ตรวจสอบจริง กรุณายืนยัน/แก้ไขส่วน Tech stack ด้านล่างให้ตรงกับโปรเจกต์จริง

## Project overview
Frontend ของระบบ ERP (PR / PO / RFQ / GRN / Stock / Borrow-Return / Memo / Approval) เชื่อมกับ
`erp-api` (Go Fiber backend, ดู `CLAUDE.md` ฝั่ง backend) ผ่าน REST API + JWT Bearer token

---

## Tech stack (สมมติฐาน — ยืนยันกับโปรเจกต์จริงอีกครั้ง)
| Layer | Library |
|---|---|
| Framework | React (Vite) |
| UI Library | Ant Design (theme token ปรับสีตาม DESIGN.md) |
| Utility CSS | Tailwind CSS (ปิด `preflight`) |
| Icons | `@ant-design/icons` เท่านั้น — **ห้าม** import `lucide-react` |
| Fonts | IBM Plex Sans Thai + IBM Plex Sans (body), Sarabun (title/display) — โหลดจาก Google Fonts ใน `index.html` |
| Auth | JWT Bearer token จาก `erp-api` เก็บใน state/memory (ตรวจสอบ storage strategy จริงในโค้ด) |

---

## Design System
**ทุกครั้งที่แก้ UI ต้องอ่าน `DESIGN.md` ก่อนเสมอ** — เป็น source of truth เรื่อง:
- Color palette (ธีมน้ำเงิน-กรมท่า: `navy #0f2d5e`, `primary-700 #1d4ed8`, ฯลฯ)
- Semantic colors (success/warning/error/info/purple สำหรับ StatCard)
- Typography scale, spacing, border-radius, box-shadow
- Component pattern: `PageHeader`, `StatCard`, `StatusBadge`, `Card`, `Button`, `Table`
- Layout pattern: List Page / Create Page / Dashboard
- Sidebar & Login page design spec

**กฎสำคัญจาก DESIGN.md ที่ต้องถือปฏิบัติเสมอ:**
- ใช้ `style` prop กับ Ant Design components, ไม่ใช้ `className="bg-blue-500"` บน component หลัก
- Card ทุกใบ: `borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)'`
- Shadow ใช้โทน navy (`rgba(15,45,94,x)`) เท่านั้น ห้ามใช้ shadow ดำ `rgba(0,0,0,x)`
- ห้ามเปลี่ยน Sidebar background ออกจาก `#0f2d5e`
- ห้ามใช้ font อื่นนอกจาก IBM Plex Sans Thai / Sarabun
- ห้าม import `lucide-react` — ใช้ `@ant-design/icons` เท่านั้น
- **StatusBadge color mapping ยึดตาม `CLAUDE.md` นี้เป็นหลัก** (enum ค่าจริงจาก DB) ไม่ใช่ list
  ตัวอย่างสั้น ๆ ที่อยู่ใน DESIGN.md — DESIGN.md มีแค่โทนสี/กฎทั่วไป ไม่ครบทุก status จริง

---

## Backend contract ที่ frontend ต้องรู้ (sync กับ `erp-api` CLAUDE.md)

### 🔴 จุดที่ต้องระวังเป็นพิเศษเวลาต่อ API (เพิ่งอัปเดตจาก DB dump ล่าสุด — ERP_V12)

1. **PR ไม่มี field status ที่บอกสถานะอนุมัติโดยตรง**
   `purchase_request.status` มีค่าได้แค่ `DRAFT, COMPLETED, STOCK_CHECK, PARTIALLY_FILLED, FULFILLED, CANCELLED`
   → หน้า PR list/detail ต้องดึงสถานะอนุมัติจาก endpoint ที่ query `approval_request`/`approval_log` แยกต่างหาก
   ไม่ใช่ derive จาก `pr.status` เฉยๆ — **`StatusBadge` ของ PR กับ PO อาจต้องมี logic ต่างกัน**

2. **PO มี field การเงินเพิ่มเติม** ที่ต้องรองรับในฟอร์มสร้าง/แก้ PO:
   `use_discount`, `discount_type (pct/amt)`, `discount_amount`, `use_vat`, `vat_amount`,
   `use_wht`, `wht_amount`, `net_amount`, `currency`
   PO status เพิ่ม `PENDING_REAPPROVAL` (กรณี PO ถูกตีกลับแล้วแก้ใหม่) → ต้องมี badge/สี เพิ่มใน `StatusBadge`

3. **โมดูลใหม่ที่ยังไม่มีหน้าจอ (backend มี table แล้ว รอ handler + UI):**
   - RFQ (`SENT, RECEIVED, SELECTED, REJECTED`)
   - Borrow/Return (`DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, BORROWED, RETURNED, PARTIALLY_RETURNED, CANCELLED`)
   - Stock Count (`DRAFT, IN_PROGRESS, COMPLETED`)
   - Memo (`DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED`) — ผูกกับ PR ผ่าน `memo_id`

4. **ระบบสิทธิ์ (RBAC) ละเอียดกว่าที่เคยรู้** — มี 4 ชั้น: role / user override / department / menu
   → เมนู sidebar และปุ่ม action ต่างๆ **ไม่ควร hardcode ตาม role อย่างเดียว** ควรเช็คสิทธิ์จาก
   `user_menu_permissions` / `role_menu_permissions` / `dept_menu_permissions` ที่ backend ส่งมาหลัง login
   (ต้องคุยกับทีม backend ว่า `/auth/me` จะรวม permission tree มาด้วยหรือ endpoint แยก)

5. **View ที่ backend เคยพึ่งพา (`v_pr_full`, `v_po_full` ฯลฯ) หายไปจาก DB dump ล่าสุด**
   → ถ้าหน้า list เคยได้ field เสริม (เช่น requested_by name, warehouse name) จาก view เหล่านี้
   ต้องเช็คกับทีม backend ว่า response shape เปลี่ยนไปหรือยัง ก่อนแก้ TypeScript interface/type ฝั่ง frontend

---

## StatusBadge — สถานะที่ต้อง map สี (สรุปจาก DB CHECK constraint จริง)
```
PR:          DRAFT / COMPLETED / STOCK_CHECK / PARTIALLY_FILLED / FULFILLED / CANCELLED
PO:          DRAFT / PENDING_APPROVAL / APPROVED / REJECTED / PENDING_REAPPROVAL / SENT / PARTIALLY_RECEIVED / RECEIVED / CANCELLED
GRN:         DRAFT / CONFIRMED / POSTED   (+ quality_status: PENDING / PASSED / FAILED / PARTIAL)
RFQ:         SENT / RECEIVED / SELECTED / REJECTED
Borrow:      DRAFT / PENDING_APPROVAL / APPROVED / REJECTED / BORROWED / RETURNED / PARTIALLY_RETURNED / CANCELLED
Stock Count: DRAFT / IN_PROGRESS / COMPLETED
Memo:        DRAFT / PENDING_APPROVAL / APPROVED / REJECTED / CANCELLED
```
ใช้สีจาก DESIGN.md (Success `#16a34a`, Warning `#d97706`, Error `#dc2626`, Info `#0ea5e9`) —
สถานะใหม่ที่ยังไม่มี mapping (เช่น `PENDING_REAPPROVAL`, `PARTIALLY_RETURNED`, `IN_PROGRESS`) ต้องเพิ่มสีเอง
แนะนำ: `PENDING_REAPPROVAL` → warning (เหมือน pending), `IN_PROGRESS` → info/cyan

---

## 🔴 Document approval flow — confirmed business rules (2026-07 session, do not re-litigate)

**PR does NOT require approval at all.** Flow is `DRAFT → COMPLETED` directly. There are
**no approve/reject endpoints for PR** — they were removed entirely
(`src/pages/pr/PRApprovalDetailPage.tsx`, `PRApprovalListPage.tsx`, `src/services/prApprovalService.ts`
deleted). **Never re-add PR approval UI, routes, or menu items.** If backend docs or old
memory mention PR approval, they are stale — trust this instead.

**Memo REQUIRES approval.** Role-based via `approval_config`, plus extra approvers via
`approval_delegation` (see below). A specific approver is chosen from the eligible pool at
creation/submit time and stored as `memo.approver_id`.

**PO REQUIRES approval** — same "pick a specific approver from the eligible pool" model as
Memo, i.e. `purchase_order.approver_id`, **NOT purely role-based**. Flow:
`DRAFT → PENDING_APPROVAL → APPROVED / REJECTED`. Approved POs can be edited within 1 year via
`PUT /po/:id/edit-approved` (reason is mandatory) — this transitions the PO to
`PENDING_REAPPROVAL` and routes it back to the **same** original approver, not a newly picked one.

**`approval_delegation` table** — columns: `id, doc_type (nullable, NULL = applies to all doc
types), user_id, reason, created_at, created_by`. This is the "extra approver" mechanism,
**additive** to role-based `approval_config`, not a replacement. No from/to date range fields —
inserting a row makes it active immediately; deleting removes it immediately.

## 🔴 Schema-drift bug class — check proactively, this session found ~20 instances

Backend Go handlers repeatedly referenced a column name that didn't match the real DB schema
(e.g. `po_id` / `pr_id` / `approval_id` / `grn_id` / `line_id` / `log_id` used in SQL when the
actual column is almost always just `id`). Root cause: SQL copy-pasted between similar handlers
without verifying real column names against the live schema.

**Rule:** before writing/reviewing SQL for a table not touched recently, verify column names via
`information_schema.columns` — never assume based on the table's "logical" name.

**Also:** a field being correctly present in a request struct AND correctly present in the
handler's save payload does **not** guarantee it's actually in the INSERT/UPDATE SQL's column
list. This session repeatedly found fields silently dropped at exactly that step
(`approver_id`, `warehouse_code`, `ref`, supplier contact fields all had this exact bug
independently, found separately). **When a field "isn't saving," check the SQL column list
directly — don't assume the struct/payload layer is at fault.**

**Nullable FK joins:** any optional/nullable foreign key (`requested_by → users`,
`location_code → location`, `warehouse_code → warehouse`, `project_code → project`,
`supplier_code → supplier` for contact fields) must use `LEFT JOIN`, never `INNER JOIN`. An
INNER JOIN silently drops entire rows where the FK is NULL — this caused a confusing "PO not
found" bug for older records created before newer nullable columns existed.

**Route registration order:** static routes (e.g. `/search`) must be registered **before**
dynamic param routes (e.g. `/:id`) in the same route group, or the router matches the dynamic
route first (`GET /po/search` gets captured as `/po/:id` with `id="search"`).

## Supplier contact data — live-joined, not stored on PO

`purchase_order` does **not** store its own copy of supplier contact fields (`office_phone`,
`fax`, `sales_person`, `contact_email`, `contact_phone`). These are always live-joined from
`supplier` via `supplier_code` at read time (`GET /po/:id` uses `LEFT JOIN supplier`). Do not
add these as `purchase_order` columns or as frontend form fields to persist — this was
explicitly decided against (reversed from an earlier snapshot-based design). Frontend should
just render whatever the join returns; never try to save these back through the PO update form.

## Debugging protocol for "field silently isn't saving" reports

This session had multiple false "fixed" reports from backend that weren't actually tested.
The protocol that actually worked:
1. Capture the real network payload via browser DevTools (Network tab) when the frontend form
   submits.
2. Confirm the payload is correct (field present, right value, right key name).
3. If backend claims a fix, **demand a pasted ACTUAL verified `SELECT` query result** against
   the real row after a real save — never accept "should be fixed now" without that evidence.

---

## 🔴 หน้า "รับเข้า" (GRN receiving) — logic การหา PO ที่ยังรับไม่ครบ (2026-07-27 session)

**PO ↔ GRN เป็น relationship 2 ระดับ ต้องดูคู่กันเสมอ ห้าม derive จาก `po.status` อย่างเดียว:**
- `purchase_order.status` = ภาพรวมทั้งใบ (ใช้แสดง badge หน้า list ทั่วไปพอ)
- `purchase_order_line.status` (`OPEN|PARTIAL|RECEIVED|CANCELLED`) + `qty_ordered` vs
  `qty_received` = ความจริงระดับบรรทัด — **ต้องใช้ตัวนี้คำนวณ "เหลืออะไรให้รับอีก"** เพราะ PO ใบ
  เดียวรับของเป็นงวด ๆ ได้ (หลาย GRN ต่อ 1 PO, แต่ละบรรทัดรับไม่พร้อมกัน)

**หน้าค้นหา PO สำหรับสร้าง GRN** ควรเรียก endpoint ที่ backend filter ให้แล้ว (ดูฝั่ง backend
`CLAUDE.md` หัวข้อ session 2026-07-27) — ผลลัพธ์คือ PO ที่ status อยู่ใน
`APPROVED / SENT / PARTIALLY_RECEIVED` และยังมีอย่างน้อย 1 บรรทัดที่ `OPEN`/`PARTIAL`
**⚠️ endpoint นี้ยังไม่มีจริงฝั่ง backend ณ session นี้ — ต้องรอ backend ทำก่อนถึงจะต่อ UI ได้**

**ฟอร์มกรอก GRN**: บรรทัดที่โหลดมาต้องมี field "จำนวนคงเหลือที่รับได้"
(`qty_ordered - qty_received`) ไว้กัน user กรอกเกิน (over-receive) ฝั่ง UI ก่อนส่ง ไม่ใช่พึ่ง backend
validate อย่างเดียว

## Inventory vs Stock — คนละระบบ อย่าสับสนตอนต่อ UI (2026-07-27 session)

DB มี stock tracking 2 ระบบแยกกัน ไม่มี FK เชื่อมกัน:
- **`inventory` / `inventory_transaction`** (ผูกกับ `mat_code`) — **❌ ไม่ได้ใช้งานจริง** ห้ามสร้าง
  หน้า/component ที่เรียก endpoint กลุ่มนี้ (เช่น inventory balance, transaction ledger) เว้นแต่มีคน
  สั่งเปลี่ยนนโยบายนี้ชัดเจน
- **`stock_item` / `stock_inventory` / `stock_reservation` / `stock_count`** (ผูกกับ `item_id`) —
  **✅ ระบบที่ใช้จริง** คู่กับหน้า Borrow/Return และ Stock Count ที่ยังต้องสร้าง UI (ดู TODO ด้านล่าง)

ถ้าเจองาน "หน้าจอ stock" หรือ "หน้าจอ inventory" ใหม่ ให้เช็คกับทีมก่อนว่าหมายถึงระบบไหน — ชื่อ
คล้ายกันมากจนสับสนได้ง่าย

---

## Known issues / TODO
- [ ] ยืนยัน tech stack จริง (Vite? CRA? Next.js?) แล้วอัปเดตหัวข้อ Tech stack ด้านบน
- [ ] เพิ่มหน้าจอ + API integration สำหรับ RFQ, Borrow/Return, Stock Count, Memo (backend table พร้อมแล้ว)
- [ ] คุยกับทีม backend เรื่อง permission tree structure (`/auth/me` response) ก่อนทำ dynamic sidebar menu
- [ ] เช็ค field การเงินใหม่ของ PO (discount/vat/wht) ในฟอร์มสร้าง/แก้ PO ว่ามีอยู่แล้วหรือยัง
- [ ] เช็คว่า field ที่เคยได้จาก DB view (`v_pr_full` ฯลฯ) ยังมาจาก API เหมือนเดิมไหม หลัง view หายจาก DB
- [ ] **หน้า "รับเข้า" (GRN)**: รอ backend ทำ endpoint search PO ก่อน แล้วค่อยต่อ UI ตาม logic ด้านบน
