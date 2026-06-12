import React from 'react'
import { Row, Col, Card, Table, Tag, Typography, Progress } from 'antd'
import {
  FileTextOutlined, ShoppingCartOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import StatusBadge from '@/components/common/StatusBadge'

const recentPR = [
  { key: '1', prNumber: 'PR-2024-0001', title: 'ซื้อวัสดุสำนักงาน', requester: 'สมชาย ใจดี', status: 'pending', amount: 15000, date: '2024-09-01' },
  { key: '2', prNumber: 'PR-2024-0002', title: 'ซื้ออุปกรณ์คอมพิวเตอร์', requester: 'สมหญิง รักดี', status: 'approved', amount: 85000, date: '2024-09-02' },
  { key: '3', prNumber: 'PR-2024-0003', title: 'ซื้อวัสดุทำความสะอาด', requester: 'มานะ ขยันดี', status: 'draft', amount: 5000, date: '2024-09-03' },
  { key: '4', prNumber: 'PR-2024-0004', title: 'ซื้อเฟอร์นิเจอร์', requester: 'สุดา ดีใจ', status: 'rejected', amount: 120000, date: '2024-09-04' },
]

const columns = [
  { title: 'เลขที่', dataIndex: 'prNumber', key: 'prNumber', render: (v: string) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{v}</span> },
  { title: 'รายการ', dataIndex: 'title', key: 'title' },
  { title: 'ผู้ขอ', dataIndex: 'requester', key: 'requester' },
  { title: 'สถานะ', dataIndex: 'status', key: 'status', render: (v: string) => <StatusBadge status={v} /> },
  { title: 'มูลค่า (บาท)', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (v: number) => v.toLocaleString() },
]

const DashboardPage: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="ภาพรวมระบบจัดซื้อจัดจ้าง"
        breadcrumbs={[{ title: 'หน้าหลัก' }]}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard title="PR รออนุมัติ" value="24" icon={<ClockCircleOutlined />} color="#f59e0b" trend={{ value: 12, label: 'จากเดือนที่แล้ว' }} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard title="PR อนุมัติแล้ว" value="156" icon={<CheckCircleOutlined />} color="#16a34a" trend={{ value: 8, label: 'จากเดือนที่แล้ว' }} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard title="PO ทั้งหมด" value="89" icon={<ShoppingCartOutlined />} color="#2563eb" trend={{ value: 5, label: 'จากเดือนที่แล้ว' }} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard title="มูลค่ารวม (ล้าน)" value="₿ 4.2" icon={<FileTextOutlined />} color="#7c3aed" trend={{ value: -3, label: 'จากเดือนที่แล้ว' }} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={<span style={{ color: '#1e3a8a', fontWeight: 600 }}>ใบขอซื้อล่าสุด</span>}
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}
            extra={<Tag color="blue">เดือนนี้</Tag>}
          >
            <Table
              dataSource={recentPR}
              columns={columns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<span style={{ color: '#1e3a8a', fontWeight: 600 }}>สถานะโดยรวม</span>}
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)', height: '100%' }}
          >
            {[
              { label: 'อนุมัติแล้ว', value: 62, color: '#16a34a' },
              { label: 'รออนุมัติ', value: 15, color: '#f59e0b' },
              { label: 'ปฏิเสธ', value: 10, color: '#dc2626' },
              { label: 'ร่าง', value: 13, color: '#94a3b8' },
            ].map((item) => (
              <div key={item.label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Typography.Text style={{ color: '#374151', fontSize: 13 }}>{item.label}</Typography.Text>
                  <Typography.Text style={{ color: item.color, fontWeight: 600 }}>{item.value}%</Typography.Text>
                </div>
                <Progress percent={item.value} strokeColor={item.color} showInfo={false} size="small" />
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DashboardPage
