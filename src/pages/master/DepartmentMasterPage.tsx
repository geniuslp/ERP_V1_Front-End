import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Card, Form, Input, InputNumber, Modal, Popconfirm, Space, Switch, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import ConfirmDeleteButton from '@/components/common/ConfirmDeleteButton'
import { useAppSelector } from '@/store'
import {
  departmentService, departmentErrorMessage, type Department, type DepartmentPayload,
} from '@/services/departmentService'

const MENU_CODE = 'MENU_ADMIN_DEPARTMENTS'

interface FormValues {
  dept_code: string
  dept_name: string
  sort_order: number
  is_active: boolean
}

const DepartmentMasterPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [rows, setRows] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [saving, setSaving] = useState(false)
  // Backend's Thai error text, shown inside the modal so it is not lost behind a toast.
  const [formError, setFormError] = useState('')
  const [form] = Form.useForm<FormValues>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await departmentService.list(accessToken))
    } catch (err: any) {
      message.error(departmentErrorMessage(err, 'โหลดรายการแผนกไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (activeOnly && !r.is_active) return false
      if (!q) return true
      return r.dept_code.toLowerCase().includes(q) || r.dept_name.toLowerCase().includes(q)
    })
  }, [rows, search, activeOnly])

  const openCreate = () => {
    setEditing(null)
    setFormError('')
    form.resetFields()
    form.setFieldsValue({ dept_code: '', dept_name: '', sort_order: 0, is_active: true })
    setOpen(true)
  }

  const openEdit = (r: Department) => {
    setEditing(r)
    setFormError('')
    form.setFieldsValue({
      dept_code: r.dept_code, dept_name: r.dept_name, sort_order: r.sort_order, is_active: r.is_active,
    })
    setOpen(true)
  }

  const handleSave = async () => {
    const v = await form.validateFields()
    const payload: DepartmentPayload = {
      dept_code: v.dept_code,
      dept_name: v.dept_name.trim(),
      sort_order: v.sort_order ?? 0,
      is_active: v.is_active,
    }
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        await departmentService.update(accessToken, editing.id, payload)
        message.success('แก้ไขแผนกสำเร็จ')
      } else {
        await departmentService.create(accessToken, payload)
        message.success('เพิ่มแผนกสำเร็จ')
      }
      setOpen(false)
      load()
    } catch (err: any) {
      setFormError(departmentErrorMessage(err, 'บันทึกไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (r: Department) => {
    try {
      await departmentService.remove(accessToken, r.id)
      message.success('ลบแผนกสำเร็จ')
      load()
    } catch (err: any) {
      const msg = departmentErrorMessage(err, 'ลบแผนกไม่สำเร็จ')
      if (err?.response?.status === 409) {
        Modal.error({ title: 'ไม่สามารถลบแผนกได้', content: msg, okText: 'ตกลง' })
      } else {
        message.error(msg)
      }
    }
  }

  const columns: ColumnsType<Department> = [
    { title: 'ลำดับ', key: 'no', width: 70, align: 'center', render: (_v, _r, i) => i + 1 },
    { title: 'รหัสแผนก', dataIndex: 'dept_code', key: 'dept_code', width: 160 },
    { title: 'ชื่อแผนก', dataIndex: 'dept_name', key: 'dept_name' },
    {
      title: 'สถานะ',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 110,
      align: 'center',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'ใช้งาน' : 'ปิดใช้งาน'}</Tag>,
    },
    { title: 'ลำดับแสดงผล', dataIndex: 'sort_order', key: 'sort_order', width: 120, align: 'right' },
    {
      title: 'จัดการ',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_v, r) => (
        <Space>
          <PermissionButton
            action="edit"
            menuCode={MENU_CODE}
            size="small"
            icon={<EditOutlined />}
            title="แก้ไข"
            onClick={() => openEdit(r)}
          />
          <ConfirmDeleteButton
            menuCode={MENU_CODE}
            size="small"
            title="ลบ"
            text={`ยืนยันการลบแผนก ${r.dept_code} ${r.dept_name}? การลบไม่สามารถย้อนกลับได้`}
            onConfirm={() => handleDelete(r)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="แผนก"
        subtitle="จัดการข้อมูลแผนก"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'ข้อมูลหลัก' }, { title: 'แผนก' }]}
        extra={
          <PermissionButton action="write" menuCode={MENU_CODE} type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            เพิ่มแผนก
          </PermissionButton>
        }
      />

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Space wrap size={16} style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="ค้นหารหัสหรือชื่อแผนก"
            style={{ width: 280 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Space size={8}>
            <Switch checked={activeOnly} onChange={setActiveOnly} />
            <span>แสดงเฉพาะที่ใช้งาน</span>
          </Space>
        </Space>
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 20, showTotal: (t) => `ทั้งหมด ${t} รายการ` }}
        />
      </Card>

      <Modal
        title={editing ? 'แก้ไขแผนก' : 'เพิ่มแผนก'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="บันทึก"
        cancelText="ยกเลิก"
        destroyOnClose
      >
        <Form autoComplete="off" form={form} layout="vertical" style={{ marginTop: 16 }}>
          {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}
          <Form.Item
            name="dept_code"
            label="รหัสแผนก"
            normalize={(v?: string) => (v ?? '').toUpperCase()}
            rules={[
              { required: true, whitespace: true, message: 'กรุณากรอกรหัสแผนก' },
              { max: 20, message: 'รหัสแผนกต้องไม่เกิน 20 ตัวอักษร' },
              { pattern: /^[A-Z0-9_]+$/, message: 'ใช้ได้เฉพาะตัวอักษร A-Z ตัวเลข 0-9 และ _ เท่านั้น' },
            ]}
          >
            <Input maxLength={20} readOnly={!!editing} disabled={!!editing} placeholder="เช่น IT_DEPT" />
          </Form.Item>
          <Form.Item
            name="dept_name"
            label="ชื่อแผนก"
            rules={[
              { required: true, whitespace: true, message: 'กรุณากรอกชื่อแผนก' },
              { max: 200, message: 'ชื่อแผนกต้องไม่เกิน 200 ตัวอักษร' },
            ]}
          >
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            name="sort_order"
            label="ลำดับแสดงผล"
            rules={[{ type: 'number', min: 0, message: 'ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' }]}
          >
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="ใช้งาน" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DepartmentMasterPage
