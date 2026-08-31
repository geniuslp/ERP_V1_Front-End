export type TrackingType = 'sku' | 'serial'
export type ItemType = 'returnable' | 'consumable'
export type StockTransactionType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUST'
export type BorrowStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'BORROWED' | 'RETURNED' | 'PARTIALLY_RETURNED'
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'FULFILLED'

export interface StockItem {
  id: number
  itemCode: string
  itemName: string
  description?: string
  itemType: ItemType
  trackingType: TrackingType
  unit: string
  minQty: number
  categoryId?: number
  categoryName?: string
  qrCode?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface StockInventory {
  id: number
  itemId: number
  itemCode: string
  itemName: string
  unit: string
  locationId: number
  locationName: string
  warehouseCode: string
  qtyOnHand: number
  qtyReserved: number
  qtyAvailable: number
}

export interface StockTransaction {
  id: number
  txnNo: string
  txnType: string
  itemId: number
  matCode: string
  itemName: string
  fromLocation?: string | null
  toLocation?: string | null
  qty: number
  // Before/after snapshot of on-hand qty at the item level — null for a few
  // transaction types not yet backfilled server-side; render as '-', not 0.
  qtyBefore?: number | null
  qtyAfter?: number | null
  // Reference document number resolved server-side from ref_doc_type + ref_doc_id
  // (e.g. "PR202608-0007", a grn_no, req_no, or borrow_no) — null when ref_doc_type
  // has no joinable table yet (see stock_transaction.go on the backend).
  refDocNo?: string | null
  remarks?: string | null
  createdByName: string
  txnDate: string
}

export interface BorrowRequest {
  id: number
  borrowNo: string
  status: BorrowStatus
  requestedBy: string
  requestedById: number
  approvedBy?: string
  purpose: string
  borrowDate: string
  expectedReturnDate?: string
  actualReturnDate?: string
  lines: BorrowLine[]
  createdAt: string
}

export interface BorrowLine {
  id: number
  borrowId: number
  lineNo: number
  itemId: number
  itemCode: string
  itemName: string
  locationId: number
  locationName: string
  qtyRequested: number
  qtyApproved?: number
  qtyBorrowed?: number
  qtyReturned?: number
  unit: string
  remarks?: string
}

export interface Reservation {
  id: number
  reservationNo: string
  status: ReservationStatus
  itemId: number
  itemCode: string
  itemName: string
  locationId: number
  locationName: string
  qtyReserved: number
  requestedBy: string
  neededBy?: string
  purpose?: string
  createdAt: string
}
