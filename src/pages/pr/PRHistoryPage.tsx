import React, { useEffect, useState } from 'react'
import { Card, Table, Tag, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

// Matches the real DB CHECK constraint on purchase_request.status — kept in sync with
// the inline statusConfig in PRStatusPage.tsx (PR approval was removed; there is no
// PENDING_APPROVAL / APPROVED / REJECTED status anymore).
const statusConfig: Record<string, { color: string; label: string }> = {
  DRAFT:            { color: 'default', label: 'ร่าง' },
  COMPLETED:        { color: 'green',   label: 'เสร็จสมบูรณ์' },
  STOCK_CHECK:      { color: 'blue',    label: 'ตรวจสต็อก' },
  PARTIALLY_FILLED: { color: 'gold',    label: 'สั่งซื้อบางส่วน' },
  FULFILLED:        { color: 'green',   label: 'เสร็จสิ้น' },
  CANCELLED:        { color: 'default', label: 'ยกเลิก' },
}

interface PRItem {
  id: number
  prNo: string
  status: string
  requestedBy: string
  locationCode: string
  projectCode: string | null
  remarks: string | null
  prDate: string
}

const PRHistoryPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [items, setItems] = useState<PRItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)

  const fetchData = async (p = page, l = limit) => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/pr`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { page: p, limit: l },
      })
      const d = res.data?.data ?? res.data
      const raw = Array.isArray(d) ? d : d?.items ?? []
      setItems(raw.map((r: any) => ({
        id:           r.id,
        prNo:         r.pr_no          ?? '',
        status:       r.status         ?? 'DRAFT',
        requestedBy:  r.requested_by   ?? '—',
        locationCode: r.location_text  ?? '—',
        projectCode:  r.project_code   ?? null,
        remarks:      r.remarks        ?? null,
        prDate:       r.pr_date        ?? '',
      })))
      setTotal(Array.isArray(d) ? raw.length : (d?.total ?? raw.length))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(page, limit) }, [page, limit])

  const columns = [
    {
      title: 'เลขที่ PR',
      dataIndex: 'prNo',
      key: 'prNo',
      render: (v: string, record: PRItem) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/pr/${record.id}`)}>
          {v}
        </a>
      ),
    },
    {
      title: 'รายการ',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      render: (v: string | null) => v || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => {
        const cfg = statusConfig[v] ?? { color: 'default', label: v }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: 'มูลค่า (บาท)',
      key: 'amount',
      align: 'right' as const,
      render: () => <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'วันที่สร้าง',
      dataIndex: 'prDate',
      key: 'prDate',
      align: 'center' as const,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
  ]

  return (
    <div>
      <PageHeader
        title="ประวัติใบขอซื้อ"
        subtitle="ประวัติใบขอซื้อทั้งหมด"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบขอซื้อ' }, { title: 'ประวัติ' }]}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          size="small"
          locale={{ emptyText: 'ไม่พบข้อมูล' }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (p, l) => { setPage(p); setLimit(l) },
          }}
        />
      </Card>
    </div>
  )
}

export default PRHistoryPage
