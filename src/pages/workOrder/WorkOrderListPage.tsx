import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Select, DatePicker, Button, Space, message } from 'antd'
import { PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { workOrderService } from '@/services/workOrderService'
import WOStatusBadge from '@/components/workOrder/WOStatusBadge'
import type { WOListItem } from '@/types/workOrder'

const MENU_CODE = 'MENU_WO_CREATE'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'DRAFT', label: 'แบบร่าง' },
  { value: 'PENDING_APPROVAL', label: 'รออนุมัติ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ไม่อนุมัติ' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
]

const WorkOrderListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [data, setData] = useState<WOListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [woNo, setWoNo] = useState('')
  const [employerName, setEmployerName] = useState('')
  const [supplier, setSupplier] = useState('')
  const [status, setStatus] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)

  const fetchList = async (nextPage = page) => {
    setLoading(true)
    try {
      const result = await workOrderService.list(accessToken, {
        wo_no: woNo || undefined,
        employer_name: employerName || undefined,
        supplier: supplier || undefined,
        status: status || undefined,
        date_from: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
        date_to: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
        page: nextPage,
        page_size: pageSize,
      })
      setData(result.items)
      setTotal(result.total)
      setPage(nextPage)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList(1) }, [])

  const handleReset = () => {
    setWoNo('')
    setEmployerName('')
    setSupplier('')
    setStatus('')
    setDateRange(null)
    fetchList(1)
  }

  const columns: ColumnsType<WOListItem> = [
    {
      title: 'เลขที่ WO',
      dataIndex: 'wo_no',
      key: 'wo_no',
      render: (v: string, r) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/work-order/${r.id}`)}>
          {v}
        </a>
      ),
    },
    {
      title: 'วันที่',
      dataIndex: 'wo_date',
      key: 'wo_date',
      render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    { title: 'ผู้ว่าจ้าง', dataIndex: 'employer_name', key: 'employer_name' },
    { title: 'ผู้รับจ้าง', dataIndex: 'supplier_name', key: 'supplier_name', render: (v?: string) => v || '—' },
    {
      title: 'มูลค่าสัญญา',
      dataIndex: 'contract_amount',
      key: 'contract_amount',
      align: 'right',
      render: (v: number) => (v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (s: WOListItem['status']) => <WOStatusBadge status={s} />,
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: WOListItem) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/work-order/${r.id}`)}>
            ดู
          </Button>
          {r.status === 'DRAFT' && (
            <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/work-order/${r.id}/edit`)}>
              แก้ไข
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="หนังสือสั่งจ้าง (Work Order)"
        subtitle="รายการหนังสือสั่งจ้างทั้งหมด"
        breadcrumbs={[{ title: 'Home' }, { title: 'Work Order' }, { title: 'รายการ' }]}
        extra={
          <PermissionButton
            menuCode={MENU_CODE}
            action="write"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/work-order/create')}
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
          >
            สร้างใหม่
          </PermissionButton>
        }
      />

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="เลขที่ WO"
            value={woNo}
            onChange={(e) => setWoNo(e.target.value)}
            onPressEnter={() => fetchList(1)}
            style={{ width: 160 }}
            allowClear
          />
          <Input
            placeholder="ผู้ว่าจ้าง"
            value={employerName}
            onChange={(e) => setEmployerName(e.target.value)}
            onPressEnter={() => fetchList(1)}
            style={{ width: 160 }}
            allowClear
          />
          <Input
            placeholder="ผู้รับจ้าง"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            onPressEnter={() => fetchList(1)}
            style={{ width: 160 }}
            allowClear
          />
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 160 }}
            options={statusOptions}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(val) => setDateRange(val as [Dayjs, Dayjs] | null)}
            format="DD/MM/YYYY"
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchList(1)}>ค้นหา</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>ล้างตัวกรอง</Button>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: (p) => fetchList(p),
          }}
          locale={{ emptyText: 'ไม่พบรายการ' }}
        />
      </Card>
    </div>
  )
}

export default WorkOrderListPage
