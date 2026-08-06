import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Descriptions, message, Spin, Alert } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { grnReceivingService, GRN_RECEIVING_MOCK_MODE } from '@/services/grnReceivingService'
import GRNQualityBadge from '@/components/stock/GRNQualityBadge'
import type { GRNv2Detail, GRNv2Line } from '@/types'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const GRNv2DetailPage: React.FC = () => {
  const { grnId } = useParams<{ grnId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [grn, setGrn] = useState<GRNv2Detail | null>(null)

  useEffect(() => {
    if (!grnId) return
    let cancelled = false
    const fetchDetail = async () => {
      setLoading(true)
      try {
        const result = await grnReceivingService.getGrnDetail(Number(grnId))
        if (!cancelled) setGrn(result)
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดรายละเอียด GRN ไม่สำเร็จ')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchDetail()
    return () => { cancelled = true }
  }, [grnId])

  const columns = [
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'ชื่อวัสดุ', dataIndex: 'mat_name', key: 'mat_name', ellipsis: true },
    { title: 'จำนวนที่รับ', dataIndex: 'qty_accepted', key: 'qty_accepted', align: 'right' as const },
    {
      title: 'คุณภาพ',
      dataIndex: 'quality_status',
      key: 'quality_status',
      render: (v: GRNv2Line['quality_status']) => <GRNQualityBadge status={v} />,
    },
  ]

  return (
    <div>
      <PageHeader
        title="รายละเอียด GRN"
        subtitle={grn ? grn.grn_no : undefined}
        breadcrumbs={[
          { title: 'Home' }, { title: 'Stock Management' }, { title: 'ประวัติ GRN' }, { title: grn?.grn_no || '...' },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/stock/grn')}>
            กลับไปรายการ
          </Button>
        }
      />

      {GRN_RECEIVING_MOCK_MODE && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="กำลังแสดงข้อมูลจำลอง (mock) — รอ backend deploy" />
      )}

      {loading && (
        <Card style={cardStyle}><div style={{ textAlign: 'center', padding: 40 }}><Spin /></div></Card>
      )}

      {!loading && grn && (
        <>
          <Card style={{ ...cardStyle, marginBottom: 20 }}>
            <Descriptions
              bordered
              size="small"
              column={2}
              styles={{ label: { width: 160, fontWeight: 600, background: '#f8fafc' } }}
            >
              <Descriptions.Item label="เลข GRN">{grn.grn_no}</Descriptions.Item>
              <Descriptions.Item label="วันที่รับ">{grn.grn_date?.slice(0, 10) || '—'}</Descriptions.Item>
              <Descriptions.Item label="เลข PO">{grn.po_no}</Descriptions.Item>
              <Descriptions.Item label="Supplier">{grn.supplier_code}</Descriptions.Item>
              <Descriptions.Item label="คลัง">{grn.warehouse_code || '—'}</Descriptions.Item>
              <Descriptions.Item label="เลขที่ใบส่งของ">{grn.delivery_note || '—'}</Descriptions.Item>
              <Descriptions.Item label="สถานะ">{grn.status}</Descriptions.Item>
              <Descriptions.Item label="คุณภาพโดยรวม"><GRNQualityBadge status={grn.quality_status} /></Descriptions.Item>
            </Descriptions>
          </Card>

          <Card style={cardStyle}>
            <Table
              rowKey="grn_line_id"
              columns={columns}
              dataSource={grn.lines}
              pagination={false}
              locale={{ emptyText: 'ไม่มีรายการใน GRN นี้' }}
            />
          </Card>
        </>
      )}
    </div>
  )
}

export default GRNv2DetailPage
