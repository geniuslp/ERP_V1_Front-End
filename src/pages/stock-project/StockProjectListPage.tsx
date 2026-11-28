import React, { useEffect, useState } from 'react'
import { Card, Select, message } from 'antd'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import StockProjectBalance from './StockProjectBalance'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

// GET /stock/by-project?all=true
interface StockProject {
  project_code: string
  project_name: string
  source?: 'WAREHOUSE' | 'PROJECT'
}

// kind = which menu opened the page: "project" = 2.1 คลังโครงการ (normal projects), "fac" = 2.2 คลัง Fac
// (warehouse projects, source WAREHOUSE). Same page and balance view, only the project list differs.
const KIND_TITLE = { project: 'คลังโครงการ', fac: 'คลัง Fac' } as const

const StockProjectListPage: React.FC<{ kind?: 'project' | 'fac' }> = ({ kind = 'project' }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [options, setOptions] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [projectCode, setProjectCode] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/stock/by-project`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { all: true },
        })
        const payload = res.data?.data ?? res.data
        const rows = Array.isArray(payload) ? payload : payload?.data ?? payload?.rows ?? []
        if (!cancelled) {
          setOptions(
            (Array.isArray(rows) ? rows : [])
              .filter((p: StockProject) => (kind === 'fac' ? p.source === 'WAREHOUSE' : p.source !== 'WAREHOUSE'))
              .map((p: StockProject) => ({
              value: p.project_code,
              label: `${p.project_code} ${p.project_name}`,
            }))
          )
        }
      } catch (err: any) {
        if (!cancelled) message.error(err?.response?.data?.message || err?.response?.data?.error || 'โหลดรายการโครงการไม่สำเร็จ')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [accessToken, kind])

  return (
    <div>
      <PageHeader
        title={KIND_TITLE[kind]}
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Inventory Control' }, { title: 'คลัง (Stock)' }, { title: KIND_TITLE[kind] }]}
      />
      <Card style={cardStyle}>
        <Select
          showSearch
          allowClear
          loading={loading}
          placeholder={kind === 'fac' ? 'เลือกคลัง Fac' : 'เลือกโครงการ'}
          options={options}
          value={projectCode}
          onChange={setProjectCode}
          filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          style={{ width: '100%', maxWidth: 560 }}
        />
      </Card>
      {projectCode && <StockProjectBalance key={projectCode} projectCode={projectCode} />}
    </div>
  )
}

export default StockProjectListPage
