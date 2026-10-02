import React, { useEffect, useState } from 'react'
import { Card, Spin, Select, Switch, Table, Space, Typography, Input, Button, Empty, message } from 'antd'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { CheckCircleFilled, CheckCircleOutlined } from '@ant-design/icons'
import { icActionButtonProps } from '@/pages/ic/utils/actionButtonStyle'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import ICPoReceiveModal from '@/pages/ic/components/ICPoReceiveModal'
import ICPoReturnModal from '@/pages/ic/components/ICPoReturnModal'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

interface ICProjectInfo {
  id: number
  project_code: string
  project_name: string
}

interface ICPoRow {
  po_id: number
  project_name: string
  po_no: string
  po_date?: string | null
  pr_no?: string | null
  supplier_name?: string | null
  expected_date?: string | null
}

type SearchOption = { value: string; label: string }

const ICPoReceivePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const preparedBy = useSearchParams()[0].get('prepared_by')
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [project, setProject] = useState<ICProjectInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const [prOptions, setPrOptions] = useState<SearchOption[]>([])
  const [poOptions, setPoOptions] = useState<SearchOption[]>([])
  const [mode, setMode] = useState<'PO' | 'PR'>('PO')
  const [pickedNo, setPickedNo] = useState<string | undefined>(undefined)
  const [searchText, setSearchText] = useState('')
  // Dropdown pick (exact number) wins over free text; empty = table stays hidden.
  const search = (pickedNo || searchText.trim()) || undefined
  const [selectedRow, setSelectedRow] = useState<ICPoRow | null>(null)
  const [returnOpen, setReturnOpen] = useState(false)
  const [onlyCompleted, setOnlyCompleted] = useState(false)

  const [rows, setRows] = useState<ICPoRow[]>([])
  const [tableLoading, setTableLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [selectedPoId, setSelectedPoId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Step 1: validate :projectId and load the project context header.
  useEffect(() => {
    const numericId = Number(projectId)
    if (!projectId || Number.isNaN(numericId)) {
      navigate('/ic/projects', { replace: true })
      return
    }

    let cancelled = false
    const fetchProject = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/${numericId}`, { headers: authHeader })
        const proj = res.data?.data ?? res.data
        if (!proj || !proj.id) {
          throw new Error('not found')
        }
        if (!cancelled) setProject(proj)
      } catch {
        if (!cancelled) navigate('/ic/projects', { replace: true })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchProject()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Step 2: once the project is confirmed valid, load PR/PO search options.
  useEffect(() => {
    if (!project) return
    let cancelled = false
    const fetchOptions = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/${project.id}/po-search-options`, {
          headers: authHeader,
        })
        const payload = res.data?.data ?? res.data
        // Shape: flat [{id, no, type}] where type is 'PO' | 'PR'. Older shape ({pr_list, po_list}) still tolerated.
        const flat: any[] = Array.isArray(payload) ? payload : []
        const byType = (t: 'PO' | 'PR') =>
          flat.filter((i) => String(i?.type ?? '').toUpperCase() === t)
        const prList = flat.length ? byType('PR') : payload?.pr_list ?? payload?.pr_numbers ?? []
        const poList = flat.length ? byType('PO') : payload?.po_list ?? payload?.po_numbers ?? []
        const toOptions = (list: any[]): SearchOption[] =>
          (Array.isArray(list) ? list : []).map((item) => {
            const value = typeof item === 'string' ? item : item?.no ?? item?.pr_no ?? item?.po_no ?? item?.value ?? String(item)
            return { value, label: value }
          })
        if (!cancelled) {
          setPrOptions(toOptions(prList))
          setPoOptions(toOptions(poList))
        }
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดตัวเลือกค้นหาไม่สำเร็จ')
      }
    }
    fetchOptions()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])

  // Step 3: fetch PO list, refetching on search/toggle/pagination change.
  useEffect(() => {
    if (!project) return
    if (!search) {
      setRows([])
      setTotal(0)
      return
    }
    let cancelled = false
    const fetchRows = async () => {
      setTableLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/${project.id}/pos`, {
          headers: authHeader,
          params: {
            search,
            search_type: mode.toLowerCase(),
            receive_status: mode === 'PO' && onlyCompleted ? 'completed' : 'pending',
            page,
            page_size: pageSize,
          },
        })
        const payload = res.data?.data ?? res.data
        const raw = Array.isArray(payload) ? payload : payload?.data ?? []
        const list: ICPoRow[] = Array.isArray(raw) ? raw : []
        console.log('[ICPoReceivePage] DEBUG first raw row', list[0], 'keys:', list[0] && Object.keys(list[0]))
        // Restrict matching to the selected mode's own field (backend `search` may cover both).
        const field: 'po_no' | 'pr_no' = mode === 'PO' ? 'po_no' : 'pr_no'
        const needle = search.toLowerCase()
        const scoped = list.filter((r) => String(r[field] ?? '').toLowerCase().includes(needle))
        if (!cancelled) {
          setRows(scoped)
          setTotal(scoped.length === list.length ? payload?.total ?? scoped.length : scoped.length)
        }
      } catch (err: any) {
        if (!cancelled) message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
      } finally {
        if (!cancelled) setTableLoading(false)
      }
    }
    fetchRows()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, mode, search, onlyCompleted, page, pageSize])

  const resetSelection = () => {
    setPage(1)
    setSelectedRow(null)
  }

  const handleModeChange = (value: 'PO' | 'PR') => {
    setMode(value)
    setOnlyCompleted(false)
    setPickedNo(undefined)
    setSearchText('')
    resetSelection()
  }

  const handlePickedChange = (value: string | undefined) => {
    setPickedNo(value)
    resetSelection()
  }

  const handleTextChange = (value: string) => {
    setSearchText(value)
    resetSelection()
  }

  const handleToggleChange = (checked: boolean) => {
    setOnlyCompleted(checked)
    setPage(1)
  }

  const handleReceive = () => {
    if (!selectedRow) return
    setSelectedPoId(selectedRow.po_id)
    setModalOpen(true)
  }

  const handleReturn = () => {
    if (!selectedRow) return
    setSelectedPoId(selectedRow.po_id)
    setReturnOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setReturnOpen(false)
    setSelectedPoId(null)
  }

  const actionsDisabled = !selectedRow

  const columns = [
    {
      title: 'ลำดับ',
      key: 'index',
      width: 70,
      render: (_: unknown, __: ICPoRow, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: 'โครงการ',
      dataIndex: 'project_name',
      key: 'project_name',
    },
    {
      title: 'เลขที่ PO',
      dataIndex: 'po_no',
      key: 'po_no',
      render: (value: string | null | undefined) => value || '-',
    },
    {
      title: 'วันที่สร้าง PO',
      dataIndex: 'po_date',
      key: 'po_date',
      render: (value: string | null | undefined) => value || '-',
    },
    {
      title: 'เลขที่ PR',
      dataIndex: 'pr_no',
      key: 'pr_no',
      render: (value: string | null | undefined) => value || '-',
    },
    {
      title: 'บริษัท/ร้านค้า',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      render: (value: string | null | undefined) => value || '-',
    },
    {
      title: 'วันที่ส่งของ',
      dataIndex: 'expected_date',
      key: 'expected_date',
      render: (value: string | null | undefined) => value || '-',
    },
    {
      // Single-select (radio semantics) check-mark, last column — replaces antd rowSelection.
      title: '',
      key: 'select',
      width: 76,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: unknown, r: ICPoRow) => {
        const checked = selectedRow?.po_id === r.po_id
        return (
          <span
            role="radio"
            aria-checked={checked}
            onClick={() => setSelectedRow(r)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              cursor: 'pointer',
              fontSize: 30,
            }}
          >
            {checked ? (
              <CheckCircleFilled style={{ color: '#16a34a' }} />
            ) : (
              <CheckCircleOutlined style={{ color: '#d1d5db' }} />
            )}
          </span>
        )
      },
    },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!project) return null

  return (
    <div>
      <PageHeader
        title="PO Receive"
        subtitle={`${project.project_code} — ${project.project_name}`}
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'Inventory Control' },
          { title: 'ข้อมูลโครงการ' },
          { title: 'PO Receive' },
        ]}
      />
      <Card style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Space wrap size="middle">
            <Select
              value={mode}
              onChange={handleModeChange}
              style={{ width: 160 }}
              options={[
                { value: 'PO', label: 'ค้นหาจาก PO' },
                { value: 'PR', label: 'ค้นหาจาก PR' },
              ]}
            />
            <Select
              allowClear
              showSearch
              placeholder={mode === 'PO' ? 'เลือกเลขที่ PO' : 'เลือกเลขที่ PR'}
              value={pickedNo}
              onChange={handlePickedChange}
              options={mode === 'PO' ? poOptions : prOptions}
              style={{ width: 240 }}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
            <Input
              allowClear
              placeholder={mode === 'PO' ? 'ค้นหา PO' : 'ค้นหา PR'}
              value={searchText}
              onChange={(e) => handleTextChange(e.target.value)}
              disabled={!!pickedNo}
              style={{ width: 220 }}
            />
            {mode === 'PO' && (
              <Space align="center">
                <Switch checked={onlyCompleted} onChange={handleToggleChange} />
                <Typography.Text style={{ color: '#374151' }}>แสดงเฉพาะรับครบแล้ว</Typography.Text>
              </Space>
            )}
          </Space>
          <Space>
            <Button disabled={actionsDisabled} onClick={handleReceive} {...icActionButtonProps('receive', actionsDisabled)}>
              PO Receive
            </Button>
            <Button disabled={actionsDisabled} onClick={handleReturn} {...icActionButtonProps('return', actionsDisabled)}>
              PO Return
            </Button>
          </Space>
        </div>

        {!search ? (
          <Empty description="กรุณาเลือกหรือกรอกเลขที่ PO / PR เพื่อค้นหา" />
        ) : (
        <Table
          rowKey="po_id"
          loading={tableLoading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          locale={{ emptyText: 'ไม่พบข้อมูล PO' }}
        />
        )}
      </Card>

      <ICPoReceiveModal open={modalOpen} poId={selectedPoId} onClose={handleModalClose} projectCode={project.project_code} preparedBy={preparedBy} />
      <ICPoReturnModal open={returnOpen} poId={selectedPoId} onClose={handleModalClose} projectCode={project.project_code} preparedBy={preparedBy} />
    </div>
  )
}

export default ICPoReceivePage
