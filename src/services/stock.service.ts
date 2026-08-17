import axios from 'axios'
import type { StockItem, StockCategory, StockImportResult, StockLookupResult } from '@/types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

// Assumed until backend confirms: multipart field name for the import file.
// One-line fix here if the real handler expects a different field.
const IMPORT_FILE_FIELD = 'file'

const useMock = !BASE_URL

const mockCategories: StockCategory[] = [
  { id: '1', code: 'CAT001', name: 'วัสดุก่อสร้าง', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: '2', code: 'CAT002', name: 'เครื่องมือ', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
]

const mockItems: StockItem[] = [
  {
    id: '1', matCode: 'MAT001', itemName: 'เหล็กแผ่น SS400', categoryId: '1', categoryName: 'วัสดุก่อสร้าง',
    itemType: 'CONSUMABLE', trackingType: 'sku', unit: 'แผ่น', unitCost: 450, qty: 10,
    isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '2', matCode: 'MAT010', itemName: 'สว่านไฟฟ้า', categoryId: '2', categoryName: 'เครื่องมือ',
    itemType: 'RETURNABLE', trackingType: 'serial', unit: 'เครื่อง', unitCost: 2500, qty: 1,
    isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
]

// Normalization isolated here — one-line fix if the backend responds with
// camelCase instead of snake_case, since every caller goes through this.
const normalizeCategory = (r: any): StockCategory => ({
  id: String(r.id),
  code: r.code,
  name: r.name,
  description: r.description ?? undefined,
  isActive: r.is_active ?? r.isActive,
  createdAt: r.created_at ?? r.createdAt,
})

const normalizeItem = (r: any): StockItem => ({
  id: String(r.id),
  matCode: r.mat_code ?? r.matCode,
  itemName: r.item_name ?? r.itemName,
  description: r.description ?? undefined,
  // `category_id`/`category_name` are legitimately `null` for uncategorized items — a
  // plain `??` chain to the (nonexistent) camelCase candidate would treat that real `null`
  // as "field missing" and fall through to `undefined`. Worse, wrapping the whole chain in
  // String(...) turned that `undefined` into the literal string "undefined", which then
  // failed to match any Select option and rendered as raw text. Read the snake_case key on
  // its own merits — null/absent both become `undefined`, but a present value (including a
  // valid 0/falsy id) is never discarded.
  categoryId: r.category_id != null ? String(r.category_id) : undefined,
  categoryName: r.category_name ?? undefined,
  itemType: r.item_type ?? r.itemType,
  trackingType: r.tracking_type ?? r.trackingType,
  unit: r.unit,
  unitCost: Number(r.unit_cost ?? r.unitCost ?? 0),
  qty: Number(r.qty ?? r.min_qty ?? r.minQty ?? 0),
  qrCode: r.qr_code ?? r.qrCode ?? undefined,
  isActive: r.is_active ?? r.isActive,
  createdAt: r.created_at ?? r.createdAt,
  updatedAt: r.updated_at ?? r.updatedAt,
})

// Mirror of normalizeItem for the request direction — confirmed against the create
// endpoint (previously the only caller); reused by updateItem so both go through one
// place instead of duplicating the mapping and risking them drifting apart.
const toItemBody = (payload: CreateStockItemPayload) => ({
  mat_code: payload.matCode,
  item_name: payload.itemName,
  ...(payload.description ? { description: payload.description } : {}),
  category_id: payload.categoryId,
  item_type: payload.itemType,
  tracking_type: payload.trackingType,
  unit: payload.unit,
  unit_cost: payload.unitCost,
  qty: payload.qty,
})

// Backend errors are plain strings like "row 5: item_name is required" — parse
// out the leading "row N:" prefix when present, otherwise fall back to row 0.
const ROW_PREFIX = /^row (\d+):\s*/i

const parseImportError = (e: any): { row: number; message: string } => {
  const s = typeof e === 'string' ? e : (e?.message ?? e?.error ?? String(e))
  const match = s.match(ROW_PREFIX)
  return match
    ? { row: Number(match[1]), message: s.slice(match[0].length) }
    : { row: 0, message: s }
}

const normalizeImportResult = (r: any): StockImportResult => {
  const errors = Array.isArray(r.errors) ? r.errors.map(parseImportError) : []
  return {
    successCount: Number(r.imported ?? 0),
    failedCount: errors.length,
    errors,
  }
}

export interface ListStockItemsParams {
  search?: string
  categoryId?: string
  page?: number
  pageSize?: number
}

export interface ListStockItemsResult {
  items: StockItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Backend wraps list responses in a pagination envelope: { data: { data: [...], total, page, page_size, total_pages }, success }
// Unwraps to the inner array; falls back to a bare array response for endpoints that aren't paginated.
const unwrapListEnvelope = (resData: any): any[] => {
  if (Array.isArray(resData)) return resData
  const payload = resData?.data
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

const unwrapPaginationMeta = (resData: any, fallbackPage: number, fallbackPageSize: number) => {
  const payload = resData?.data
  const total = Number(payload?.total ?? unwrapListEnvelope(resData).length)
  const page = Number(payload?.page ?? fallbackPage)
  const pageSize = Number(payload?.page_size ?? fallbackPageSize)
  const totalPages = Number(payload?.total_pages ?? Math.max(1, Math.ceil(total / pageSize)))
  return { total, page, pageSize, totalPages }
}

export interface BulkPreviewMaster {
  mat_code: string | null
  group_name: string | null
  subgroup_name: string | null
  mat_name: string | null
  spec_description: string | null
  brand_name: string | null
  unit_name: string | null
}

export interface BulkPreviewRow {
  row_no: number
  mat_code: string
  file_name: string
  code_found: boolean
  master: BulkPreviewMaster | null
  name_matched: boolean
  status: 'ok' | 'code_not_found' | 'name_mismatch'
}

export interface BulkPreviewSummary {
  total: number
  ok: number
  code_not_found: number
  name_mismatch: number
}

export interface BulkPreviewResult {
  rows: BulkPreviewRow[]
  summary: BulkPreviewSummary
}

export interface CreateStockItemPayload {
  matCode: string
  itemName: string
  description?: string
  categoryId: string
  itemType: StockItem['itemType']
  trackingType: StockItem['trackingType']
  unit: string
  unitCost: number
  qty: number
}

let mockIdSeq = mockItems.length

export const stockService = {
  listCategories: async (token: string): Promise<StockCategory[]> => {
    if (useMock) return [...mockCategories]
    const res = await axios.get(`${BASE_URL}/stock/categories`, { headers: authHeader(token) })
    return unwrapListEnvelope(res.data).map(normalizeCategory)
  },

  listItems: async (token: string, params: ListStockItemsParams): Promise<ListStockItemsResult> => {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20
    if (useMock) {
      const filtered = mockItems.filter((i) => {
        if (params.categoryId && i.categoryId !== params.categoryId) return false
        if (params.search) {
          const s = params.search.toLowerCase()
          if (!i.matCode.toLowerCase().includes(s) && !i.itemName.toLowerCase().includes(s)) return false
        }
        return true
      })
      const start = (page - 1) * pageSize
      return {
        items: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      }
    }
    const res = await axios.get(`${BASE_URL}/stock/items`, {
      headers: authHeader(token),
      params: {
        search: params.search || undefined,
        category_id: params.categoryId || undefined,
        page,
        page_size: pageSize,
      },
    })
    const meta = unwrapPaginationMeta(res.data, page, pageSize)
    return { items: unwrapListEnvelope(res.data).map(normalizeItem), ...meta }
  },

  createItem: async (token: string, payload: CreateStockItemPayload): Promise<StockItem> => {
    if (useMock) {
      const category = mockCategories.find((c) => c.id === payload.categoryId)
      const item: StockItem = {
        id: String(++mockIdSeq),
        matCode: payload.matCode,
        itemName: payload.itemName,
        description: payload.description,
        categoryId: payload.categoryId,
        categoryName: category?.name,
        itemType: payload.itemType,
        trackingType: payload.trackingType,
        unit: payload.unit,
        unitCost: payload.unitCost,
        qty: payload.qty,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockItems.push(item)
      return item
    }
    const res = await axios.post(`${BASE_URL}/stock/items`, toItemBody(payload), { headers: authHeader(token) })
    const r = res.data?.data ?? res.data
    return normalizeItem(r)
  },

  getItem: async (token: string, id: string | number): Promise<StockItem> => {
    if (useMock) {
      const item = mockItems.find((i) => i.id === String(id))
      if (!item) throw new Error('Item not found')
      return item
    }
    const res = await axios.get(`${BASE_URL}/stock/items/${id}`, { headers: authHeader(token) })
    return normalizeItem(res.data?.data ?? res.data)
  },

  updateItem: async (token: string, id: string | number, payload: CreateStockItemPayload): Promise<StockItem> => {
    if (useMock) {
      const idx = mockItems.findIndex((i) => i.id === String(id))
      if (idx === -1) throw new Error('Item not found')
      const category = mockCategories.find((c) => c.id === payload.categoryId)
      mockItems[idx] = {
        ...mockItems[idx],
        matCode: payload.matCode,
        itemName: payload.itemName,
        description: payload.description,
        categoryId: payload.categoryId,
        categoryName: category?.name,
        itemType: payload.itemType,
        trackingType: payload.trackingType,
        unit: payload.unit,
        unitCost: payload.unitCost,
        qty: payload.qty,
        updatedAt: new Date().toISOString(),
      }
      return mockItems[idx]
    }
    const res = await axios.put(`${BASE_URL}/stock/items/${id}`, toItemBody(payload), { headers: authHeader(token) })
    return normalizeItem(res.data?.data ?? res.data)
  },

  previewImport: async (token: string, file: File): Promise<BulkPreviewResult> => {
    if (useMock) {
      return { rows: [], summary: { total: 0, ok: 0, code_not_found: 0, name_mismatch: 0 } }
    }
    const formData = new FormData()
    formData.append(IMPORT_FILE_FIELD, file)
    const res = await axios.post(`${BASE_URL}/stock/items/bulk/preview`, formData, {
      headers: { ...authHeader(token), 'Content-Type': 'multipart/form-data' },
    })
    const r = res.data?.data ?? res.data
    return {
      rows: Array.isArray(r?.rows) ? r.rows : [],
      summary: r?.summary ?? { total: 0, ok: 0, code_not_found: 0, name_mismatch: 0 },
    }
  },

  importExcel: async (token: string, file: File): Promise<StockImportResult> => {
    if (useMock) {
      return { successCount: 1, failedCount: 0, errors: [] }
    }
    const formData = new FormData()
    formData.append(IMPORT_FILE_FIELD, file)
    const res = await axios.post(`${BASE_URL}/stock/items/import`, formData, {
      headers: { ...authHeader(token), 'Content-Type': 'multipart/form-data' },
    })
    const r = res.data?.data ?? res.data
    return normalizeImportResult(r)
  },

  lookupByMatCode: async (token: string, matCode: string): Promise<StockLookupResult> => {
    if (useMock) {
      const item = mockItems.find((i) => i.matCode === matCode)
      return item
        ? { matCode, itemName: item.itemName, qtyOnHand: item.qty, unit: item.unit, found: true }
        : { matCode, qtyOnHand: 0, found: false }
    }
    const res = await axios.get(`${BASE_URL}/stock/lookup`, {
      headers: authHeader(token),
      params: { mat_code: matCode },
    })
    const r = res.data?.data ?? res.data
    return {
      matCode: r.mat_code ?? matCode,
      itemName: r.item_name ?? undefined,
      qtyOnHand: Number(r.qty_on_hand ?? 0),
      unit: r.unit ?? undefined,
      found: !!r.found,
    }
  },
}
