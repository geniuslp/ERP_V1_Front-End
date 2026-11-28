import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Input, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { PRIORITY, REPAIR_MENU_CODE, STATUS, repairApi, repairErrText, type RepairRequest } from './repairRequest'

// เอกสารแจ้งซ่อม > 5.1 บันทึกการแจ้งซ่อม — list (a Project-department user sees their projects' requests + their own).
const cardStyle: React.CSSProperties = { borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }

const RepairRequestListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [rows, setRows] = useState<RepairRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | undefined>()
  const [priority, setPriority] = useState<string | undefined>()
  const [mine, setMine] = useState(false)
  const [myApprovals, setMyApprovals] = useState(false)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await repairApi.list(accessToken, {
        page, limit: pageSize, search: search || undefined, status, priority,
        mine: mine || undefined, my_approvals: myApprovals || undefined,
      })
      setRows(res.rows)
      setTotal(res.total)
    } catch (e) {
      message.error(repairErrText(e, 'โหลดรายการใบแจ้งซ่อมไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }, [accessToken, page, pageSize, search, status, priority, mine, myApprovals])

  useEffect(() => { load() }, [load])

  const columns: ColumnsType<RepairRequest> = [
    { title: 'ลำดับ', key: 'no', width: 60, align: 'center', render: (_v, _r, i) => (page - 1) * pageSize + i + 1 },
    { title: 'เลขที่', dataIndex: 'request_no', key: 'no2', width: 150, render: (v: string) => <b style={{ color: '#1d4ed8' }}>{v}</b> },
    { title: 'วันที่', dataIndex: 'request_date', key: 'date', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'โครงการ', key: 'pj', width: 260, render: (_v, r) => `${r.project_code} ${r.project_name ?? ''}`.trim() },
    { title: 'สาขา', dataIndex: 'branch_name', key: 'branch', width: 120, render: (v: string | null) => v || '-' },
    {
      title: 'รายการ', key: 'items', width: 220,
      render: (_v, r) => (r.first_machine ? `${r.first_machine}${r.item_count > 1 ? ` (+${r.item_count - 1})` : ''}` : '-'),
    },
    { title: 'ความสำคัญ', dataIndex: 'priority', key: 'pri', width: 100, render: (v: RepairRequest['priority']) => <Tag color={PRIORITY[v]?.color}>{PRIORITY[v]?.label ?? v}</Tag> },
    { title: 'วันที่ต้องใช้งาน', dataIndex: 'need_date', key: 'need', width: 120, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '-') },
    { title: 'ผู้แจ้ง', dataIndex: 'requested_by_name', key: 'by', width: 150, render: (v: string | null) => v || '-' },
    { title: 'สถานะ', dataIndex: 'status', key: 'status', width: 100, render: (v: RepairRequest['status']) => <Tag color={STATUS[v]?.color}>{STATUS[v]?.label ?? v}</Tag> },
  ]

  const resetPage = () => setPage(1)

  return (
    <div>
      <PageHeader
        title="บันทึกการแจ้งซ่อม"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Memo' }, { title: 'เอกสารแจ้งซ่อม' }, { title: 'บันทึกการแจ้งซ่อม' }]}
      />
      <Card style={cardStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 12 }}>
          <Space wrap size={12}>
            <Input
              allowClear
              placeholder="ค้นหาเลขที่ / โครงการ / ชื่อหรือรหัสเครื่อง"
              style={{ width: 300 }}
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); if (!e.target.value) { setSearch(''); resetPage() } }}
              onPressEnter={() => { setSearch(searchInput.trim()); resetPage() }}
              suffix={<SearchOutlined style={{ cursor: 'pointer' }} onClick={() => { setSearch(searchInput.trim()); resetPage() }} />}
            />
            <Select allowClear placeholder="ทุกสถานะ" style={{ width: 140 }} value={status}
              options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))}
              onChange={(v) => { setStatus(v); resetPage() }} />
            <Select allowClear placeholder="ทุกระดับความสำคัญ" style={{ width: 170 }} value={priority}
              options={Object.entries(PRIORITY).map(([value, s]) => ({ value, label: s.label }))}
              onChange={(v) => { setPriority(v); resetPage() }} />
            <Space size={6}>
              <Switch checked={mine} onChange={(v) => { setMine(v); resetPage() }} />
              <Typography.Text>เฉพาะที่ฉันแจ้ง</Typography.Text>
            </Space>
            <Space size={6}>
              <Switch checked={myApprovals} onChange={(v) => { setMyApprovals(v); resetPage() }} />
              <Typography.Text>ที่ฉันเป็นผู้อนุมัติ</Typography.Text>
            </Space>
          </Space>
          <PermissionButton menuCode={REPAIR_MENU_CODE} action="write" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/repair/requests/new')}>
            สร้างใบแจ้งซ่อม
          </PermissionButton>
        </div>
        <Table<RepairRequest>
          size="small"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1400 }}
          onRow={(r) => ({ onClick: () => navigate(`/repair/requests/${r.id}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: 'ยังไม่มีใบแจ้งซ่อม' }}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true,
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
        />
      </Card>
    </div>
  )
}

export default RepairRequestListPage
