import React, { useState, useEffect, useRef } from 'react'
import { Modal, Drawer, Table, Input, Select, Button, Space, Tag, Row, Col, Checkbox, Pagination, Grid, message } from 'antd'
import axios from 'axios'
import { useAppSelector } from '@/store'
import { stockService } from '@/services/stock.service'
import type { Material, StockLookupResult } from '@/types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const { useBreakpoint } = Grid

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

interface SelectOption {
  value: number
  label: string
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (items: Material[]) => void
  showStockLookup?: boolean
}

const MaterialPickerModal: React.FC<Props> = ({ open, onClose, onConfirm, showStockLookup = false }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const screens = useBreakpoint()
  const isMobile = screens.md === false

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

  /* ── stock lookup cache, keyed by mat_code — 'loading' while in flight ── */
  const [stockLookups, setStockLookups] = useState<Record<string, StockLookupResult | 'loading'>>({})

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ensureStockLookup = (matCode: string) => {
    if (!showStockLookup) return
    setStockLookups((prev) => {
      if (prev[matCode]) return prev // already cached or in flight
      const run = async () => {
        try {
          const result = await stockService.lookupByMatCode(accessToken ?? '', matCode)
          setStockLookups((p) => ({ ...p, [matCode]: result }))
        } catch {
          setStockLookups((p) => ({ ...p, [matCode]: { matCode, qtyOnHand: 0, found: false } }))
        }
      }
      run()
      return { ...prev, [matCode]: 'loading' }
    })
  }

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
      render: (v: string, r: Material) => {
        const lookup = stockLookups[r.mat_code]
        return (
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{v}</div>
            {r.spec_description && (
              <div style={{ fontSize: 11, color: '#6b7280' }}>{r.spec_description}</div>
            )}
            {showStockLookup && selectedKeys.includes(r.mat_code) && (
              <div style={{ marginTop: 2 }}>
                {lookup === 'loading' && (
                  <Tag style={{ fontSize: 11 }}>กำลังตรวจสอบ Stock...</Tag>
                )}
                {lookup && lookup !== 'loading' && lookup.found && (
                  <Tag color={lookup.qtyOnHand > 0 ? 'success' : 'warning'} style={{ fontSize: 11 }}>
                    คงเหลือใน Stock: {lookup.qtyOnHand.toLocaleString('th-TH')} {lookup.unit ?? r.unit_name}
                  </Tag>
                )}
                {lookup && lookup !== 'loading' && !lookup.found && (
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>ไม่มีในระบบ Stock</span>
                )}
              </div>
            )}
          </div>
        )
      },
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
      rows.forEach((r) => ensureStockLookup(r.mat_code))
    },
  }

  const toggleRow = (row: Material) => {
    const isSelected = selectedKeys.includes(row.mat_code)
    if (isSelected) {
      setSelectedKeys(selectedKeys.filter((k) => k !== row.mat_code))
      setSelectedRows(selectedRows.filter((r) => r.mat_code !== row.mat_code))
    } else {
      setSelectedKeys([...selectedKeys, row.mat_code])
      setSelectedRows([...selectedRows, row])
      ensureStockLookup(row.mat_code)
    }
  }

  const footer = (
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
  )

  const filters = (
    <>
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
    </>
  )

  const mobileList = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!loading && data.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>ไม่พบรายการวัสดุ</div>
      )}
      {data.map((row) => {
        const isSelected = selectedKeys.includes(row.mat_code)
        const lookup = stockLookups[row.mat_code]
        return (
          <div
            key={row.mat_code}
            onClick={() => toggleRow(row)}
            style={{
              ...cardStyle,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: 14,
              background: isSelected ? '#eff6ff' : '#fff',
              border: isSelected ? '1px solid #93c5fd' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            <Checkbox checked={isSelected} onClick={(e) => e.stopPropagation()} onChange={() => toggleRow(row)} style={{ marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#2563eb', wordBreak: 'break-all' }}>
                {row.mat_code}
              </div>
              <div style={{ marginTop: 2, fontSize: 13, color: '#1f2937' }}>{row.mat_name_th}</div>
              {row.spec_description && (
                <div style={{ marginTop: 2, fontSize: 12, color: '#6b7280' }}>{row.spec_description}</div>
              )}
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <Tag style={{ fontSize: 11 }}>{row.unit_name}</Tag>
                {row.brand_name && <Tag style={{ fontSize: 11 }}>{row.brand_name}</Tag>}
                <Tag color={row.is_active ? 'green' : 'default'} style={{ fontSize: 11 }}>
                  {row.is_active ? 'ใช้งาน' : 'ปิด'}
                </Tag>
              </div>
              {showStockLookup && isSelected && (
                <div style={{ marginTop: 6 }}>
                  {lookup === 'loading' && <Tag style={{ fontSize: 11 }}>กำลังตรวจสอบ Stock...</Tag>}
                  {lookup && lookup !== 'loading' && lookup.found && (
                    <Tag color={lookup.qtyOnHand > 0 ? 'success' : 'warning'} style={{ fontSize: 11 }}>
                      คงเหลือใน Stock: {lookup.qtyOnHand.toLocaleString('th-TH')} {lookup.unit ?? row.unit_name}
                    </Tag>
                  )}
                  {lookup && lookup !== 'loading' && !lookup.found && (
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>ไม่มีในระบบ Stock</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
      {total > 10 && (
        <Pagination
          style={{ marginTop: 4, textAlign: 'center' }}
          current={page}
          pageSize={10}
          total={total}
          showSizeChanger={false}
          onChange={(p) => setPage(p)}
        />
      )}
    </div>
  )

  if (isMobile) {
    return (
      <Drawer
        title={<span style={{ color: '#1e3a8a', fontWeight: 700 }}>เลือกรายการวัสดุและบริการ</span>}
        open={open}
        onClose={onClose}
        placement="bottom"
        height="100%"
        destroyOnClose
        styles={{ body: { padding: 16 } }}
        footer={footer}
      >
        {filters}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>กำลังโหลด...</div>
        ) : (
          mobileList
        )}
      </Drawer>
    )
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
      footer={footer}
    >
      {filters}

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
