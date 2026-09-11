import api from '@/services/api'
import type {
  ReceivablePoItem,
  ReceivablePoLinesResponse,
  GRNv2CreatePayload,
  GRNv2CreateResult,
  GRNv2ListItem,
  GRNv2Detail,
} from '@/types'

// 🔴 MOCK MODE — GET /po/:id/receivable-lines confirmed LIVE and working
// (backend investigation, this session): POHandler.GetReceivableLines
// (po.go:2866) is fully implemented, routed, and correctly returns
// unit_price. Mock mode is now off; MOCK_RECEIVABLE_POS/MOCK_RECEIVABLE_LINES
// are kept dormant below for dev/testing convenience (flip the flag back to
// true to use them without touching any other code).
export const GRN_RECEIVING_MOCK_MODE = false

const mockDelay = <T>(data: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), 300))

const MOCK_RECEIVABLE_POS: ReceivablePoItem[] = [
  {
    po_id: 101, po_no: 'PO-2026-0101', po_date: '2026-07-01',
    supplier_code: 'SUP001', supplier_name: 'บริษัท ตัวอย่าง จำกัด',
    status: 'APPROVED', status_receive: 'SENT',
  },
  {
    po_id: 102, po_no: 'PO-2026-0102', po_date: '2026-07-05',
    supplier_code: 'SUP002', supplier_name: 'บริษัท ทดสอบ จำกัด',
    status: 'APPROVED', status_receive: 'PARTIALLY_RECEIVED',
  },
]

const MOCK_RECEIVABLE_LINES: Record<number, ReceivablePoLinesResponse> = {
  101: {
    po_id: 101, po_no: 'PO-2026-0101', supplier_code: 'SUP001', warehouse_code: 'WH01',
    lines: [
      { po_line_id: 1001, line_no: 1, mat_code: 'MAT-001', mat_name: 'สินค้าตัวอย่าง A', qty_ordered: 100, qty_received: 0, qty_remaining: 100, unit_price: 125.5, unit_name: 'ชิ้น' },
      { po_line_id: 1002, line_no: 2, mat_code: 'MAT-002', mat_name: 'สินค้าตัวอย่าง B', qty_ordered: 50, qty_received: 0, qty_remaining: 50, unit_price: 2340, unit_name: 'กล่อง' },
    ],
  },
  102: {
    po_id: 102, po_no: 'PO-2026-0102', supplier_code: 'SUP002', warehouse_code: 'WH01',
    lines: [
      { po_line_id: 2001, line_no: 1, mat_code: 'MAT-003', mat_name: 'สินค้าตัวอย่าง C', qty_ordered: 200, qty_received: 80, qty_remaining: 120, unit_price: 89.25, unit_name: 'ชิ้น' },
    ],
  },
}

let mockGrnSeq = 9000
const MOCK_GRN_LIST: GRNv2ListItem[] = [
  { grn_id: 8001, grn_no: 'GRN-2026-0001', grn_date: '2026-07-10', po_id: 102, po_no: 'PO-2026-0102', supplier_code: 'SUP002', warehouse_code: 'WH01', status: 'CONFIRMED', quality_status: 'PASSED' },
]
const MOCK_GRN_DETAIL: Record<number, GRNv2Detail> = {
  8001: {
    grn_id: 8001, grn_no: 'GRN-2026-0001', grn_date: '2026-07-10', po_id: 102, po_no: 'PO-2026-0102',
    supplier_code: 'SUP002', warehouse_code: 'WH01', delivery_note: 'DN-556677',
    status: 'CONFIRMED', quality_status: 'PASSED',
    lines: [
      { grn_line_id: 1, po_line_id: 2001, mat_code: 'MAT-003', mat_name: 'สินค้าตัวอย่าง C', qty_accepted: 80, quality_status: 'PASSED' },
    ],
  },
}

export const grnReceivingService = {
  getReceivablePOs: async (params: {
    page: number; limit: number; supplier_code?: string; po_no?: string
  }): Promise<{ data: ReceivablePoItem[]; total: number }> => {
    if (GRN_RECEIVING_MOCK_MODE) {
      let rows = MOCK_RECEIVABLE_POS
      if (params.supplier_code) rows = rows.filter((r) => r.supplier_code.includes(params.supplier_code!))
      if (params.po_no) rows = rows.filter((r) => r.po_no.includes(params.po_no!))
      return mockDelay({ data: rows, total: rows.length })
    }
    const res = await api.get('/po/receivable', { params })
    return { data: res.data?.data?.data ?? res.data?.data ?? [], total: res.data?.data?.total ?? 0 }
  },

  getReceivableLines: async (poId: number): Promise<ReceivablePoLinesResponse> => {
    if (GRN_RECEIVING_MOCK_MODE) {
      const found = MOCK_RECEIVABLE_LINES[poId]
      if (!found) throw new Error('ไม่พบ PO หรือไม่มีรายการที่รับได้ (mock)')
      return mockDelay(found)
    }

    // GET /po/:id/receivable-lines returns a flat array of lines only — no PO
    // header (po_no/warehouse_code/supplier) — so the header comes from a
    // separate GET /po/:id call and the two are combined into the shape this
    // page expects. Also note the real line objects key their id as
    // `line_id`, not `po_line_id` (the mock's naming) — remapped below.
    const [poRes, linesRes] = await Promise.all([
      api.get(`/po/${poId}`),
      api.get(`/po/${poId}/receivable-lines`),
    ])
    const po = poRes.data?.data
    const rawLines: Array<{
      line_id: number
      po_id: number
      line_no: number
      mat_code: string
      mat_name?: string | null
      qty_ordered: number
      qty_received: number
      qty_remaining: number
      unit_price: number
      status: string
    }> = linesRes.data?.data ?? []

    return {
      po_id: po?.po_id ?? poId,
      po_no: po?.po_no ?? '',
      // purchase_order no longer carries a supplier_code (clean-break migration
      // to supplier_id, per backend CLAUDE.md) — supplier_name is the closest
      // available label for this field.
      supplier_code: po?.supplier_name ?? '',
      warehouse_code: po?.warehouse_code ?? undefined,
      lines: rawLines.map((l) => ({
        po_line_id: l.line_id,
        line_no: l.line_no,
        mat_code: l.mat_code,
        mat_name: l.mat_name ?? '',
        qty_ordered: l.qty_ordered,
        qty_received: l.qty_received,
        qty_remaining: l.qty_remaining,
        unit_price: l.unit_price ?? 0,
      })),
    }
  },

  createGrnDraft: async (payload: GRNv2CreatePayload): Promise<GRNv2CreateResult> => {
    if (GRN_RECEIVING_MOCK_MODE) {
      mockGrnSeq += 1
      const result: GRNv2CreateResult = { grn_id: mockGrnSeq, grn_no: `GRN-2026-${mockGrnSeq}`, status: 'DRAFT' }
      return mockDelay(result)
    }
    const res = await api.post('/grn', payload)
    return res.data?.data
  },

  confirmGrn: async (grnId: number): Promise<{ grn_id: number; status: string }> => {
    if (GRN_RECEIVING_MOCK_MODE) {
      return mockDelay({ grn_id: grnId, status: 'CONFIRMED' })
    }
    const res = await api.post(`/grn/${grnId}/confirm`)
    return res.data?.data
  },

  getGrnList: async (params: {
    page: number; limit: number; po_no?: string
  }): Promise<{ data: GRNv2ListItem[]; total: number }> => {
    if (GRN_RECEIVING_MOCK_MODE) {
      let rows = MOCK_GRN_LIST
      if (params.po_no) rows = rows.filter((r) => r.po_no.includes(params.po_no!))
      return mockDelay({ data: rows, total: rows.length })
    }
    const res = await api.get('/grn', { params })
    return { data: res.data?.data?.data ?? res.data?.data ?? [], total: res.data?.data?.total ?? 0 }
  },

  getGrnDetail: async (grnId: number): Promise<GRNv2Detail> => {
    if (GRN_RECEIVING_MOCK_MODE) {
      const found = MOCK_GRN_DETAIL[grnId]
      if (!found) throw new Error('ไม่พบ GRN (mock)')
      return mockDelay(found)
    }
    const res = await api.get(`/grn/${grnId}`)
    return res.data?.data
  },
}
