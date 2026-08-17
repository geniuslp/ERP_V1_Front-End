import axios from 'axios'
import type {
  StockTransferListItem, StockTransferDetail, StockTransferCreatePayload,
  StockTransactionHistoryItem, ProjectStockBalanceItem, StockTransferType,
} from '@/types/stockTransfer'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

// WH_TO_PROJECT (the "ใบเบิกของ" / requisition flow) is backed by the dedicated
// `/requisition` API contract. WH_TO_WH (warehouse-to-warehouse transfer) keeps using the
// older `/stock-transfer` API — the two flows share these UI components but not a backend
// contract, so every call below branches on transferType to pick the right base path.
const basePath = (transferType?: StockTransferType) =>
  transferType === 'WH_TO_PROJECT' ? '/requisition' : '/stock-transfer'

// The `/requisition/*` endpoints (WH_TO_PROJECT) are confirmed live against the real
// backend — those calls must surface real failures, not paper over them with mock data.
// `/stock-transfer/*` (WH_TO_WH) and `/requisition/project-balance` are NOT in the
// confirmed-live endpoint list, so they keep the mock fallback until confirmed.
const isConfirmedLivePath = (path: string) => path === '/requisition'
const MOCK_FALLBACK_ON_ERROR = (path: string) => !isConfirmedLivePath(path)

export interface ListStockTransfersParams {
  transferType?: StockTransferType
  status?: string
  fromWarehouseCode?: string
  toWarehouseCode?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface ListStockTransfersResult {
  items: StockTransferListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

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

const mockList: StockTransferListItem[] = [
  {
    transfer_id: 1, transfer_no: 'WHT-2026-0001', transfer_type: 'WH_TO_PROJECT',
    transfer_date: '2026-08-10', from_warehouse_code: 'WH01', from_warehouse_name: 'คลังกลาง',
    to_project_code: 'PRJ001', to_project_name: 'โครงการ A', requested_by_name: 'สมชาย ใจดี',
    status: 'DRAFT', line_count: 2,
  },
  {
    transfer_id: 2, transfer_no: 'WHT-2026-0002', transfer_type: 'WH_TO_WH',
    transfer_date: '2026-08-11', from_warehouse_code: 'WH01', from_warehouse_name: 'คลังกลาง',
    to_warehouse_code: 'WH02', to_warehouse_name: 'คลังสาขา 2', requested_by_name: 'สมหญิง มั่นคง',
    status: 'CONFIRMED', checked_by_name: 'วิชัย ตรวจสอบ', line_count: 1,
  },
]

const mockDetail = (id: number): StockTransferDetail => {
  const base = mockList.find((l) => l.transfer_id === id) ?? mockList[0]
  return {
    transfer_id: base.transfer_id,
    transfer_no: base.transfer_no,
    transfer_type: base.transfer_type,
    transfer_date: base.transfer_date,
    from_warehouse_code: base.from_warehouse_code,
    from_warehouse_name: base.from_warehouse_name,
    to_warehouse_code: base.to_warehouse_code,
    to_warehouse_name: base.to_warehouse_name,
    to_project_code: base.to_project_code,
    to_project_name: base.to_project_name,
    purpose: 'เบิกใช้งานหน้างาน',
    status: base.status,
    requested_by_name: base.requested_by_name,
    checked_by_name: base.checked_by_name,
    checked_at: base.status === 'CONFIRMED' ? '2026-08-12T09:00:00Z' : undefined,
    lines: [
      {
        transfer_line_id: 1, line_no: 1, item_id: 101, mat_code: 'MAT001', item_name: 'เหล็กแผ่น SS400',
        unit: 'แผ่น', qty_on_hand: 50, qty_requested: 10, qty_confirmed: base.status === 'CONFIRMED' ? 10 : undefined,
      },
    ],
    status_log: [
      { to_status: 'DRAFT', changed_by_name: base.requested_by_name, changed_at: base.transfer_date + 'T08:00:00Z' },
      ...(base.status === 'CONFIRMED'
        ? [{ to_status: 'CONFIRMED' as const, changed_by_name: base.checked_by_name || '', changed_at: '2026-08-12T09:00:00Z' }]
        : []),
    ],
  }
}

export const stockTransferService = {
  list: async (token: string, params: ListStockTransfersParams): Promise<ListStockTransfersResult> => {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20
    const path = basePath(params.transferType)
    try {
      const res = await axios.get(`${BASE_URL}${path}`, {
        headers: authHeader(token),
        params: {
          transfer_type: params.transferType,
          status: params.status || undefined,
          from_warehouse_code: params.fromWarehouseCode || undefined,
          to_warehouse_code: params.toWarehouseCode || undefined,
          search: params.search || undefined,
          date_from: params.dateFrom || undefined,
          date_to: params.dateTo || undefined,
          page, page_size: pageSize,
        },
      })
      const meta = unwrapPaginationMeta(res.data, page, pageSize)
      return { items: unwrapListEnvelope(res.data), ...meta }
    } catch (err) {
      if (!MOCK_FALLBACK_ON_ERROR(path)) throw err
      const filtered = mockList.filter((r) => !params.transferType || r.transfer_type === params.transferType)
      return { items: filtered, total: filtered.length, page: 1, pageSize, totalPages: 1 }
    }
  },

  get: async (token: string, id: string | number, transferType?: StockTransferType): Promise<StockTransferDetail> => {
    const path = basePath(transferType)
    try {
      const res = await axios.get(`${BASE_URL}${path}/${id}`, { headers: authHeader(token) })
      return res.data?.data ?? res.data
    } catch (err) {
      if (!MOCK_FALLBACK_ON_ERROR(path)) throw err
      return mockDetail(Number(id))
    }
  },

  create: async (token: string, payload: StockTransferCreatePayload): Promise<{ transfer_id: number }> => {
    const res = await axios.post(`${BASE_URL}${basePath(payload.transfer_type)}`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  confirm: async (token: string, id: string | number, transferType?: StockTransferType): Promise<void> => {
    await axios.post(`${BASE_URL}${basePath(transferType)}/${id}/confirm`, {}, { headers: authHeader(token) })
  },

  cancel: async (token: string, id: string | number, transferType?: StockTransferType): Promise<void> => {
    await axios.post(`${BASE_URL}${basePath(transferType)}/${id}/cancel`, {}, { headers: authHeader(token) })
  },

  // WH_TO_PROJECT (requisition) history lives under /requisition/history, everything else
  // under /stock-transfer/history — two backends since the requisition flow moved to its
  // own API contract. When the caller filters to a specific transferType we only need one
  // source; with no filter (the combined "ประวัติการเคลื่อนไหว" page) we query both and
  // merge client-side so requisition rows don't silently disappear from that view.
  history: async (
    token: string,
    params: { matCode?: string; transferType?: string; warehouseCode?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }
  ): Promise<{ items: StockTransactionHistoryItem[]; total: number; page: number; pageSize: number; totalPages: number }> => {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20
    const commonParams = {
      mat_code: params.matCode || undefined,
      transfer_type: params.transferType || undefined,
      warehouse_code: params.warehouseCode || undefined,
      date_from: params.dateFrom || undefined,
      date_to: params.dateTo || undefined,
    }

    // /requisition/history is confirmed live and must surface real errors; /stock-transfer/history
    // is not confirmed, so only that source keeps a per-source mock fallback on failure.
    const fetchFrom = async (path: string, sourceType: 'REQUISITION' | 'STOCK_TRANSFER'): Promise<StockTransactionHistoryItem[]> => {
      const res = await axios.get(`${BASE_URL}${path}/history`, {
        headers: authHeader(token),
        params: { ...commonParams, page: 1, page_size: 1000 },
      })
      return unwrapListEnvelope(res.data).map((item: StockTransactionHistoryItem) => ({ ...item, source_type: sourceType }))
    }

    const fetchFromWithFallback = async (path: string, sourceType: 'REQUISITION' | 'STOCK_TRANSFER'): Promise<StockTransactionHistoryItem[]> => {
      try {
        return await fetchFrom(path, sourceType)
      } catch (err) {
        if (!MOCK_FALLBACK_ON_ERROR(path)) throw err
        return []
      }
    }

    if (params.transferType) {
      const path = basePath(params.transferType as StockTransferType)
      const sourceType = params.transferType === 'WH_TO_PROJECT' ? 'REQUISITION' : 'STOCK_TRANSFER'
      const merged = await fetchFromWithFallback(path, sourceType)
      const total = merged.length
      const start = (page - 1) * pageSize
      return { items: merged.slice(start, start + pageSize), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    }

    const [requisitionRows, transferRows] = await Promise.all([
      fetchFrom('/requisition', 'REQUISITION'),
      fetchFromWithFallback('/stock-transfer', 'STOCK_TRANSFER'),
    ])
    const merged = [...requisitionRows, ...transferRows].sort((a, b) => (a.txn_date < b.txn_date ? 1 : -1))
    const total = merged.length
    const start = (page - 1) * pageSize
    return { items: merged.slice(start, start + pageSize), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  },

  // NOTE: /requisition/project-balance is NOT in the confirmed-live endpoint list (only
  // create/list/get/confirm/cancel/history are confirmed) — keeps its mock fallback until
  // the backend confirms this one too.
  projectBalance: async (
    token: string,
    params: { projectCode?: string; matCode?: string; page?: number; pageSize?: number }
  ): Promise<{ items: ProjectStockBalanceItem[]; total: number }> => {
    try {
      const res = await axios.get(`${BASE_URL}/requisition/project-balance`, {
        headers: authHeader(token),
        params: { project_code: params.projectCode || undefined, mat_code: params.matCode || undefined, page: params.page ?? 1, page_size: params.pageSize ?? 20 },
      })
      const rows = unwrapListEnvelope(res.data)
      return { items: rows, total: Number(res.data?.data?.total ?? rows.length) }
    } catch (err) {
      const mockBalance: ProjectStockBalanceItem[] = [
        { project_code: 'PRJ001', project_name: 'โครงการ A', mat_code: 'MAT001', item_name: 'เหล็กแผ่น SS400', unit: 'แผ่น', qty_on_hand: 10 },
      ]
      return { items: mockBalance, total: mockBalance.length }
    }
  },
}
