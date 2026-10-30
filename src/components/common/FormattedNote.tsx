import React from 'react'
import { formatNote } from '@/utils/formatNote'

interface Props {
  value?: string | null
  /** Shown when there is no text. */
  empty?: React.ReactNode
  lineHeight?: string | number
  style?: React.CSSProperties
}

// A free-text note laid out as a list: "1." / "2." items and "-" bullets each start a new line
// (bullets indented). Works on screen and in print (plain divs, no antd).
const FormattedNote: React.FC<Props> = ({ value, empty = null, lineHeight, style }) => {
  const lines = formatNote(value)
  if (lines.length === 0) return <>{empty}</>
  return (
    <div style={{ overflowWrap: 'anywhere', ...style }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{ lineHeight, minHeight: l.text === '' ? '0.8em' : undefined, paddingLeft: l.indent ? '1.4em' : undefined }}
        >
          {l.text}
        </div>
      ))}
    </div>
  )
}

export default FormattedNote
