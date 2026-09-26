import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Table, Input, Select, Row, Col, message } from 'antd'
import axios from 'axios'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

export interface ICMovementMaterialOption {
  mat_code: string
  mat_name: string
  spec_name?: string
  cost_code: string
  cost_name: string
  cost_subgroup_id: number
  unit: string
  qty_on_hand: number
}

interface SelectOption {
  value: string
  label: string
}

interface Props {
  open: boolean
  projectCode: string
  movementId: string
  jobCode?: string
  onClose: () => void
  onSelect: (material: ICMovementMaterialOption) => void
}

// Scoped to this project's ic_project_cost_item (qty_on_hand > 0) for the movement's
// job_code — a small list (materials actually received into one project/job code), so
// Subgroup/MatName filter options are derived client-side from the fetched set rather
// than a separate /master lookup, and no server-side pagination is needed.
const ICMovementMaterialPickerModal: React.FC<Props> = ({
  open,
  projectCode,
  movementId,
  jobCode,
  onClose,
  onSelect,
}) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [materials, setMaterials] = useState<ICMovementMaterialOption[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedCostCode, setSelectedCostCode] = useState<string | undefined>(undefined)
  const [selectedMatName, setSelectedMatName] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open || !projectCode || !movementId) return
    setSelectedCostCode(undefined)
    setSelectedMatName(undefined)
    setSearch('')

    let cancelled = false
    const fetchMaterials = async () => {
      setLoading(true)
      try {
        const res = await axios.get(
          `${BASE_URL}/ic/projects/${projectCode}/movements/${movementId}/available-materials`,
          { headers: authHeader, params: { job_code: jobCode } }
        )
        const raw = res.data?.data ?? res.data
        const list = Array.isArray(raw) ? raw : []
        console.log('[ICMovementMaterialPicker] DEBUG', { url: res.config?.url, params: res.config?.params, rawShape: Array.isArray(raw) ? 'array' : typeof raw, count: list.length, first: list[0], rawKeys: raw && !Array.isArray(raw) ? Object.keys(raw) : undefined })
        if (!cancelled) {
          setMaterials(
            list.map((m: any) => ({
              mat_code: m.mat_code,
              mat_name: m.mat_name,
              spec_name: m.spec_name,
              cost_code: m.cost_code,
              cost_name: m.cost_name,
              cost_subgroup_id: m.cost_subgroup_id,
              unit: m.unit,
              qty_on_hand: Number(m.qty_on_hand ?? 0),
            }))
          )
        }
      } catch (err: any) {
        if (!cancelled) message.error(err?.response?.data?.message || err?.message || 'โหลดรายการวัสดุไม่สำเร็จ')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchMaterials()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectCode, movementId, jobCode])

  // Subgroup (CostCode) options — unique cost_code values present in this scoped list.
  const costCodeOptions: SelectOption[] = useMemo(() => {
    const seen = new Map<string, string>()
    materials.forEach((m) => {
      if (m.cost_code && !seen.has(m.cost_code)) seen.set(m.cost_code, m.cost_name)
    })
    return Array.from(seen.entries()).map(([code, name]) => ({
      value: code,
      label: name ? `${code} — ${name}` : code,
    }))
  }, [materials])

  // MatName options, narrowed by the selected Subgroup/CostCode if any.
  const matNameOptions: SelectOption[] = useMemo(() => {
    const scoped = selectedCostCode ? materials.filter((m) => m.cost_code === selectedCostCode) : materials
    const seen = new Set<string>()
    scoped.forEach((m) => {
      if (m.mat_name) seen.add(m.mat_name)
    })
    return Array.from(seen).map((name) => ({ value: name, label: name }))
  }, [materials, selectedCostCode])

  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLowerCase()
    return materials.filter((m) => {
      if (selectedCostCode && m.cost_code !== selectedCostCode) return false
      if (selectedMatName && m.mat_name !== selectedMatName) return false
      if (q) {
        const haystack = `${m.mat_code} ${m.mat_name} ${m.spec_name ?? ''} ${m.cost_code}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [materials, selectedCostCode, selectedMatName, search])

  const handleRowClick = (record: ICMovementMaterialOption) => {
    onSelect(record)
    onClose()
  }

  const columns = [
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', width: 120 },
    { title: 'CostCode', dataIndex: 'cost_code', width: 120 },
    {
      title: 'ชื่อวัสดุ',
      dataIndex: 'mat_name',
      ellipsis: true,
      render: (v: string, r: ICMovementMaterialOption) => (
        <div>
          <div style={{ fontWeight: 400, fontSize: 13 }}>{v}</div>
          {r.spec_name && (
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{r.spec_name}</div>
          )}
        </div>
      ),
    },
    {
      title: 'คงเหลือ',
      dataIndex: 'qty_on_hand',
      width: 90,
      align: 'right' as const,
    },
    { title: 'หน่วย', dataIndex: 'unit', width: 70, align: 'center' as const },
  ]

  return (
    <Modal
      title={<span style={{ color: '#1e3a8a', fontWeight: 700 }}>เลือกรายการวัสดุ</span>}
      open={open}
      onCancel={onClose}
      width={860}
      destroyOnClose
      footer={null}
    >
      <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
        <Col xs={24} sm={12}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>กลุ่มย่อย (Subgroup)</div>
          <Select
            placeholder="เลือก Subgroup"
            allowClear
            showSearch
            style={{ width: '100%' }}
            options={costCodeOptions}
            value={selectedCostCode}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            onChange={(val) => {
              setSelectedCostCode(val ?? undefined)
              setSelectedMatName(undefined)
            }}
          />
        </Col>
        <Col xs={24} sm={12}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>ชื่อวัสดุ (Mat Name)</div>
          <Select
            placeholder="เลือกชื่อวัสดุ"
            allowClear
            showSearch
            style={{ width: '100%' }}
            options={matNameOptions}
            value={selectedMatName}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            onChange={(val) => setSelectedMatName(val ?? undefined)}
          />
        </Col>
      </Row>

      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>ค้นหาอิสระ (รหัส / ชื่อ / Spec)</div>
      <Input
        placeholder="ค้นหารหัส, ชื่อ, Spec..."
        allowClear
        style={{ marginBottom: 12 }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Table
        rowKey="mat_code"
        loading={loading}
        dataSource={filteredMaterials}
        columns={columns}
        size="small"
        scroll={{ y: 320 }}
        pagination={filteredMaterials.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
        onRow={(record) => ({
          onClick: () => handleRowClick(record),
          style: { cursor: 'pointer' },
        })}
        locale={{ emptyText: 'ไม่พบรายการวัสดุ' }}
      />
    </Modal>
  )
}

export default ICMovementMaterialPickerModal
