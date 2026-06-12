import React from 'react'
import { Card, Table } from 'antd'
import PageHeader from '@/components/common/PageHeader'
import StatusBadge from '@/components/common/StatusBadge'

const data = [
  { key: '1', poNumber: 'PO-2024-0001', vendor: 'บริษัท ABC จำกัด', status: 'completed', amount: 85000, orderDate: '2024-08-01', closedDate: '2024-08-20' },
  { key: '2', poNumber: 'PO-2024-0002', vendor: 'บริษัท XYZ จำกัด', status: 'cancelled', amount: 42000, orderDate: '2024-08-05', closedDate: '2024-08-07' },
]

const columns = [
  { title: 'เลขที่ PO', dataIndex: 'poNumber', render: (v: string) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{v}</span> },
  { title: 'ผู้ขาย', dataIndex: 'vendor' },
  { title: 'สถานะ', dataIndex: 'status', render: (v: string) => <StatusBadge status={v} /> },
  { title: 'มูลค่า (บาท)', dataIndex: 'amount', align: 'right' as const, render: (v: number) => v.toLocaleString() },
  { title: 'วันที่สั่ง', dataIndex: 'orderDate' },
  { title: 'วันที่ปิด', dataIndex: 'closedDate' },
]

const POHistoryPage: React.FC = () => (
  <div>
    <PageHeader title="ประวัติใบสั่งซื้อ" subtitle="ประวัติ PO ที่ดำเนินการเสร็จสิ้นแล้ว"
      breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบสั่งซื้อ' }, { title: 'ประวัติ' }]} />
    <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
      <Table dataSource={data} columns={columns} size="small" pagination={{ pageSize: 10, showTotal: (t) => `ทั้งหมด ${t} รายการ` }} />
    </Card>
  </div>
)

export default POHistoryPage
