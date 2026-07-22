import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Table, Input, Select, Button, Typography, message } from 'antd'
import axios from 'axios'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const { Text } = Typography

export interface CostCodeItem {
  subgroupId: number
  costCode: string
  subjectCode: string
  subjectName: string
  jobCode: string
  jobName: string
  groupCode: string
  groupName: string
  subgroupCode: string
  subgroupName: string
}

interface SelectOption {
  value: string
  label: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (item: CostCodeItem) => void
}

const CostCodeSelectionModal: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [data, setData] = useState<CostCodeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  /* ── filter state ──────────────────────────────────────────────
     The /cost-code/full response is already flat with job_code/group_code on every
     row, so Job Type → Group cascading is done client-side against the single fetch
     rather than round-tripping to the cascading /jobs, /groups endpoints — those exist
     for the Material-style subject-scoped cascade, but here job_code/group_code alone
     are enough to filter this already-small hierarchy table. */
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setSearch('')
    setSelectedJob(null)
    setSelectedGroup(null)

    const fetchCostCodes = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/cost-code/full`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setData(
          (Array.isArray(list) ? list : []).map((c: any) => ({
            subgroupId:   c.subgroup_id,
            costCode:     c.cost_code,
            subjectCode:  c.subject_code,
            subjectName:  c.subject_name,
            jobCode:      c.job_code,
            jobName:      c.job_name,
            groupCode:    c.group_code,
            groupName:    c.group_name,
            subgroupCode: c.subgroup_code,
            subgroupName: c.subgroup_name,
          })),
        )
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'โหลดข้อมูล Cost Code ไม่สำเร็จ'
        message.error(errMsg)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchCostCodes()
  }, [open, accessToken])

  // Job Type filter options — distinct job_code across the whole hierarchy
  const jobOptions: SelectOption[] = useMemo(() => {
    const seen = new Map<string, string>()
    data.forEach((d) => {
      if (!seen.has(d.jobCode)) seen.set(d.jobCode, d.jobName)
    })
    return Array.from(seen.entries())
      .map(([code, name]) => ({ value: code, label: name ? `${code} — ${name}` : code }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }, [data])

  // Group filter options — cascades from the selected Job Type
  const groupOptions: SelectOption[] = useMemo(() => {
    const seen = new Map<string, string>()
    data
      .filter((d) => !selectedJob || d.jobCode === selectedJob)
      .forEach((d) => {
        if (!seen.has(d.groupCode)) seen.set(d.groupCode, d.groupName)
      })
    return Array.from(seen.entries())
      .map(([code, name]) => ({ value: code, label: name ? `${code} — ${name}` : code }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }, [data, selectedJob])

  // reset Group filter if it no longer applies once Job Type changes
  useEffect(() => {
    if (selectedGroup && !groupOptions.some((o) => o.value === selectedGroup)) {
      setSelectedGroup(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJob])

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.filter((d) => {
      if (selectedJob && d.jobCode !== selectedJob) return false
      if (selectedGroup && d.groupCode !== selectedGroup) return false
      if (!q) return true
      return (
        d.costCode.toLowerCase().includes(q) ||
        d.subjectName?.toLowerCase().includes(q) ||
        d.jobName?.toLowerCase().includes(q) ||
        d.groupName?.toLowerCase().includes(q) ||
        d.subgroupName?.toLowerCase().includes(q) ||
        d.subgroupCode?.toLowerCase().includes(q)
      )
    })
  }, [data, search, selectedJob, selectedGroup])

  const handleSelect = (item: CostCodeItem) => {
    onSelect(item)
    onClose()
  }

  const columns = [
    { title: 'Subject', key: 'subject', width: 140, render: (_: unknown, r: CostCodeItem) => `${r.subjectCode} — ${r.subjectName}` },
    { title: 'Job', key: 'job', width: 140, render: (_: unknown, r: CostCodeItem) => `${r.jobCode} — ${r.jobName}` },
    { title: 'Group', key: 'group', width: 140, render: (_: unknown, r: CostCodeItem) => `${r.groupCode} — ${r.groupName}` },
    { title: 'รหัสกลุ่มย่อย', dataIndex: 'subgroupCode', key: 'subgroupCode', width: 110 },
    { title: 'ชื่อกลุ่มย่อย', dataIndex: 'subgroupName', key: 'subgroupName', ellipsis: true },
    {
      title: 'รหัสรวม',
      dataIndex: 'costCode',
      key: 'costCode',
      width: 120,
      render: (v: string) => <Text code style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_: unknown, r: CostCodeItem) => (
        <Button
          size="small"
          type="primary"
          onClick={(e) => { e.stopPropagation(); handleSelect(r) }}
        >
          เลือก
        </Button>
      ),
    },
  ]

  return (
    <Modal
      title={<span style={{ color: '#1e3a8a', fontWeight: 700 }}>เลือก Cost Code</span>}
      open={open}
      onCancel={onClose}
      width={900}
      destroyOnClose
      footer={
        <Button onClick={onClose}>ยกเลิก</Button>
      }
    >
      {/* ── filters ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Job Type</div>
          <Select
            placeholder="เลือก Job Type"
            allowClear
            showSearch
            style={{ width: '100%' }}
            options={jobOptions}
            value={selectedJob ?? undefined}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            onChange={(v) => setSelectedJob(v ?? null)}
          />
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Group</div>
          <Select
            placeholder="เลือก Group"
            allowClear
            showSearch
            style={{ width: '100%' }}
            options={groupOptions}
            value={selectedGroup ?? undefined}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            onChange={(v) => setSelectedGroup(v ?? null)}
          />
        </div>
      </div>

      {/* ── search ── */}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>ค้นหาอิสระ (รหัสรวม / Subject / Job / Group / Subgroup)</div>
      <Input
        placeholder="ค้นหา เช่น LE30300, ชื่อ Subject/Job/Group/Subgroup..."
        allowClear
        style={{ marginBottom: 12 }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Table
        rowKey="subgroupId"
        loading={loading}
        dataSource={filteredData}
        columns={columns}
        size="small"
        scroll={{ x: 800, y: 340 }}
        pagination={{ pageSize: 10, showTotal: (t) => `ทั้งหมด ${t} รายการ` }}
        onRow={(record) => ({
          style: { cursor: 'pointer' },
          onClick: () => handleSelect(record),
        })}
        locale={{ emptyText: 'ไม่พบ Cost Code' }}
      />
    </Modal>
  )
}

export default CostCodeSelectionModal
