import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Tag, message } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import type { POListItem, POStatus } from '@/types/po'
import { poApprovalService } from '@/services/poApprovalService'

// Same status map as POStatusPage.tsx — kept in sync with the real DB CHECK
// constraint on purchase_order.status (StatusBadge is stale/mock-era and
// doesn't cover these values, so it isn't used here).
const statusTag = (status: POStatus) => {
  const map: Record<POStatus, { color: string; label: string }> = {
    DRAFT: { color: 'default', label: 'แบบร่าง' },
    PENDING_APPROVAL: { color: 'processing', label: 'รออนุมัติ' },
    APPROVED: { color: 'success', label: 'อนุมัติแล้ว' },
    REJECTED: { color: 'error', label: 'ไม่อนุมัติ' },
    PENDING_REAPPROVAL: { color: 'gold', label: 'รออนุมัติอีกครั้ง' },
    SENT: { color: 'blue', label: 'ส่งแล้ว' },
    PARTIALLY_RECEIVED: { color: 'cyan', label: 'รับสินค้าบางส่วน' },
    RECEIVED: { color: 'green', label: 'รับสินค้าแล้ว' },
    CANCELLED: { color: 'warning', label: 'ยกเลิก' },
  }
  const s = map[status] ?? { color: 'default', label: status }
  return <Tag color={s.color}>{s.label}</Tag>
}

const POHistoryPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [items, setItems] = useState<POListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)

  const fetchData = async (p = page, l = limit) => {
    setLoading(true)
    try {
      const res = await poApprovalService.getList(accessToken, { page: p, limit: l })
      const data = res.data.data
      setItems(Array.isArray(data.items) ? data.items : [])
      setTotal(data.total ?? 0)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(page, limit) }, [page, limit])

  const columns: ColumnsType<POListItem> = [
    {
      title: 'เลขที่ PO',
      dataIndex: 'po_no',
      key: 'po_no',
      render: (v: string, record) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/po/approval/${record.id}`)}>
          {v}
        </a>
      ),
    },
    { title: 'ผู้ขาย', dataIndex: 'supplier_name', key: 'supplier_name' },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (v: POStatus) => statusTag(v),
    },
    {
      title: 'มูลค่า (บาท)',
      key: 'net_amount',
      align: 'right',
      render: (_: unknown, r) => r.net_amount.toLocaleString('th-TH'),
    },
    {
      title: 'วันที่สั่ง',
      dataIndex: 'po_date',
      key: 'po_date',
      render: (v: string) => v?.slice(0, 10) ?? '-',
    },
    // NOTE: GET /po's response (POListItem) has no closed/completed-date field —
    // same gap flagged for PRHistoryPage's "วันที่ปิด" column. Not invented here;
    // add this column once the backend actually returns such a field.
    {
      title: '',
      key: 'action',
      render: (_: unknown, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          size="small"
          onClick={() => navigate(`/po/approval/${record.id}`)}
        >
          ดู
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ประวัติใบสั่งซื้อ"
        subtitle="ประวัติ PO ที่ดำเนินการเสร็จสิ้นแล้ว"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบสั่งซื้อ' }, { title: 'ประวัติ' }]}
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

export default POHistoryPage
