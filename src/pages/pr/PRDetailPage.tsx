import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Descriptions, Table, Tag, Space, Button, Spin, Empty, Typography, message, Alert, Modal } from 'antd'
import { ArrowLeftOutlined, PaperClipOutlined, EditOutlined, WarningOutlined, PrinterOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import PRPrint, { type PRData } from './PRPrint'

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
  orderType: 'stock' | 'cost' | null
  remarks: string | null
  prDate: string
  requiredDate: string | null
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
  orderType:    raw.order_type     ?? null,
  remarks:      raw.remarks        ?? null,
  prDate:       raw.pr_date        ?? '',
  requiredDate: raw.required_date  ?? null,
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

interface BlockingPO {
  po_id?: number
  po_no: string
}

// GET /pr/:id/lines-with-po-status returns referenced_pos: { po_id, po_no, qty }[]
// per line — these are the still-active (non-cancelled) POs consuming this PR's
// lines, which is exactly what the reopen guard blocks on. Used both for the
// proactive banner and to resolve po_id when the reactive error only has po_no.
const extractBlockingPOs = (lines: any[]): BlockingPO[] => {
  const byId = new Map<number, BlockingPO>()
  for (const line of lines ?? []) {
    for (const po of line.referenced_pos ?? []) {
      if (po?.po_id != null && !byId.has(po.po_id)) {
        byId.set(po.po_id, { po_id: po.po_id, po_no: po.po_no })
      }
    }
  }
  return Array.from(byId.values())
}

// Best-effort parse of the reopen 400 error — prefer a structured field if the
// backend sends one, otherwise fall back to pulling PO numbers out of the
// message text (format PO-YYYYMM-NNNN).
const parseBlockingPOsFromError = (err: any): string[] | null => {
  if (err?.response?.status !== 400) return null
  const data = err?.response?.data
  const structured = data?.blocking_pos ?? data?.pos ?? data?.data?.blocking_pos
  if (Array.isArray(structured) && structured.length > 0) {
    return structured.map((p: any) => (typeof p === 'string' ? p : p?.po_no)).filter(Boolean)
  }
  const msg: string = data?.message || data?.error || ''
  const matches = msg.match(/PO-\d{4,}-\d+/g)
  return matches && matches.length > 0 ? matches : null
}

const PRDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [pr, setPr] = useState<PRDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [blockingPOs, setBlockingPOs] = useState<BlockingPO[]>([])
  const [blockModalPOs, setBlockModalPOs] = useState<BlockingPO[] | null>(null)
  const [printData, setPrintData] = useState<PRData | null>(null)

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

  // Proactive check: only relevant once the PR is COMPLETED (the only status
  // that shows the "แก้ไข" button / calls reopen).
  useEffect(() => {
    if (pr?.status !== 'COMPLETED') {
      setBlockingPOs([])
      return
    }
    const fetchLinesPOStatus = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/pr/${id}/lines-with-po-status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const body = res.data?.data ?? res.data
        setBlockingPOs(extractBlockingPOs(body?.lines ?? []))
      } catch {
        // Non-critical — the reactive error modal on "แก้ไข" click still catches this.
        setBlockingPOs([])
      }
    }
    fetchLinesPOStatus()
  }, [pr?.status, id])

  const handleEdit = async () => {
    setReopening(true)
    try {
      await axios.put(`${BASE_URL}/pr/${id}/reopen`, null, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      navigate(`/pr/${id}/edit`)
    } catch (err: any) {
      const blockingPoNos = parseBlockingPOsFromError(err)
      if (blockingPoNos) {
        // Resolve po_id from the already-fetched referenced_pos where possible
        // so the list is clickable; falls back to plain text if not found.
        setBlockModalPOs(
          blockingPoNos.map((po_no) => blockingPOs.find((p) => p.po_no === po_no) ?? { po_no }),
        )
      } else {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'เปิด PR เพื่อแก้ไขไม่สำเร็จ'
        )
      }
    } finally {
      setReopening(false)
    }
  }

  // No separate print-data endpoint for PR (unlike PO's GET /po/:id/print-data)
  // — everything the print layout needs is already in the detail response
  // this page loaded, so build PRData straight from `pr` instead of an extra call.
  const handlePrint = () => {
    if (!pr) return
    setPrintData({
      prNo: pr.prNo,
      prDate: pr.prDate ? dayjs(pr.prDate).format('DD/MM/YYYY') : '',
      projectDept: pr.projectCode ?? '',
      vendor: '',
      deliveryDate: pr.requiredDate ? dayjs(pr.requiredDate).format('DD/MM/YYYY') : '',
      deliveryTo: pr.locationText ?? '',
      remark: pr.remarks ?? '',
      orderType: pr.orderType ?? '',
      status: pr.status,
      items: pr.lines.map((l) => ({
        no: String(l.lineNo),
        costCode: l.costCode ? `${l.costCode}${l.costSubgroupName ? ` — ${l.costSubgroupName}` : ''}` : '',
        matCode: l.matCode,
        desc: l.matName ?? '',
        qty: l.qtyRequested,
        unit: l.unitName ?? '',
        remark: l.remarks ?? '',
      })),
    })
  }

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
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              พิมพ์
            </Button>
            {pr.status === 'COMPLETED' && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                loading={reopening}
                onClick={handleEdit}
              >
                แก้ไข
              </Button>
            )}
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/pr/status')}>
              กลับ
            </Button>
          </Space>
        }
      />

      {blockingPOs.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ borderRadius: 12, marginBottom: 16 }}
          message="ไม่สามารถแก้ไข PR นี้ได้ในขณะนี้"
          description={
            <span>
              PO ที่ต้องยกเลิกก่อนแก้ไข PR นี้:{' '}
              {blockingPOs.map((po, i) => (
                <React.Fragment key={po.po_id ?? po.po_no}>
                  {i > 0 && ', '}
                  <a onClick={() => navigate(`/po/approval/${po.po_id}`)}>{po.po_no}</a>
                </React.Fragment>
              ))}
            </span>
          }
        />
      )}

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

      <Modal
        open={!!blockModalPOs}
        title={
          <Space>
            <WarningOutlined style={{ color: '#d97706' }} />
            <span>ไม่สามารถแก้ไข PR นี้ได้</span>
          </Space>
        }
        onCancel={() => setBlockModalPOs(null)}
        footer={[
          <Button key="close" onClick={() => setBlockModalPOs(null)}>
            ปิด
          </Button>,
        ]}
      >
        <Text>ไม่สามารถแก้ไข PR นี้ได้ เนื่องจากยังมี PO ที่ยังไม่ถูกยกเลิกอ้างอิงอยู่:</Text>
        <ul style={{ marginTop: 8, marginBottom: 8, paddingLeft: 20 }}>
          {blockModalPOs?.map((po) => (
            <li key={po.po_id ?? po.po_no}>
              {po.po_id ? (
                <a onClick={() => { setBlockModalPOs(null); navigate(`/po/approval/${po.po_id}`) }}>
                  {po.po_no}
                </a>
              ) : (
                po.po_no
              )}
            </li>
          ))}
        </ul>
        <Text>กรุณายกเลิก PO ดังกล่าวก่อน จึงจะสามารถแก้ไข PR นี้ได้</Text>
      </Modal>

      {printData && (
        <PRPrint
          data={printData}
          onReady={() => {
            window.print()
            setPrintData(null)
          }}
        />
      )}
    </div>
  )
}

export default PRDetailPage
