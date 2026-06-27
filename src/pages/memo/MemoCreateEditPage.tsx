import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card, Form, Input, Row, Col, Button, Table, InputNumber, Space, message, Alert, Select,
} from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined, SendOutlined, CloseOutlined } from '@ant-design/icons'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import { ROUTES } from '@/config/routes'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const LOCKED_STATUSES = ['APPROVED', 'REJECTED', 'CANCELLED']

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

interface EditableItem {
  key: string
  description: string
  unit: string
  quantity: number
  estimatedPrice: number
  remark?: string
}

const emptyItem = (): EditableItem => ({
  key: `item-${Date.now()}-${Math.random()}`,
  description: '',
  unit: '',
  quantity: 1,
  estimatedPrice: 0,
  remark: '',
})

const MemoCreateEditPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [items, setItems] = useState<EditableItem[]>([emptyItem()])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [canEdit, setCanEdit] = useState(true)
  const [memoStatus, setMemoStatus] = useState('')
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)

  useEffect(() => {
    const fetchProjects = async () => {
      setProjectsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/master/projects`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setProjects(list.map((p: any) => ({
          value: p.project_code,
          label: p.project_code
            ? `${p.project_code} — ${p.project_name ?? p.name ?? ''}`
            : (p.project_name ?? p.name ?? String(p.id)),
        })))
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'Failed to load projects')
      } finally {
        setProjectsLoading(false)
      }
    }
    fetchProjects()
  }, [])

  useEffect(() => {
    if (!isEdit) return
    const fetchMemo = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/memo/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const memo = res.data?.data ?? res.data

        const status = memo.status ?? ''
        setMemoStatus(status)
        setCanEdit(!LOCKED_STATUSES.includes(status.toUpperCase()))

        form.setFieldsValue({
          title:        memo.title,
          project_code: memo.project_code ?? memo.projectCode,
          department:   memo.department,
          note:         memo.note,
        })

        const lines = memo.lines ?? memo.items ?? []
        setItems(
          lines.map((it: any) => ({
            key:            String(it.id ?? `${Date.now()}-${Math.random()}`),
            description:    it.description       ?? '',
            unit:           it.unit              ?? '',
            quantity:       it.quantity          ?? 1,
            estimatedPrice: it.estimated_price   ?? it.estimatedPrice ?? 0,
            remark:         it.remark            ?? '',
          }))
        )
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
    fetchMemo()
  }, [id])

  const updateItem = (key: string, field: keyof EditableItem, value: any) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)))
  }

  const addItem = () => setItems((prev) => [...prev, emptyItem()])
  const removeItem = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key))

  const totalAmount = items.reduce((sum, it) => sum + (it.quantity || 0) * (it.estimatedPrice || 0), 0)

  const validateItems = () => {
    const invalid = items.some((it) => !it.description.trim() || !it.unit.trim())
    if (invalid) {
      message.warning('กรุณากรอกรายการและหน่วยให้ครบทุกแถว')
      return false
    }
    return true
  }

  const handleSave = async (status?: 'DRAFT' | 'PENDING_APPROVAL') => {
    if (isEdit && !canEdit) {
      message.warning('ไม่สามารถแก้ไขใบบันทึกนี้ได้')
      return
    }

    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    if (!validateItems()) return

    const payload: any = {
      title:        values.title,
      project_code: values.project_code ?? undefined,
      department:   values.department   ?? undefined,
      note:         values.note         ?? undefined,
      lines: items.map((item, i) => ({
        line_no:         i + 1,
        description:     item.description,
        unit:            item.unit,
        quantity:        item.quantity,
        estimated_price: item.estimatedPrice,
        remark:          item.remark || undefined,
      })),
    }

    if (!isEdit && status) {
      payload.status = status
    }

    setSubmitting(true)
    try {
      let res
      if (isEdit) {
        res = await axios.put(`${BASE_URL}/memo/${id}`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('แก้ไขใบบันทึกสำเร็จ')
      } else {
        res = await axios.post(`${BASE_URL}/memo`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success(status === 'DRAFT' ? 'บันทึกร่างสำเร็จ' : 'สร้างใบบันทึกสำเร็จ')
      }
      const memoId = res.data?.data?.id ?? res.data?.id ?? id
      navigate(ROUTES.MEMO.DETAIL.replace(':id', String(memoId)))
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'บันทึกไม่สำเร็จ'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    { title: '#', key: 'no', width: 40, render: (_: any, __: any, idx: number) => idx + 1 },
    {
      title: 'รายการ/รายละเอียด *',
      key: 'description',
      render: (_: any, record: EditableItem) => (
        <Input
          value={record.description}
          status={!record.description.trim() ? 'error' : undefined}
          onChange={(e) => updateItem(record.key, 'description', e.target.value)}
        />
      ),
    },
    {
      title: 'หน่วย *',
      key: 'unit',
      width: 100,
      render: (_: any, record: EditableItem) => (
        <Input
          value={record.unit}
          status={!record.unit.trim() ? 'error' : undefined}
          onChange={(e) => updateItem(record.key, 'unit', e.target.value)}
        />
      ),
    },
    {
      title: 'จำนวน *',
      key: 'quantity',
      width: 110,
      render: (_: any, record: EditableItem) => (
        <InputNumber
          min={0.01}
          style={{ width: '100%' }}
          value={record.quantity}
          onChange={(val) => updateItem(record.key, 'quantity', val ?? 0)}
        />
      ),
    },
    {
      title: 'ราคาประมาณ/หน่วย',
      key: 'estimatedPrice',
      width: 130,
      render: (_: any, record: EditableItem) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={record.estimatedPrice}
          onChange={(val) => updateItem(record.key, 'estimatedPrice', val ?? 0)}
        />
      ),
    },
    {
      title: 'รวม',
      key: 'total',
      width: 110,
      align: 'right' as const,
      render: (_: any, record: EditableItem) =>
        ((record.quantity || 0) * (record.estimatedPrice || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    },
    {
      title: 'หมายเหตุ',
      key: 'remark',
      render: (_: any, record: EditableItem) => (
        <Input
          placeholder="(optional)"
          value={record.remark}
          onChange={(e) => updateItem(record.key, 'remark', e.target.value)}
        />
      ),
    },
    {
      title: 'ลบ',
      key: 'delete',
      width: 60,
      render: (_: any, record: EditableItem) => (
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          disabled={items.length === 1}
          onClick={() => removeItem(record.key)}
        />
      ),
    },
  ]

  const lockedMessage = memoStatus === 'APPROVED'
    ? 'ใบบันทึกนี้อนุมัติแล้ว — ไม่สามารถแก้ไขได้'
    : memoStatus === 'REJECTED'
    ? 'ใบบันทึกนี้ถูกปฏิเสธแล้ว — ไม่สามารถแก้ไขได้'
    : 'ใบบันทึกนี้ถูกยกเลิกแล้ว — ไม่สามารถแก้ไขได้'

  return (
    <div>
      <PageHeader
        title={isEdit ? 'แก้ไขใบบันทึก' : 'สร้างใบบันทึก'}
        subtitle="บันทึกความต้องการจัดซื้อ"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ใบบันทึก' }, { title: isEdit ? 'แก้ไข' : 'สร้าง' }]}
        extra={null}
      />

      {isEdit && !canEdit && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message={lockedMessage}
        />
      )}

      <Form form={form} layout="vertical" disabled={isEdit && !canEdit}>
        <Card
          title={<span style={cardTitleStyle}>ข้อมูลทั่วไป</span>}
          style={{ ...cardStyle, marginBottom: 16 }}
          loading={loading}
        >
          <Row gutter={16}>
            <Col md={12} xs={24}>
              <Form.Item label="หัวข้อ / เรื่อง" name="title" rules={[{ required: true, message: 'กรุณากรอกหัวข้อ' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="โครงการ" name="project_code">
                <Select
                  placeholder="— เลือกโครงการ —"
                  loading={projectsLoading}
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={projects}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item label="หน่วยงาน" name="department">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="หมายเหตุ" name="note">
                <Input.TextArea rows={3} maxLength={1000} showCount />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card
          title={<span style={cardTitleStyle}>รายการวัสดุ/บริการ</span>}
          extra={
            !isEdit || canEdit ? (
              <Button type="dashed" icon={<PlusOutlined />} onClick={addItem}>
                เพิ่มรายการ
              </Button>
            ) : null
          }
          style={cardStyle}
        >
          <Table
            rowKey="key"
            columns={columns}
            dataSource={items}
            pagination={false}
            scroll={{ x: 900 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5}>
                    <strong>มูลค่าประมาณรวม</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} colSpan={2} align="right">
                    <strong>{totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      </Form>

      {/* Bottom action bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 24,
        padding: '16px 24px',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
        border: 'none',
      }}>
        <Button icon={<CloseOutlined />} onClick={() => navigate(ROUTES.MEMO.LIST)}>
          ยกเลิก
        </Button>
        {isEdit ? (
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            disabled={!canEdit}
            onClick={() => handleSave()}
            style={{
              background: canEdit ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : undefined,
              border: 'none',
            }}
          >
            บันทึก
          </Button>
        ) : (
          <>
            <Button icon={<SaveOutlined />} loading={submitting} onClick={() => handleSave('DRAFT')}>
              บันทึกร่าง
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={submitting}
              onClick={() => handleSave('PENDING_APPROVAL')}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}
            >
              ส่งให้ PR ดำเนินการ
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default MemoCreateEditPage
