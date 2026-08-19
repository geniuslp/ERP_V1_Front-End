import axios from 'axios'
import type { MaterialMasterDetail, MaterialMasterUpdatePayload, MaterialMasterOption, MasterLookupKind } from '@/types/materialMaster'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

const unwrap = (data: any) => (Array.isArray(data) ? data : data?.data ?? [])

export const materialMasterService = {
  // Keyed by mat_code (string), not a numeric id — confirmed: GET /master/allMaterial's
  // rows have no id/mat_id/material_id field at all, mat_code is the only identifier.
  get: async (token: string, code: string): Promise<MaterialMasterDetail> => {
    const res = await axios.get(`${BASE_URL}/master/materials/${encodeURIComponent(code)}`, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  update: async (token: string, code: string, payload: MaterialMasterUpdatePayload): Promise<void> => {
    await axios.put(`${BASE_URL}/master/materials/${encodeURIComponent(code)}`, payload, { headers: authHeader(token) })
  },

  // Confirmed endpoint (same one MaterialPage.tsx's group filter/insert-row use)
  // — note it's /groups, not /master/mat-groups.
  getGroups: async (token: string): Promise<MaterialMasterOption[]> => {
    const res = await axios.get(`${BASE_URL}/groups`, { headers: authHeader(token) })
    // Number(...) here guards against a real bug class: GET /master/materials/:code
    // (confirmed) returns group_id as a JSON number, but this LIST endpoint's id
    // serialization was never independently confirmed — if it returns id as a
    // string, Select's strict value===option.value match silently fails and the
    // dropdown renders blank even though the form value is "set" correctly.
    return unwrap(res.data).map((g: any) => ({
      id: Number(g.id),
      code: g.group_code,
      name: g.group_name,
      label: g.group_code ? `${g.group_code} — ${g.group_name}` : g.group_name,
    }))
  },

  // Confirmed endpoint (MaterialPage.tsx InsertRow / MaterialPickerModal.tsx).
  getSubgroups: async (token: string, groupId: number): Promise<MaterialMasterOption[]> => {
    const res = await axios.get(`${BASE_URL}/master/subgroups`, {
      headers: authHeader(token),
      params: { group_id: groupId },
    })
    return unwrap(res.data).map((s: any) => ({
      id: Number(s.id),
      code: s.subgroup_code,
      name: s.subgroup_name,
      label: s.subgroup_code ? `${s.subgroup_code} — ${s.subgroup_name}` : s.subgroup_name,
    }))
  },

  // Confirmed endpoint (MaterialPage.tsx InsertRow / MaterialPickerModal.tsx).
  getMatNames: async (token: string, subgroupId: number): Promise<MaterialMasterOption[]> => {
    const res = await axios.get(`${BASE_URL}/master/mat-names`, {
      headers: authHeader(token),
      params: { subgroup_id: subgroupId },
    })
    return unwrap(res.data).map((m: any) => ({
      id: Number(m.id),
      code: m.mat_name_code,
      name: m.mat_name_th ?? m.mat_name,
      label: m.mat_name_code ? `${m.mat_name_code} — ${m.mat_name_th ?? m.mat_name}` : (m.mat_name_th ?? m.mat_name),
    }))
  },

  // Confirmed endpoint (MaterialPage.tsx InsertRow).
  getSpecs: async (token: string, matNameId: number): Promise<MaterialMasterOption[]> => {
    const res = await axios.get(`${BASE_URL}/master/specs`, {
      headers: authHeader(token),
      params: { mat_name_id: matNameId },
    })
    return unwrap(res.data).map((s: any) => ({
      id: Number(s.id),
      code: s.spec_code,
      name: s.spec_description,
      label: s.spec_code ? `${s.spec_code} — ${s.spec_description}` : s.spec_description,
    }))
  },

  // Confirmed endpoint (MaterialPage.tsx InsertRow).
  getBrands: async (token: string, specId: number): Promise<MaterialMasterOption[]> => {
    const res = await axios.get(`${BASE_URL}/master/brands`, {
      headers: authHeader(token),
      params: { spec_id: specId },
    })
    return unwrap(res.data).map((b: any) => ({
      id: Number(b.id),
      code: b.brand_code,
      name: b.brand_name,
      label: b.brand_code ? `${b.brand_code} — ${b.brand_name}` : b.brand_name,
    }))
  },

  // ⚠️ UNCONFIRMED — no /master/units endpoint exists anywhere else in this
  // codebase yet. MaterialPage.tsx's own "add new material" flow currently
  // treats unit as free-text (unitCode/unitName Inputs), not a master-data
  // Select. This follows the naming convention of the other cascade endpoints
  // as a best guess; confirm the real path/shape with backend before relying
  // on it. Fails soft (empty options) rather than crashing the page.
  getUnits: async (token: string): Promise<MaterialMasterOption[]> => {
    const res = await axios.get(`${BASE_URL}/master/units`, { headers: authHeader(token) })
    return unwrap(res.data).map((u: any) => ({
      id: Number(u.id),
      code: u.unit_code,
      name: u.unit_name,
      label: u.unit_code ? `${u.unit_code} — ${u.unit_name}` : u.unit_name,
    }))
  },

  // ── Rename the shared master lookup values (edits the shared record, not
  // this material's link to it) — confirmed endpoints/body field names.
  // Note these paths deliberately differ from the GET endpoints above (e.g.
  // group rename is /master/mat-groups/:id, PUT, while fetching groups uses
  // /groups) — that's the confirmed backend contract for this feature, not
  // a typo; don't "fix" them to match the GET paths.
  renameGroup: async (token: string, id: number, group_name: string): Promise<void> => {
    await axios.put(`${BASE_URL}/master/mat-groups/${id}`, { group_name }, { headers: authHeader(token) })
  },
  renameSubgroup: async (token: string, id: number, subgroup_name: string): Promise<void> => {
    await axios.put(`${BASE_URL}/master/subgroups/${id}`, { subgroup_name }, { headers: authHeader(token) })
  },
  renameMatName: async (token: string, id: number, mat_name: string): Promise<void> => {
    await axios.put(`${BASE_URL}/master/mat-names/${id}`, { mat_name }, { headers: authHeader(token) })
  },
  renameSpec: async (token: string, id: number, spec_description: string): Promise<void> => {
    await axios.put(`${BASE_URL}/master/spec-sizes/${id}`, { spec_description }, { headers: authHeader(token) })
  },
  renameBrand: async (token: string, id: number, brand_name: string): Promise<void> => {
    await axios.put(`${BASE_URL}/master/brands/${id}`, { brand_name }, { headers: authHeader(token) })
  },
  renameUnit: async (token: string, id: number, unit_name: string): Promise<void> => {
    await axios.put(`${BASE_URL}/master/units/${id}`, { unit_name }, { headers: authHeader(token) })
  },

  // Single dispatch point so callers don't need a switch on kind themselves.
  renameLookup: async (token: string, kind: MasterLookupKind, id: number, value: string): Promise<void> => {
    switch (kind) {
      case 'group': return materialMasterService.renameGroup(token, id, value)
      case 'subgroup': return materialMasterService.renameSubgroup(token, id, value)
      case 'mat_name': return materialMasterService.renameMatName(token, id, value)
      case 'spec': return materialMasterService.renameSpec(token, id, value)
      case 'brand': return materialMasterService.renameBrand(token, id, value)
      case 'unit': return materialMasterService.renameUnit(token, id, value)
    }
  },
}
