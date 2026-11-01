import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { Button, Popconfirm, Table, Tag, Upload, message } from 'antd'
import { DeleteOutlined, InboxOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useAppSelector } from '@/store'
import { resolveFileUrl } from '@/utils/fileUrl'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

interface SavedFile {
  id: number
  file_name: string
  file_path: string
  file_size?: number | null
}

// A file picked before the work order exists: kept here until uploadPending(woId) sends it.
interface QueuedFile {
  uid: string
  file: File
}

type Row = { key: string; file_name: string; file_size?: number | null; saved?: SavedFile; queued?: QueuedFile }

const fmtSize = (n?: number | null) =>
  n ? (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : '-'

const errText = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback

export interface WOAttachmentHandle {
  /** Uploads the files picked before the work order was saved; call right after the first save with the new id. */
  uploadPending: (woId: number | string) => Promise<void>
}

interface Props {
  /** Saved work order id. While it is missing, picked files are queued and sent by uploadPending(). */
  woId?: number | string
  /** List only (no upload / delete) — used where the files belong to the work order but are not edited there. */
  readOnly?: boolean
  /** Read-only mode: render nothing at all while the work order has no files. */
  hideWhenEmpty?: boolean
  /** Optional heading shown above the file table (only rendered together with the table). */
  title?: string
}

// Files attached to a work order itself: GET/POST/DELETE /work-order/:id/attachments (PDF / JPEG, 10 MB each).
// Same drop zone + file table as the "แนบไฟล์ PDF/JPEG" tab of the contractor work log. With a saved work order a
// dropped file is uploaded right away; before the first save it waits in a local queue (tagged "รอบันทึก") and the
// create page uploads it as soon as the work order gets its id.
const WOAttachmentPanel = forwardRef<WOAttachmentHandle, Props>(({ woId, readOnly = false, hideWhenEmpty = false, title }, ref) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const headers = { Authorization: `Bearer ${accessToken}` }
  const [files, setFiles] = useState<SavedFile[]>([])
  const [queued, setQueued] = useState<QueuedFile[]>([])
  const [loaded, setLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)

  const loadFor = useCallback(async (id?: number | string) => {
    if (!id) { setFiles([]); setLoaded(true); return }
    try {
      const res = await axios.get(`${BASE_URL}/work-order/${id}/attachments`, { headers: { Authorization: `Bearer ${accessToken}` } })
      setFiles(Array.isArray(res.data?.data) ? res.data.data : [])
    } catch (e) {
      message.error(errText(e, 'โหลดไฟล์แนบไม่สำเร็จ'))
    } finally {
      setLoaded(true)
    }
  }, [accessToken])

  useEffect(() => { void loadFor(woId) }, [loadFor, woId])

  const postFile = (id: number | string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return axios.post(`${BASE_URL}/work-order/${id}/attachments`, fd, { headers })
  }

  useImperativeHandle(ref, () => ({
    uploadPending: async (id) => {
      if (queued.length === 0) return
      setUploading(true)
      const failed: string[] = []
      for (const q of queued) {
        try { await postFile(id, q.file) } catch { failed.push(q.file.name) }
      }
      setQueued([])
      setUploading(false)
      await loadFor(id)
      if (failed.length > 0) message.error(`แนบไฟล์ไม่สำเร็จ: ${failed.join(', ')} — กรุณาแนบใหม่อีกครั้ง`)
    },
  }))

  const accept = async (file: File) => {
    if (!/\.(pdf|jpe?g)$/i.test(file.name)) { message.error('รองรับเฉพาะไฟล์ PDF หรือ JPEG'); return }
    if (file.size > 10 * 1024 * 1024) { message.error('ไฟล์ต้องมีขนาดไม่เกิน 10 MB'); return }
    if (!woId) {
      setQueued((prev) => [...prev, { uid: `${Date.now()}-${Math.random()}`, file }])
      return
    }
    setUploading(true)
    try {
      await postFile(woId, file)
      await loadFor(woId)
      message.success('แนบไฟล์เรียบร้อยแล้ว')
    } catch (e) {
      message.error(errText(e, 'แนบไฟล์ไม่สำเร็จ'))
    } finally {
      setUploading(false)
    }
  }

  const removeSaved = async (f: SavedFile) => {
    try {
      await axios.delete(`${BASE_URL}/work-order/${woId}/attachments/${f.id}`, { headers })
      setFiles((prev) => prev.filter((x) => x.id !== f.id))
    } catch (e) {
      message.error(errText(e, 'ลบไฟล์ไม่สำเร็จ'))
    }
  }

  if (readOnly && hideWhenEmpty && (!loaded || files.length === 0)) return null

  const rows: Row[] = [
    ...files.map((f): Row => ({ key: `s-${f.id}`, file_name: f.file_name, file_size: f.file_size, saved: f })),
    ...queued.map((q): Row => ({ key: `q-${q.uid}`, file_name: q.file.name, file_size: q.file.size, queued: q })),
  ]

  return (
    <div>
      {title && <div style={{ fontSize: 14, fontWeight: 600, color: '#1e3a8a', marginBottom: 8 }}>{title}</div>}
      {!readOnly && (
        <Upload.Dragger
          accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
          showUploadList={false}
          multiple
          disabled={uploading}
          beforeUpload={(file) => { void accept(file as unknown as File); return false }}
          style={{ marginBottom: 16 }}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">{uploading ? 'กำลังอัปโหลด...' : 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}</p>
          <p className="ant-upload-hint">
            รองรับไฟล์ PDF / JPEG ไฟล์ละไม่เกิน 10 MB (เลือกได้หลายไฟล์)
            {!woId && ' — ไฟล์จะถูกอัปโหลดเมื่อกด "บันทึกและไปต่อ"'}
          </p>
        </Upload.Dragger>
      )}
      <Table<Row>
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={rows}
        locale={{ emptyText: 'ยังไม่มีไฟล์แนบ' }}
        columns={[
          {
            title: 'ชื่อไฟล์', dataIndex: 'file_name',
            render: (v: string, r) => r.saved
              ? <a href={resolveFileUrl(r.saved.file_path)} target="_blank" rel="noopener noreferrer">{v}</a>
              : <span>{v} <Tag color="orange" style={{ marginLeft: 6 }}>รอบันทึก</Tag></span>,
          },
          { title: 'ขนาด', dataIndex: 'file_size', width: 110, align: 'right', render: (v?: number | null) => fmtSize(v) },
          ...(readOnly ? [] : [{
            title: '', key: 'del', width: 56, align: 'center' as const,
            render: (_: unknown, r: Row) => r.queued ? (
              <Button type="text" danger size="small" icon={<DeleteOutlined />}
                onClick={() => setQueued((prev) => prev.filter((x) => x.uid !== r.queued!.uid))} />
            ) : (
              <Popconfirm title="ลบไฟล์นี้?" okText="ลบ" cancelText="ยกเลิก" onConfirm={() => removeSaved(r.saved!)}>
                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          }]),
        ]}
      />
    </div>
  )
})

WOAttachmentPanel.displayName = 'WOAttachmentPanel'

export default WOAttachmentPanel
