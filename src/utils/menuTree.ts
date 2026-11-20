// Menu tree helpers for the permission matrix. The matrix lists one row per actionable (leaf) menu under each
// top-level module, so a menu that sits two levels below the module (e.g. OF > รายงาน OF > a report page) must be
// found through its group instead of being dropped.

interface TreeNode {
  id: number
  parent_id: number | null
  order?: number
}

/** All leaf menus below `topId`, in tree order (siblings sorted by `order`). A top with no children is its own leaf. */
export function leafMenusUnder<T extends TreeNode>(menus: T[], topId: number): T[] {
  const byParent = new Map<number, T[]>()
  for (const m of menus) {
    if (m.parent_id === null) continue
    const list = byParent.get(m.parent_id) ?? []
    list.push(m)
    byParent.set(m.parent_id, list)
  }
  const out: T[] = []
  const walk = (parentId: number, seen: Set<number>) => {
    for (const m of (byParent.get(parentId) ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      if (seen.has(m.id)) continue // parent_id cycle guard
      if (byParent.has(m.id)) walk(m.id, new Set(seen).add(m.id))
      else out.push(m)
    }
  }
  walk(topId, new Set([topId]))
  return out
}

/** Id of the top-level ancestor of `id` (itself when it is top-level), or null when the chain is broken. */
export function topAncestorId(menus: TreeNode[], id: number): number | null {
  const byId = new Map(menus.map((m) => [m.id, m]))
  let cur = byId.get(id)
  const seen = new Set<number>()
  while (cur && cur.parent_id !== null) {
    if (seen.has(cur.id)) return null
    seen.add(cur.id)
    cur = byId.get(cur.parent_id)
  }
  return cur ? cur.id : null
}
