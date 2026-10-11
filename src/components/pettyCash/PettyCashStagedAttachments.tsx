import React, { useRef, useState } from 'react'
import { Button, Modal, Tag, Spin } from 'antd'
import { UploadOutlined, DeleteOutlined, CloseOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fileIcon, fmtSize, ATTACH_ACCEPT } from './attachmentUtils'
import type { PettyCashAttachment } from '@/types/pettyCash'

export interface StagedFile { uid: string; file: File }

// Attachment control: the PR create page's drag-and-drop box (same markup/styling) followed by one
// compact line per file. Used on the create/edit page (files staged locally) and on the detail page (files
// uploaded immediately, `staged` empty).

interface Props {
  staged?: StagedFile[]
  saved: PettyCashAttachment[]
  /** Picking / removing staged files is allowed. */
  canStage: boolean
  /** Deleting already-saved files is allowed (document is DRAFT). */
  canDeleteSaved: boolean
  /** Text such as "กำลังอัปโหลดไฟล์ 2/3" while files are uploading. */
  progressText?: string
  /** Shows the loading state on the "แนบไฟล์" button. */
  busy?: boolean
  onStage: (file: File) => void
  onUnstage?: (uid: string) => void
  onDeleteSaved: (att: PettyCashAttachment) => Promise<void>
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#1e40af',
  background: '#f8faff', border: '0.5px solid #bfdbfe', borderRadius: 6, padding: '3px 8px',
}

const nameStyle: React.CSSProperties = {
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
}

const sizeStyle: React.CSSProperties = { fontSize: 11, color: '#6b7280', flexShrink: 0 }

const PettyCashStagedAttachments: React.FC<Props> = ({
  staged = [], saved, canStage, canDeleteSaved, progressText, busy, onStage, onUnstage, onDeleteSaved,
}) => {
  const confirmDelete = (a: PettyCashAttachment) => {
    Modal.confirm({
      title: 'ลบไฟล์แนบ',
      content: `ต้องการลบไฟล์ "${a.file_name}" ใช่หรือไม่`,
      okText: 'ลบ',
      cancelText: 'ยกเลิก',
      okButtonProps: { danger: true },
      centered: true,
      onOk: () => onDeleteSaved(a),
    })
  }

  const empty = staged.length === 0 && saved.length === 0
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const addFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((f) => onStage(f))
  }

  return (
    <div style={{ width: '50%', minWidth: 320, maxWidth: '100%' }}>
      {canStage && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ATTACH_ACCEPT}
            style={{ display: 'none' }}
            onChange={(e) => {
              addFiles(e.target.files)
              ;(e.target as HTMLInputElement).value = ''
            }}
          />
          {/* Drop zone — same markup/styling as PRCreatePage */}
          <div
            onClick={() => { if (!busy) fileInputRef.current?.click() }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (!busy) addFiles(e.dataTransfer.files) }}
            style={{
              border: `1.5px dashed ${isDragging ? '#2563eb' : '#bfdbfe'}`,
              borderRadius: 8,
              padding: '8px 12px',
              cursor: busy ? 'not-allowed' : 'pointer',
              background: isDragging ? '#eff6ff' : '#f8faff',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s',
            }}
          >
            {busy ? <Spin size="small" /> : <UploadOutlined style={{ color: '#2563eb', fontSize: 18, flexShrink: 0 }} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#1e40af' }}>
                คลิกเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title="รองรับ JPG, PDF, DOC, XLS — เลือกได้หลายไฟล์พร้อมกัน">
                รองรับ JPG, PDF, DOC, XLS — เลือกได้หลายไฟล์พร้อมกัน
              </div>
            </div>
          </div>
        </>
      )}
      {progressText && <div style={{ marginTop: 6, fontSize: 12, color: '#1d4ed8' }}>{progressText}</div>}

      {empty ? (
        !canStage && <span style={{ fontSize: 12, color: '#9ca3af' }}>ยังไม่มีไฟล์แนบ</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: canStage || progressText ? 8 : 0 }}>
          {saved.map((a) => (
            <div key={`saved-${a.id}`} style={rowStyle}>
              {fileIcon(a.file_name)}
              <a
                href={a.file_path}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...nameStyle, color: '#1e40af' }}
                title={[
                  a.file_name,
                  a.uploaded_by_name ? `โดย ${a.uploaded_by_name}` : '',
                  a.uploaded_at ? dayjs(a.uploaded_at).format('DD/MM/YYYY HH:mm') : '',
                ].filter(Boolean).join(' · ')}
              >
                {a.file_name}
              </a>
              <span style={sizeStyle}>{fmtSize(a.file_size)}</span>
              {canDeleteSaved && (
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDelete(a)} />
              )}
            </div>
          ))}
          {staged.map(({ uid, file }) => (
            <div key={uid} style={rowStyle}>
              {fileIcon(file.name)}
              <span style={nameStyle} title={file.name}>{file.name}</span>
              <Tag style={{ margin: 0, fontSize: 11, lineHeight: '16px' }}>รออัปโหลด</Tag>
              <span style={sizeStyle}>{fmtSize(file.size)}</span>
              {canStage && onUnstage && (
                <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => onUnstage(uid)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PettyCashStagedAttachments
