import React, { useEffect, useState } from 'react'
import { Card, Table, Select, DatePicker, Input, Button, Space, Tag, Tabs, Badge } from 'antd'
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { stockTransferService } from '@/services/stockTransfer.service'
import {
  STOCK_TRANSFER_STATUS_COLOR, STOCK_TRANSFER_STATUS_LABEL,
} from '@/types/stockTransfer'
import type { StockTransferListItem, StockTransferType } from '@/types/stockTransfer'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

interface Props {
  transferType: StockTransferType
  menuCode: string
  title: string
  subtitle: string
  createLabel: string
  breadcrumbLabel: string
  createPath: string
  detailPathPrefix: string
  fromLabel: string
  toLabel: string
  // Adds a "รอตรวจสอบ/ยืนยันแล้ว/ยกเลิก/ทั้งหมด" tab bar above the table, defaulting to the
  // "รอตรวจสอบ" (DRAFT) tab so warehouse staff land straight on what needs their action.
  showReviewTabs?: boolean
}

type ReviewTabKey = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'ALL'

const TAB_STATUS: Record<ReviewTabKey, string | undefined> = {
  PENDING: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  ALL: undefined,
}

const resolveFromTo = (r: StockTransferListItem): { from: string; to: string } => ({
  from: r.from_warehouse_name || r.from_warehouse_code || r.from_project_name || r.from_project_code || '—',
  to: r.to_warehouse_name || r.to_warehouse_code || r.to_project_name || r.to_project_code || '—',
})

const StockTransferListView: React.FC<Props> = ({
  transferType, menuCode, title, subtitle, createLabel, breadcrumbLabel, createPath, detailPathPrefix, fromLabel, toLabel,
  showReviewTabs,
}) => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [data, setData] = useState<StockTransferListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)

  const [reviewTab, setReviewTab] = useState<ReviewTabKey>(showReviewTabs ? 'PENDING' : 'ALL')
  const [pendingCount, setPendingCount] = useState(0)

  const fetchList = async (nextPage = page, tab: ReviewTabKey = reviewTab) => {
    if (!accessToken) return
    setLoading(true)
    try {
      const effectiveStatus = showReviewTabs ? TAB_STATUS[tab] : statusFilter
      const result = await stockTransferService.list(accessToken, {
        transferType,
        status: effectiveStatus,
        fromWarehouseCode: warehouseFilter,
        search: search || undefined,
        dateFrom: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
        dateTo: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
        page: nextPage,
        pageSize,
      })
      setData(result.items)
      setTotal(result.total)
      setPage(nextPage)
      if (showReviewTabs && tab === 'PENDING') setPendingCount(result.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList(1, reviewTab) }, [transferType])

  // Keep the "รอตรวจสอบ" badge count fresh even while viewing another tab.
  useEffect(() => {
    if (!showReviewTabs || !accessToken || reviewTab === 'PENDING') return
    stockTransferService
      .list(accessToken, { transferType, status: 'DRAFT', page: 1, pageSize: 1 })
      .then((res) => setPendingCount(res.total))
      .catch(() => {})
  }, [showReviewTabs, accessToken, transferType, reviewTab])

  const handleTabChange = (key: string) => {
    const tab = key as ReviewTabKey
    setReviewTab(tab)
    fetchList(1, tab)
  }

  const handleReset = () => {
    setSearch('')
    setStatusFilter(undefined)
    setWarehouseFilter(undefined)
    setDateRange(null)
    fetchList(1)
  }

  const columns = [
    {
      title: 'เลขที่เอกสาร',
      dataIndex: 'transfer_no',
      key: 'transfer_no',
      render: (v: string, record: StockTransferListItem) => (
        <a onClick={() => navigate(`${detailPathPrefix}/${record.transfer_id}`)} style={{ color: '#2563eb', fontWeight: 600 }}>
          {v}
        </a>
      ),
    },
    {
      title: 'วันที่',
      dataIndex: 'transfer_date',
      key: 'transfer_date',
      render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    { title: fromLabel, key: 'from', render: (_: unknown, r: StockTransferListItem) => resolveFromTo(r).from },
    { title: toLabel, key: 'to', render: (_: unknown, r: StockTransferListItem) => resolveFromTo(r).to },
    ...(transferType === 'WH_TO_PROJECT' ? [{
      title: 'Stock House', key: 'is_stock_house', width: 90,
      render: (_: unknown, r: StockTransferListItem) => (
        r.is_stock_house ? <Tag color="blue">ตู้ {r.container_no || ''}</Tag> : null
      ),
    }] : []),
    { title: 'ผู้ขอ', dataIndex: 'requested_by_name', key: 'requested_by_name' },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (s: StockTransferListItem['status']) => (
        <Tag color={STOCK_TRANSFER_STATUS_COLOR[s]}>{STOCK_TRANSFER_STATUS_LABEL[s] || s}</Tag>
      ),
    },
    { title: 'ผู้ตรวจสอบ', dataIndex: 'checked_by_name', key: 'checked_by_name', render: (v?: string) => v || '—' },
    {
      title: '',
      key: 'action',
      render: (_: unknown, record: StockTransferListItem) => (
        showReviewTabs && reviewTab === 'PENDING' ? (
          <Button
            size="small"
            type="primary"
            onClick={() => navigate(`${detailPathPrefix}/${record.transfer_id}`)}
          >
            ตรวจสอบ
          </Button>
        ) : (
          <Button size="small" onClick={() => navigate(`${detailPathPrefix}/${record.transfer_id}`)}>ดูรายละเอียด</Button>
        )
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: breadcrumbLabel }]}
        extra={
          <PermissionButton
            menuCode={menuCode}
            action="write"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate(createPath)}
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
          >
            {createLabel}
          </PermissionButton>
        }
      />

      <Card style={cardStyle}>
        {showReviewTabs && (
          <Tabs
            activeKey={reviewTab}
            onChange={handleTabChange}
            items={[
              {
                key: 'PENDING',
                label: (
                  <Space size={6}>
                    <span>รอตรวจสอบ</span>
                    {pendingCount > 0 && <Badge count={pendingCount} overflowCount={999} color="#faad14" />}
                  </Space>
                ),
              },
              { key: 'CONFIRMED', label: 'ยืนยันแล้ว' },
              { key: 'CANCELLED', label: 'ยกเลิก' },
              { key: 'ALL', label: 'ทั้งหมด' },
            ]}
          />
        )}
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="ค้นหาเลขที่เอกสาร"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => fetchList(1)}
            style={{ width: 200 }}
            allowClear
          />
          {!showReviewTabs && (
            <Select
              placeholder="สถานะ"
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 160 }}
              options={[
                { value: 'DRAFT', label: 'ร่าง' },
                { value: 'CONFIRMED', label: 'ยืนยันแล้ว' },
                { value: 'CANCELLED', label: 'ยกเลิก' },
              ]}
            />
          )}
          <Input
            placeholder="รหัสคลัง"
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            style={{ width: 140 }}
            allowClear
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
          rowKey="transfer_id"
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

export default StockTransferListView
