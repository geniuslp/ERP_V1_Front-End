import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Spin, Descriptions, Tag, Modal, message } from 'antd'
import { EditOutlined, DeleteOutlined, PlusOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import ICMovementAddLineModal from '@/pages/ic/components/ICMovementAddLineModal'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

interface MovementHeader {
  doc_no?: string
  project_name?: string
  job_code?: string
  doc_type?: 'ISSUE' | 'TRANSFER'
  status?: 'DRAFT' | 'POSTED'
}

interface MovementLine {
  key: string
  mat_code: string
  item_name: string
  spec_name?: string
  cost_code: string
  qty: number
  unit: string
  to_project_name?: string
  to_cost_code?: string
  remark?: string
}

const mapLine = (l: any, index: number): MovementLine => ({
  key: String(l.line_id ?? l.id ?? index),
  mat_code: l.mat_code,
  item_name: l.item_name ?? l.mat_name ?? '',
  spec_name: l.spec_name,
  cost_code: l.cost_code,
  qty: Number(l.qty ?? 0),
  unit: l.unit,
  to_project_name: l.to_project_name,
  to_cost_code: l.to_cost_code,
  remark: l.remarks ?? l.remark,
})

const docTypeLabel = (type?: string) => {
  if (type === 'ISSUE') return 'ตัดเบิก'
  if (type === 'TRANSFER') return 'โอน'
  return '-'
}

const ICProjectMovementDetailPage: React.FC = () => {
  const { projectCode, movementId } = useParams<{ projectCode: string; movementId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [loading, setLoading] = useState(true)
  const [header, setHeader] = useState<MovementHeader | null>(null)
  const [lines, setLines] = useState<MovementLine[]>([])
  const [linesLoading, setLinesLoading] = useState(false)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isPosted = header?.status === 'POSTED'

  // GET /ic/projects/:projectCode/movements/:movementId — endpoint not confirmed to
  // exist yet on the backend. TODO: verify with backend; until then, fall back to
  // whatever was passed via navigation state so the page still renders.
  const fetchHeader = async () => {
    if (!projectCode || !movementId) return
    try {
      const res = await axios.get(`${BASE_URL}/ic/projects/${projectCode}/movements/${movementId}`, {
        headers: authHeader,
      })
      const data = res.data?.data ?? res.data
      setHeader(data)
    } catch {
      // TODO: endpoint may not exist yet — fall back to state passed from the create page.
      const stateDocNo = (location.state as any)?.doc_no
      setHeader(stateDocNo ? { doc_no: stateDocNo } : {})
    }
  }

  useEffect(() => {
    if (!projectCode || !movementId) {
      navigate('/ic/projects', { replace: true })
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      await fetchHeader()
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, movementId])

  const fetchLines = async () => {
    if (!projectCode || !movementId) return
    setLinesLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/ic/projects/${projectCode}/movements/${movementId}/lines`, {
        headers: authHeader,
      })
      const raw = res.data?.data ?? res.data
      const list = Array.isArray(raw) ? raw : raw?.data ?? []
      setLines((Array.isArray(list) ? list : []).map(mapLine))
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'โหลดรายการวัสดุไม่สำเร็จ')
    } finally {
      setLinesLoading(false)
    }
  }

  useEffect(() => {
    fetchLines()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, movementId])

  const handlePreview = () => {
    message.info('Preview - coming soon')
  }

  const handleAddItem = () => {
    if (isPosted) return
    setItemModalOpen(true)
  }

  const handleAddLineSuccess = () => {
    setItemModalOpen(false)
    fetchLines()
  }

  const handleEditLine = (_line: MovementLine) => {
    if (isPosted) return
    setItemModalOpen(true)
  }

  const handleDeleteLine = (key: string) => {
    if (isPosted) return
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  const submitMovement = async () => {
    if (!projectCode || !movementId) return
    setSubmitting(true)
    try {
      await axios.post(`${BASE_URL}/ic/projects/${projectCode}/movements/${movementId}/submit`, {}, {
        headers: authHeader,
      })
      message.success('บันทึกเอกสารสำเร็จ')
      await fetchHeader()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'บันทึกเอกสารไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = () => {
    Modal.confirm({
      title: 'ยืนยันการบันทึก?',
      content: 'หลังจากนี้จะไม่สามารถเพิ่มรายการเพิ่มเติมได้ และจะหักยอดคงเหลือทันที',
      okText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      onOk: submitMovement,
    })
  }

  const columns = [
    {
      title: 'Action',
      key: 'action',
      width: 90,
      render: (_: unknown, record: MovementLine) => (
        <Space>
          <EditOutlined
            style={{ color: isPosted ? '#d1d5db' : '#2563eb', cursor: isPosted ? 'not-allowed' : 'pointer' }}
            onClick={() => handleEditLine(record)}
          />
          <DeleteOutlined
            style={{ color: isPosted ? '#d1d5db' : '#dc2626', cursor: isPosted ? 'not-allowed' : 'pointer' }}
            onClick={() => handleDeleteLine(record.key)}
          />
        </Space>
      ),
    },
    {
      title: 'No',
      key: 'no',
      width: 60,
      render: (_: unknown, __: MovementLine, index: number) => index + 1,
    },
    {
      title: 'MatCode',
      dataIndex: 'mat_code',
      key: 'mat_code',
    },
    {
      title: 'MateName',
      key: 'mate_name',
      render: (_: unknown, record: MovementLine) =>
        [record.item_name, record.spec_name].filter(Boolean).join(' '),
    },
    {
      title: 'CostCode',
      dataIndex: 'cost_code',
      key: 'cost_code',
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
    },
    {
      title: 'ToProject',
      dataIndex: 'to_project_name',
      key: 'to_project_name',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: 'ToCostCode',
      dataIndex: 'to_cost_code',
      key: 'to_cost_code',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      render: (value: string | undefined) => value || '-',
    },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={header?.doc_no ? `เอกสารตัดเบิก/โอน ${header.doc_no}` : 'เอกสารตัดเบิก/โอน'}
        subtitle={header?.project_name}
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'โครงการ' },
          { title: header?.project_name || projectCode || '' },
          { title: 'ตัดเบิก/โอน' },
        ]}
      />

      <Card style={cardStyle}>
        <Descriptions column={3} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="เลขที่เอกสาร">{header?.doc_no || '-'}</Descriptions.Item>
          <Descriptions.Item label="โครงการ">{header?.project_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="ประเภท Job">{header?.job_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="ประเภทเอกสาร">{docTypeLabel(header?.doc_type)}</Descriptions.Item>
          <Descriptions.Item label="สถานะ">
            {isPosted ? <Tag color="green">บันทึกแล้ว</Tag> : <Tag>ร่าง</Tag>}
          </Descriptions.Item>
        </Descriptions>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
          <Button icon={<EyeOutlined />} onClick={handlePreview}>
            Preview
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddItem} disabled={isPosted}>
            เพิ่มรายการ
          </Button>
        </div>

        <Table
          rowKey="key"
          columns={columns}
          dataSource={lines}
          loading={linesLoading}
          pagination={false}
          locale={{ emptyText: 'ยังไม่มีรายการ' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={submitting}
            disabled={isPosted}
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
            onClick={handleSubmit}
          >
            Submit
          </Button>
        </div>
      </Card>

      {projectCode && movementId && (
        <ICMovementAddLineModal
          open={itemModalOpen}
          projectCode={projectCode}
          movementId={movementId}
          jobCode={header?.job_code}
          onClose={() => setItemModalOpen(false)}
          onSuccess={handleAddLineSuccess}
        />
      )}
    </div>
  )
}

export default ICProjectMovementDetailPage
