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
     row. Job is now a document-level field (PR's own "ประเภท Job" dropdown) rather
     than a per-line selection, so there's no Job Type filter here anymore — Group
     is filtered directly against the whole dataset instead of cascading from a
     job selection. jobCode/jobName are still fetched/kept on each row (free-text
     search still matches against them) — only the selectable Job level is gone. */
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setSearch('')
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

  // Group filter options — distinct group_code across the whole hierarchy
  // (previously cascaded from a Job Type selection; Job is no longer a
  // selectable filter level here, see note above).
  const groupOptions: SelectOption[] = useMemo(() => {
    const seen = new Map<string, string>()
    data.forEach((d) => {
      if (!seen.has(d.groupCode)) seen.set(d.groupCode, d.groupName)
    })
    return Array.from(seen.entries())
      .map(([code, name]) => ({ value: code, label: name ? `${code} — ${name}` : code }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }, [data])

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.filter((d) => {
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
  }, [data, search, selectedGroup])

  const handleSelect = (item: CostCodeItem) => {
    onSelect(item)
    onClose()
  }

  const columns = [
    { title: 'Subject', key: 'subject', width: 140, render: (_: unknown, r: CostCodeItem) => `${r.subjectCode} — ${r.subjectName}` },
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
