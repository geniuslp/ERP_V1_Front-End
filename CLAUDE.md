# ERP Frontend — Claude Code Context (FRONTEND: erp-frontend)

> ⚠️ ไฟล์นี้เป็นไฟล์ใหม่ — เดิมมีแค่ `DESIGN.md` (design system) ไม่มี `CLAUDE.md` แยกสำหรับ frontend
> อ่าน `DESIGN.md` ควบคู่เสมอก่อนแก้ UI ทุกครั้ง — ไฟล์นี้เน้น "โครงสร้าง/วิธีทำงาน" ส่วน DESIGN.md เน้น "หน้าตา"
> 🔴 สมมติฐานที่ยังไม่ยืนยัน: React + Vite + Ant Design + Tailwind (ไม่ preflight) — อนุมานจาก DESIGN.md
> ยังไม่มีไฟล์ `package.json` / source code frontend ให้ตรวจสอบจริง กรุณายืนยัน/แก้ไขส่วน Tech stack ด้านล่างให้ตรงกับโปรเจกต์จริง

## Project overview
Frontend ของระบบ ERP (PR / PO / RFQ / GRN / Stock / Borrow-Return / Memo / Approval) เชื่อมกับ
`erp-api` (Go Fiber backend, ดู `CLAUDE.md` ฝั่ง backend) ผ่าน REST API + JWT Bearer token

---

## ⚙️ Working rules — Claude Code prompting

เวลาทำงานกับ Claude Code ในโปรเจกต์นี้ (ทั้งฝั่งนี้และฝั่ง backend `erp-api`):

1. **Prompt ที่ส่งให้ Claude Code ต้องเขียนเป็นภาษาอังกฤษเสมอ** (context/comment ในเอกสารนี้เขียนไทยได้ตามเดิม แต่ prompt/instruction ที่สั่งงานจริงต้องแปลเป็นอังกฤษก่อนส่ง)
2. **ต้องแยก prompt ออกเป็นสามส่วนตาม layer เสมอ**: `Frontend`, `Backend`, `SQL` — ห้ามรวมเป็น prompt เดียวแบบผสมทุก layer แม้ว่างานนั้นจะกระทบหลาย layer พร้อมกัน (เช่น เพิ่ม field ใหม่ที่ต้องมี migration + handler + UI ก็ให้แยกเป็น 3 prompt ตามลำดับ SQL → Backend → Frontend)
3. **ลำดับการส่งงานที่กระทบหลาย layer: SQL ก่อน → Backend → Frontend ทีหลังสุด** (ฝั่ง frontend ควรรอ backend endpoint พร้อมใช้งานจริงก่อนค่อยเขียน UI ต่อ)
4. กฎนี้ถือเป็น default ของโปรเจกต์ — ไม่ต้องพิมพ์บอกซ้ำทุกรอบ

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

🔴 **อัปเดต (session นี้) — `GET /po/:id/receivable-lines` confirmed LIVE, ไม่ใช่ "ยังไม่มีจริง"
อีกต่อไป.** ตรวจสอบฝั่ง backend แล้ว: `POHandler.GetReceivableLines` (po.go:2866) implement
เต็มแล้ว, routed แล้ว, และ scan `unit_price` ถูกต้อง. `grnReceivingService.ts` เปลี่ยนเป็น
`GRN_RECEIVING_MOCK_MODE = false` แล้ว. ⚠️ ข้อควรระวังตอนต่อจริง: endpoint นี้คืนแค่ array ของ
lines ล้วน ๆ (ไม่มี po_no/warehouse_code/supplier ติดมาด้วย), และ field id ของแต่ละ line ชื่อ
`line_id` ไม่ใช่ `po_line_id` เหมือนใน mock — `getReceivableLines()` เลย fetch `GET /po/:id`
เพิ่มมาประกบเอา header (po_no/warehouse_code) แล้ว remap `line_id → po_line_id` ให้ตรงกับ type
เดิมที่หน้า `GRNCreatePage.tsx` ใช้อยู่ (ไม่ต้องแก้โค้ดหน้า page เลย). PO ไม่มี `supplier_code`
แล้ว (clean-break migration ไป `supplier_id`) จึงใช้ `supplier_name` แทนใน field นี้.

**ฟอร์มกรอก GRN**: บรรทัดที่โหลดมาต้องมี field "จำนวนคงเหลือที่รับได้"
(`qty_ordered - qty_received`) ไว้กัน user กรอกเกิน (over-receive) ฝั่ง UI ก่อนส่ง ไม่ใช่พึ่ง backend
validate อย่างเดียว

## 🔴 Session 2026-08-26 — print race fix, Memo/PR edit-mode rules, stock-split auto-reserve, supplier_code → id migration

**Print logo race condition (fixed).** `PurchaseOrderPrint.tsx`, `PRPrint.tsx`,
`WorkOrderPrintStandard.tsx`, `WorkOrderPrintPOStyle.tsx` — `window.print()` used to fire once DOM
layout measured, but the logo `<img>` could still be mid-load, printing a blank logo. Now the logo
is preloaded and `window.print()` is gated on an `onReady()` callback that fires only after the
image finishes loading. **Apply this same preload+gate pattern to any future print component that
renders a logo/remote image.**

**Memo is editable while `PENDING_APPROVAL`**, not just `DRAFT`. `MemoCreateEditPage.tsx` /
`MemoDetailPage.tsx`: editable for `DRAFT`, `PENDING_APPROVAL`, `REJECTED`; blocked only for
`APPROVED`/`CANCELLED`. Editing while `PENDING_APPROVAL` does **not** reset status or reassign
`approver_id` — the in-flight approval just continues against the edited content.

**PR line editing restrictions.** `PRItemsTable.tsx` — a line loaded from the existing PR
(`isExisting: true`) locks `mat_code`; only `qty_requested` and delete stay available on it. Lines
added fresh during the current edit session have no such lock. Don't "simplify" this by making all
rows equally editable — the lock is intentional (existing lines may already have stock
reservations / PO splits against them).

**`cost_subgroup_id` lock on existing lines is narrower (2026-09-10 update).** It stays locked for
`order_type === 'cost'` (stock-reservation/PO-split dependency applies there), but is editable for
`order_type === 'stock'` on an existing `DRAFT` line — no PO-split/reservation dependency ties cost
code to stock-type PRs. `PRItemsTable` takes an `orderType` prop (passed from `PRCreatePage.tsx`'s
watched `order_type` form field) and only disables the Cost Code button when
`r.isExisting && orderType !== 'stock'`.

**PR edit-mode save now actually re-submits.** `PRCreatePage.tsx`'s "บันทึกการแก้ไข" (save edit)
now calls `PUT /pr/:id` followed by `POST /pr/:id/submit`. Previously it only called `PUT`, so a PR
reopened from `COMPLETED` got stuck at `DRAFT` after editing instead of returning to `COMPLETED`.

**Attachment cross-linking (Memo/PR/PO).** `POApprovalDetailPage.tsx` renders up to three
`AttachmentSection` blocks (Memo/PR/PO); `PRDetailPage.tsx` renders two (Memo/PR). Each section
renders only if its key (`memo`/`pr`/`po`) is **present** on `attachments` in the API response —
check key presence (`'memo' in po.attachments`), not array length, since the backend omits the key
entirely (not `[]`) when that chain link doesn't exist for the document.

**Backend note — dead handler removed.** `PRHandler.Get` (`pr.go`) was unused/unreachable; the live
handler for `GET /pr/:id` has always been `PRApprovalHandler.GetDetail` (`pr_approval.go`), which is
where the `{pr, memo}` attachments feature was actually merged. If a future PR-detail feature
doesn't show up after editing what looks like the right handler, check `routes.go` /
`internal/routes/pr.go` for which handler is actually wired before assuming your edit is live.

**`PRStatusPage.tsx`**: Edit button for `DRAFT` PRs (gated by `MENU_PR_CREATE`) was a regression
from an unrelated earlier commit (`94b5fe8`) — restored. Also fixed the action column overflowing
by widening the column and adding `scroll={{x}}`.

**Stock auto-split is now live** — `qty_reserved` / `qty_to_order` on PR lines are computed, not
static. At PR submit, stock is auto-split: `qty_reserved` = amount deducted from central stock
(`stock_item`), `qty_to_order` = shortfall that still needs a PO. This replaces the old
all-or-nothing shortage block — it's first-come-first-served across concurrent PRs. For
`order_type='cost'` PRs (requires `project_code`), the reserved amount also mirrors into
`project_stock` via `addToProjectStock`/`deductProjectStock` (the same helpers
Requisition/StockTransfer already use). Reopening a `COMPLETED` PR reverses both `stock_item` and
(for `cost`-type) `project_stock` — reversal is blocked with `409` if the project already consumed
the material elsewhere.

**`PRDetailPage.tsx` line table column swap.** "PO ที่สั่งแล้ว" (per-line multi-PO split-order
history) was replaced with "ตัดจาก Stock" (`qtyReserved`). The split-order-history view
(`linePoMap` state/fetch) was removed entirely. **Flag this if a future request asks to see which
POs were created against a specific PR line** — that view no longer exists and would need to be
rebuilt.

**PO-line-from-PR-line ordering cap changed.** Anywhere that capped "remaining orderable qty" at
`qty_requested - qty_ordered` now uses `qty_to_order - qty_ordered` instead, since stock-covered
quantity should never be orderable via PO. Affects `GetPRLinesForPO`, the PO-create-from-PR flow,
and the documented pattern in backend `SKILL.md`.

**Backend bugfix — `reconcilePRLineQty` double-counting.** Editing/growing an existing PO line that
shares a PR line with another PO used to compute "remaining capacity" without excluding the
editing PO's own prior contribution — this could either wrongly block a valid no-op resave, or (in
a first attempted fix) wrongly allow real over-allocation. Fixed by comparing the line's new total
(`newSum[id]`) against `qty_to_order - othersClaim` (everyone else's claim, explicitly excluding
this call's own old contribution) rather than a delta against a raw budget number. **Rule for
future split-ordering work: always compare new totals against remaining-excluding-your-own-old-
claim, never a delta against a raw budget — those are different units and easy to mix up.**

**Supplier identifier migration — `supplier_code` → `id`.** Backend fully dropped `supplier_code`
from the `supplier` table; everything (list/get/update/delete endpoints, `purchase_order`'s FK)
now uses `supplier.id` (auto-increment PK). Frontend updated to match: `POCreatePage.tsx` (dropdown
value, fetch URL, submit payload key is now `supplier_id`), `POApprovalDetailPage.tsx`,
`types/po.ts` (`supplier_code: string` → `supplier_id?: number`), `SupplierPage.tsx` (rowKey,
PUT/DELETE URLs, bulk-import flow, and removal of the now-obsolete manual "รหัสผู้ขาย" required
text input — suppliers no longer have a user-entered code). **Explicitly NOT touched:**
`WorkOrder*` files and GRN/receiving files/types — these have their own separate, unconfirmed
`supplier_code` usage on different tables; don't assume they're part of this migration without
separately verifying their backend state.

**Supplier Excel import/export headers (frontend session).** `SupplierPage.tsx`'s `EXCEL_HEADERS`
(shared by the downloadable import template, the Excel-file import parsing in `handleBulkImport`/
`handlePanelConfirmImport`, and the "Export Excel" button) use this English header set, in this
order:
```
supplier_name | tax_id | address | contact_name | contact_tel | contact_phone | contact_email |
payment_terms | currency | Remark
```
`is_active` is deliberately **not** part of this set (removed from both import parsing and
export — it's still a real field on the `Supplier` edit form/table, just not importable/exportable
via Excel). The three contact-related headers don't map 1:1 to their similarly-named internal
field — mind the remap when touching this code:
- `contact_name` (header) → `sales_person` (API field)
- `contact_tel` (header) → `sales_person_phone` (API field)
- `contact_phone` (header) → `office_phone` (API field)
- `contact_email` → `contact_email` (unchanged)
- `Remark` (header, capitalized) → `remarks` (API field)

`Remark` is capitalized (not `remark`) to match the header text exactly — `sheet_to_json` keys
parsed rows by the literal header cell text, case-sensitive, so the template, parsing, and export
must all agree on `Remark` exactly.

**Print button stale-state bugfix.** `POCreatePage.tsx`'s print guard checked a `savedPoId` state
that was never populated after a successful Create — the response-parsing fallback chain was
missing the `po_id` key (the field name every other PO response actually uses; the code was
checking `id`, which doesn't exist on PO responses). Fixed by adding `po_id` to the fallback chain
in both the create-success handler and the edit-mode load effect. **This codebase's PO responses
always key the primary key as `po_id`, never `id`** — check for this before writing any new
response-parsing code for PO objects.

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

## 🔴 PR warehouse_code — now derived server-side from project, not user-selected (frontend session)

**`PRCreatePage.tsx` no longer has a "คลังสินค้า" (warehouse) Select at all.** Backend now derives
`warehouse_code` server-side from `project.warehouse_code`, which is only populated for 4 dedicated
"warehouse projects" (`2026-WH-001..004` = บางแค/ศาลายา/บางบ่อ/ปราจีน) and **rejects any
`warehouse_code` the client sends directly**. The frontend payload no longer includes
`warehouse_code` at all (was previously read from a user-facing Select shown only for
`order_type === 'stock'`).

**`project_code` is now REQUIRED when `order_type === 'stock'`** (previously optional/unused for
that type) — enforced via a Form.Item rule mirroring the backend's validation, so the user sees an
inline error before submit rather than a raw API rejection. The "โครงการ" Select's options are
filtered client-side: only the 4 warehouse-project codes when `order_type === 'stock'`, the normal
customer-project list (warehouse-projects excluded) otherwise.

**⚠️ This filter is a hardcoded 4-code allowlist (`WAREHOUSE_PROJECT_CODES` in
`PRCreatePage.tsx`), not a backend-provided flag.** `GET /master/projects` does not currently
return any field (`project_type`, `is_warehouse_project`, `warehouse_code`, etc.) that
distinguishes warehouse-projects from real customer projects — checked across every place this
repo consumes that endpoint (`PRCreatePage.tsx`, `ProjectListPage.tsx`'s `mapProject`). If the
backend ever adds/removes a warehouse-project or exposes a real distinguishing field, this
hardcoded list needs a matching update (or ideally, backend should add a proper flag so the
frontend doesn't need to hardcode project codes at all).

**Update — `POCreatePage.tsx` migrated too (same session, follow-up request).** The no-PR PO
create/edit flow now matches PR exactly: no warehouse Select ever existed in this page's JSX (only
dead state/fetch — `warehouses`/`warehousesLoading`/`GET /master/warehouses` — that was never wired
to a visible field; removed), `project_code` is required when `order_type === 'stock'` **and no PR
is linked** (`!selectedPrId`), and the same `WAREHOUSE_PROJECT_CODES` allowlist (kept in sync
manually between the two files — see the ⚠️ above) filters the "โครงการ" Select's options the same
way.

**PR-linked PO path is intentionally different and was left alone**, per explicit scope: when
`selectedPrId` is set, `project_code` stays disabled/driven by the linked PR (no new required rule
— the PR already enforces its own), and `warehouse_code` **is still sent** in the submit payload,
carried over from the linked PR's own (already backend-derived) value via the existing
`prAutoFill`/`fetchPrDetail` effect — this is correct and intentional, not a leftover: a PO created
from a stock-type PR inherits that PR's already-correct `warehouse_code` rather than re-deriving it
from a PO-level project selection. The no-PR payload path (`selectedPrId` falsy) never sends
`warehouse_code` at all, matching PR's behavior.

---

## 🔴 Session 2026-09-21 — new IC (Inventory Control) module, WO payment-conditions redesign, misc bug fixes

**New IC pages/components (backend `/ic/pos/...` endpoints, new sidebar group).**
- `src/pages/ic/ICProjectListPage.tsx` — list page ("ข้อมูลโครงการสำหรับ IC").
- `src/pages/ic/ICPoReceivePage.tsx` + `src/pages/ic/components/ICPoReceiveModal.tsx` — 3-tab modal
  (รายละเอียดเอกสาร / รายการสินค้า / ไฟล์แนบ). The attachments tab is a disabled placeholder
  ("ยังไม่พร้อมใช้งาน (Coming soon)") — not wired to any endpoint yet. The items tab calls
  `GET /ic/pos/:poId/receive-lines` and `POST /ic/pos/:poId/receive-lines/submit`.
- `src/pages/ic/components/ICPoReceivePrint.tsx` — print layout mirrors
  `PurchaseOrderPrint.tsx`'s structure with `PRPrint.tsx`'s simpler footer; follows the same
  logo-preload + `onReady()`-gated `window.print()` pattern as the other print components (see
  DESIGN.md's new "Print page" note).
- `src/pages/ic/ICPoReturnPage.tsx` + `src/pages/ic/components/ICPoReturnModal.tsx` — single-tab
  modal, no print button/flow.
- Sidebar (`SidebarMenu.tsx`): new top-level "Inventory Control" group with 3 children —
  ข้อมูลโครงการสำหรับ IC, PO Receive, PO Return.

**WO (Work Order) payment-conditions redesign.** `WorkOrderCreatePage.tsx` — removed 5 single-value
form fields (`advance_pct`, `advance_amount`, `retention_pct`, `penalty_pct_per_day`,
`progress_payment_note`), replaced by a new repeatable-row section
`src/components/workOrder/WOPaymentConditionsSection.tsx` with 3 sub-blocks: งวดงาน (installments,
each with its own payment status), เงินประกัน (retentions), ค่าปรับ (penalties) — see DESIGN.md's
new "Repeatable-row table with + button" pattern note.
- **Payment-conditions save IS bundled into the main WO save** (confirmed from diff, not a separate
  button): `handleSave` first calls `create`/`update` on the WO itself, then — only once a real
  `wo.id` exists — calls `workOrderService.updatePaymentConditions(...)` as a second sequential API
  call. If that second call fails, the WO record itself has still saved; the user gets a distinct
  error message (`'บันทึกหนังสือสั่งจ้างสำเร็จ แต่บันทึกเงื่อนไขการจ่ายเงินไม่สำเร็จ ...'`) rather than
  a rolled-back/atomic-looking failure. `buildPayload` now explicitly destructures out the 5 removed
  field names before spreading `form.getFieldsValue()` — needed because edit-mode's
  `form.setFieldsValue({ ...wo })` still seeds those stale values into the antd form store even
  though they have no `Form.Item` anymore, so the strip prevents silently resurrecting and
  resubmitting them.
- **🔴 Known gap, still open:** `WorkOrderPrintStandard.tsx` and `WorkOrderDetailPage.tsx` still
  read the 5 removed fields directly off the WO record, not from the new payment-condition tables
  (`GET /work-order/:woId/payment-conditions`). Printed output and the detail view will show stale
  data for any WO edited after this change, until those two files are migrated to the new resource.

**Bug fixes this session:**
- Unit column previously showed `unit_code` instead of `unit_name` — this was a **backend** fix
  (join/select column swapped server-side). Frontend note: `ICPoReceiveModal.tsx`'s items table
  reads whichever value the API puts under the `unit` key (`dataIndex: 'unit'`,
  `src/pages/ic/components/ICPoReceiveModal.tsx:531-534`) — no frontend code change was needed, but
  this means the frontend has no independent verification the backend is sending the display name
  vs the code; if "wrong unit" reports recur, check the API response shape directly rather than
  assuming this file's rendering logic.
- `ICPoReceiveModal.tsx`'s post-submit success modal ("บันทึกข้อมูลเรียบร้อยแล้ว") now has a
  "พิมพ์" button alongside "ปิด" — clicking it sets `printData` from the just-submitted response
  and triggers the same `ICPoReceivePrint` + `onReady()`-gated print flow used elsewhere, instead of
  requiring the user to close the modal and reopen it to print.

## 🧭 Session learnings (2026-09-2X) — IC Project Movement (ตัดเบิก/โอน) built end-to-end [Frontend]

1. **New pages.** Project list → "ตัดเบิก/โอน" button (Action column) → movements list page →
   create header page (project/job_code/doc_type/requested_by/doc_date/remark, 2-column layout per
   the project-edit-page pattern) → detail page (line items table; Preview + เพิ่มรายการ + Submit
   buttons, Submit placed below the table). Submit locks the document (`POSTED`) and disables
   further edits.

2. **"เพิ่มรายการ" modal's MatCode field** uses a PR-style material picker popup (filters:
   Subgroup/MatName/search; single-select, unlike PR's multi-select checkbox picker), scoped to
   `GET .../available-materials` (only items with `qty_on_hand > 0` under the movement's
   `job_code`) — with added CostCode + คงเหลือ columns not present in the original PR picker.

3. 🔴 **Known open item:** this material picker was just built and has NOT been verified working
   end-to-end yet (blocked on backend test data being in the wrong table — see backend CLAUDE.md
   entry, same date).

4. **Fixed (bugs found while testing this feature, unrelated to IC Project Movement itself):**
   `StockTransactionPage.tsx` had 3 pre-existing bugs — silent fallback to mock data on fetch
   error (removed, now shows `message.error`), hardcoded From/To Location dropdown options (now
   fetches `GET /master/locations` — flagged as possibly the wrong master, since no per-warehouse
   zone endpoint exists in the codebase, only a flat location list), and a non-functional date
   range filter (now wired to `date_from`/`date_to` params, matching the
   `GRNHistoryPage`/`WorkOrderListPage`/etc. convention).

5. 🔴 **Unexplained:** console log from `PRItemsTable.tsx` (a PR-page component) observed during a
   movement-page test session — cause not yet investigated.

## 🧭 Session learnings (2026-09-26) — IC Project Movement line-add UX becomes local-only, warehouse-linked projects concept

**"เพิ่มรายการ" on the movement create/edit page no longer calls a save API per line.** Lines are
held in local React state (array, same "Repeatable-row table with + button" pattern as
`WOPaymentConditionsSection.tsx`) with per-row edit (reopens the modal, prefilled) and delete
icons — both local-only, no API calls. The whole batch is submitted only when the user clicks
Submit. **Losing unsaved lines on refresh is expected/accepted, not a bug to fix.**

**"ประเภทเอกสาร" dropdown label change.** TRANSFER option label changed from "โอน" to
"โอนข้ามโครงการ" (ISSUE's "ตัดเบิก" label unchanged).

**Stale-closure bugfix.** Row action icons (edit/delete) and the Submit/เพิ่มรายการ buttons now
correctly grey out/hide when a document's status is `POSTED` — fixed by making `isPosted` a proper
render dependency.

**"คงเหลือวัสดุ" page** (`/ic/projects/:projectCode/stock`) no longer shows a CostName column
(CostCode stays) — for both normal and warehouse-linked projects. Intentional product decision, not
a regression.

**New concept — "warehouse-linked" projects.** A project can be warehouse-linked (backend:
`project.linked_warehouse_code` is set). For such projects, TRANSFER-related pages
(available-materials picker, คงเหลือวัสดุ) source data from the general stock system instead of
`ic_project_cost_item` — backend handles the branching, but frontend should not assume every
project shown in these pages behaves like a normal cost-tracked project. `cost_subgroup_id` may be
0/absent for these rows and `to_cost_subgroup_id` may not be required when the destination is
warehouse-linked (backend relaxed the `NOT NULL` constraint accordingly).

**Files touched this session:** `src/pages/ic/ICProjectMovementListPage.tsx`,
`src/pages/ic/ICProjectMovementPage.tsx` (new, replaces the deleted
`ICProjectMovementCreatePage.tsx`/`ICProjectMovementDetailPage.tsx`),
`src/pages/ic/ICProjectStockPage.tsx` (new), `src/pages/ic/components/ICMovementAddLineModal.tsx`,
`src/pages/ic/components/ICMovementMaterialPickerModal.tsx`, plus related IC/PO-receive component
touch-ups (`ICPoReceivePage.tsx`, `ICPoReceiveModal.tsx`, `ICPoReturnModal.tsx`,
`ICProjectCostTransactionPage.tsx`, `ICProjectListPage.tsx`) and shared table components
(`MaterialPickerModal.tsx`, `POItemsTable.tsx`, `PRItemsTable.tsx`).

## 🧭 Session learnings (2026-09-28) — PR/PO status→history consolidation, price-history modal filters, print label fixes

**1. Resizable columns — no shared component.** Every page that has drag-to-resize columns
copies the same local pattern independently: a `ResizableTitle` component (wraps `react-resizable`'s
`Resizable` + `import 'react-resizable/css/styles.css'`) wired in via
`<Table components={{ header: { cell: ResizableTitle } }}>`, with one `useState`/`onResize` handler
pair per resizable column. Confirmed present on: `POStatusPage.tsx`, `PRStatusPage.tsx`,
`MemoListPage.tsx`, `PRHistoryPage.tsx`, `POHistoryPage.tsx`, and the price-history `Modal` inside
`POItemsTable.tsx`. **There is no shared `ResizableTitle` component to import** — a new page copies
the local pattern rather than extracting one (this has been true across every session that's added
it so far; if it's ever worth extracting, that's a deliberate future refactor, not something to
assume already exists).

**2. Project display rule — confirmed consistent.** On-screen tables and detail sections (Memo, PR,
PO) render the project as `"{project_code} {project_name}"`, single space, no dash:
`MemoListPage.tsx`, `PRHistoryPage.tsx`, `PRStatusPage.tsx`, `POHistoryPage.tsx`, `POStatusPage.tsx`,
`POApprovalDetailPage.tsx`'s detail Descriptions block. Print pages keep the em-dash form
`"{code} — {name}"` — confirmed still true in `MemoPrint.tsx` (built in `MemoDetailPage.tsx`'s
project-label mapping) and unchanged in `PRPrint.tsx`/`PurchaseOrderPrint.tsx`. No page was found
still mixing the two conventions as of this session.

**3. Row tint — actual current rules per page (verified against source, not aspirational):**
- `MemoListPage.tsx`: gray = `PENDING_APPROVAL`, green = `APPROVED`, light red = `REJECTED`, no tint
  for `DRAFT`/`CANCELLED` (Memo's DB enum has no "partial" status). **Note:** the tint keys off
  `status` alone — it does **not** additionally check `linkedPoIds`. If "green only when a PO is
  already linked" is actually wanted, that's still open (see "Requested, not verified" below).
- `PRHistoryPage.tsx`: gray = `STOCK_CHECK`, light red/orange = `PARTIALLY_FILLED`, green =
  `COMPLETED`/`FULFILLED`, no tint for `DRAFT`/`CANCELLED`. No live PR currently has `STOCK_CHECK` or
  `PARTIALLY_FILLED`, so only the green tint is visibly exercised today — the other two are wired
  and correct, just unobserved in real data.
- `POHistoryPage.tsx`: light red/orange = `status_receive === 'PARTIALLY_RECEIVED'`, gray =
  `status === 'PENDING_APPROVAL' || 'PENDING_REAPPROVAL'`, green =
  `status_receive === 'RECEIVED'`, no tint otherwise — first matching rule wins (checked in that
  order).
- **Root-cause lesson (applies to `PRStatusPage.tsx`'s separate `po_conversion_status` tint, not the
  three above):** a tint applied only as an inline `style` on `onRow` (as `MemoListPage`/
  `PRHistoryPage`/`POHistoryPage` all do) is high-enough CSS specificity to just work. But
  `PRStatusPage.tsx`'s conversion-status tint uses `rowClassName` (`.pr-row-fulfilled` /
  `.pr-row-partial`) instead, and antd's own `.ant-table-tbody > tr > td` background rules otherwise
  win and render the row white. The actual fix (see `src/index.css`) is CSS on
  `.ant-table-tbody > tr.pr-row-fulfilled > td` / `.pr-row-partial > td` with `!important`, **plus** an
  explicit `:hover > td` override (also `!important`) — without the hover override, antd's own
  `tr:hover > td` rule wins on specificity and every tinted row flashes to the default hover blue.
  Two different tint mechanisms coexist in this codebase (`onRow` inline style vs. `rowClassName` +
  `!important` CSS) — check which one a given page already uses before adding a new tint to it.

**4. PR/PO status pages retired, consolidated into history pages.** `PRStatusPage.tsx`'s and
`POStatusPage.tsx`'s "จัดการ" actions (ดู detail / แก้ไข / ลบ — though see below, no delete
actually existed to move) were copied onto `PRHistoryPage.tsx`/`POHistoryPage.tsx` as a new resizable
"จัดการ" column, using the identical `PermissionButton`/menu-code gating and visibility conditions.
Both status pages are hidden from the sidebar (a frontend-only filter in `SidebarMenu.tsx` excludes
`MENU_PR_STATUS`/`MENU_PO_STATUS` regardless of the backend's `is_active` flag — sidebar menus are
otherwise 100% backend-driven via `GET /menus`, so there was no other way to hide them without a
backend/DB change). Routes and page files were deliberately **not** deleted. Remaining references to
the retired paths (`/pr/status`, `/po/status`) as of this session:
  - `src/App.tsx` — the routes themselves (kept on purpose)
  - `src/pages/pr/PRDetailPage.tsx` (back button), `src/pages/pr/PRCreatePage.tsx` (post-save/edit
    navigation, 3 call sites), `src/pages/po/POCreatePage.tsx` (post-create navigation)
  - `src/config/routes.ts` — `STATUS` path constants
  - `src/pages/po/POApprovalDetailPage.tsx`, `src/pages/po/components/EditApprovedButton.tsx` — both
    still reference `MENU_PO_STATUS` as a permission code (not navigation)
  These are candidates to repoint to the history pages later — left alone since that wasn't asked
  for yet.
  **Correction from this session:** neither status page actually had a delete action to carry over
  (both only ever had view + edit) — the original consolidation ask assumed one existed. Don't
  invent a delete endpoint/button without a separate explicit decision to add one.

**5. `PRStatusPage.tsx` filters and edit condition.** Confirmed live (not disabled placeholders):
search/status/date-range/job filters are wired to `GET /pr`'s `search`, `status`, `date_from`,
`date_to`, `job_code` params. Edit button condition:
`record.status === 'DRAFT' && !record.hasActivePoLink` (mapped from the API's
`has_active_po_link`) — the same condition is now also used on `PRHistoryPage.tsx`'s new "จัดการ"
column, and both read the same `GET /pr` field so there's no backend gap.

**6. `PRHistoryPage.tsx` columns (current, left-to-right):** เลขที่ PR, Ref. MEMO, โครงการ, Job
(short code only, e.g. "MP" — not the full "CODE - Name" label), ผู้ขอซื้อ, สถานะ, หมายเหตุ,
วันที่สร้าง, จัดการ (added this session) — horizontal scroll, every column resizable. There is no
มูลค่า column. "วันที่อนุมัติ" was deliberately **not** added here — PR has no approval concept at
all (see the 2026-07 session note above: PR flow is `DRAFT → COMPLETED` directly, no approve/reject
endpoints exist).

**7. `POHistoryPage.tsx` / `POStatusPage.tsx` columns.** Both now show เลข PR (from the `pr_nos`
array, joined with `, `) and หมายเหตุ PO. `POHistoryPage.tsx` additionally has วันที่เปิด PO
(`po_date`), วันที่อนุมัติ PO (`approved_at`, date+time, "—" when null), กำหนดส่งของ
(`expected_date`), ผู้อนุมัติ (`approved_by_name`, "—" when null) — all four resizable, added this
session once the backend confirmed these fields on `GET /po`. Both pages' Job column reads
`job_code` (`job_names` is dead — never populated by the backend, see the 2026-08-07 note above).
**Money-format inconsistency found, not yet fixed:** `POHistoryPage.tsx`'s "มูลค่า (หลังหักส่วนลด)"
and `POApprovalDetailPage.tsx`'s equivalent both force 2 decimals
(`minimumFractionDigits: 2, maximumFractionDigits: 2`) + "บาท", but `POStatusPage.tsx`'s "มูลค่าก่อน
VAT" column calls plain `.toLocaleString('th-TH')` with no fraction-digit options, so it can render
with 0–3 decimals depending on the value. Not touched this session since `POStatusPage.tsx` is being
retired — flagging so it isn't assumed fixed everywhere.

**8. `POApprovalDetailPage.tsx` (`/po/approval/:id`) head/items restructuring — confirmed
implemented**, not just requested: the head `Descriptions` block is exactly 5 rows
(โครงการ/Job/ประเภทการซื้อ; ชื่อบริษัท/เงื่อนไข; ผู้รับของ/เบอร์โทร/สถานที่ส่ง;
วันที่ส่ง/มูลค่าหักส่วนลดก่อนหักภาษี; — remarks live in the header's own remarks field, not this
grid); the items table has no Brand or status column (`ลำดับ, Cost Code, รหัสวัสดุ, ชื่อวัสดุ,
จำนวนสั่ง, ราคา/หน่วย, มูลค่า, หมายเหตุ` only), quantity renders with its unit
(`qty_ordered` + `unit_name`), and both price/value columns are 2-decimal + "บาท".

**9. Price-history modal (`POItemsTable.tsx`) — confirmed implemented end-to-end.** Title
"ราคาที่เคยซื้อล่าสุด"; endpoint `GET /master/materials/:code/price-history` with `page`, `limit`,
`date_from`, `date_to` (both dates optional/combinable, confirmed live on the backend — see
`internal/handlers/master.go` `GetMaterialPriceHistory` in the `erp-api` repo: uses the
`AND ($n::date IS NULL OR ...)` pattern on both the row query and its `COUNT(*)`, so `total`/
`total_pages` already reflect the filtered set). Columns: รหัสวัสดุ (`mat_code`), รายการ (`mat_name`
+ `spec_name` joined by a single space on one line, no separator when `spec_name` is empty — same
convention as `PRPrint.tsx`'s `ItemRow`), ร้านค้า, วันที่, ราคา/หน่วย. Modal widened 20% (880→1056,
capped at `maxWidth: '95vw'`), all 5 columns scaled 20% too, all still resizable. Date-range filter
added above the table (`DatePicker.RangePicker` + 3/6/12-month `presets`), resets to page 1 and
clears on a different `matCode`, distinct empty-state text when a range is active. **`mat_code`/
`spec_name` are confirmed actually rendered**, not just requested — verified by reading the backend
SQL directly (`SELECT pol.mat_code, ..., ss.spec_description AS spec_name ...`, `mat_code` marshalled
without `omitempty` so it's always present and is literally the endpoint's own filter value, so it
can't come back empty for a real row).

**10. Print pages — label/layout state as of this session:**
  - `MemoPrint.tsx`: info-box field order is โครงการ (code + full name, em-dash), เรื่อง (title),
    สถานที่ส่งของ, หน่วยงาน (dept, full name), หมายเหตุ (label is just "หมายเหตุ", not
    "หมายเหตุ / Remark"), กำหนดส่งของหน้างาน. Requester (`ผู้ขอ / Requester`) now has its own
    signature box next to Approver (`AUTH_COLS`), not a plain text line in the info box. "No" →
    "ลำดับ". Per-line remarks render under the item row itself (`ItemRow`'s `row.remark`), not as a
    separate table column.
  - `PRPrint.tsx`: Thai labels โครงการ/วันที่/กำหนดส่งของ/สถานที่ส่งของ/หมายเหตุ; header "ลำดับ";
    item column "รายการ" renders ItemName + SpecName on one line via `cleanItemName()` (strips a
    legacy literal `"--"` divider some old rows still carry, replacing it with a single space) +
    `` `${desc}${spec ? ' ' + spec : ''}` ``; the PR number itself renders at 15pt vs. its "PR No :"
    label's 10pt (visibly bigger).
  - `PurchaseOrderPrint.tsx`: labels changed this session — "พนักงานขาย" → "Contact :", "เบอร์ติดต่อ"
    → "Tel." (was "เบอร์ติดต่อ :"), "Po No" → "PO No" (casing fix; the on-page text has always been
    "Po No :" with a colon, not "Po No." with a period — fixed the casing only, didn't add a period
    that was never there).
  - All of the above keep the shared logo-preload + `onReady()`-gated `window.print()` pattern —
    untouched.

**11. Other confirmed UI state:** `PRCreatePage.tsx`'s action bar is one merged row — พิมพ์ +
กลับหน้าหลัก on the left, บันทึกร่าง + ส่งใบขอซื้อ on the right (previously two separate rows).
`MemoListPage.tsx` has no "สร้างใบบันทึกขอซื้อ" create button (confirmed absent — create lives
elsewhere in the Memo menu group, see `menuSlice.ts`'s `memo-create` entry). `MemoListPage.tsx`'s
columns are all resizable, and its "สถานะ" column was replaced by "วันที่อนุมัติ"
(`approvedAt`, date+time, "—" when null) this session — **confirmed done**, not just requested;
`status` itself stays on the row interface purely to drive the row tint in #3 above.

**12. `api.ts` error sanitizer.** `src/services/api.ts`'s response interceptor
(`sanitizeDbError`/`looksLikeRawDbError`, ~line 32-52) replaces any `response.data.message` or
`.error` that looks like a raw Postgres/pgx error (matches `SQLSTATE|violates|foreign key
constraint|duplicate key|null value in column|pq:`) with the generic
`"ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง"` before any page's catch block ever sees it. **When
this generic message shows up anywhere, that's a signal to check the actual backend response
first** — it usually means a raw SQL error leaked through unwrapped, not that the frontend
validation itself is at fault.

**13. Infra note (not a code issue).** `erp-frontend`'s container has previously crash-looped from
an nginx config error ("unknown directive ssl" at `/etc/nginx/conf.d/default.conf:9`) — unrelated to
the React code itself. When debugging a crash-looping frontend container, get the real container
name from `docker ps` first (it's `erp-frontend`) rather than trusting a truncated `docker ps` column
that might suggest a different name.

**Requested, not verified — do not treat as done:**
- MemoListPage's green tint checking `linkedPoIds` (non-empty) in addition to `status === 'APPROVED'`
  — the actual code only checks `status`.
- `POStatusPage.tsx`'s money column forcing 2 decimals — it doesn't (`POHistoryPage.tsx` and
  `POApprovalDetailPage.tsx` do). Not fixed this session since the page is being retired.

## 🧭 Session learnings (2026-10-01) — new OH order types on PR/PO [Frontend]

- `order_type` now = `stock | cost | asset_equipment | office_equipment | asset_tool`
  (labels "Asset Equipment" / "Office Equipment" / "Asset Tool"). Single source:
  `src/constants/orderTypes.ts` (`ORDER_TYPE_LABEL/OPTIONS`, `isOhOrderType`, `OH_JOB_CODE`).
- The 3 new types: `job_code` auto-set to `G` (General Code; 'OH' is not a valid DB value) + read-only, project optional, cost code required on
  every line and loaded **only** from `GET /master/cost-code/full?scope=oh` (rows `{subgroup_id, subgroup_code,
  subgroup_name, cost_code, ...}` — `subgroup_id` is the `cost_subgroup_id`; NOT `id` (earlier note was wrong);
  same key as the unscoped list). Enabled via `CostCodeSelectionModal`'s `ohOnly` prop (passed by `PRItemsTable` /
  `POItemsTable`). Existing PR lines stay cost-code-editable for these types.
- Switching across the OH boundary (OH ↔ stock/cost) with cost codes already on lines →
  `OrderTypeSelect` confirm dialog, then all cost codes cleared. stock↔cost switching is unchanged.
- PO from PR: order_type was already locked to the PR's; unchanged.
- Hidden for the 3 types: `status_receive` badge (`POStatusBadges` takes `orderType`). **No** "send to
  supplier" button or receive-related link exists in the frontend today (no `/po/:id/send` call), so
  nothing to hide there — `POCreatePage`'s "ส่งใบสั่งซื้อ" is submit-for-approval, not send. If a
  send-to-supplier button is added later, gate it with `!isOhOrderType(order_type)`.
- Lists: `PRHistoryPage`/`POHistoryPage` have an order-type column + filter (`?order_type=`).
  `PRStatusPage`/`POStatusPage` (retired) got no column/filter. PO create's PR sidebar shows each
  PR's type tag. IC pages untouched and don't reference the new types.

## 🧭 Session learnings (2026-10-19) — Group Cost Code Major block, project job shares, Memo job, Work Order form rework [Frontend]

> Everything below was checked by reading the working tree (uncommitted changes at the time of
> writing). **All of it is typechecked/read-only verified, NOT verified in the browser.** Backend
> contracts for job shares, memo job and the Work Order changes are **NOT verified with real
> requests** — treat any "backend returns X" below as the contract the frontend was written
> against, not as observed behavior.

**Repo name.** The repo/package is `erp-frontend` (`package.json` `name`), not `erp-web`. (The H1 of
this file said `erp-web` before this session; fixed.)

**Master > Group Cost Code (`src/pages/master/CostCodeJobTypeModal.tsx`).**
- Subgroups are loaded with `include_head=true` (admin page only; pickers never pass it), so Major and
  Head rows are returned here but stay hidden from PR/PO pickers. `is_major` is read alongside `is_head`.
- **Major** (group `00` / subgroup `000`, one per job) renders as a separate block above the table
  (purple "Major" tag + code + name), never as a table row; group `00` stays in the table only if it also
  has non-Major subgroups. Group `00` subgroups are fetched eagerly in `fetchGroups` for this block.
- Head rows sort before normal rows (`sortSubgroups`, stable) and keep the light-blue row tint.
- The only switch left is the **Head** switch (`HeadSwitchField`); there is no Major switch — Major is
  display-only.
- The Major full code is **composed on the client**: `activeSubjectCode + jobType.filterJobCode +
  group_code + subgroup_code`. The OH display rule (`G00000`) is **NOT applied** — no `G00000` handling
  exists anywhere in `src/`. Backend contract: `GET /master/cost-code/subgroups?group_id=&include_head=true`
  returning `is_head`/`is_major`; not verified with real requests.

**Project form "ประเภทงาน" (`src/pages/master/ProjectCreateEditPage.tsx`) — implemented.** Repeatable-row
table (job select + % + derived amount + delete, "เพิ่มประเภทงาน" button; same pattern as
`WOPaymentConditionsSection`). Options come from `GET /master/job-types` (`job_code, job_name,
needs_share`); duplicates are disabled in the select. The `%` input and amount column appear only for jobs
where the API says `needs_share === true` (nothing hardcoded). Total share of needs-share rows must be
`<= 100` (red total, blocks save); every needs-share row needs a `%`. Amount = `budget_amount * % / 100`
(budget treated as 0 when `project_kind === 'VO'`). Payload: `job_codes` = **full list** of selected jobs;
`job_shares` = `[{job_code, share_percent, share_amount}]` for needs-share jobs only. Edit mode rebuilds
rows from `job_codes` and fills `%` from `job_shares` (a legacy project without shares loads with `%`
empty and must be filled before saving). Backend (`job_shares` on `/master/projects`) not verified.

**Memo job (`MemoCreateEditPage.tsx`, `MemoDetailPage.tsx`, `MemoListPage.tsx`, `MemoPrint.tsx`) —
implemented.** Required "ประเภทงาน (Job)" select, disabled until a project is chosen, options = that
project's `job_codes` (from `GET /master/projects`) labelled with names from `GET /master/job-types`;
changing the project clears the job. Sent as `job_code` on save; loaded from `job_code`/`jobCode`.
Detail page shows `"{code} {name}"`; list page has a "Job" column showing the raw code only (resizable
like the others); print shows `ประเภทงาน (Job) : {code} — {name}` only when set (old memos have none, so
the line is omitted). The `Memo` type (`src/types/index.ts`) gained `jobCode`. Backend `memo.job_code`
persistence not verified.

**Work Order form (`WorkOrderCreatePage.tsx`, `types/workOrder.ts`, `WOItemsTable.tsx`,
`WOPaymentConditionsSection.tsx`) — implemented in code.**
- Section titles are numbered: 1 เจ้าของโครงการ (ผู้ว่าจ้าง), 2 ผู้รับจ้าง/ผู้ให้เช่า, 3 สัญญาประเภท,
  4 งานระบบ, 5 ลักษณะของสัญญา, 6 มูลค่าสัญญา (ไม่รวม VAT), **7 เงื่อนไขการจ่ายเงิน**, 8 ระยะเวลาสัญญา,
  9 อ้างอิงสัญญา, 10 เงื่อนไขอื่นๆ.
- **Owner** is a dropdown *before* the project and offers the head office only
  (`EMPLOYER_HEAD_OFFICE`), sent as `employer_name`; an old document's stored employer is kept as an extra
  option. It no longer auto-fills from the project.
- **Project** select (`project_choice`, form-only) accepts an existing project or typed free text
  (`__text__:` prefix). `resolveProject` sends **either** `project_code` **or** `project_name_text`,
  never both (the other is explicitly cleared). Warehouse projects are excluded via
  `src/constants/warehouseProjects.ts` (`WAREHOUSE_PROJECT_CODES`, a hardcoded 4-code list — **TODO:
  replace with a backend flag**; `PRCreatePage`/`POCreatePage` still keep their own copies). A warehouse
  project already on an old document stays selectable. `formatWOProject` renders the project in
  detail/print.
- **Contract types**: `LABOR_MATERIAL`, `LABOR_ONLY`, `RENTAL`, `SERVICE`, in one shared map
  (`WO_CONTRACT_TYPE_OPTIONS` / `WO_CONTRACT_TYPE_LABEL`) used by the form, the detail page and
  `WorkOrderPrintStandard.tsx` (its old local label map was removed).
- **Work system** (งานระบบ) is a multi-select of `M*` job codes from `GET /master/job-types`
  (`useJobTypes` in `src/hooks/useJobTypeNames.ts`, cached per page load). Legacy P/E/S values stay as
  "(ค่าเดิม)" options. `work_system` is an array on the API; the old scalar lookup produced array-index
  garbage — fixed via `formatWorkSystem(v, names)` (`"CODE - name"`, joined with `, `), used in the
  detail page and `WorkOrderPrintStandard.tsx`.
- **Contract description** is now a free-text `Input.TextArea` (max 2000); old dropdown codes are mapped
  to their Thai text on load via `WO_CONTRACT_DESCRIPTION_LABEL`.
- **WHT defaults**: `GET /work-order/wht-defaults` → `contract_types[{contract_type, default_wht_rate}]`.
  Line rates the user never touched follow the default for the current `contract_type`
  (`defaultWhtRate`, falling back to 3 if the call fails or hasn't loaded); a line with an explicit
  `wht_rate` (user-picked or saved) is never overwritten. The line Select offers 1 / 3 / 5. The header
  `wht_rate` follows the default only while untouched (`isFieldTouched`) and not in edit mode.
- **Signer** stays `contact_person` (label "ผู้ลงนาม"), prefilled from the supplier's `sales_person` only
  when empty or still holding the page's own previous auto-fill. `subcontractor_signed_name` does not
  exist in the frontend.
- **Section 7**: **7.1 เงินล่วงหน้า** — the existing `advance_deduct_pct` field moved into the card as a
  Select of 5/10/15/20/30 % (a stored value outside the list, e.g. 50, stays selectable) plus a read-only
  amount `= contract_amount * % / 100` (display only, not sent). **7.2 เงินงวดสัญญา** — the existing
  installments table, relabelled. **7.3 เงินประกัน** — `%` is a Select of 5/10 (stored other values, e.g.
  7, stay shown and untouched) and `amount` is read-only `= contract_amount * % / 100`, recomputed when
  the contract value changes (saved rows are not rewritten on edit-mode load). **The contract-value base
  is `contract_amount`** (มูลค่าสัญญาไม่รวม VAT).
- Backend (`/work-order/wht-defaults`, `project_name_text`, array `work_system`, the new contract types,
  payment-conditions save) **not verified with real requests**. The WO save error toast now also falls
  back to `response.data.error`. `WorkOrderPrintView.tsx` also has uncommitted changes that were not
  reviewed for this note.

**Known open items (WO).**
- Header **VAT rate** (`vat_rate`, `InputNumber` 0–100) is saved but **not used**: VAT is a hardcoded 7%
  in `WOItemsTable.tsx` (`* 0.07`, 3 places) and `WorkOrderDetailPage.tsx` (`* 0.07`).
- Header **WHT** (`wht_rate`) is still a free `InputNumber` 0–100, **not** a Select of 1/3/5 (only the
  line-level control is a Select).
- `WorkOrderDetailPage.tsx` and `WorkOrderPrintStandard.tsx` still read the old
  `advance_pct`/`advance_amount`/`retention_pct` fields (the print uses its own 7.1/7.3/7.4 numbering),
  not the new 7.1 `advance_deduct_pct` / 7.3 retention rows. Same gap as the 2026-09-21 note.

**Lessons.**
- `api.ts`'s error sanitizer replaces anything that looks like a raw DB error with the generic
  "ข้อมูลที่กรอกไม่ถูกต้อง…" message, which can hide the real backend message. When it shows up, **check
  the Network tab response first**; don't assume the frontend validation is wrong.
- Don't hardcode business rules the backend exposes through an endpoint (job `needs_share` from
  `/master/job-types`, WHT defaults from `/work-order/wht-defaults`). The remaining violation is the
  warehouse-project code list (TODO above).

## 🧭 Session learnings (2026-10-25) — WO form 7.5 / 8.1 / 8.2, new submenu + page "บันทึกงานของผู้รับเหมาตามใบสั่งจ้าง" [Frontend]

> Verified: `tsc --noEmit` ไม่มี error ในไฟล์ที่แตะ. **ไม่ได้เปิดเบราว์เซอร์ / ไม่ได้ยิง API จริง** — ทุกอย่างด้านล่างเขียนตามสเก็ตช์มือที่ผู้ใช้ให้
> (ลายมืออ่านยากบางจุด ดู "ที่เดา" ท้ายหัวข้อ). Backend/SQL ดู `erp-api` `CLAUDE.md` หัวข้อ session 2026-10-25 (migrations 017–021).

**WO create form (`WorkOrderCreatePage.tsx`, `WOPaymentConditionsSection.tsx`)**
- หัวข้อ 8 มี sub-block 2 อัน (สไตล์เดียวกับ 7.x — `subCardStyle`: radius 10, border `#e5e7eb`, ไม่มีเงา, ซ้ำกับค่าในไฟล์ section เพราะไม่มี shared): **8.1 เบี้ยปรับ** =
  Radio มี/ไม่มี (`has_penalty`, ข้อความ "ปรับวันละ 1.00% ของมูลค่างาน" คงที่ ไม่ส่งอัตรา) และ **8.2 ประกันผลงาน 1 ปี** = TextArea (`warranty_note`, max 2000).
  ช่อง "ระยะเวลารับประกัน (ปี)" (`warranty_years`) เอาออกจากฟอร์ม. `WorkOrderDetailPage.tsx` / `WorkOrderPrintStandard.tsx` อ่านค่าใหม่แล้ว (8.1/8.2); `WorkOrderPrintView.tsx` ไม่ได้ตรวจ.
- **7.5 เงื่อนไขการจ่ายเงิน (อื่นๆ)** = ช่อง `other_deduction_note` ถูกย้ายเข้าการ์ดหัวข้อ 7 ผ่าน prop `otherSlot` ของ `WOPaymentConditionsSection` (เดิมเป็นการ์ดแยกนอกหัวข้อ 7).
- บล็อก **"ค่าปรับ" ถูกซ่อนจาก UI หัวข้อ 7** (ตามสั่ง "เอาออกก่อน") แต่ state/props (`penalties`, `onPenaltiesChange`) และการโหลด/บันทึก
  `payment-conditions` ยังอยู่ — WO เก่าที่มีรายการค่าปรับจะส่งค่าเดิมกลับตอน save (ไม่หาย แต่แก้จากหน้านี้ไม่ได้). ถ้าจะลบจริงต้องลบ state + save wiring ด้วย.

**เมนู + route**: เมนู `MENU_WO_CONTRACTOR_LOG` อยู่ใต้ `MENU_PO` ("PO/WO"), ลำดับ 9 ก่อน Budget Cost (เมนู sidebar มาจาก backend `GET /menus` ล้วน; ต้อง grant สิทธิ์ใน permission matrix ก่อนถึงจะเห็น).
Routes ใน `App.tsx`: `/work-order/contractor-log` (สร้างใหม่) และ `/work-order/contractor-log/:id` (แก้ไข) — ทั้งคู่ `RequirePermission menuCode="MENU_WO_CONTRACTOR_LOG" action="read"`
(ใช้ `read` เพื่อให้ผู้ที่เห็นเมนูเข้าได้; ยังไม่แยก write/edit เหมือน PO create). icon map ใน `SidebarMenu.tsx`.

**หน้า `WorkOrderContractorLogPage.tsx`** (2 tab; PageHeader "บันทึกงานของผู้รับเหมาตามใบสั่งจ้าง")
- **Tab 1 ข้อมูลเอกสาร**: เลือก WO (Select ค้นหา remote `GET /work-order?status=APPROVED&search=`, เฉพาะ WO ที่อนุมัติแล้ว; ตอนแก้ไขจะ merge WO เดิมเข้า option แม้ไม่ APPROVED แล้ว) →
  ผู้รับจ้าง / โครงการ-แผนก / ลักษณะสัญญา เติมอัตโนมัติ (read-only, ไม่เก็บใน DB) → ตาราง Contract/Advance/Retention (กรอกเองทุกช่อง; Contract เติม 100% + `contract_amount` ของ WO ตอนเลือก WO)
  → ช่อง PJ (เลือกโครงการ, `useProjectOptions`). ปุ่ม "ประเภทวางบิล" = สลับไป tab 2. ปุ่ม "บันทึก" (ที่ footer เฉพาะ tab 1; สเก็ตช์ไม่มี) → `POST/PUT /wo-contractor-log`,
  บันทึกครั้งแรกแล้ว `navigate` ไป `/…/:id` (replace). ยังไม่มีหน้า list — เข้าเรื่องที่บันทึกไว้ได้ด้วย URL ที่มี id เท่านั้น.
- **Tab 2 ประเภทรับวางบิล** = component `src/components/workOrder/WOContractorBillTab.tsx` (ต้องบันทึก tab 1 ก่อน ไม่งั้นแสดง Alert): ตารางรายการ bill ของเอกสารนี้ (คลิกแถวเพื่อแก้, "สร้างรายการใหม่"),
  ฟอร์ม (ประเภทรับวางบิล ADV/Progress/Retention, งวดที่, AP Voucher No.* [พื้นเหลือง], PAY TO, Credit Term [AUTO จาก `supplier.payment_terms`], รายละเอียด),
  ตาราง invoice (เพิ่ม/ลบแถว: ใบกำกับภาษี/INVOICE NO., INVOICE DATE, วันที่ส่งมอบงาน, วันที่วางบิล, วันที่จ่าย), ตาราง "สรุปรายการเบิก" 7 บรรทัด + รวมเป็นเงิน (1) + จ่ายสุทธิ,
  ปุ่ม DRAFT / SAVE (บันทึก `status` DRAFT|SAVED) / PRINT (disabled — ยังไม่มี layout). บรรทัด "เงินงวดนี้" (Progress) เลือกงวดจาก `GET /work-order/:woId/payment-conditions` → เติมยอดงวดนั้น.
  สูตรอยู่ในตัว component (`calc` useMemo) และ backend คำนวณ `subtotal`/`net_amount` ซ้ำเองทุกครั้ง (ค่าที่ client ส่งสองตัวนั้นถูกเมิน).
- **ที่เดาจากสเก็ตช์ (ขอให้ผู้ใช้ยืนยัน)**: ป้ายคอลัมน์ "วันที่ส่งมอบงาน"; ฐานคำนวณ (หัก ADV/Retention คิดจากยอดก่อนหัก, VAT/WHT คิดหลังหักเงินล่วงหน้า — เช็คตรงกับตัวเลขตัวอย่าง 4,430,000);
  ชนิดหัก ณ ที่จ่าย (ค่าจ้างรับเหมา 3%, ค่าบริการ 3%, ค่าเช่า 5%, ค่าขนส่ง 1%); ช่อง "3/5/1" ข้างบรรทัด 5 ในสเก็ตช์ (ไม่ได้ทำเป็นอะไร ใช้ช่อง % กรอกเอง); "ปรับ PAGE (A)" ที่มุมล่างสเก็ตช์ (ไม่ได้ทำ);
  bill แบบ Retention ใช้ฟอร์มเดียวกับ Progress โดยกรอกยอด "เงินงวดนี้" เอง. สถานะ SAVED ยังไม่ล็อกการแก้ไข. AP Voucher No. ยังไม่จำกัดสิทธิ์เฉพาะฝ่ายบัญชี.
- **Gotcha**: `Tabs` ของ antd ไม่ unmount tab ที่เปิดไปแล้ว — bill ใหม่ที่ยังไม่บันทึกจะถูกรีเซ็ตเป็นค่า default ถ้าแก้ค่า default จาก tab 1 (Advance/Retention %) ระหว่างนั้น (`newForm` เปลี่ยน → effect `setF(newForm())`).

## Known issues / TODO
- [ ] ยืนยัน tech stack จริง (Vite? CRA? Next.js?) แล้วอัปเดตหัวข้อ Tech stack ด้านบน
- [ ] เพิ่มหน้าจอ + API integration สำหรับ RFQ, Borrow/Return, Stock Count, Memo (backend table พร้อมแล้ว)
- [ ] คุยกับทีม backend เรื่อง permission tree structure (`/auth/me` response) ก่อนทำ dynamic sidebar menu
- [ ] เช็ค field การเงินใหม่ของ PO (discount/vat/wht) ในฟอร์มสร้าง/แก้ PO ว่ามีอยู่แล้วหรือยัง
- [ ] เช็คว่า field ที่เคยได้จาก DB view (`v_pr_full` ฯลฯ) ยังมาจาก API เหมือนเดิมไหม หลัง view หายจาก DB
- [ ] **หน้า "รับเข้า" (GRN)**: รอ backend ทำ endpoint search PO ก่อน แล้วค่อยต่อ UI ตาม logic ด้านบน