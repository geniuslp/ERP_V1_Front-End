import React from 'react'
import { Card, Table, Button } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import StatusBadge from '@/components/common/StatusBadge'

const data = [
  { key: '1', poNumber: 'PO-2024-0001', vendor: 'บริษัท ABC จำกัด', status: 'sent', amount: 85000, orderDate: '2024-09-01', deliveryDate: '2024-09-15' },
  { key: '2', poNumber: 'PO-2024-0002', vendor: 'บริษัท XYZ จำกัด', status: 'partial', amount: 42000, orderDate: '2024-09-02', deliveryDate: '2024-09-10' },
  { key: '3', poNumber: 'PO-2024-0003', vendor: 'ห้างหุ้นส่วน DEF', status: 'completed', amount: 15000, orderDate: '2024-09-03', deliveryDate: '2024-09-05' },
]

const columns = [
  { title: 'เลขที่ PO', dataIndex: 'poNumber', render: (v: string) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{v}</span> },
  { title: 'ผู้ขาย', dataIndex: 'vendor' },
  { title: 'สถานะ', dataIndex: 'status', render: (v: string) => <StatusBadge status={v} /> },
  { title: 'มูลค่า (บาท)', dataIndex: 'amount', align: 'right' as const, render: (v: number) => v.toLocaleString() },
  { title: 'วันที่สั่ง', dataIndex: 'orderDate' },
  { title: 'กำหนดส่ง', dataIndex: 'deliveryDate' },
  { title: '', key: 'action', render: () => <Button type="link" icon={<EyeOutlined />} size="small">ดู</Button> },
]

const POStatusPage: React.FC = () => (
  <div>
    <PageHeader title="ตรวจสอบสถานะ PO" subtitle="ติดตามสถานะใบสั่งซื้อทั้งหมด"
      breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบสั่งซื้อ' }, { title: 'ตรวจสอบสถานะ' }]} />
    <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
      <Table dataSource={data} columns={columns} size="small" pagination={{ pageSize: 10, showTotal: (t) => `ทั้งหมด ${t} รายการ` }} />
    </Card>
  </div>
)

export default POStatusPage
