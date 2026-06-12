import React, { useState } from 'react'
import { Card, Table, Input, Select, Space, Button, DatePicker, Row, Col } from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import StatusBadge from '@/components/common/StatusBadge'

const data = [
  { key: '1', prNumber: 'PR-2024-0001', title: 'ซื้อวัสดุสำนักงาน', requester: 'สมชาย ใจดี', dept: 'IT', status: 'pending', amount: 15000, date: '2024-09-01' },
  { key: '2', prNumber: 'PR-2024-0002', title: 'ซื้ออุปกรณ์คอมพิวเตอร์', requester: 'สมหญิง รักดี', dept: 'HR', status: 'approved', amount: 85000, date: '2024-09-02' },
  { key: '3', prNumber: 'PR-2024-0003', title: 'ซื้อวัสดุทำความสะอาด', requester: 'มานะ ขยันดี', dept: 'OPS', status: 'draft', amount: 5000, date: '2024-09-03' },
  { key: '4', prNumber: 'PR-2024-0004', title: 'ซื้อเฟอร์นิเจอร์สำนักงาน', requester: 'สุดา ดีใจ', dept: 'FIN', status: 'rejected', amount: 120000, date: '2024-09-04' },
  { key: '5', prNumber: 'PR-2024-0005', title: 'ซื้อกระดาษ A4', requester: 'วิชัย มานะ', dept: 'IT', status: 'approved', amount: 3500, date: '2024-09-05' },
]

const columns = [
  { title: 'เลขที่ PR', dataIndex: 'prNumber', key: 'prNumber', render: (v: string) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{v}</span> },
  { title: 'รายการ', dataIndex: 'title', key: 'title' },
  { title: 'ผู้ขอ', dataIndex: 'requester', key: 'requester' },
  { title: 'แผนก', dataIndex: 'dept', key: 'dept' },
  { title: 'สถานะ', dataIndex: 'status', key: 'status', render: (v: string) => <StatusBadge status={v} /> },
  { title: 'มูลค่า (บาท)', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (v: number) => v.toLocaleString() },
  { title: 'วันที่', dataIndex: 'date', key: 'date' },
  {
    title: 'จัดการ', key: 'action', width: 80,
    render: () => <Button type="link" icon={<EyeOutlined />} size="small">ดู</Button>,
  },
]

const PRStatusPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | undefined>()

  const filtered = data.filter((d) => {
    const matchSearch = !search || d.prNumber.includes(search) || d.title.includes(search)
    const matchStatus = !status || d.status === status
    return matchSearch && matchStatus
  })

  return (
    <div>
      <PageHeader
        title="ตรวจสอบสถานะ PR"
        subtitle="ติดตามสถานะใบขอซื้อทั้งหมด"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบขอซื้อ' }, { title: 'ตรวจสอบสถานะ' }]}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Input prefix={<SearchOutlined />} placeholder="ค้นหาเลขที่หรือรายการ" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Col>
          <Col xs={24} md={6}>
            <Select placeholder="กรองตามสถานะ" allowClear style={{ width: '100%' }} value={status} onChange={setStatus}
              options={[
                { value: 'draft', label: 'ร่าง' }, { value: 'pending', label: 'รออนุมัติ' },
                { value: 'approved', label: 'อนุมัติแล้ว' }, { value: 'rejected', label: 'ปฏิเสธ' },
              ]} />
          </Col>
          <Col xs={24} md={6}>
            <DatePicker.RangePicker style={{ width: '100%' }} placeholder={['วันเริ่ม', 'วันสิ้นสุด']} />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatus(undefined) }}>รีเซ็ต</Button>
          </Col>
        </Row>
        <Table dataSource={filtered} columns={columns} rowKey="key" size="small"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `ทั้งหมด ${t} รายการ` }} />
      </Card>
    </div>
  )
}

export default PRStatusPage
