import React from 'react'
import { signerNameFontPt } from '@/utils/signerName'

// Approval / request by user ID (2026-11-26): every print (Memo, PR, PO, WO, IC, Petty Cash) shows the
// person's username in the signature box instead of a signature image. One component so the size and look
// stay the same on every document: as large as fits the box (max 18pt, min 12pt), semi-bold, centred.
const SignerId: React.FC<{ name?: string | null; boxMm: number; style?: React.CSSProperties }> = ({ name, boxMm, style }) => {
  const text = (name ?? '').trim()
  if (!text) return null
  return (
    <div
      style={{
        textAlign: 'center',
        fontFamily: "'Cordia New', sans-serif",
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: '0.2px',
        color: '#000',
        fontSize: `${signerNameFontPt(text, boxMm, 18, 12)}pt`,
        overflowWrap: 'anywhere',
        ...style,
      }}
    >
      {text}
    </div>
  )
}

export default SignerId
