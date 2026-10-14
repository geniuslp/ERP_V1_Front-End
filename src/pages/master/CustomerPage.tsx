import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Typography, Tag, Switch, Tooltip } from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UploadOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { usePermissionContext } from '@/contexts/PermissionContext'
import { customerService } from '@/services/customerService'
import type { Customer, CustomerPayload, CustomerStatusFilter } from '@/types/customer'
import CustomerImportModal from '@/components/customer/CustomerImportModal'
import { useAppSelector } from '@/store'
import { PAYMENT_TERM_OPTIONS } from '@/constants/paymentTerms'

// Customer form reuses Supplier's shared option list verbatim, just excluding
// "เงินสด" at render time (per explicit instruction — the shared source
// itself is not altered, so "เงินสด" stays available on the Supplier page).
const CUSTOMER_CREDIT_TERM_OPTIONS = PAYMENT_TERM_OPTIONS.filter((o) => o.value !== 'เงินสด')

// Backend keys customers by cus_id (GET/PUT/DELETE /customer/:id) — key the table row on it.
type CustomerRecord = Customer & { key: number }

const { Text } = Typography

const MENU_CODE = 'MENU_MASTER_CUSTOMER'
const GENERIC_ERROR = 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'
const looksLikeRawDbError = (t: string) => /SQLSTATE|violates|foreign key constraint|duplicate key|null value in column|pq:/i.test(t)
// Backend messages are plain-language; only a leaked raw DB error is replaced.
const apiError = (err: any, fallback: string) => {
  const m = err?.response?.data?.message || err?.response?.data?.error
  if (typeof m === 'string' && m) return looksLikeRawDbError(m) ? GENERIC_ERROR : m
  return fallback
}
const orNull = (v?: string | null) => (v && v.trim() ? v.trim() : null)

const STATUS_OPTIONS: { value: CustomerStatusFilter; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'active', label: 'ใช้งาน' },
  { value: 'inactive', label: 'ไม่ใช้งาน' },
]

// Long text: single-line ellipsis + full text in a tooltip.
const EllipsisText: React.FC<{ value?: string | null }> = ({ value }) =>
  value ? (
    <Tooltip title={<span style={{ whiteSpace: 'pre-wrap' }}>{value}</span>}>
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </Tooltip>
  ) : <span style={{ color: '#9ca3af' }}>—</span>

const CustomerPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<CustomerRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const { can } = usePermissionContext()
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>('active')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  // `search` is the debounced value actually sent to the API; `searchInput`
  // tracks the raw keystrokes so the box stays responsive while typing.
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searching, setSearching] = useState(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [importOpen, setImportOpen] = useState(false)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const { items, total: t } = await customerService.list(accessToken ?? '', {
        page: currentPage, page_size: pageSize, search: search || undefined, status: statusFilter,
      })
      setData(items.map((r) => ({ ...r, key: r.cus_id })))
      setTotal(t)
    } catch (err: any) {
      message.error(apiError(err, 'โหลดข้อมูลไม่สำเร็จ'))
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }, [accessToken, currentPage, pageSize, search, statusFilter])

  // debounce the search box: wait 400ms after typing stops before hitting the
  // API, and jump back to page 1 since the result set changes.
  const handleSearchInputChange = (value: string) => {
    setSearchInput(value)
    setSearching(true)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setCurrentPage(1)
      setSearch(value)
    }, 400)
  }

  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ is_active: true })
    setOpen(true)
  }

  const openEdit = (record: CustomerRecord) => {
    setEditing(record)
    form.resetFields()
    form.setFieldsValue(record)
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    const payload: CustomerPayload = {
      customer_code: String(values.customer_code).trim(),
      customer_name: String(values.customer_name).trim(),
      contact: orNull(values.contact),
      tel: orNull(values.tel),
      address: orNull(values.address),
      remarks: orNull(values.remarks),
      credit_term: orNull(values.credit_term),
      ...(editing ? { is_active: !!values.is_active } : {}),
    }
    setSaving(true)
    try {
      if (editing) {
        await customerService.update(accessToken ?? '', editing.cus_id, payload)
        message.success('แก้ไขข้อมูลลูกค้าสำเร็จ')
      } else {
        const created = await customerService.create(accessToken ?? '', payload)
        message.success(`สร้างลูกค้าสำเร็จ รหัส: ${created.customer_code}`)
      }
      closeModal()
      fetchCustomers()
    } catch (err: any) {
      if (err?.response?.status === 409) {
        form.setFields([{ name: 'customer_code', errors: ['รหัสลูกค้านี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น'] }])
      } else {
        message.error(apiError(err, 'บันทึกไม่สำเร็จ'))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await customerService.remove(accessToken ?? '', id)
      message.success('ลบลูกค้าเรียบร้อยแล้ว')
      fetchCustomers()
    } catch (err: any) {
      message.error(apiError(err, 'ลบลูกค้าไม่สำเร็จ'))
    }
  }

  const columns = [
    {
      title: 'ลำดับ',
      key: 'no',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, __: CustomerRecord, index: number) =>
        (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: 'รหัสลูกค้า',
      dataIndex: 'customer_code',
      width: 130,
      render: (v: string) => <Text style={{ fontFamily: 'Sarabun, IBM Plex Sans Thai, sans-serif' }}>{v}</Text>,
    },
    {
      title: 'ชื่อลูกค้า',
      dataIndex: 'customer_name',
      width: 220,
      render: (v: string) => <Text strong style={{ fontSize: 14, color: '#1e3a8a' }}>{v}</Text>,
    },
    {
      title: 'ผู้ติดต่อ', dataIndex: 'contact', width: 180,
      render: (v?: string | null) => <EllipsisText value={v} />,
    },
    {
      title: 'เบอร์โทร', dataIndex: 'tel', width: 130,
      render: (v?: string | null) => <EllipsisText value={v} />,
    },
    {
      title: 'ที่อยู่', dataIndex: 'address', width: 220,
      render: (v?: string | null) => <EllipsisText value={v} />,
    },
    {
      title: 'เครดิต (วัน)', dataIndex: 'credit_term', width: 110, align: 'center' as const,
      render: (v?: string | null) => (v ? v : <span style={{ color: '#9ca3af' }}>—</span>),
    },
    {
      title: 'หมายเหตุ', dataIndex: 'remarks', width: 200,
      render: (v?: string | null) => <EllipsisText value={v} />,
    },
    {
      title: 'สถานะ', dataIndex: 'is_active', width: 100, align: 'center' as const,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'ใช้งาน' : 'ไม่ใช้งาน'}</Tag>,
    },
    {
      title: '',
      width: 100,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: unknown, r: CustomerRecord) => (
        <Space>
          <PermissionButton menuCode={MENU_CODE} action="edit" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          {r.is_active && can(MENU_CODE, 'delete') && (
            <Popconfirm title="ยืนยันการลบลูกค้านี้?" onConfirm={() => handleDelete(r.cus_id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ลูกค้า (Customer)"
        subtitle="จัดการข้อมูลลูกค้า"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'ลูกค้า' }]}
        extra={
          <Space>
            <PermissionButton menuCode={MENU_CODE} action="write" icon={<UploadOutlined />} onClick={() => setImportOpen(true)} style={{ borderRadius: 8 }}>
              นำเข้า Excel
            </PermissionButton>
            <PermissionButton menuCode={MENU_CODE} action="write" type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 8 }}>
            สร้างลูกค้า
            </PermissionButton>
          </Space>
        }
      />

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="ค้นหาชื่อ / รหัส / ผู้ติดต่อ / หมายเหตุลูกค้า"
            allowClear
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={searchInput}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
          />
          <Select
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}
            style={{ width: 130 }}
          />
          <Button
            onClick={() => {
              setStatusFilter('active')
              setSearchInput('')
              setSearching(true)
              setCurrentPage(1)
              setSearch('')
            }}
            style={{ borderRadius: 8 }}
          >
            ล้างค้นหา
          </Button>
        </Space>

        <Table
          rowKey="key"
          loading={loading || searching}
          dataSource={data}
          columns={columns}
          size="small"
          scroll={{ x: 1300 }}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            showSizeChanger: true,
            onChange: (page, size) => { setCurrentPage(page); setPageSize(size) },
          }}
        />
      </Card>

      <CustomerImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => { setCurrentPage(1); fetchCustomers() }}
      />

      <Modal
        title={<span style={{ fontFamily: 'Sarabun, sans-serif', fontWeight: 700, color: '#1e3a8a' }}>{editing ? 'แก้ไขลูกค้า' : 'สร้างลูกค้า'}</span>}
        open={open}
        onCancel={closeModal}
        destroyOnClose
        width={560}
        footer={[
          <Button key="cancel" onClick={closeModal} style={{ borderRadius: 8 }}>ยกเลิก</Button>,
          <Button key="save" type="primary" loading={saving} onClick={handleSave} style={{ borderRadius: 8 }}>บันทึก</Button>,
        ]}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="customer_code"
            label="รหัสลูกค้า"
            rules={[{ required: true, whitespace: true, message: 'กรุณากรอกรหัสลูกค้า' }, { max: 20, message: 'รหัสลูกค้ายาวเกิน 20 ตัวอักษร' }]}
            extra="รหัสลูกค้าต้องไม่ซ้ำกับที่มีอยู่ในระบบ"
          >
            <Input placeholder="เช่น CUS-000001" maxLength={20} style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item
            name="customer_name"
            label="ชื่อลูกค้า"
            rules={[{ required: true, whitespace: true, message: 'กรุณากรอกชื่อลูกค้า' }, { max: 255, message: 'ชื่อลูกค้ายาวเกิน 255 ตัวอักษร' }]}
          >
            <Input placeholder="ชื่อบริษัท / ลูกค้า" maxLength={255} style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="contact" label="ผู้ติดต่อ">
            <Input.TextArea rows={2} placeholder="ชื่อผู้ติดต่อ" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="tel" label="เบอร์โทร" rules={[{ max: 50, message: 'เบอร์โทรยาวเกิน 50 ตัวอักษร' }]}>
            <Input placeholder="เบอร์โทร" maxLength={50} style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="address" label="ที่อยู่">
            <Input.TextArea rows={3} placeholder="ที่อยู่" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="remarks" label="หมายเหตุ">
            <Input.TextArea rows={3} placeholder="หมายเหตุ" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="credit_term" label="เครดิต (วัน)">
            <Select placeholder="เลือกเครดิต" options={CUSTOMER_CREDIT_TERM_OPTIONS} allowClear />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label="สถานะการใช้งาน" valuePropName="checked">
              <Switch checkedChildren="ใช้งาน" unCheckedChildren="ปิดใช้งาน" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default CustomerPage
