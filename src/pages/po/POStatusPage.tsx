import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, message, Input, Row, Col, Tag, Typography, Select } from 'antd'
import { EyeOutlined, EditOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import type { POListItem } from '@/types/po'
import { poApprovalService } from '@/services/poApprovalService'
import POStatusBadges from '@/components/po/POStatusBadge'
import { formatPoNoWithRevision } from '@/utils/poNo'
import EditApprovedButton from '@/pages/po/components/EditApprovedButton'
import { JOB_TYPES } from '@/constants/jobTypes'

const MENU_CODE = 'MENU_PO_CREATE'
const { Text } = Typography

const SUPPLIER_COLUMN_DEFAULT_WIDTH = 160
const PROJECT_COLUMN_DEFAULT_WIDTH = 140

// Same react-resizable pattern as PRStatusPage.tsx's "โครงการ" column — only
// columns that pass width/onResize via onHeaderCell get a drag handle; every
// other column's th renders through untouched.
interface ResizableTitleProps extends React.HTMLAttributes<HTMLElement> {
  onResize?: (e: React.SyntheticEvent, data: ResizeCallbackData) => void
  width?: number
}

const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResize, width, ...restProps } = props
  if (!width || !onResize) {
    return <th {...restProps} />
  }
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[80, 0]}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: -5,
            bottom: 0,
            top: 0,
            width: 10,
            cursor: 'col-resize',
            zIndex: 1,
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative' }} />
    </Resizable>
  )
}

const POStatusPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [items, setItems] = useState<POListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)

  // Resizable widths for "ร้านค้า / บริษัท" and "ProjectName" — same pattern as
  // PRStatusPage.tsx's "โครงการ" column, not persisted (resets on refresh).
  const [supplierColWidth, setSupplierColWidth] = useState(SUPPLIER_COLUMN_DEFAULT_WIDTH)
  const [projectColWidth, setProjectColWidth] = useState(PROJECT_COLUMN_DEFAULT_WIDTH)
  const handleSupplierColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setSupplierColWidth(data.size.width)
  }
  const handleProjectColResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setProjectColWidth(data.size.width)
  }

  // Filter inputs (uncommitted) vs. applied filters (sent to the API) — kept
  // separate so typing doesn't refetch on every keystroke; only "ค้นหา" or
  // "ล้าง" commits a new fetch, same trigger pattern as the rest of this page.
  const [poNoInput, setPoNoInput] = useState('')
  const [supplierInput, setSupplierInput] = useState('')
  const [createdByInput, setCreatedByInput] = useState('')
  const [filters, setFilters] = useState<{ po_no?: string; supplier?: string; created_by_name?: string }>({})
  // Filters the already-fetched page's rows client-side — GET /po has no
  // confirmed job_code query param, unlike the server-side filters above.
  const [jobCode, setJobCode] = useState<string | undefined>()

  const fetchData = async (p = page, l = limit, f = filters) => {
    setLoading(true)
    try {
      const res = await poApprovalService.getList(accessToken, {
        page: p,
        page_size: l,
        po_no: f.po_no || undefined,
        supplier: f.supplier || undefined,
        created_by_name: f.created_by_name || undefined,
      })
      const data = res.data.data
      setItems(Array.isArray(data.data) ? data.data : [])
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

  const filteredItems = jobCode ? items.filter((i) => i.job_code === jobCode) : items

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
    setJobCode(undefined)
    setPage(1)
    setFilters({})
  }

  const columns: ColumnsType<POListItem> = [
    {
      title: 'ลำดับ',
      key: 'line_index',
      width: 80,
      align: 'center',
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (_: unknown, __, index: number) => (page - 1) * limit + index + 1,
    },
    {
      title: 'เลขที่ PO',
      dataIndex: 'po_no',
      key: 'po_no',
      render: (v: string, record) => (
        <a style={{ color: '#2563eb', fontWeight: 600 }} onClick={() => navigate(`/po/approval/${record.po_id}`)}>
          {formatPoNoWithRevision(v, record.revision_round)}
        </a>
      ),
    },
    {
      title: 'ร้านค้า / บริษัท',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: supplierColWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        width: supplierColWidth,
        onResize: handleSupplierColResize,
      }),
    },
    {
      title: 'ProjectName',
      key: 'project_name',
      width: projectColWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        width: projectColWidth,
        onResize: handleProjectColResize,
      }),
      // project_name is nullable (LEFT JOIN) — fall back to project_code so
      // the cell isn't blank when the join doesn't match.
      render: (_: unknown, r) => r.project_name || r.project_code || '-',
    },
    {
      // Confirmed against the live API response: GET /po (list) returns the
      // job classification as `job_code` (e.g. "MP"), not `job_names` — the
      // previous job_names-based render always showed "-" because that field
      // is never populated by the backend. Display-only: show just the short
      // code, not the full "CODE - Name" label (JOB_TYPES.label is formatted
      // that way) — split on " - " defensively in case job_code itself ever
      // comes back combined, and take only the code part before it.
      title: 'งาน',
      dataIndex: 'job_code',
      key: 'job_code',
      width: 90,
      align: 'center',
      render: (v?: string) => {
        if (!v) return <Text type="secondary">-</Text>
        const code = v.split(' - ')[0].trim()
        return (
          <Tag color="geekblue" style={{ margin: 0, fontSize: 13 }}>
            {code}
          </Tag>
        )
      },
    },
    {
      // total_amount - discount_amount = after-discount, before VAT/WHT —
      // confirmed against erp-api po.go (`vatAmount := totalAmount -
      // discountAmount`, stored as po.vat_amount despite the confusing name).
      // net_amount already bakes in VAT/WHT — do not reintroduce that here.
      title: 'มูลค่าก่อน VAT',
      key: 'amount_after_discount',
      // Tight fixed width sized to the longest expected value
      // ("999,999,999 บาท") plus cell padding — not left to auto/content
      // width, which was leaving excess gap for typical shorter amounts.
      width: 120,
      align: 'right',
      ellipsis: true,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (_: unknown, r) => `${(r.total_amount - (r.discount_amount ?? 0)).toLocaleString('th-TH')} บาท`,
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
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 220,
      render: (_v: unknown, r) => <POStatusBadges status={r.status} statusReceive={r.status_receive} />,
    },
    {
      title: 'ผู้สร้าง',
      key: 'last_edited_by',
      width: 140,
      ellipsis: true,
      render: (_: unknown, r) => {
        const name =
          r.updated_by_name && r.updated_by_name !== r.created_by_name
            ? r.updated_by_name
            : r.created_by_name
        return name || '-'
      },
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
            onClick={() => navigate(`/po/approval/${record.po_id}`)}
          >
            ดู
          </Button>
          {(record.status === 'DRAFT' || record.status === 'PENDING_APPROVAL') && (
            <PermissionButton
              menuCode={MENU_CODE}
              action="edit"
              type="link"
              icon={<EditOutlined />}
              size="small"
              onClick={() => navigate(`/po/${record.po_id}/edit`)}
            >
              แก้ไข
            </PermissionButton>
          )}
          {/* record.can_edit_approved is never actually set by GET /po (list) —
              the List handler's PORow struct has no CanEditApproved field at
              all (unlike GET /po/:id, which computes it for APPROVED only).
              Check status + the same 1-year window the backend enforces
              directly off record.created_at instead of relying on that
              always-undefined flag. */}
          {(record.status === 'APPROVED' || record.status === 'PENDING_REAPPROVAL') &&
            (record.created_at
              ? Date.now() - new Date(record.created_at).getTime() < 365 * 24 * 60 * 60 * 1000
              : false) && (
              <EditApprovedButton poId={record.po_id} poNo={record.po_no} menuCode={MENU_CODE} size="small" />
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
            <Select
              placeholder="กรองตามประเภท Job"
              allowClear
              style={{ width: '100%' }}
              value={jobCode}
              onChange={setJobCode}
              options={JOB_TYPES.map((jt) => ({ value: jt.code, label: jt.label }))}
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
          rowKey="po_id"
          loading={loading}
          dataSource={filteredItems}
          columns={columns}
          components={{ header: { cell: ResizableTitle } }}
          tableLayout="fixed"
          scroll={{ x: 'max-content' }}
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
