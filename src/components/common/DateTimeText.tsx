import React from 'react'
import { Tooltip } from 'antd'
import dayjs from 'dayjs'

interface DateTimeTextProps {
  /** ISO timestamp from the API (the backend sends Thai time with a +07:00 offset). */
  value?: string | null
  /** Shown when there is no value. */
  empty?: React.ReactNode
}

/** DD/MM/YYYY — the normal on-screen date. */
export const formatDate = (value?: string | null): string => {
  if (!value) return ''
  const d = dayjs(value)
  return d.isValid() ? d.format('DD/MM/YYYY') : ''
}

/** DD/MM/YYYY HH:mm:ss — shown in the hover tooltip. */
export const formatDateTime = (value?: string | null): string => {
  if (!value) return ''
  const d = dayjs(value)
  return d.isValid() ? d.format('DD/MM/YYYY HH:mm:ss') : ''
}

/** Shows the date only; hovering reveals the full date and time. Use for created / updated / approved times. */
const DateTimeText: React.FC<DateTimeTextProps> = ({ value, empty = '—' }) => {
  const date = formatDate(value)
  if (!date) return <>{empty}</>
  return (
    <Tooltip title={formatDateTime(value)}>
      <span style={{ cursor: 'default' }}>{date}</span>
    </Tooltip>
  )
}

export default DateTimeText
