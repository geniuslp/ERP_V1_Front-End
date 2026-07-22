import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Descriptions, Table, Tag, Space, Button, Spin, Empty, Typography } from 'antd'
import { ArrowLeftOutlined, PaperClipOutlined, EditOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'

// Edit uses the create page's own menu code (same convention as
// POStatusPage.tsx / PRStatusPage.tsx gating their edit buttons).
const MENU_CODE = 'MENU_PR_CREATE'

const { Text } = Typography

const BASE_URL = (import.meta as any).env?.VITE_API_URL
// Uploaded files are served as static assets off the API server root (app.Static("/uploads", ...)),
// not under /api/v1 — strip the versioned API suffix to get the file host.
const FILE_BASE_URL = (BASE_URL ?? '').replace(/\/api\/v1\/?$/, '')

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#1e40af',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const statusConfig: Record<string, { color: string; label: string }> = {
  DRAFT:            { color: 'default', label: 'ร่าง' },
  COMPLETED:        { color: 'green',   label: 'เสร็จสมบูรณ์' },
  STOCK_CHECK:      { color: 'blue',    label: 'ตรวจสต็อก' },
  PARTIALLY_FILLED: { color: 'gold',    label: 'สั่งซื้อบางส่วน' },
  FULFILLED:        { color: 'green',   label: 'เสร็จสิ้น' },
  CANCELLED:        { color: 'default', label: 'ยกเลิก' },
}

interface PRLineItem {
  id: number
  lineNo: number
  matCode: string
  qtyRequested: number
  qtyReserved: number
  qtyToOrder: number
  status: string
  remarks?: string | null
  matName?: string | null
  unitName?: string | null
  costCode?: string | null
  costSubgroupName?: string | null
}

interface PRAttachment {
  id: number
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  uploadedAt: string
}

interface PRDetail {
  id: number
  prNo: string
  status: string
  requestedBy: string
  approverName: string | null
  locationText: string
  projectCode: string | null
  remarks: string | null
  prDate: string
  lines: PRLineItem[]
  attachments: PRAttachment[]
}

const mapPR = (raw: any): PRDetail => ({
  id:           raw.id,
  prNo:         raw.pr_no          ?? '',
  status:       raw.status         ?? 'DRAFT',
  requestedBy:  raw.requested_by   ?? '—',
  approverName: raw.approver_name  ?? null,
  locationText: raw.location_text  ?? '—',
  projectCode:  raw.project_code   ?? null,
  remarks:      raw.remarks        ?? null,
  prDate:       raw.pr_date        ?? '',
  lines: (raw.lines ?? []).map((l: any) => ({
    id:               l.id,
    lineNo:           l.line_no            ?? 0,
    matCode:          l.mat_code           ?? '',
    qtyRequested:     l.qty_requested      ?? 0,
    qtyReserved:      l.qty_reserved       ?? 0,
    qtyToOrder:       l.qty_to_order       ?? 0,
    status:           l.status             ?? '',
    remarks:          l.remarks,
    matName:          l.mat_name,
    unitName:         l.unit_name,
    costCode:         l.cost_code,
    costSubgroupName: l.cost_subgroup_name,
  })),
  attachments: (raw.attachments ?? []).map((a: any) => ({
    id:         a.id,
    fileName:   a.file_name,
    filePath:   a.file_path,
    fileSize:   a.file_size ?? 0,
    fileType:   a.file_type ?? '',
    uploadedAt: a.uploaded_at ?? '',
  })),
})

const formatSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`

const PRDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [pr, setPr] = useState<PRDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchPR = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/pr/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const raw = res.data?.data ?? res.data
      setPr(mapPR(raw))
    } catch (err: any) {
      setPr(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPR() }, [id])

  // whether any line has a cost code assigned — hides the column entirely on older PRs
  const hasCostCode = pr?.lines.some((l) => l.costCode || l.costSubgroupName) ?? false

  const lineColumns = [
    { title: 'No.', dataIndex: 'lineNo', key: 'lineNo', width: 60, align: 'center' as const },
    { title: 'รหัสวัสดุ', dataIndex: 'matCode', key: 'matCode', width: 130 },
    {
      title: 'รายการ', key: 'matName',
      render: (_: unknown, r: PRLineItem) => r.matName || <Text type="secondary">—</Text>,
    },
    { title: 'จำนวนขอ', dataIndex: 'qtyRequested', key: 'qtyRequested', width: 100, align: 'right' as const },
    { title: 'จำนวนสั่งซื้อ', dataIndex: 'qtyToOrder', key: 'qtyToOrder', width: 110, align: 'right' as const },
    { title: 'หน่วย', dataIndex: 'unitName', key: 'unitName', width: 80, align: 'center' as const },
    ...(hasCostCode
      ? [{
          title: 'Cost Code', key: 'costCode', width: 180,
          render: (_: unknown, r: PRLineItem) => r.costCode
            ? <Text code>{r.costCode}{r.costSubgroupName ? ` — ${r.costSubgroupName}` : ''}</Text>
            : <Text type="secondary">—</Text>,
        }]
      : []),
    {
      title: 'หมายเหตุ', dataIndex: 'remarks', key: 'remarks',
      render: (v?: string | null) => v || <Text type="secondary">—</Text>,
    },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!pr) {
    return (
      <div>
        <PageHeader
          title="ใบขอซื้อ (PR)"
          breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบขอซื้อ' }, { title: 'รายละเอียด' }]}
        />
        <Card style={cardStyle}>
          <Empty description="ไม่พบข้อมูลใบขอซื้อ" />
        </Card>
      </div>
    )
  }

  const statusCfg = statusConfig[pr.status] ?? { color: 'default', label: pr.status }

  return (
    <div>
      <PageHeader
        title={`ใบขอซื้อ ${pr.prNo}`}
        subtitle="รายละเอียดใบขอซื้อ (มุมมองอ่านอย่างเดียว)"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบขอซื้อ' }, { title: pr.prNo }]}
        extra={
          <Space>
            {pr.status === 'DRAFT' && (
              <PermissionButton
                menuCode={MENU_CODE}
                action="edit"
                icon={<EditOutlined />}
                onClick={() => navigate(`/pr/${pr.id}/edit`)}
              >
                แก้ไข
              </PermissionButton>
            )}
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/pr/status')}>
              กลับ
            </Button>
          </Space>
        }
      />

      <Card style={{ ...cardStyle, marginBottom: 16 }} title={<span style={cardTitleStyle}>ข้อมูลใบขอซื้อ</span>}>
        <Descriptions column={{ xs: 1, sm: 2 }} size="middle">
          <Descriptions.Item label="เลขที่ PR">{pr.prNo}</Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="วันที่">
            {pr.prDate ? dayjs(pr.prDate).format('DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="ผู้ขอซื้อ">{pr.requestedBy}</Descriptions.Item>
          <Descriptions.Item label="ผู้อนุมัติ">{pr.approverName || '—'}</Descriptions.Item>
          <Descriptions.Item label="สถานที่ส่งของ">{pr.locationText}</Descriptions.Item>
          <Descriptions.Item label="รหัสงาน">{pr.projectCode || '—'}</Descriptions.Item>
          <Descriptions.Item label="หมายเหตุ" span={2}>{pr.remarks || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ ...cardStyle, marginBottom: 16 }} title={<span style={cardTitleStyle}>รายการวัสดุ</span>}>
        <Table
          rowKey="id"
          size="small"
          dataSource={pr.lines}
          columns={lineColumns}
          pagination={false}
          locale={{ emptyText: 'ไม่มีรายการ' }}
          scroll={{ x: 700 }}
        />
      </Card>

      {pr.attachments.length > 0 && (
        <Card style={cardStyle} title={<span style={cardTitleStyle}>ไฟล์แนบ</span>}>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {pr.attachments.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  border: '0.5px solid #e5e7eb',
                  borderRadius: 8,
                }}
              >
                <Space>
                  <PaperClipOutlined style={{ color: '#2563eb' }} />
                  <a
                    href={`${FILE_BASE_URL}/${a.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, color: '#1e40af' }}
                    className="attachment-filename-link"
                  >
                    {a.fileName}
                  </a>
                  <Text type="secondary" style={{ fontSize: 12 }}>{formatSize(a.fileSize)}</Text>
                </Space>
              </div>
            ))}
          </Space>
        </Card>
      )}
    </div>
  )
}

export default PRDetailPage
