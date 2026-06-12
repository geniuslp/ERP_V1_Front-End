import React from 'react'
import { Card, Table, Tag } from 'antd'
import PageHeader from '@/components/common/PageHeader'
import StatusBadge from '@/components/common/StatusBadge'

const data = [
  { key: '1', prNumber: 'PR-2024-0001', title: 'ซื้อวัสดุสำนักงาน', status: 'approved', amount: 15000, createdDate: '2024-08-01', closedDate: '2024-08-05' },
  { key: '2', prNumber: 'PR-2024-0002', title: 'ซื้ออุปกรณ์ IT', status: 'completed', amount: 85000, createdDate: '2024-08-10', closedDate: '2024-08-15' },
  { key: '3', prNumber: 'PR-2024-0003', title: 'ซื้อครุภัณฑ์', status: 'cancelled', amount: 45000, createdDate: '2024-08-20', closedDate: '2024-08-22' },
]

const columns = [
  { title: 'เลขที่ PR', dataIndex: 'prNumber', render: (v: string) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{v}</span> },
  { title: 'รายการ', dataIndex: 'title' },
  { title: 'สถานะ', dataIndex: 'status', render: (v: string) => <StatusBadge status={v} /> },
  { title: 'มูลค่า (บาท)', dataIndex: 'amount', align: 'center' as const, render: (v: number) => v.toLocaleString() },
  { title: 'วันที่สร้าง', dataIndex: 'createdDate' ,align: 'center'},
  { title: 'วันที่ปิด', dataIndex: 'closedDate' ,align: 'center' },
]


const PRHistoryPage: React.FC = () => (
  <div>
    <PageHeader title="ประวัติใบขอซื้อ" subtitle="ประวัติ PR ที่ดำเนินการเสร็จสิ้นแล้ว"
      breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบขอซื้อ' }, { title: 'ประวัติ' }]} />
    <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
      <Table dataSource={data} columns={columns} size="small"
        pagination={{ pageSize: 10, showTotal: (t) => `ทั้งหมด ${t} รายการ` }} />
    </Card>
  </div>
)

export default PRHistoryPage
