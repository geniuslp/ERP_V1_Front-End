import type { CSSProperties } from 'react'

// "Block" look shared by every section card (see DESIGN.md → Block card). antd Cards get it from the global rules in
// src/index.css; plain <div> blocks (PO detail sections, master-page panels, Memo attachments) that are not antd
// Cards take it from these two objects so they match.
export const BLOCK_CARD_STYLE: CSSProperties = {
  border: '1px solid #bcd0f0',
  borderLeft: '4px solid #2563eb',
  borderRadius: 12,
  boxShadow: '0 4px 16px rgba(15,45,94,0.14)',
}

// Header strip of a plain-div block: tinted background, blue divider, navy bold title.
export const BLOCK_HEAD_STYLE: CSSProperties = {
  background: '#eef4ff',
  borderBottom: '1px solid #cfe0f7',
  color: '#0f2d5e',
  fontWeight: 700,
}
