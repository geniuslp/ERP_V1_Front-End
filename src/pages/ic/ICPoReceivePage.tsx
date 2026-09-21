import React, { useEffect, useState } from 'react'
import { Card, Spin, Select, Switch, Table, Space, Typography, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import ICPoReceiveModal from '@/pages/ic/components/ICPoReceiveModal'

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
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [project, setProject] = useState<ICProjectInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const [prOptions, setPrOptions] = useState<SearchOption[]>([])
  const [poOptions, setPoOptions] = useState<SearchOption[]>([])
  const [search, setSearch] = useState<string | undefined>(undefined)
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
        const prList = payload?.pr_list ?? payload?.pr_numbers ?? []
        const poList = payload?.po_list ?? payload?.po_numbers ?? []
        const toOptions = (list: any[]): SearchOption[] =>
          (Array.isArray(list) ? list : []).map((item) => {
            const value = typeof item === 'string' ? item : item?.pr_no ?? item?.po_no ?? item?.value ?? String(item)
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
    let cancelled = false
    const fetchRows = async () => {
      setTableLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/${project.id}/pos`, {
          headers: authHeader,
          params: {
            search: search || undefined,
            receive_status: onlyCompleted ? 'completed' : 'pending',
            page,
            page_size: pageSize,
          },
        })
        const payload = res.data?.data ?? res.data
        const list = Array.isArray(payload) ? payload : payload?.data ?? []
        if (!cancelled) {
          setRows(Array.isArray(list) ? list : [])
          setTotal(payload?.total ?? (Array.isArray(list) ? list.length : 0))
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
  }, [project, search, onlyCompleted, page, pageSize])

  const handleSearchChange = (value: string | undefined) => {
    setSearch(value)
    setPage(1)
  }

  const handleToggleChange = (checked: boolean) => {
    setOnlyCompleted(checked)
    setPage(1)
  }

  const handleRowClick = (record: ICPoRow) => {
    setSelectedPoId(record.po_id)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setSelectedPoId(null)
  }

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
      render: (value: string) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{value}</span>,
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
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }} size="middle">
          <Select
            allowClear
            showSearch
            placeholder="ค้นหาเลขที่ PR / PO"
            value={search}
            onChange={handleSearchChange}
            style={{ width: 280 }}
            optionFilterProp="label"
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          >
            <Select.OptGroup label="เลขที่ PR">
              {prOptions.map((opt) => (
                <Select.Option key={`pr-${opt.value}`} value={opt.value} label={opt.label}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select.OptGroup>
            <Select.OptGroup label="เลขที่ PO">
              {poOptions.map((opt) => (
                <Select.Option key={`po-${opt.value}`} value={opt.value} label={opt.label}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select.OptGroup>
          </Select>

          <Space align="center">
            <Switch checked={onlyCompleted} onChange={handleToggleChange} />
            <Typography.Text style={{ color: '#374151' }}>แสดงเฉพาะรับครบแล้ว</Typography.Text>
          </Space>
        </Space>

        <Table
          rowKey="po_id"
          loading={tableLoading}
          columns={columns}
          dataSource={rows}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
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
      </Card>

      <ICPoReceiveModal open={modalOpen} poId={selectedPoId} onClose={handleModalClose} />
    </div>
  )
}

export default ICPoReceivePage
