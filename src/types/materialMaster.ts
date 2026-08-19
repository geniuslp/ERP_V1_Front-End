// GET /master/materials/:id response shape, confirmed against backend this session.
export interface MaterialMasterDetail {
  id: number
  mat_code: string
  is_active: boolean
  group_id: number
  group_name: string
  subgroup_id: number
  subgroup_name: string
  mat_name_id: number
  mat_name: string
  spec_id: number
  spec_description: string
  brand_id: number
  brand_name: string
  unit_id: number
  unit_name: string
}

// PUT /master/materials/:id request body.
export interface MaterialMasterUpdatePayload {
  mat_code: string
  group_id: number
  subgroup_id: number
  mat_name_id: number
  spec_id: number
  brand_id: number
  unit_id: number
  is_active: boolean
}

export interface MaterialMasterOption {
  id: number
  code?: string
  name: string
  label: string
}

// The six master lookup values editable inline from the material detail page.
// Renaming any of these edits the SHARED master record (PUT /master/<x>/:id),
// not the material's own link to it — affects every other material using
// the same group/subgroup/mat_name/spec/brand/unit.
export type MasterLookupKind = 'group' | 'subgroup' | 'mat_name' | 'spec' | 'brand' | 'unit'

export interface RenameTarget {
  kind: MasterLookupKind
  id: number
  currentValue: string
}
