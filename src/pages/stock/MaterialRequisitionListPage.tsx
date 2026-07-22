import React, { useEffect, useState } from 'react'
import { Card, Table, Select, DatePicker, Button, Space, Tag, message } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs, { Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import {
  REQUISITION_STATUS_COLOR, REQUISITION_STATUS_LABEL,
} from '@/types/requisition'
import type { RequisitionListItem } from '@/types/requisition'

const BASE_URL = (import.meta as any).env?.VITE_API_URL
const MENU_CODE = 'MENU_STOCK_REQUISITION'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const MaterialRequisitionListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [data, setData] = useState<RequisitionListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)

  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)

  const fetchList = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/borrow`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          page: nextPage,
          limit,
          status: statusFilter || undefined,
          date_from: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
          date_to: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
        },
      })
      const rows: RequisitionListItem[] = res.data?.data ?? []
      setData(rows)
      setTotal(res.data?.meta?.total ?? rows.length)
      setPage(nextPage)
    } catch (err: any) {
      setData([])
      setTotal(0)
      message.error(err?.response?.data?.message || err?.message || 'โหลดรายการใบขอเบิกไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList(1) }, [])

  const columns = [
    {
      title: 'เลขใบขอเบิก',
      dataIndex: 'borrow_no',
      key: 'borrow_no',
      render: (v: string, record: RequisitionListItem) => (
        <a onClick={() => navigate(`/stock/requisition/${record.borrow_id}`)} style={{ color: '#2563eb', fontWeight: 600 }}>
          {v}
        </a>
      ),
    },
    {
      title: 'วันที่ขอ',
      dataIndex: 'borrow_date',
      key: 'borrow_date',
      render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    { title: 'ผู้ขอ', dataIndex: 'borrower_name', key: 'borrower_name' },
    { title: 'คลัง', dataIndex: 'warehouse_code', key: 'warehouse_code' },
    { title: 'วัตถุประสงค์', dataIndex: 'purpose', key: 'purpose', ellipsis: true, render: (v?: string) => v || '—' },
    { title: 'จำนวนรายการ', dataIndex: 'line_count', key: 'line_count', align: 'right' as const },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={REQUISITION_STATUS_COLOR[s]}>{REQUISITION_STATUS_LABEL[s] || s}</Tag>,
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, record: RequisitionListItem) => (
        <Button size="small" onClick={() => navigate(`/stock/requisition/${record.borrow_id}`)}>ดูรายละเอียด</Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ใบขอเบิกอุปกรณ์"
        subtitle="รายการคำขอเบิกวัสดุจากคลัง"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'ใบขอเบิก' }]}
      />

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Select
            placeholder="สถานะ"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            options={[
              { value: 'DRAFT', label: 'ร่าง' },
              { value: 'PENDING_APPROVAL', label: 'รออนุมัติ' },
              { value: 'APPROVED', label: 'อนุมัติแล้ว' },
              { value: 'REJECTED', label: 'ถูกปฏิเสธ' },
            ]}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(val) => setDateRange(val as [Dayjs, Dayjs] | null)}
            format="DD/MM/YYYY"
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchList(1)}>ค้นหา</Button>
          <PermissionButton
            menuCode={MENU_CODE}
            action="write"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/stock/requisition/create')}
            style={{ marginLeft: 'auto' }}
          >
            สร้างใบขอเบิก
          </PermissionButton>
        </Space>

        <Table
          rowKey="borrow_id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: false,
            onChange: (p) => fetchList(p),
          }}
          locale={{ emptyText: 'ไม่พบใบขอเบิก' }}
        />
      </Card>
    </div>
  )
}

export default MaterialRequisitionListPage
