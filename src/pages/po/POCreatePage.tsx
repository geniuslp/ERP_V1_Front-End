import React, { useState, useRef } from 'react'
import {
  Card, Form, Select, DatePicker, Button, Space, message, Row, Col, Input, Table,
} from 'antd'
import {
  SaveOutlined, SendOutlined, UploadOutlined, CloseCircleFilled, FileOutlined,
  PrinterOutlined, ArrowLeftOutlined, EditOutlined, CloseOutlined, StopOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'

interface AttachedFile {
  uid: string
  name: string
  size: number
  file: File
}

const POCreatePage: React.FC = () => {
  const [form] = Form.useForm()
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const poNumber = '6906-012'
  const poLatest = '6906-011'

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const newFiles: AttachedFile[] = Array.from(files).map((f) => ({
      uid: `${Date.now()}-${Math.random()}`,
      name: f.name,
      size: f.size,
      file: f,
    }))
    setAttachedFiles((prev) => [...prev, ...newFiles])
  }

  const removeFile = (uid: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.uid !== uid))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 12,
    border: 'none',
    boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  }

  const cardTitleStyle: React.CSSProperties = {
    color: '#1e3a8a',
    fontWeight: 600,
  }

  const labelStyle: React.CSSProperties = {
    color: '#374151',
    fontSize: 13,
  }

  const tableColumns = [
    { title: 'No.', dataIndex: 'no', key: 'no', width: 60, align: 'center' as const },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'รายการ', dataIndex: 'name', key: 'name' ,align:'center'},
    { title: 'จำนวนสั่ง (PR)', dataIndex: 'qtyPR', key: 'qtyPR', width: 120, align: 'right' as const },
    { title: 'จำนวนซื้อ (Stock)', dataIndex: 'qtyStock', key: 'qtyStock', width: 140, align: 'right' as const },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 80, align: 'center' as const },
  ]

  return (
    <div>
      <PageHeader
        title="ออกใบสั่งซื้อ (PO)"
        subtitle="สร้างใบสั่งซื้อสินค้า/บริการเพื่อส่งอนุมัติ"
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'ใบสั่งซื้อ' },
          { title: 'สร้างใบสั่งซื้อ' },
        ]}
      />

      <Row gutter={[16, 16]}>

        {/* ── Main Info Card ── */}
        <Col span={24}>
          <Card
            title={<span style={cardTitleStyle}>ข้อมูลใบสั่งซื้อ</span>}
            style={cardStyle}
          >
            <Form form={form} layout="vertical">
              <Row gutter={16}>

                {/* PO Number */}
                <Col xs={24} md={6}>
                  <Form.Item
                    label={
                      <span style={{ ...labelStyle, color: '#cc0000', fontWeight: 600 }}>
                        หมายเลข PO
                      </span>
                    }
                    name="poNumber"
                    initialValue={poNumber}
                  >
                    <Input
                      style={{ color: '#cc0000', fontWeight: 600 }}
                      prefix={
                        <span style={{ fontSize: 11, color: '#6b7280', marginRight: 4 }}>
                          ล่าสุด: <span style={{ color: '#cc0000' }}>{poLatest}</span>
                        </span>
                      }
                    />
                  </Form.Item>
                </Col>

                {/* Status */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>สถานะ</span>} name="status">
                    <Input defaultValue="open" disabled />
                  </Form.Item>
                </Col>

                {/* Date */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>วันที่</span>} name="date">
                    <Input
                      defaultValue={new Date().toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                      disabled
                    />
                  </Form.Item>
                </Col>

                {/* ชื่อย่อบริษัท */}
                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={labelStyle}>ชื่อย่อบริษัท</span>}
                    name="vendorCode"
                  >
                    <Input.Search enterButton />
                  </Form.Item>
                </Col>

                {/* ชื่อบริษัท */}
                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span style={labelStyle}>ชื่อบริษัท</span>}
                    name="vendorName"
                  >
                    <Input disabled />
                  </Form.Item>
                </Col>

                {/* เบอร์โทร */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>เบอร์โทร</span>} name="phone">
                    <Input />
                  </Form.Item>
                </Col>

                {/* Fax */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>Fax</span>} name="fax">
                    <Input />
                  </Form.Item>
                </Col>

                {/* พนักงานขาย */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>พนักงานขาย</span>} name="salesperson">
                    <Input />
                  </Form.Item>
                </Col>

                {/* อีเมลล์ */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>อีเมลล์</span>} name="email">
                    <Input />
                  </Form.Item>
                </Col>

                {/* เบอร์ติดต่อ */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>เบอร์ติดต่อ</span>} name="contactPhone">
                    <Input />
                  </Form.Item>
                </Col>

                {/* เงื่อนไขชำระเงิน */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>เงื่อนไขชำระเงิน</span>} name="paymentTerm">
                    <Input />
                  </Form.Item>
                </Col>

                {/* ผู้ขอซื้อ */}
                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={labelStyle}>ผู้ขอซื้อ</span>}
                    name="requestedBy"
                    rules={[{ required: true, message: 'กรุณาเลือกผู้ขอซื้อ' }]}
                  >
                    <Select
                      placeholder="- เลือกรายการ -"
                      options={[
                        { value: 'u1', label: 'นายสมชาย ใจดี' },
                        { value: 'u2', label: 'นางสาวสมหญิง รักดี' },
                      ]}
                    />
                  </Form.Item>
                </Col>

                {/* สถานที่ส่งของ */}
                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={labelStyle}>สถานที่ส่งของ</span>}
                    name="deliveryLocation"
                    rules={[{ required: true, message: 'กรุณาเลือกสถานที่ส่งของ' }]}
                  >
                    <Select
                      placeholder="- เลือกรายการ -"
                      options={[
                        { value: 'wh1', label: 'คลังสินค้า A' },
                        { value: 'hq', label: 'สำนักงานใหญ่' },
                      ]}
                    />
                  </Form.Item>
                </Col>

                {/* ผู้อนุมัติ */}
                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={labelStyle}>ผู้อนุมัติ</span>}
                    name="approver"
                    rules={[{ required: true, message: 'กรุณาเลือกผู้อนุมัติ' }]}
                  >
                    <Select
                      placeholder="- เลือกรายการ -"
                      options={[
                        { value: 'a1', label: 'ผู้จัดการฝ่าย' },
                        { value: 'a2', label: 'ผู้อำนวยการ' },
                      ]}
                    />
                  </Form.Item>
                </Col>

                {/* วันที่อนุมัติ */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>วันที่อนุมัติ</span>} name="approvedDate">
                    <Input disabled />
                  </Form.Item>
                </Col>

                {/* กำหนดส่งของ */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>กำหนดส่งของ</span>} name="deliveryDate">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                {/* Ref */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>Ref</span>} name="ref">
                    <Input />
                  </Form.Item>
                </Col>

                {/* PR Order */}
                <Col xs={24} md={6}>
                  <Form.Item label={<span style={labelStyle}>PR Order</span>} name="prOrder">
                    <Select
                      placeholder="- เลือก PR Order -"
                      options={[
                        { value: 'PR-2025-001', label: 'PR-2025-001 — วัสดุก่อสร้าง' },
                        { value: 'PR-2025-002', label: 'PR-2025-002 — อุปกรณ์สำนักงาน' },
                        { value: 'PR-2025-003', label: 'PR-2025-003 — อะไหล่เครื่องจักร' },
                        { value: 'PR-2025-004', label: 'PR-2025-004 — วัตถุดิบการผลิต' },
                        { value: 'PR-2025-005', label: 'PR-2025-005 — เคมีภัณฑ์' },
                      ]}
                    />
                  </Form.Item>
                </Col>

              </Row>
            </Form>
          </Card>
        </Col>

        {/* ── Items Table Card ── */}
        <Col span={24}>
          <Card
            title={<span style={cardTitleStyle}>เลือกรายการ วัสดุและบริการ</span>}
            style={cardStyle}
          >
            <Table
              columns={tableColumns}
              dataSource={[]}
              pagination={false}
              locale={{ emptyText: 'ยังไม่มีรายการ' }}
              size="small"
            />
          </Card>
        </Col>

        {/* ── Note Card ── */}
        <Col span={24}>
          <Card style={cardStyle}>
            <Form.Item
              label={
                <span style={{ color: '#cc0000', fontWeight: 600, fontSize: 13 }}>
                  หมายเหตุ
                </span>
              }
            >
              <Input.TextArea rows={3} />
            </Form.Item>
          </Card>
        </Col>

        {/* ── File Attachment Card ── */}
        <Col span={24}>
          <Card
            title={<span style={cardTitleStyle}>แนบไฟล์</span>}
            style={cardStyle}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              style={{ display: 'none' }}
              onChange={(e) => addFiles(e.target.files)}
              onClick={(e) => { ;(e.target as HTMLInputElement).value = '' }}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: `1.5px dashed ${isDragging ? '#2563eb' : '#bfdbfe'}`,
                borderRadius: 10,
                padding: '20px 24px',
                cursor: 'pointer',
                background: isDragging ? '#eff6ff' : '#f8faff',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <UploadOutlined style={{ fontSize: 22, color: '#2563eb' }} />
              <div>
                <div style={{ fontSize: 14, color: '#1e40af', fontWeight: 500 }}>
                  คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  รองรับไฟล์ JPG, PDF, DOC, XLS — สามารถเลือกได้หลายไฟล์พร้อมกัน
                </div>
              </div>
            </div>

            {attachedFiles.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {attachedFiles.map((f) => (
                  <div
                    key={f.uid}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#eff6ff',
                      border: '0.5px solid #bfdbfe',
                      borderRadius: 8,
                      padding: '5px 10px',
                      fontSize: 13,
                      color: '#1e40af',
                      maxWidth: 280,
                    }}
                  >
                    <FileOutlined style={{ fontSize: 14, flexShrink: 0 }} />
                    <span
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}
                      title={f.name}
                    >
                      {f.name}
                    </span>
                    <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>
                      ({formatSize(f.size)})
                    </span>
                    <CloseCircleFilled
                      onClick={(e) => { e.stopPropagation(); removeFile(f.uid) }}
                      style={{ fontSize: 14, color: '#93c5fd', cursor: 'pointer', flexShrink: 0, transition: 'color 0.15s' }}
                      onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#2563eb')}
                      onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#93c5fd')}
                    />
                  </div>
                ))}
              </div>
            )}

            {attachedFiles.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                {attachedFiles.length} ไฟล์ที่แนบ
              </div>
            )}
          </Card>
        </Col>

        {/* ── Action Bar Card ── */}
        <Col span={24}>
          <Card
            style={{
              ...cardStyle,
              position: 'sticky',
              bottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

              {/* Left: พิมพ์ + กลับ */}
              <Space>
                <Button icon={<PrinterOutlined />}>พิมพ์</Button>
                <Button icon={<ArrowLeftOutlined />}>กลับหน้าหลัก</Button>
              </Space>

              {/* Right: action buttons */}
              <Space>
                <Button icon={<EditOutlined />}>Update</Button>
                <Button
                  icon={<CloseOutlined />}
                  style={{ borderColor: '#ef4444', color: '#ef4444' }}
                >
                  Cancel
                </Button>
                <Button
                  icon={<StopOutlined />}
                  style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
                >
                  Reject
                </Button>
                <Button icon={<SaveOutlined />}>บันทึกร่าง</Button>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => message.success('ส่งใบสั่งซื้อเรียบร้อยแล้ว')}
                >
                  ส่งใบสั่งซื้อ
                </Button>
              </Space>

            </div>
          </Card>
        </Col>

      </Row>
    </div>
  )
}

export default POCreatePage
