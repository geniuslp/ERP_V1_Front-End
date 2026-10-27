import { useMemo } from 'react'
import { usePermissionContext } from '@/contexts/PermissionContext'
import type { PermMenu } from '@/types/permission.types'

// Menu data for the top navigation bar. Same source and rules as SidebarMenu.tsx (kept unused for
// rollback): the GET /menus tree already filtered per user, ordered by `order`.

export interface NavNode extends PermMenu {
  children: NavNode[]
}

// Frontend-only override shared with the sidebar: these entries were consolidated into the history pages.
const HIDDEN_MENU_CODES = ['MENU_PR_STATUS', 'MENU_PO_STATUS']
// Top-level groups role-locked to ADMIN_CENTER (mirrors the RequireRole route guards).
const ADMIN_CENTER_ONLY_MENU_CODES = ['MENU_ADMIN', 'MENU_SYSTEM']
// CREATE routes are guarded with action="write", so the nav gates on the same action.
const isCreateMenu = (menuCode: string) => menuCode.endsWith('_CREATE')

// Children whose route needs a :param and has no standalone target — shown disabled, like the sidebar did.
export const PARAM_REQUIRED_MENU_CODES = ['MENU_IC_PO_RECEIVE', 'MENU_IC_PO_RETURN']

export function useNavTree() {
  const { can, hasRole, loading, menus } = usePermissionContext()

  const tree = useMemo<NavNode[]>(() => {
    const byParent = new Map<number | null, PermMenu[]>()
    for (const m of menus) {
      if (!m.is_active || HIDDEN_MENU_CODES.includes(m.menu_code)) continue
      const list = byParent.get(m.parent_id) ?? []
      list.push(m)
      byParent.set(m.parent_id, list)
    }

    const build = (parentId: number | null, depth: number, seen: Set<number>): NavNode[] => {
      const out: NavNode[] = []
      for (const m of (byParent.get(parentId) ?? []).slice().sort((a, b) => a.order - b.order)) {
        if (seen.has(m.id)) continue // guard against a parent_id cycle
        if (depth === 0 && ADMIN_CENTER_ONLY_MENU_CODES.includes(m.menu_code) && !hasRole('ADMIN_CENTER')) continue
        const kids = build(m.id, depth + 1, new Set(seen).add(m.id))
        if (byParent.has(m.id)) {
          if (kids.length > 0) out.push({ ...m, children: kids })
        } else if (isCreateMenu(m.menu_code) ? can(m.menu_code, 'write') : can(m.menu_code, 'read')) {
          out.push({ ...m, children: [] })
        }
      }
      return out
    }

    return build(null, 0, new Set())
      // Same frontend-only ordering override as the sidebar: Memo before PR.
      .sort((a, b) => {
        if (a.menu_code === 'MENU_MEMO' && b.menu_code === 'MENU_PR') return -1
        if (a.menu_code === 'MENU_PR' && b.menu_code === 'MENU_MEMO') return 1
        return 0
      })
  }, [menus, can, hasRole])

  return { tree, loading }
}

// ── Short labels (display only; the menu data is not changed) ──────────────────────────────────
const SHORT_LABEL_BY_CODE: Record<string, string> = {
  MENU_PR: 'OF',
  MENU_PO: 'PO/WO',
  MENU_IC: 'IC',
  MENU_FINANCE: 'AP',
}

const FIRST_THAI = /[฀-๿]/

/** Bar label: code map first, else the part of menu_name before the first Thai character, else the full name. */
export function shortLabel(node: Pick<PermMenu, 'menu_code' | 'menu_name'>): string {
  const mapped = SHORT_LABEL_BY_CODE[node.menu_code]
  if (mapped) return mapped
  const name = node.menu_name ?? ''
  const idx = name.search(FIRST_THAI)
  const head = (idx === -1 ? name : name.slice(0, idx)).trim()
  return head || name.trim()
}

// ── Numbering ──────────────────────────────────────────────────────────────────────────────────
/** 1, 2, 3... for the clickable entries of ONE main menu, in display order (group headings are not numbered).
 *  Each main menu starts again at 1. */
export function numberLeaves(top: NavNode): Map<string, number> {
  const out = new Map<string, number>()
  let n = 0
  const visit = (nodes: NavNode[]) => {
    for (const c of nodes) {
      if (c.children.length > 0) visit(c.children)
      else out.set(c.menu_code, ++n)
    }
  }
  visit(top.children)
  return out
}

// ── Active route ────────────────────────────────────────────────────────────────────────────────
/** "/ic/projects/:projectId/po-receive" -> "/ic/projects" (the part before ":"), trailing slash removed. */
export const normalizeMenuPath = (p?: string): string => {
  if (!p) return ''
  const head = p.split(':')[0].replace(/\/+$/, '')
  return head
}

export interface ActiveNav {
  leafCode: string | null
  topCode: string | null
}

/** Longest menu_path prefix wins, so /po and /po/create never both highlight. */
export function findActive(tree: NavNode[], pathname: string): ActiveNav {
  let best: { leafCode: string; topCode: string; len: number; raw: number } | null = null
  const visit = (nodes: NavNode[], topCode: string | null) => {
    for (const n of nodes) {
      const top = topCode ?? n.menu_code
      if (n.children.length > 0) {
        visit(n.children, top)
        continue
      }
      if (!n.menu_path) continue
      const np = normalizeMenuPath(n.menu_path)
      const matches = np === '' ? pathname === '/' : pathname === np || pathname.startsWith(np + '/')
      if (!matches) continue
      const len = np === '' ? 1 : np.length
      const raw = n.menu_path.length
      if (!best || len > best.len || (len === best.len && raw > best.raw)) {
        best = { leafCode: n.menu_code, topCode: top, len, raw }
      }
    }
  }
  visit(tree, null)
  const b = best as { leafCode: string; topCode: string } | null
  return { leafCode: b?.leafCode ?? null, topCode: b?.topCode ?? null }
}

// ── Persisted item widths (desktop bar, per browser) ───────────────────────────────────────────
export const TOPNAV_WIDTHS_KEY = 'erp.topnav.widths.v1'
export const TOPNAV_WIDTHS_RESET_EVENT = 'erp-topnav-widths-reset'
export const TOPNAV_MIN_WIDTH = 64
export const TOPNAV_MAX_WIDTH = 320

// OF / IC / AP became short labels; widths saved for their old long labels would leave empty space
// next to the text, so those three are dropped once per browser and the items size to their text again.
const SHORT_LABEL_WIDTH_FIX_KEY = 'erp.topnav.widths.shortlabels.v1'
const SHORT_LABEL_CODES = ['MENU_PR', 'MENU_IC', 'MENU_FINANCE']

export function loadTopNavWidths(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(TOPNAV_WIDTHS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[k] = Math.min(TOPNAV_MAX_WIDTH, Math.max(TOPNAV_MIN_WIDTH, v))
      }
    }
    if (!window.localStorage.getItem(SHORT_LABEL_WIDTH_FIX_KEY)) {
      SHORT_LABEL_CODES.forEach((code) => { delete out[code] })
      window.localStorage.setItem(TOPNAV_WIDTHS_KEY, JSON.stringify(out))
      window.localStorage.setItem(SHORT_LABEL_WIDTH_FIX_KEY, '1')
    }
    return out
  } catch {
    return {} // storage unavailable or corrupt JSON: the menu works with default widths
  }
}

export function saveTopNavWidths(widths: Record<string, number>): void {
  try {
    window.localStorage.setItem(TOPNAV_WIDTHS_KEY, JSON.stringify(widths))
  } catch {
    /* storage unavailable: widths just do not persist */
  }
}

/** Resets every item to its default width (used by the user dropdown action). */
export function resetTopNavWidths(): void {
  try {
    window.localStorage.removeItem(TOPNAV_WIDTHS_KEY)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(TOPNAV_WIDTHS_RESET_EVENT))
}
