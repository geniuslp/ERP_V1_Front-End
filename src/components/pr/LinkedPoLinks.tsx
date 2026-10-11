import React from 'react'
import { Space } from 'antd'

export interface LinkedPo {
  poId: number
  poNo: string
  status: string
}

// Maps the API's `linked_pos` ({po_id, po_no, status}[]) to LinkedPo[].
// Missing/invalid input -> []. Cancelled POs are dropped defensively; the
// backend should already exclude them from the "active link" list.
export const mapLinkedPos = (raw: unknown): LinkedPo[] =>
  Array.isArray(raw)
    ? raw
        .filter((p: any) => p && p.po_id != null && p.status !== 'CANCELLED')
        .map((p: any) => ({ poId: Number(p.po_id), poNo: String(p.po_no ?? ''), status: String(p.status ?? '') }))
    : []

// PO detail route (App.tsx: /po/approval/:id), opened in a new tab so the
// user keeps the PR page.
export const PoLink: React.FC<{ po: LinkedPo }> = ({ po }) => (
  <a
    href={`/po/approval/${po.poId}`}
    target="_blank"
    rel="noopener noreferrer"
    style={{ color: '#2563eb', fontWeight: 600 }}
    onClick={(e) => e.stopPropagation()}
  >
    {po.poNo}
  </a>
)

export const LinkedPoList: React.FC<{ pos: LinkedPo[] }> = ({ pos }) => (
  <Space size={[8, 4]} wrap>
    {pos.map((p, i) => (
      <React.Fragment key={p.poId}>
        <PoLink po={p} />
        {i < pos.length - 1 && <span style={{ color: '#9ca3af' }}>,</span>}
      </React.Fragment>
    ))}
  </Space>
)

export const linkedPoNoText = (pos: LinkedPo[]) => pos.map((p) => p.poNo).join(', ')
