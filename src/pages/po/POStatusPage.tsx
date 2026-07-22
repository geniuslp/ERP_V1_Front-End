import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Tag, Space, message, Input, Row, Col } from 'antd'
import { EyeOutlined, EditOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import type { POListItem, POStatus } from '@/types/po'
import { poApprovalService } from '@/services/poApprovalService'

const MENU_CODE = 'MENU_PO_CREATE'

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

const POStatusPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [items, setItems] = useState<POListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)

  // Filter inputs (uncommitted) vs. applied filters (sent to the API) — kept
  // separate so typing doesn't refetch on every keystroke; only "ค้นหา" or
  // "ล้าง" commits a new fetch, same trigger pattern as the rest of this page.
  const [poNoInput, setPoNoInput] = useState('')
  const [supplierInput, setSupplierInput] = useState('')
  const [createdByInput, setCreatedByInput] = useState('')
  const [filters, setFilters] = useState<{ po_no?: string; supplier?: string; created_by_name?: string }>({})

  const fetchData = async (p = page, l = limit, f = filters) => {
    setLoading(true)
    try {
      const res = await poApprovalService.getList(accessToken, {
        page: p,
        limit: l,
        po_no: f.po_no || undefined,
        supplier: f.supplier || undefined,
        created_by_name: f.created_by_name || undefined,
      })
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

  useEffect(() => { fetchData(page, limit, filters) }, [page, limit, filters])

  const handleSearch = () => {
    setPage(1)
    setFilters({
      po_no: poNoInput.trim(),
      supplier: supplierInput.trim(),
      created_by_name: createdByInput.trim(),
    })
  }

  const handleClear = () => {
    setPoNoInput('')
    setSupplierInput('')
    setCreatedByInput('')
    setPage(1)
    setFilters({})
  }

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
    {
      title: 'กำหนดส่ง',
      dataIndex: 'expected_date',
      key: 'expected_date',
      render: (v: string | null) => v?.slice(0, 10) ?? '-',
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, record) => (
        <Space size={4}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => navigate(`/po/approval/${record.id}`)}
          >
            ดู
          </Button>
          {record.status === 'DRAFT' && (
            <PermissionButton
              menuCode={MENU_CODE}
              action="edit"
              type="link"
              icon={<EditOutlined />}
              size="small"
              onClick={() => navigate(`/po/${record.id}/edit`)}
            >
              แก้ไข
            </PermissionButton>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ตรวจสอบสถานะ PO"
        subtitle="ติดตามสถานะใบสั่งซื้อทั้งหมด"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบสั่งซื้อ' }, { title: 'ตรวจสอบสถานะ' }]}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={6}>
            <Input
              placeholder="เลขที่ PO"
              value={poNoInput}
              onChange={(e) => setPoNoInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} md={6}>
            <Input
              placeholder="ผู้ขาย"
              value={supplierInput}
              onChange={(e) => setSupplierInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} md={6}>
            <Input
              placeholder="ผู้สร้าง"
              value={createdByInput}
              onChange={(e) => setCreatedByInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} md={6}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={loading}>
                ค้นหา
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleClear}>
                ล้าง
              </Button>
            </Space>
          </Col>
        </Row>

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

export default POStatusPage
