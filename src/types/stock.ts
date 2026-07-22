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
  txnType: StockTransactionType
  itemId: number
  itemCode: string
  itemName: string
  fromLocationId?: number
  fromLocationName?: string
  toLocationId?: number
  toLocationName?: string
  qty: number
  remarks?: string
  createdBy: string
  createdAt: string
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
