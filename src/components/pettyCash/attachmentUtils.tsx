import React from 'react'
import {
  FilePdfOutlined, FileImageOutlined, FileWordOutlined, FileExcelOutlined, FileOutlined,
} from '@ant-design/icons'

// Shared by the Petty Cash attachment control (create/edit page and detail page).

export const MAX_BYTES = 10 * 1024 * 1024
export const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx']
export const ATTACH_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx'

export const extOf = (name: string) => (name.split('.').pop() ?? '').toLowerCase()

export const fileIcon = (name: string) => {
  const style = { color: '#2563eb', fontSize: 14, flexShrink: 0 }
  switch (extOf(name)) {
    case 'pdf': return <FilePdfOutlined style={{ ...style, color: '#dc2626' }} />
    case 'jpg': case 'jpeg': case 'png': return <FileImageOutlined style={style} />
    case 'doc': case 'docx': return <FileWordOutlined style={style} />
    case 'xls': case 'xlsx': return <FileExcelOutlined style={{ ...style, color: '#16a34a' }} />
    default: return <FileOutlined style={style} />
  }
}

export const fmtSize = (bytes?: number | null) => {
  if (bytes == null) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Thai error text when the file is not allowed (type / size), else null. */
export const validateAttachmentFile = (file: File): string | null => {
  if (!ALLOWED_EXT.includes(extOf(file.name))) return 'รองรับเฉพาะไฟล์ pdf, jpg, jpeg, png, doc, docx, xls, xlsx เท่านั้น'
  if (file.size > MAX_BYTES) return 'ไฟล์ต้องมีขนาดไม่เกิน 10 MB'
  return null
}
