import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { DownOutlined, LeftOutlined, MenuOutlined, CloseOutlined, RightOutlined } from '@ant-design/icons'
import {
  PARAM_REQUIRED_MENU_CODES, TOPNAV_MAX_WIDTH, TOPNAV_MIN_WIDTH, TOPNAV_WIDTHS_RESET_EVENT,
  findActive, loadTopNavWidths, saveTopNavWidths, shortLabel, useNavTree, type NavNode,
} from './topNavData'

// Top navigation bar (replaces the sidebar). Desktop (>=992px): a horizontally scrollable strip of text-only
// top-level items with portal dropdowns; narrow screens: a menu button + full-width accordion drawer.
// Data: GET /menus tree via useNavTree (same permission filtering and order as the old SidebarMenu).

const NAVY = '#0f2d5e'
const NAVY_DARK = '#09203f'
const DESKTOP_H = 64
const NARROW_H = 56
const DROPDOWN_Z = 900 // above page content (sticky bar is 100), below antd modals (1000)

const CSS = `
.tn-bar { position: sticky; top: 0; z-index: 100; background: ${NAVY}; box-shadow: 0 2px 12px rgba(15,45,94,0.3); }
.tn-bar *:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; border-radius: 8px; }
.tn-strip { scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: smooth; }
.tn-strip::-webkit-scrollbar { display: none; }
.tn-item { position: relative; flex: 0 0 auto; list-style: none; }
.tn-trigger { display: inline-flex; align-items: center; gap: 6px; width: 100%; box-sizing: border-box; padding: 8px 14px;
  border: 0; border-radius: 8px; background: transparent; color: #bfdbfe; font: inherit; font-size: 14px; font-weight: 500;
  line-height: 1.4; white-space: nowrap; cursor: pointer; text-decoration: none; }
.tn-trigger:hover, .tn-trigger[aria-expanded="true"] { background: rgba(255,255,255,0.08); color: #fff; }
.tn-trigger.tn-active { background: linear-gradient(135deg,#2563eb,#1d4ed8); color: #fff; font-weight: 600; }
.tn-trigger[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
.tn-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tn-chev { font-size: 10px; flex: 0 0 auto; }
.tn-handle { position: absolute; top: 10px; bottom: 10px; right: -5px; width: 10px; cursor: col-resize; z-index: 2; touch-action: none; }
.tn-handle::after { content: ''; position: absolute; top: 0; bottom: 0; left: 4px; width: 1px; background: rgba(255,255,255,0.45); opacity: 0; }
.tn-item:hover .tn-handle::after, .tn-handle.tn-dragging::after { opacity: 1; }
.tn-arrow { flex: 0 0 auto; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 8px; background: rgba(255,255,255,0.08); color: #bfdbfe; cursor: pointer; font-size: 14px; }
.tn-arrow:hover:not(:disabled) { color: #fff; background: rgba(255,255,255,0.16); }
.tn-arrow:disabled { opacity: 0.35; cursor: default; }
.tn-icon-btn { color: #bfdbfe !important; }
.tn-icon-btn:hover { color: #fff !important; background: rgba(255,255,255,0.08) !important; }
.tn-panel { position: fixed; z-index: ${DROPDOWN_Z}; min-width: 260px; max-height: calc(100vh - 96px); overflow: auto; box-sizing: border-box;
  background: #fff; border-radius: 12px; padding: 8px; box-shadow: 0 8px 30px rgba(15,45,94,0.18); }
.tn-panel-title { padding: 6px 12px 8px; font-size: 12px; font-weight: 600; color: #60a5fa; border-bottom: 1px solid #dbeafe; margin-bottom: 6px; }
.tn-group-head { padding: 8px 12px 4px; font-size: 12px; font-weight: 600; color: #60a5fa; }
.tn-child { display: block; padding: 10px 12px; border-radius: 8px; color: #1e3a8a; font-size: 14px; text-decoration: none; cursor: pointer; }
.tn-child:hover { background: #eff6ff; }
.tn-child.tn-child-active { background: #eff6ff; color: #1d4ed8; font-weight: 600; }
.tn-child[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
.tn-drawer-item { display: flex; align-items: center; justify-content: space-between; width: 100%; box-sizing: border-box; min-height: 44px;
  padding: 10px 16px; border: 0; background: transparent; color: #bfdbfe; font: inherit; font-size: 15px; font-weight: 500; text-align: left;
  text-decoration: none; cursor: pointer; }
.tn-drawer-item:hover { background: rgba(255,255,255,0.08); color: #fff; }
.tn-drawer-item.tn-active { background: linear-gradient(135deg,#2563eb,#1d4ed8); color: #fff; font-weight: 600; }
.tn-drawer-sub { background: ${NAVY_DARK}; }
.tn-drawer-sub .tn-drawer-item { padding-left: 32px; font-size: 14px; }
.tn-drawer-sub .tn-drawer-item[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
.tn-drawer-head { padding: 10px 16px 4px 32px; font-size: 12px; font-weight: 600; color: #60a5fa; }
`

interface Props {
  isNarrow: boolean
  brand: React.ReactNode
  /** Bell + user dropdown (bar right side). */
  right: React.ReactNode
  /** User block shown at the bottom of the mobile drawer. */
  drawerFooter: React.ReactNode
}

const TopNavMenu: React.FC<Props> = ({ isNarrow, brand, right, drawerFooter }) => {
  const { tree, loading } = useNavTree()
  const location = useLocation()
  const active = useMemo(() => findActive(tree, location.pathname), [tree, location.pathname])

  return (
    <>
      <style>{CSS}</style>
      {isNarrow ? (
        <NarrowBar tree={tree} loading={loading} active={active} brand={brand} right={right} drawerFooter={drawerFooter} />
      ) : (
        <DesktopBar tree={tree} loading={loading} active={active} brand={brand} right={right} />
      )}
    </>
  )
}

interface BarProps {
  tree: NavNode[]
  loading: boolean
  active: { leafCode: string | null; topCode: string | null }
  brand: React.ReactNode
  right: React.ReactNode
}

// ───────────────────────────────── Desktop bar ─────────────────────────────────

const DesktopBar: React.FC<BarProps> = ({ tree, loading, active, brand, right }) => {
  const location = useLocation()
  const barRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const stripRef = useRef<HTMLUListElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const itemEls = useRef(new Map<string, HTMLLIElement>())
  const triggerEls = useRef(new Map<string, HTMLElement>())

  const [openCode, setOpenCode] = useState<string | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [needsArrows, setNeedsArrows] = useState(false)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const [widths, setWidths] = useState<Record<string, number>>(() => loadTopNavWidths())

  const openT = useRef<number | undefined>(undefined)
  const closeT = useRef<number | undefined>(undefined)
  const focusFirst = useRef(false)
  const openedByHover = useRef(false)
  const dragging = useRef(false)

  const clearTimers = () => {
    window.clearTimeout(openT.current)
    window.clearTimeout(closeT.current)
  }
  const closeDropdown = useCallback(() => {
    window.clearTimeout(openT.current)
    window.clearTimeout(closeT.current)
    setOpenCode(null)
  }, [])

  // ── Strip measuring: arrows only when the items are wider than the bar's middle part ──
  const measure = useCallback(() => {
    const strip = stripRef.current
    const nav = navRef.current
    if (!strip || !nav) return
    const kids = Array.from(strip.children) as HTMLElement[]
    const content = kids.length ? kids[kids.length - 1].offsetLeft + kids[kids.length - 1].offsetWidth - kids[0].offsetLeft : 0
    setNeedsArrows(content > nav.clientWidth + 1)
    setCanLeft(strip.scrollLeft > 1)
    setCanRight(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1)
  }, [])

  useLayoutEffect(() => { measure() }, [measure, tree, widths, needsArrows])

  useEffect(() => {
    const ro = new ResizeObserver(() => measure())
    if (navRef.current) ro.observe(navRef.current)
    if (stripRef.current) {
      ro.observe(stripRef.current)
      Array.from(stripRef.current.children).forEach((c) => ro.observe(c))
    }
    return () => ro.disconnect()
  }, [measure, tree])

  // Scroll listener: update arrow state; scrolling the strip closes an open dropdown.
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const onScroll = () => {
      measure()
      setOpenCode(null)
    }
    strip.addEventListener('scroll', onScroll, { passive: true })
    return () => strip.removeEventListener('scroll', onScroll)
  }, [measure, tree])

  // Mouse wheel (vertical delta) and Shift+wheel scroll the strip sideways, only when it can scroll.
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const onWheel = (e: WheelEvent) => {
      if (strip.scrollWidth <= strip.clientWidth + 1) return
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      if (delta === 0) return
      const atStart = strip.scrollLeft <= 0 && delta < 0
      const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1 && delta > 0
      if (atStart || atEnd) return
      e.preventDefault()
      strip.scrollBy({ left: delta, behavior: 'auto' })
    }
    strip.addEventListener('wheel', onWheel, { passive: false })
    return () => strip.removeEventListener('wheel', onWheel)
  }, [tree])

  // Route change: close the dropdown and bring the active top-level item into view.
  useEffect(() => {
    closeDropdown()
    const strip = stripRef.current
    const el = active.topCode ? itemEls.current.get(active.topCode) : undefined
    if (!strip || !el) return
    const left = el.offsetLeft
    const right = left + el.offsetWidth
    if (left < strip.scrollLeft || right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: Math.max(0, left - (strip.clientWidth - el.offsetWidth) / 2), behavior: 'smooth' })
    }
  }, [location.pathname, active.topCode, tree, closeDropdown])

  // ── Arrow buttons: click = one step, hold = keeps scrolling ──
  const holdTimer = useRef<number | undefined>(undefined)
  const holdRaf = useRef<number | undefined>(undefined)
  const held = useRef(false)

  const step = (dir: 1 | -1) => {
    const strip = stripRef.current
    if (!strip) return
    const amount = Math.max(200, Math.round(strip.clientWidth * 0.6))
    strip.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }
  const stopHold = () => {
    window.clearTimeout(holdTimer.current)
    if (holdRaf.current != null) cancelAnimationFrame(holdRaf.current)
    holdRaf.current = undefined
  }
  const startHold = (dir: 1 | -1) => {
    held.current = false
    stopHold()
    holdTimer.current = window.setTimeout(() => {
      held.current = true
      const strip = stripRef.current
      if (!strip) return
      const tick = () => {
        strip.scrollBy({ left: dir * 14, behavior: 'auto' })
        holdRaf.current = requestAnimationFrame(tick)
      }
      holdRaf.current = requestAnimationFrame(tick)
    }, 350)
  }
  const endHold = (dir: 1 | -1) => {
    const wasHeld = held.current
    stopHold()
    if (!wasHeld) step(dir)
    held.current = false
  }
  useEffect(() => stopHold, [])

  // ── Dropdown placement (portal, position: fixed from the trigger's rect, kept inside the viewport) ──
  const place = useCallback(() => {
    if (!openCode) return
    const trig = triggerEls.current.get(openCode)
    const bar = barRef.current
    if (!trig || !bar) return
    const r = trig.getBoundingClientRect()
    const panelW = panelRef.current?.offsetWidth ?? 260
    const left = Math.max(8, Math.min(r.left, window.innerWidth - panelW - 8))
    setPos({ left, top: bar.getBoundingClientRect().bottom + 4 })
  }, [openCode])

  useLayoutEffect(() => {
    if (!openCode) { setPos(null); return }
    place()
  }, [openCode, place, widths])

  useEffect(() => {
    if (!openCode) return
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [openCode, place])

  // Outside click closes.
  useEffect(() => {
    if (!openCode) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (itemEls.current.get(openCode)?.contains(t)) return
      closeDropdown()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [openCode, closeDropdown])

  // Keyboard-opened dropdowns focus their first entry.
  useEffect(() => {
    if (!openCode) focusFirst.current = false
    if (openCode && pos && focusFirst.current) {
      focusFirst.current = false
      panelRef.current?.querySelector<HTMLElement>('[data-nav-entry]:not([aria-disabled="true"])')?.focus()
    }
  }, [openCode, pos])

  // ── Open / close with a 150ms hover delay ──
  const scheduleOpen = (code: string) => {
    window.clearTimeout(closeT.current)
    if (openCode === code) return
    window.clearTimeout(openT.current)
    openT.current = window.setTimeout(() => { openedByHover.current = true; setOpenCode(code) }, 150)
  }
  const scheduleClose = () => {
    window.clearTimeout(openT.current)
    window.clearTimeout(closeT.current)
    closeT.current = window.setTimeout(() => setOpenCode(null), 150)
  }
  const closeAndFocusTrigger = () => {
    const code = openCode
    closeDropdown()
    if (code) triggerEls.current.get(code)?.focus()
  }

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    const entries = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[data-nav-entry]:not([aria-disabled="true"])') ?? [])
    const idx = entries.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); entries[(idx + 1) % entries.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); entries[(idx - 1 + entries.length) % entries.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); entries[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); entries[entries.length - 1]?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); closeAndFocusTrigger() }
    else if (e.key === 'Tab') { e.preventDefault(); closeAndFocusTrigger() }
  }

  // ── Resizable items (pointer events; widths persisted per browser, keyed by menu_code) ──
  const persist = (next: Record<string, number>) => saveTopNavWidths(next)

  const onHandleDown = (e: React.PointerEvent<HTMLSpanElement>, code: string) => {
    e.preventDefault()
    e.stopPropagation()
    const li = itemEls.current.get(code)
    if (!li) return
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    dragging.current = true
    closeDropdown()
    target.classList.add('tn-dragging')
    const startX = e.clientX
    const startW = li.offsetWidth
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    let latest = startW

    const onMove = (ev: PointerEvent) => {
      latest = Math.min(TOPNAV_MAX_WIDTH, Math.max(TOPNAV_MIN_WIDTH, Math.round(startW + ev.clientX - startX)))
      setWidths((w) => ({ ...w, [code]: latest }))
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      target.classList.remove('tn-dragging')
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
      dragging.current = false
      setWidths((w) => {
        const next = { ...w, [code]: latest }
        persist(next)
        return next
      })
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const resetOne = (code: string) => {
    setWidths((w) => {
      const next = { ...w }
      delete next[code]
      persist(next)
      return next
    })
  }

  // "รีเซ็ตความกว้างเมนู" in the user dropdown clears storage and dispatches this event.
  useEffect(() => {
    const onReset = () => setWidths({})
    window.addEventListener(TOPNAV_WIDTHS_RESET_EVENT, onReset)
    return () => window.removeEventListener(TOPNAV_WIDTHS_RESET_EVENT, onReset)
  }, [])

  // ── Render ──
  const openNode = openCode ? tree.find((n) => n.menu_code === openCode) : undefined

  const renderEntry = (n: NavNode) => {
    const isActive = active.leafCode === n.menu_code
    if (PARAM_REQUIRED_MENU_CODES.includes(n.menu_code) || !n.menu_path) {
      return (
        <span key={n.id} data-nav-entry role="menuitem" aria-disabled="true" tabIndex={-1} className="tn-child"
          title={PARAM_REQUIRED_MENU_CODES.includes(n.menu_code) ? 'กรุณาเลือกโครงการก่อน' : n.menu_name}>
          {n.menu_name}
        </span>
      )
    }
    return (
      <Link key={n.id} to={n.menu_path} data-nav-entry role="menuitem" title={n.menu_name}
        aria-current={isActive ? 'page' : undefined}
        className={`tn-child${isActive ? ' tn-child-active' : ''}`}>
        {n.menu_name}
      </Link>
    )
  }

  return (
    <header ref={barRef} className="tn-bar" style={{ height: DESKTOP_H }}>
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px' }}>
        <div style={{ flexShrink: 0 }}>{brand}</div>

        <nav ref={navRef} aria-label="เมนูหลัก" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {needsArrows && (
            <button
              type="button"
              className="tn-arrow"
              aria-label="เลื่อนไปทางซ้าย"
              disabled={!canLeft}
              onPointerDown={() => startHold(-1)}
              onPointerUp={() => endHold(-1)}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              onClick={(e) => { if (e.detail === 0) step(-1) }}
            >
              <LeftOutlined />
            </button>
          )}
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            {loading ? null : (
              <ul
                ref={stripRef}
                className="tn-strip"
                style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0, padding: '4px 6px 4px 4px', overflowX: 'auto', overflowY: 'hidden', position: 'relative', listStyle: 'none' }}
              >
                {tree.map((n) => {
                  const hasKids = n.children.length > 0
                  const label = shortLabel(n)
                  const w = widths[n.menu_code]
                  const isActiveTop = active.topCode === n.menu_code
                  const setItemRef = (el: HTMLLIElement | null) => {
                    if (el) itemEls.current.set(n.menu_code, el)
                    else itemEls.current.delete(n.menu_code)
                  }
                  return (
                    <li
                      key={n.id}
                      ref={setItemRef}
                      className="tn-item"
                      style={w ? { width: w } : undefined}
                      onPointerEnter={(e) => {
                        if (e.pointerType !== 'mouse' || dragging.current) return
                        if (hasKids) scheduleOpen(n.menu_code)
                        else scheduleClose()
                      }}
                      onPointerLeave={(e) => { if (e.pointerType === 'mouse' && hasKids) scheduleClose() }}
                    >
                      {hasKids ? (
                        <button
                          type="button"
                          ref={(el) => { if (el) triggerEls.current.set(n.menu_code, el); else triggerEls.current.delete(n.menu_code) }}
                          className={`tn-trigger${isActiveTop ? ' tn-active' : ''}`}
                          title={n.menu_name}
                          aria-haspopup="menu"
                          aria-expanded={openCode === n.menu_code}
                          aria-current={isActiveTop ? 'true' : undefined}
                          onClick={() => {
                            clearTimers()
                            // A menu the hover already opened stays open on click; a click-opened one toggles.
                            const keepOpen = openCode === n.menu_code && openedByHover.current
                            openedByHover.current = false
                            setOpenCode(keepOpen ? n.menu_code : openCode === n.menu_code ? null : n.menu_code)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') { e.preventDefault(); focusFirst.current = true; clearTimers(); setOpenCode(n.menu_code) }
                            else if (e.key === 'Escape') closeDropdown()
                            else if (e.key === 'Enter' || e.key === ' ') focusFirst.current = true
                          }}
                        >
                          <span className="tn-label">{label}</span>
                          <DownOutlined className="tn-chev" />
                        </button>
                      ) : n.menu_path ? (
                        <Link
                          to={n.menu_path}
                          ref={(el) => { if (el) triggerEls.current.set(n.menu_code, el); else triggerEls.current.delete(n.menu_code) }}
                          className={`tn-trigger${isActiveTop ? ' tn-active' : ''}`}
                          title={n.menu_name}
                          aria-current={isActiveTop ? 'page' : undefined}
                        >
                          <span className="tn-label">{label}</span>
                        </Link>
                      ) : (
                        <span className="tn-trigger" aria-disabled="true" title={n.menu_name}>
                          <span className="tn-label">{label}</span>
                        </span>
                      )}
                      <span
                        className="tn-handle"
                        aria-hidden="true"
                        onPointerDown={(e) => onHandleDown(e, n.menu_code)}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => { e.stopPropagation(); resetOne(n.menu_code) }}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
            {needsArrows && canLeft && (
              <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, pointerEvents: 'none', background: `linear-gradient(90deg, ${NAVY}, rgba(15,45,94,0))` }} />
            )}
            {needsArrows && canRight && (
              <div aria-hidden style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, pointerEvents: 'none', background: `linear-gradient(270deg, ${NAVY}, rgba(15,45,94,0))` }} />
            )}
          </div>
          {needsArrows && (
            <button
              type="button"
              className="tn-arrow"
              aria-label="เลื่อนไปทางขวา"
              disabled={!canRight}
              onPointerDown={() => startHold(1)}
              onPointerUp={() => endHold(1)}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              onClick={(e) => { if (e.detail === 0) step(1) }}
            >
              <RightOutlined />
            </button>
          )}
        </nav>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>{right}</div>
      </div>

      {openNode && createPortal(
        <div
          ref={panelRef}
          className="tn-panel"
          role="menu"
          aria-label={openNode.menu_name}
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') window.clearTimeout(closeT.current) }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') scheduleClose() }}
          onKeyDown={onPanelKeyDown}
        >
          <div className="tn-panel-title">{openNode.menu_name}</div>
          {openNode.children.map((c) =>
            c.children.length > 0 ? (
              <div key={c.id} role="group" aria-label={c.menu_name}>
                <div className="tn-group-head">{c.menu_name}</div>
                {c.children.map(renderEntry)}
              </div>
            ) : (
              renderEntry(c)
            ),
          )}
        </div>,
        document.body,
      )}
    </header>
  )
}

// ───────────────────────────────── Narrow bar + drawer ─────────────────────────────────

const NarrowBar: React.FC<BarProps & { drawerFooter: React.ReactNode }> = ({ tree, loading, active, brand, right, drawerFooter }) => {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (open && active.topCode) setExpanded(active.topCode)
  }, [open, active.topCode])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const renderLeaf = (n: NavNode) => {
    const isActive = active.leafCode === n.menu_code
    if (PARAM_REQUIRED_MENU_CODES.includes(n.menu_code) || !n.menu_path) {
      return (
        <span key={n.id} className="tn-drawer-item" aria-disabled="true"
          title={PARAM_REQUIRED_MENU_CODES.includes(n.menu_code) ? 'กรุณาเลือกโครงการก่อน' : n.menu_name}>
          {n.menu_name}
        </span>
      )
    }
    return (
      <Link key={n.id} to={n.menu_path} aria-current={isActive ? 'page' : undefined}
        className={`tn-drawer-item${isActive ? ' tn-active' : ''}`}>
        {n.menu_name}
      </Link>
    )
  }

  return (
    <header className="tn-bar" style={{ height: NARROW_H }}>
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 0 4px' }}>
        <button
          ref={btnRef}
          type="button"
          aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'}
          aria-expanded={open}
          aria-controls="tn-drawer"
          onClick={() => setOpen((o) => !o)}
          className="tn-arrow"
          style={{ width: 44, height: 44, fontSize: 18 }}
        >
          {open ? <CloseOutlined /> : <MenuOutlined />}
        </button>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>{brand}</div>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>{right}</div>
      </div>

      {open && (
        <>
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', left: 0, right: 0, top: NARROW_H, bottom: 0, background: 'rgba(9,32,63,0.55)', zIndex: DROPDOWN_Z - 1 }}
          />
          <nav
            id="tn-drawer"
            aria-label="เมนูหลัก"
            style={{
              position: 'fixed', left: 0, right: 0, top: NARROW_H, bottom: 0, zIndex: DROPDOWN_Z,
              background: NAVY, overflowY: 'auto', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ flex: 1 }}>
              {loading ? null : tree.map((n) => {
                const isActiveTop = active.topCode === n.menu_code
                if (n.children.length === 0) {
                  return n.menu_path ? (
                    <Link key={n.id} to={n.menu_path} aria-current={isActiveTop ? 'page' : undefined}
                      className={`tn-drawer-item${isActiveTop ? ' tn-active' : ''}`}>
                      {n.menu_name}
                    </Link>
                  ) : null
                }
                const isOpen = expanded === n.menu_code
                return (
                  <div key={n.id}>
                    <button
                      type="button"
                      className={`tn-drawer-item${isActiveTop ? ' tn-active' : ''}`}
                      aria-expanded={isOpen}
                      aria-controls={`tn-sub-${n.id}`}
                      onClick={() => setExpanded(isOpen ? null : n.menu_code)}
                    >
                      <span>{n.menu_name}</span>
                      <DownOutlined style={{ fontSize: 11, transform: isOpen ? 'rotate(180deg)' : undefined }} />
                    </button>
                    {isOpen && (
                      <div id={`tn-sub-${n.id}`} className="tn-drawer-sub">
                        {n.children.map((c) =>
                          c.children.length > 0 ? (
                            <div key={c.id}>
                              <div className="tn-drawer-head">{c.menu_name}</div>
                              {c.children.map(renderLeaf)}
                            </div>
                          ) : (
                            renderLeaf(c)
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', padding: 16 }}>{drawerFooter}</div>
          </nav>
        </>
      )}
    </header>
  )
}

export default TopNavMenu
