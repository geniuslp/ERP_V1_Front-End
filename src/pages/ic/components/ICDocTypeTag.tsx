import React from 'react'
import { Tag } from 'antd'

export type ICDocType = 'RECEIVE' | 'RETURN'

// Prefer the API's doc_type; otherwise derive from the stock transaction's ref_doc_type.
// Never derive from the document-number prefix.
export const resolveICDocType = (docType?: string | null, refDocType?: string | null): ICDocType | null => {
  if (docType === 'RECEIVE' || docType === 'RETURN') return docType
  if (refDocType === 'PO') return 'RECEIVE'
  if (refDocType === 'PO_RETURN') return 'RETURN'
  return null
}

export const IC_DOC_TYPE_STYLE: Record<ICDocType, { label: string; color: string; bg: string; border: string }> = {
  RECEIVE: { label: 'PO Receive', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  RETURN: { label: 'PO Return', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
}

interface Props {
  docType?: string | null
  refDocType?: string | null
  style?: React.CSSProperties
}

const ICDocTypeTag: React.FC<Props> = ({ docType, refDocType, style }) => {
  const type = resolveICDocType(docType, refDocType)
  if (!type) return null
  const s = IC_DOC_TYPE_STYLE[type]
  return (
    <Tag style={{ margin: 0, color: s.color, background: s.bg, borderColor: s.border, ...style }}>{s.label}</Tag>
  )
}

export default ICDocTypeTag
