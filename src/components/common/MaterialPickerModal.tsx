import React, { useState, useEffect, useRef } from 'react'
import { Modal, Table, Input, Select, Button, Space, Tag, Row, Col, message } from 'antd'
import axios from 'axios'
import { useAppSelector } from '@/store'
import type { Material } from '@/types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

interface SelectOption {
  value: number
  label: string
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (items: Material[]) => void
}

const MaterialPickerModal: React.FC<Props> = ({ open, onClose, onConfirm }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  /* ── main table state ─────────────────────────────────────────── */
  const [data, setData] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  /* ── filter state ─────────────────────────────────────────────── */
  const [subgroups, setSubgroups] = useState<SelectOption[]>([])
  const [matNames, setMatNames] = useState<SelectOption[]>([])
  const [selectedSubgroup, setSelectedSubgroup] = useState<number | null>(null)
  const [selectedMatName, setSelectedMatName] = useState<number | null>(null)
  const [subgroupsLoading, setSubgroupsLoading] = useState(false)
  const [matNamesLoading, setMatNamesLoading] = useState(false)

  /* ── selection state ──────────────────────────────────────────── */
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [selectedRows, setSelectedRows] = useState<Material[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* reset + fetch subgroups when modal opens */
  useEffect(() => {
    if (!open) return

    setSearch('')
    setPage(1)
    setSelectedSubgroup(null)
    setSelectedMatName(null)
    setMatNames([])
    setSelectedKeys([])
    setSelectedRows([])

    const fetchSubgroups = async () => {
      setSubgroupsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/subgroups`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setSubgroups(
          list.map((s: any) => {
            const code = s.subgroup_code ?? s.subGroupCode ?? ''
            const name = s.subgroup_name ?? s.subGroupName ?? s.name ?? ''
            return {
              value: s.id ?? s.subgroup_id,
              label: code ? `${code} — ${name}` : name,
            }
          }),
        )
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'โหลด Subgroup ไม่สำเร็จ'
        message.error(errMsg)
      } finally {
        setSubgroupsLoading(false)
      }
    }

    fetchSubgroups()
  }, [open, accessToken])

  /* fetch mat-names when selectedSubgroup changes */
  useEffect(() => {
    setSelectedMatName(null)
    setMatNames([])

    if (!selectedSubgroup) return

    const fetchMatNames = async () => {
      setMatNamesLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/mat-names`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { subgroup_id: selectedSubgroup },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setMatNames(
          list.map((m: any) => ({
            value: m.id ?? m.mat_name_id,
            label: m.mat_name_th ?? m.mat_name ?? m.name,
          })),
        )
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'โหลดชื่อวัสดุไม่สำเร็จ'
        message.error(errMsg)
      } finally {
        setMatNamesLoading(false)
      }
    }

    fetchMatNames()
  }, [selectedSubgroup, accessToken])

  /* main fetch — reruns when any filter/page/search changes */
  useEffect(() => {
    if (!open) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/allMaterial`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            page,
            limit: 10,
            q: search || undefined,
            subgroup_id: selectedSubgroup ?? undefined,
            mat_name_id: selectedMatName ?? undefined,
          },
        })
        const list: Material[] = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        const tot: number = res.data?.total ?? list.length
        setData(list)
        setTotal(tot)
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'โหลดข้อมูลไม่สำเร็จ'
        message.error(errMsg)
        setData([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [page, search, selectedSubgroup, selectedMatName, open, accessToken])

  const handleConfirm = () => {
    onConfirm(selectedRows)
    onClose()
  }

  const columns = [
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', width: 120 },
    {
      title: 'ชื่อวัสดุ',
      dataIndex: 'mat_name_th',
      ellipsis: true,
      render: (v: string, r: Material) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{v}</div>
          {r.spec_description && (
            <div style={{ fontSize: 11, color: '#6b7280' }}>{r.spec_description}</div>
          )}
        </div>
      ),
    },
    { title: 'ยี่ห้อ', dataIndex: 'brand_name', width: 120, ellipsis: true },
    { title: 'หน่วย', dataIndex: 'unit_name', width: 70, align: 'center' as const },
    {
      title: 'สถานะ',
      dataIndex: 'is_active',
      width: 72,
      align: 'center' as const,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'} style={{ fontSize: 11 }}>
          {v ? 'ใช้งาน' : 'ปิด'}
        </Tag>
      ),
    },
  ]

  const rowSelection = {
    selectedRowKeys: selectedKeys,
    onChange: (keys: React.Key[], rows: Material[]) => {
      const currentCodes = new Set(data.map((d) => d.mat_code))
      const keptKeys = selectedKeys.filter((k) => !currentCodes.has(String(k)))
      const keptRows = selectedRows.filter((r) => !currentCodes.has(r.mat_code))
      setSelectedKeys([...keptKeys, ...keys])
      setSelectedRows([...keptRows, ...rows])
    },
  }

  return (
    <Modal
      title={
        <span style={{ color: '#1e3a8a', fontWeight: 700 }}>
          เลือกรายการวัสดุและบริการ
        </span>
      }
      open={open}
      onCancel={onClose}
      width={860}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: 13 }}>
            เลือกแล้ว{' '}
            <span style={{ color: '#1e3a8a', fontWeight: 600 }}>{selectedRows.length}</span>{' '}
            รายการ
          </span>
          <Space>
            <Button onClick={onClose}>ยกเลิก</Button>
            <Button
              type="primary"
              disabled={selectedRows.length === 0}
              onClick={handleConfirm}
            >
              ยืนยัน ({selectedRows.length})
            </Button>
          </Space>
        </div>
      }
    >
      {/* ── cascading filters ── */}
      <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
        <Col xs={24} sm={12}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>กลุ่มย่อย (Subgroup)</div>
          <Select
            placeholder="เลือก Subgroup"
            allowClear
            showSearch
            loading={subgroupsLoading}
            style={{ width: '100%' }}
            options={subgroups}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            onChange={(val: number | undefined) => {
              setSelectedSubgroup(val ?? null)
              setPage(1)
            }}
          />
        </Col>
        <Col xs={24} sm={12}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>ชื่อวัสดุ (Mat Name)</div>
          <Select
            placeholder="เลือกชื่อวัสดุ"
            allowClear
            showSearch
            disabled={!selectedSubgroup}
            loading={matNamesLoading}
            style={{ width: '100%' }}
            options={matNames}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            onChange={(val: number | undefined) => {
              setSelectedMatName(val ?? null)
              setPage(1)
            }}
          />
        </Col>
      </Row>

      {/* ── search ── */}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>ค้นหาอิสระ (รหัส / ชื่อ / Spec / ยี่ห้อ)</div>
      <Input.Search
        placeholder="ค้นหารหัส, ชื่อ, Spec, ยี่ห้อ..."
        allowClear
        style={{ marginBottom: 12 }}
        onSearch={(val) => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          setSearch(val)
          setPage(1)
        }}
        onChange={(e) => {
          const val = e.target.value
          if (!val) {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            setSearch('')
            setPage(1)
          } else {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
              setSearch(val)
              setPage(1)
            }, 300)
          }
        }}
      />

      <Table
        rowKey="mat_code"
        loading={loading}
        dataSource={data}
        columns={columns}
        rowSelection={rowSelection}
        size="small"
        scroll={{ x: 680, y: 300 }}
        pagination={{
          current: page,
          pageSize: 10,
          total,
          showSizeChanger: false,
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
          onChange: (p) => setPage(p),
        }}
      />
    </Modal>
  )
}

export default MaterialPickerModal
