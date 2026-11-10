import React, { useEffect, useState } from 'react'
import { Table, Tag, Spin } from 'antd'
import axios from 'axios'
import { useAppSelector } from '@/store'
import { resolveFileUrl } from '@/utils/fileUrl'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

type Source = 'MEMO' | 'PR' | 'PO' | 'WO'

interface FileRow {
  key: string
  source: Source
  file_name: string
  file_path: string
  file_size?: number | null
}

const SOURCE_TAG: Record<Source, { label: string; color: string }> = {
  MEMO: { label: 'Memo', color: 'purple' },
  PR: { label: 'PR', color: 'blue' },
  PO: { label: 'PO', color: 'green' },
  WO: { label: 'WO', color: 'orange' },
}

const fmtSize = (n?: number | null) =>
  n ? (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : '-'

const toRows = (source: Source, list: any): FileRow[] =>
  (Array.isArray(list) ? list : []).map((a: any) => ({
    key: `${source}-${a.id}`,
    source,
    file_name: a.file_name ?? a.fileName ?? '',
    file_path: resolveFileUrl(a.file_path ?? a.filePath) ?? '',
    file_size: a.file_size ?? a.fileSize ?? null,
  }))

interface Props {
  kind: 'PO' | 'WO'
  docId: number | string
}

/**
 * Read-only list of the files that travel with a document: Memo → PR → PO (or WO), each row tagged with where it
 * came from. PO: one call (GET /po/:id carries attachments.memo / .pr / .po). WO: the work order's own files
 * (GET /work-order/:id/attachments) plus, when it was created from a PR, that PR's and its Memo's files
 * (GET /pr/:id). A source that cannot be loaded is simply left out.
 */
const LinkedDocFiles: React.FC<Props> = ({ kind, docId }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [rows, setRows] = useState<FileRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const headers = { Authorization: `Bearer ${accessToken}` }
    const get = async (url: string) => {
      try { return (await axios.get(`${BASE_URL}${url}`, { headers })).data?.data } catch { return null }
    }
    const run = async () => {
      setLoading(true)
      let memo: FileRow[] = []
      let pr: FileRow[] = []
      let own: FileRow[] = []
      if (kind === 'PO') {
        const po = await get(`/po/${docId}`)
        memo = toRows('MEMO', po?.attachments?.memo)
        pr = toRows('PR', po?.attachments?.pr)
        own = toRows('PO', po?.attachments?.po)
      } else {
        const [wo, woFiles] = await Promise.all([get(`/work-order/${docId}`), get(`/work-order/${docId}/attachments`)])
        own = toRows('WO', woFiles)
        if (wo?.pr_id) {
          const prDoc = await get(`/pr/${wo.pr_id}`)
          memo = toRows('MEMO', prDoc?.attachments?.memo)
          pr = toRows('PR', prDoc?.attachments?.pr)
        }
      }
      if (!cancelled) {
        setRows([...memo, ...pr, ...own])
        setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [accessToken, kind, docId])

  if (loading) return <div style={{ textAlign: 'center', padding: 16 }}><Spin /></div>
  if (rows.length === 0) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 600, color: '#1e3a8a', marginBottom: 8 }}>
        ไฟล์แนบจากเอกสารต้นทาง (Memo → PR → {kind})
      </div>
      <Table<FileRow>
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={rows}
        columns={[
          {
            title: 'ที่มา', dataIndex: 'source', width: 100,
            render: (s: Source) => <Tag color={SOURCE_TAG[s].color} style={{ marginInlineEnd: 0 }}>{SOURCE_TAG[s].label}</Tag>,
          },
          { title: 'ชื่อไฟล์', dataIndex: 'file_name', render: (v: string, r) => <a href={r.file_path} target="_blank" rel="noopener noreferrer">{v}</a> },
          { title: 'ขนาด', dataIndex: 'file_size', width: 110, align: 'right', render: (v?: number | null) => fmtSize(v) },
        ]}
      />
    </div>
  )
}

export default LinkedDocFiles
