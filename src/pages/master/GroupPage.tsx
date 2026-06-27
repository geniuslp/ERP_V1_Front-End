import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, Tag, Divider, message, Popconfirm, Upload, Typography } from 'antd'
import type { UploadProps } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, InboxOutlined, CheckOutlined, WarningOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import axios from 'axios'
import type { Group } from '@/types'
import { useAppSelector } from '@/store'
import * as XLSX from 'xlsx'

const { Text } = Typography

type GroupRecord = Group & { key: string }

interface ParsedRow {
  row: number
  group_code: string
  group_name: string
  is_active: string
  valid: boolean
  error: string
}

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const TEMPLATE_HEADERS = ['group_code', 'group_name', 'is_active']

const downloadTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ['GRP001', 'วัตถุดิบเหล็ก', 'true'],
    ['GRP002', 'สินค้าอุปโภค', 'true'],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Groups')
  XLSX.writeFile(wb, 'group_template.xlsx')
}

const toBool = (v: string) =>
  v === '' || v === '1' || v.toLowerCase() === 'true' || v === 'ใช้งาน'

const GroupPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<GroupRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GroupRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [form] = Form.useForm()

  // upload state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [uploadFileName, setUploadFileName] = useState('')
  const [importSubmitting, setImportSubmitting] = useState(false)

  const fetchGroups = async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/groups`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const list: Group[] = res.data?.data ?? []
      setData(list.map((g: any) => ({ ...g, key: g.group_code })))
    } catch {
      message.error('โหลดข้อมูลกลุ่มไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGroups() }, [accessToken])

  useEffect(() => {
    if (open && editing) {
      form.setFieldsValue(editing)
    } else if (open && !editing) {
      form.resetFields()
    }
  }, [open, editing])

  const openCreate = () => { setEditing(null); setOpen(true) }
  const openEdit = (r: GroupRecord) => { setEditing(r); setOpen(true) }

  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const handleDelete = async (key: string) => {
    setDeletingKey(key)
    try {
      await axios.delete(`${BASE_URL}/groups/${key}`, { headers: authHeader })
      message.success('ลบกลุ่มเรียบร้อย')
      await fetchGroups()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'ลบกลุ่มไม่สำเร็จ กรุณาลองใหม่'
      message.error(msg)
    } finally {
      setDeletingKey(null)
    }
  }

  const handleOk = () => {
    form.validateFields().then(async (values) => {
      setSaving(true)
      try {
        if (editing) {
          await axios.put(`${BASE_URL}/groups/${editing.key}`, values, { headers: authHeader })
          message.success('แก้ไขกลุ่มเรียบร้อย')
        } else {
          await axios.post(`${BASE_URL}/groups`, values, { headers: authHeader })
          message.success('เพิ่มกลุ่มเรียบร้อย')
        }
        setOpen(false)
        await fetchGroups()
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่'
        message.error(msg)
      } finally {
        setSaving(false)
      }
    })
  }

  const handleUpload: UploadProps['beforeUpload'] = (file) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      message.error('รองรับเฉพาะไฟล์ .xlsx, .xls, .csv เท่านั้น')
      return false
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const bytes = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(bytes, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (!raw.length) { message.warning('ไม่พบข้อมูลในไฟล์'); return }
        const rows: ParsedRow[] = raw.map((r, i) => {
          const group_code = String(r.group_code ?? '').trim()
          const group_name = String(r.group_name ?? '').trim()
          const is_active = String(r.is_active ?? '').trim()
          const errs: string[] = []
          if (!group_code) errs.push('group_code: required')
          if (!group_name) errs.push('group_name: required')
          return { row: i + 2, group_code, group_name, is_active, valid: errs.length === 0, error: errs.join(' / ') }
        })
        setParsedRows(rows)
        setUploadFileName(file.name)
      } catch {
        message.error('ไม่สามารถอ่านไฟล์ได้')
      }
    }
    reader.readAsArrayBuffer(file)
    return false
  }

  const handleConfirmImport = async () => {
    const valid = parsedRows.filter((r) => r.valid)
    if (!valid.length) { message.warning('ไม่มีรายการที่ถูกต้องสำหรับนำเข้า'); return }
    setImportSubmitting(true)
    try {
      const items = valid.map((r) => ({
        group_code: r.group_code,
        group_name: r.group_name,
        is_active: toBool(r.is_active),
      }))
      const res = await axios.post(`${BASE_URL}/groups/bulk`, items, { headers: authHeader })
      setParsedRows([])
      setUploadFileName('')
      message.success(`นำเข้าสำเร็จ ${res.data?.count ?? valid.length} รายการ`)
      await fetchGroups()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'นำเข้าไม่สำเร็จ')
    } finally {
      setImportSubmitting(false)
    }
  }

  const columns = [
    { title: 'รหัสกลุ่ม', dataIndex: 'group_code', width: 150 },
    { title: 'ชื่อกลุ่ม', dataIndex: 'group_name' },
    {
      title: 'สถานะ', dataIndex: 'is_active', width: 110,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'ใช้งาน' : 'ปิดใช้งาน'}</Tag>,
    },
    {
      title: 'จัดการ', key: 'action', width: 160,
      render: (_: unknown, r: GroupRecord) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>แก้ไข</Button>
          <Popconfirm
            title="ยืนยันการลบ"
            description={`ต้องการลบกลุ่ม "${r.group_name}" ใช่หรือไม่?`}
            onConfirm={() => handleDelete(r.key)}
            okText="ลบ"
            okButtonProps={{ danger: true }}
            cancelText="ยกเลิก"
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={deletingKey === r.key}>ลบ</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const uploadColumns = [
    {
      title: '#', key: 'no', width: 48, align: 'center' as const,
      render: (_: unknown, r: ParsedRow) => (
        <Text style={{ fontSize: 11, color: r.valid ? '#6b7280' : '#ef4444' }}>{r.row}</Text>
      ),
    },
    { title: 'รหัสกลุ่ม', dataIndex: 'group_code', width: 150 },
    { title: 'ชื่อกลุ่ม', dataIndex: 'group_name' },
    { title: 'ใช้งาน', dataIndex: 'is_active', width: 100 },
    {
      title: 'สถานะ', key: 'status', width: 240,
      render: (_: unknown, r: ParsedRow) => r.valid
        ? <Tag color="success" style={{ fontSize: 11 }}><CheckOutlined /> ถูกต้อง</Tag>
        : <Tag color="error" icon={<WarningOutlined />} style={{ fontSize: 11, whiteSpace: 'normal', height: 'auto', lineHeight: '1.4' }}>{r.error}</Tag>,
    },
  ]

  const validCount = parsedRows.filter((r) => r.valid).length
  const errorCount = parsedRows.filter((r) => !r.valid).length

  return (
    <div>
      <PageHeader
        title="จัดการกลุ่ม"
        subtitle="เพิ่ม ลบ แก้ไขรหัสกลุ่ม"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'กลุ่ม' }]}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>เพิ่มกลุ่ม</Button>}
      />

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Table
          dataSource={data} columns={columns} size="small"
          pagination={{ pageSize: 10 }} rowKey="key" loading={loading}
        />
      </Card>

      {/* Upload panel */}
      <Card
        style={{ marginTop: 20, borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}
        title={<span style={{ fontWeight: 600 }}>อัปโหลดไฟล์เพื่อนำเข้าข้อมูล</span>}
        extra={
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
            ดาวน์โหลด Template (.xlsx)
          </Button>
        }
      >
        <Upload.Dragger
          name="file"
          accept=".xlsx,.xls,.csv"
          showUploadList={false}
          beforeUpload={handleUpload}
          style={{
            borderRadius: 10,
            borderColor: parsedRows.length ? '#3b82f6' : '#d1d5db',
            background: parsedRows.length ? '#eff6ff' : undefined,
          }}
        >
          <div style={{ padding: parsedRows.length ? '8px 0' : '14px 0' }}>
            <p style={{ fontSize: parsedRows.length ? 24 : 36, color: parsedRows.length ? '#3b82f6' : '#9ca3af', margin: 0 }}>
              <InboxOutlined />
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: parsedRows.length ? '#1d4ed8' : '#374151', margin: '6px 0 2px' }}>
              {parsedRows.length ? `${uploadFileName} — คลิกเพื่อเลือกไฟล์ใหม่` : 'คลิกหรือลากไฟล์มาวางที่นี่'}
            </p>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
              รองรับไฟล์ <Text code>.xlsx</Text> <Text code>.xls</Text> <Text code>.csv</Text>
            </p>
          </div>
        </Upload.Dragger>

        {parsedRows.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '16px 0 10px' }}>
              <Text strong style={{ fontSize: 13 }}>ตรวจสอบข้อมูล</Text>
              <Tag color="blue" style={{ fontSize: 11 }}>{uploadFileName}</Tag>
              <Tag color="success" style={{ fontSize: 11 }}>
                <CheckOutlined /> ถูกต้อง {validCount} รายการ
              </Tag>
              {errorCount > 0 && (
                <Tag color="error" style={{ fontSize: 11 }}>
                  <WarningOutlined /> มีข้อผิดพลาด {errorCount} รายการ
                </Tag>
              )}
            </div>

            <Table
              size="small"
              dataSource={parsedRows.map((r, i) => ({ ...r, key: i }))}
              columns={uploadColumns}
              pagination={parsedRows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
              rowClassName={(r: ParsedRow) => (r.valid ? '' : 'import-row-error')}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button onClick={() => { setParsedRows([]); setUploadFileName('') }}>ล้างข้อมูล</Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={importSubmitting}
                disabled={validCount === 0}
                onClick={handleConfirmImport}
                style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', border: 'none' }}
              >
                ยืนยันนำเข้า ({validCount} รายการ)
              </Button>
            </div>
          </>
        )}
      </Card>

      <Modal
        title={editing ? 'แก้ไขกลุ่ม' : 'เพิ่มกลุ่ม'}
        open={open}
        onOk={handleOk}
        onCancel={() => setOpen(false)}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={saving}
        width={420}
      >
        <Divider style={{ margin: '12px 0' }} />
        <Form form={form} layout="vertical">
          <Form.Item label="รหัสกลุ่ม" name="group_code" rules={[{ required: true, message: 'กรุณากรอกรหัสกลุ่ม' }]}>
            <Input placeholder="เช่น GRP001" maxLength={20} disabled={!!editing} />
          </Form.Item>
          <Form.Item label="ชื่อกลุ่ม" name="group_name" rules={[{ required: true, message: 'กรุณากรอกชื่อกลุ่ม' }]}>
            <Input placeholder="เช่น วัตถุดิบ" maxLength={100} />
          </Form.Item>
          <Form.Item label="สถานะ" name="is_active" initialValue={true} rules={[{ required: true }]}>
            <Select options={[{ value: true, label: 'ใช้งาน' }, { value: false, label: 'ปิดใช้งาน' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default GroupPage
