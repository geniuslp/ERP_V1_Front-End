import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Select, DatePicker, Button, Space, Tooltip, Popconfirm, message } from 'antd'
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined,
  EditOutlined, FileAddOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import MemoStatusBadge from './components/MemoStatusBadge'
import { ROUTES } from '@/config/routes'
import { useAppSelector } from '@/store'
import PermissionGate from '@/components/permission/PermissionGate'
import type { Memo, MemoStatus } from '@/types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const mapMemo = (m: any): Memo => ({
  ...m,
  id:           String(m.id),
  memoNo:       m.memo_no         ?? m.memoNo        ?? '',
  title:        m.title           ?? '',
  requestedBy:  m.requested_by_name ?? m.requestedBy ?? '',
  approverName: m.approver_name     ?? m.approverName ?? undefined,
  projectName:  m.project_code    ?? m.project_name  ?? m.projectName   ?? undefined,
  supplierName: m.supplier_code   ?? m.supplier_name ?? m.supplierName  ?? undefined,
  status:       m.status          ?? 'DRAFT',
  createdAt:    m.created_at      ?? m.createdAt     ?? '',
  updatedAt:    m.updated_at      ?? m.updatedAt     ?? '',
})

const MemoListPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<Memo[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<MemoStatus | undefined>(undefined)
  const [range, setRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/memo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          search: search || undefined,
          status:  status  || undefined,
          date_from: range?.[0] ? range[0].format('YYYY-MM-DD') : undefined,
          date_to:   range?.[1] ? range[1].format('YYYY-MM-DD') : undefined,
        },
      })
      // backend returns { success, data: { data: [...], total, page, ... } }
      const raw = Array.isArray(res.data)
        ? res.data
        : res.data?.data?.data ?? res.data?.data ?? []
      const list = Array.isArray(raw) ? raw : []
      setData(list.map(mapMemo))
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'โหลดข้อมูลใบบันทึกไม่สำเร็จ'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${BASE_URL}/memo/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('ลบใบบันทึกสำเร็จ')
      fetchData()
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'ลบใบบันทึกไม่สำเร็จ'
      )
    }
  }

  const handleReset = () => {
    setSearch('')
    setStatus(undefined)
    setRange(null)
  }

  useEffect(() => {
    fetchData()
  }, [search, status, range])

  const columns = [
    {
      title: 'เลขที่ใบบันทึก',
      dataIndex: 'memoNo',
      key: 'memoNo',
      render: (memoNo: string, record: Memo) => (
        <a
          style={{ color: '#2563eb', fontWeight: 600 }}
          onClick={() => navigate(ROUTES.MEMO.DETAIL.replace(':id', record.id))}
        >
          {memoNo}
        </a>
      ),
    },
    {
      title: 'หัวข้อ / เรื่อง',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'โครงการ',
      dataIndex: 'projectName',
      key: 'projectName',
      ellipsis: true,
      render: (val?: string) => val || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'ผู้สร้าง',
      dataIndex: 'requestedBy',
      key: 'requestedBy',
    },
    {
      title: 'ผู้อนุมัติ',
      dataIndex: 'approverName',
      key: 'approverName',
      render: (val?: string) => val || <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (s: MemoStatus) => <MemoStatusBadge status={s} />,
    },
    {
      title: 'วันที่สร้าง',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'จัดการ',
      key: 'actions',
      render: (_: any, record: Memo) => (
        <Space>
          <Tooltip title="ดู">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(ROUTES.MEMO.DETAIL.replace(':id', record.id))}
            />
          </Tooltip>
          <Tooltip title="แก้ไข">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(ROUTES.MEMO.EDIT.replace(':id', record.id))}
            />
          </Tooltip>
          {(record.status === 'PENDING_PO' || record.status === 'pending_po') && (
            <Tooltip title="สร้าง PO">
              <Button
                size="small"
                icon={<FileAddOutlined />}
                onClick={() =>
                  navigate(ROUTES.PO.CREATE, { state: { fromMemoId: record.id, memo: record } })
                }
              />
            </Tooltip>
          )}
          <Popconfirm
            title="ยืนยันการลบใบบันทึกนี้?"
            okText="ลบ"
            cancelText="ยกเลิก"
            disabled={record.status === 'PO_CREATED' || record.status === 'po_created'}
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip
              title={
                record.status === 'PO_CREATED' || record.status === 'po_created'
                  ? 'สร้าง PO แล้ว ไม่สามารถลบได้'
                  : 'ลบ'
              }
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={record.status === 'PO_CREATED' || record.status === 'po_created'}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ใบบันทึก (Memo)"
        subtitle="รายการใบบันทึกความต้องการจัดซื้อ"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบบันทึก' }]}
        extra={
          <PermissionGate menuCode="MENU_MEMO_CREATE" action="write" mode="hide">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(ROUTES.MEMO.CREATE)}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}
            >
              สร้างใบบันทึก
            </Button>
          </PermissionGate>
        }
      />

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, width: '100%', flexWrap: 'wrap' }}>
          <Input
            placeholder="ค้นหาเลขที่/หัวข้อ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="สถานะ"
            value={status}
            onChange={setStatus}
            allowClear
            style={{ width: 180 }}
            options={[
              { value: 'DRAFT',            label: 'ร่าง' },
              { value: 'PENDING_APPROVAL', label: 'รอการอนุมัติ' },
              { value: 'APPROVED',         label: 'อนุมัติแล้ว' },
              { value: 'REJECTED',         label: 'ถูกปฏิเสธ' },
              { value: 'CANCELLED',        label: 'ยกเลิก' },
            ]}
          />
          <DatePicker.RangePicker
            value={range as any}
            onChange={(v) => setRange(v as any)}
            format="DD/MM/YYYY"
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>
            ค้นหา
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            รีเซต
          </Button>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `ทั้งหมด ${total} รายการ`,
          }}
          locale={{ emptyText: 'ไม่พบข้อมูลใบบันทึก' }}
        />
      </Card>
    </div>
  )
}

export default MemoListPage