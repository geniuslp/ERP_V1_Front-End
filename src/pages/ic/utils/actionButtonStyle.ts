import type React from 'react'

// DESIGN.md Button spec for IC PO Receive (blue) / PO Return (red) action buttons.
// Inline styles can't express :hover, so hover colour is swapped via mouse handlers.
const COLORS = {
  receive: { base: '#1d4ed8', hover: '#2563eb' },
  return: { base: '#dc2626', hover: '#b91c1c' },
} as const

const SIZE: React.CSSProperties = {
  height: 46,
  fontSize: 17,
  fontWeight: 500,
  padding: '0 23px',
  borderRadius: 8,
}

export const icActionButtonProps = (kind: 'receive' | 'return', disabled = false) => {
  const { base, hover } = COLORS[kind]
  // When disabled, leave colours to antd's disabled styling.
  if (disabled) return { style: SIZE }
  const paint = (el: HTMLElement, bg: string) => {
    el.style.background = bg
    el.style.borderColor = bg
  }
  return {
    style: { ...SIZE, background: base, borderColor: base, color: '#fff' } as React.CSSProperties,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => paint(e.currentTarget, hover),
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => paint(e.currentTarget, base),
  }
}
