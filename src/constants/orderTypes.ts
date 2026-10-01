// purchase_request / purchase_order `order_type` domain.
// 'stock' / 'cost' are the original types. The three "OH" types below have no
// goods receiving, never appear in IC, can't be sent to a supplier, and their
// cost code can only come from the OH/General cost-code list
// (GET /master/cost-code/full?scope=oh). job_code is always 'G' (General Code) for them.
export type OrderType = 'stock' | 'cost' | 'asset_equipment' | 'office_equipment' | 'asset_tool'

export const OH_ORDER_TYPES: OrderType[] = ['asset_equipment', 'office_equipment', 'asset_tool']

export const OH_JOB_CODE = 'G'

export const isOhOrderType = (t?: string | null): boolean =>
  !!t && (OH_ORDER_TYPES as string[]).includes(t)

export const ORDER_TYPE_LABEL: Record<string, string> = {
  stock: 'คลังสินค้า (Stock)',
  cost: 'โครงการ (Cost)',
  asset_equipment: 'Asset Equipment',
  office_equipment: 'Office Equipment',
  asset_tool: 'Asset Tool',
}

export const ORDER_TYPE_OPTIONS = (Object.keys(ORDER_TYPE_LABEL) as OrderType[]).map((value) => ({
  value,
  label: ORDER_TYPE_LABEL[value],
}))
