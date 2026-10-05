import React, { useEffect, useState } from 'react'
import { Skeleton } from 'antd'
import axios from 'axios'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

interface Props {
  poId: number | null
  /** Shown while the header call is loading / if it fails, so the strip never shows less than the modal knows. */
  fallbackPoNo?: string | null
  fallbackProject?: string | null
}

interface StripData {
  poNo: string
  prNos: string[]
  project: string
}

// GET /ic/pos/:poId/header — tolerant of pr_nos[] / pr_no and flat or nested project fields.
const parseHeader = (raw: any): StripData => {
  const d = raw?.data ?? raw ?? {}
  const h = d.header ?? d
  const prRaw = h.pr_nos ?? h.pr_no_list ?? h.pr_no
  const prNos: string[] = (Array.isArray(prRaw) ? prRaw : typeof prRaw === 'string' ? prRaw.split(',') : [])
    .map((v: unknown) => String(v ?? '').trim())
    .filter(Boolean)
  const code = h.project_code ?? h.project?.project_code ?? ''
  const name = h.project_name ?? h.project?.project_name ?? ''
  return {
    poNo: h.po_no ?? '',
    prNos,
    // On-screen project format: "{code} {name}", one space, no dash.
    project: [code, name].filter(Boolean).join(' '),
  }
}

const labelStyle: React.CSSProperties = { fontSize: 12.5, color: '#60a5fa' }
const valueStyle: React.CSSProperties = { fontSize: 14, color: '#1e3a8a', fontWeight: 600, overflowWrap: 'anywhere' }

const Item: React.FC<{ label: string; loading: boolean; children: React.ReactNode }> = ({ label, loading, children }) => (
  <div style={{ minWidth: 0 }}>
    <span style={labelStyle}>{label} : </span>
    {loading ? <Skeleton.Input active size="small" style={{ width: 120, minWidth: 120, height: 18, verticalAlign: 'middle' }} /> : <span style={valueStyle}>{children}</span>}
  </div>
)

/** PO / PR / โครงการ strip shared by the receive and return list modals. */
const ICPoInfoStrip: React.FC<Props> = ({ poId, fallbackPoNo, fallbackProject }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<StripData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!poId) return
    let cancelled = false
    setLoading(true)
    setData(null)
    axios
      .get(`${BASE_URL}/ic/pos/${poId}/header`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => { if (!cancelled) setData(parseHeader(res.data)) })
      .catch(() => { /* non-blocking: strip falls back to "-" / modal context */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId])

  const poNo = data?.poNo || fallbackPoNo || '-'
  const prText = data && data.prNos.length > 0 ? data.prNos.join(', ') : '-'
  const project = data?.project || fallbackProject || '-'

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 32px',
        padding: '10px 14px',
        marginBottom: 12,
        background: '#eff6ff',
        border: '1px solid #dbeafe',
        borderRadius: 8,
      }}
    >
      <Item label="PO" loading={false}>{poNo}</Item>
      <Item label="PR" loading={loading}>{prText}</Item>
      <Item label="โครงการ" loading={loading && !project}>{project}</Item>
    </div>
  )
}

export default ICPoInfoStrip
