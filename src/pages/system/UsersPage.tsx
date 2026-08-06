import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, Tag, Avatar, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, KeyOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import axios from 'axios'
import { useAppSelector } from '@/store'
import { permissionMatrixService } from '@/services/permissionMatrix.service'
import type { PermRole, Department } from '@/types/permission.types'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'
interface UserRole { role_id: number; role_code: string; role_name: string }
interface UserRecord {
  key: string; id: string; username: string; fullName: string; email: string
  role: string; department: string; isActive: boolean
  roleId: number | null; roleIds: number[]; roles: UserRole[]; deptCode: string | null
}
const user = JSON.parse(sessionStorage.getItem('user') ?? '{}')
const UsersPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [data, setData] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UserRecord | null>(null)
  const [form] = Form.useForm()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState<UserRecord | null>(null)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordForm] = Form.useForm()

  const [departments, setDepartments] = useState<Department[]>([])
  const [allRoles, setAllRoles] = useState<PermRole[]>([])
  const [roleOptions, setRoleOptions] = useState<PermRole[]>([])

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/users/allUser`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setData(list.map((u: any) => ({
        key: String(u.id),
        id: String(u.id),
        username: u.username,
        fullName: u.full_name ?? u.fullName ?? u.username,
        email: u.email,
        role: (u.roles ?? []).map((rl: UserRole) => rl.role_name).join(', ') || u.role || '-',
        department: u.department ?? '-',
        isActive: u.is_active,
        roleId: u.roles?.[0]?.role_id ?? u.role_id ?? null,
        roleIds: (u.roles ?? []).map((rl: UserRole) => rl.role_id),
        roles: u.roles ?? [],
        deptCode: u.dept_code ?? null,
      })))
      } catch {
        message.error('โหลดข้อมูลผู้ใช้ไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    permissionMatrixService.getDepartments(accessToken).then(setDepartments).catch(() => {})
    permissionMatrixService.getRoles(accessToken).then(setAllRoles).catch(() => {})
  }, [accessToken])

  const openCreate = () => { setEditing(null); form.resetFields(); setRoleOptions([]); setOpen(true) }
  const openEdit = async (r: UserRecord) => {
    setEditing(r)
    const deptCode = r.deptCode ?? departments.find((d) => d.dept_name === r.department)?.dept_code ?? undefined

    // Ensure role options are loaded before we try to resolve/select roles below.
    let roles = allRoles
    if (roles.length === 0 && accessToken) {
      try {
        roles = await permissionMatrixService.getRoles(accessToken as string)
        setAllRoles(roles)
      } catch {
        roles = []
      }
    }

    let roleIds = r.roleIds
    try {
      const res = await axios.get(`${BASE_URL}/users/${r.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const fresh = res.data?.data ?? res.data
      if (Array.isArray(fresh?.roles)) roleIds = fresh.roles.map((rl: UserRole) => rl.role_id)
    } catch {
      // fall back to roleIds already present on the row from the list fetch
    }

    // Role options are normally scoped to the selected department, but a user's
    // existing roles may span departments — keep those visible so setFieldsValue
    // doesn't silently drop values that don't resolve to an option.
    const rolesForDept = deptCode ? roles.filter((role) => role.dept_code === deptCode) : roles
    const missingAssigned = roles.filter((role) => roleIds.includes(role.id) && !rolesForDept.some((rd) => rd.id === role.id))
    setRoleOptions([...rolesForDept, ...missingAssigned])

    form.setFieldsValue({
      username: r.username,
      fullName: r.fullName,
      email: r.email,
      deptCode,
      roleIds,
    })
    setOpen(true)
  }
  const handleDeptChange = (deptCode: string) => {
    const rolesForDept = allRoles.filter((role) => role.dept_code === deptCode)
    setRoleOptions(rolesForDept)
    const currentRoleIds: number[] = form.getFieldValue('roleIds') ?? []
    const filtered = currentRoleIds.filter((id) => rolesForDept.some((role) => role.id === id))
    form.setFieldValue('roleIds', filtered)
  }
  const handleDelete = (key: string) => { setData(data.filter((d) => d.key !== key)); message.success('ลบผู้ใช้เรียบร้อย') }

  const openPasswordReset = (r: UserRecord) => { setPasswordTarget(r); passwordForm.resetFields(); setPasswordOpen(true) }
  const handlePasswordOk = () => {
    passwordForm.validateFields().then(async (values) => {
      if (!passwordTarget) return
      setPasswordSubmitting(true)
      try {
        await axios.put(`${BASE_URL}/users/${passwordTarget.id}/password`, { new_password: values.password }, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('เปลี่ยน password สำเร็จ')
        setPasswordOpen(false)
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'เปลี่ยน password ไม่สำเร็จ'
        message.error(errMsg)
      } finally {
        setPasswordSubmitting(false)
      }
    })
  }
  const handleOk = () => {
    form.validateFields().then(async (values) => {
      if (editing) {
        try {
          const payload = {
            username: values.username,
            full_name: values.fullName,
            email: values.email,
            dept_code: values.deptCode,
            role_ids: values.roleIds,
          }
          await axios.put(`${BASE_URL}/users/${editing.id}`, payload, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const dept = departments.find((d) => d.dept_code === values.deptCode)
          const selectedRoles = allRoles
            .filter((r) => (values.roleIds ?? []).includes(r.id))
            .map((r) => ({ role_id: r.id, role_code: r.role_code, role_name: r.role_name }))
          setData(data.map((d) => d.key === editing.key ? {
            ...d,
            username: values.username,
            fullName: values.fullName,
            email: values.email,
            deptCode: values.deptCode,
            roleId: values.roleIds?.[0] ?? null,
            roleIds: values.roleIds ?? [],
            roles: selectedRoles.length ? selectedRoles : d.roles,
            department: dept?.dept_name ?? d.department,
            role: selectedRoles.map((r) => r.role_name).join(', ') || d.role,
          } : d))
          message.success('แก้ไขข้อมูลเรียบร้อย')
          setOpen(false)
        } catch {
          message.error('แก้ไขข้อมูลไม่สำเร็จ')
        }
      } else {
        const newUser = { key: Date.now().toString(), id: Date.now().toString(), ...values, isActive: true }
        setData([...data, newUser])
        message.success('เพิ่มผู้ใช้เรียบร้อย')
        setOpen(false)
      }
    })
  }

  const columns = [
    { title: 'ผู้ใช้', key: 'user', render: (_: unknown, r: UserRecord) => (
      <Space>
        <Avatar style={{ background: '#2563eb' }} size={32}>{r.fullName.charAt(0)}</Avatar>
        <div><div style={{ fontWeight: 600, fontSize: 13 }}>{r.fullName}</div><div style={{ fontSize: 11, color: '#60a5fa' }}>{r.username}</div></div>
      </Space>
    )},
    { title: 'อีเมล', dataIndex: 'email' },
    { title: 'บทบาท', dataIndex: 'role', render: (v: string) => <Tag color={v === 'Admin' ? 'blue' : v === 'Manager' ? 'purple' : 'default'}>{v}</Tag> },
    { title: 'แผนก', dataIndex: 'department' },
    { title: 'สถานะ', dataIndex: 'isActive', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'ใช้งาน' : 'ปิดใช้งาน'}</Tag> },
    { title: 'จัดการ', key: 'action', render: (_: unknown, r: UserRecord) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>แก้ไข</Button>
        <Button size="small" icon={<KeyOutlined />} onClick={() => openPasswordReset(r)}>เปลี่ยน Password</Button>
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.key)}>ลบ</Button>
      </Space>
    )},
  ]

  return (
    <div>
      <PageHeader title="จัดการผู้ใช้" subtitle="เพิ่ม ลบ แก้ไขข้อมูลผู้ใช้งาน"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'System' }, { title: 'ผู้ใช้' }]}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>เพิ่มผู้ใช้</Button>}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Table dataSource={data} columns={columns} loading={loading} size="small" pagination={{ pageSize: 10 }} />
      </Card>
      <Modal title={editing ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้'} open={open} onOk={handleOk} onCancel={() => setOpen(false)} okText="บันทึก" cancelText="ยกเลิก">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="ชื่อผู้ใช้" name="username" rules={[{ required: true }]}><Input prefix={<UserOutlined />} /></Form.Item>
          <Form.Item label="ชื่อ-นามสกุล" name="fullName" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="อีเมล" name="email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          {!editing && <Form.Item label="รหัสผ่าน" name="password" rules={[{ required: true }]}><Input.Password /></Form.Item>}
          <Form.Item label="แผนก" name="deptCode" rules={[{ required: true }]}>
            <Select
              options={departments.map((d) => ({ value: d.dept_code, label: d.dept_name }))}
              onChange={handleDeptChange}
              placeholder="เลือกแผนก"
            />
          </Form.Item>
          <Form.Item label="บทบาท" name="roleIds" rules={[{ required: true, type: 'array', min: 1 }]}>
            <Select
              mode="multiple"
              options={roleOptions.map((r) => ({ value: r.id, label: r.role_name }))}
              placeholder="เลือกบทบาท"
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={`เปลี่ยน Password: ${passwordTarget?.username ?? ''}`}
        open={passwordOpen}
        onOk={handlePasswordOk}
        onCancel={() => setPasswordOpen(false)}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={passwordSubmitting}
      >
        <Form form={passwordForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="รหัสผ่านใหม่" name="password" rules={[{ required: true, message: 'กรุณากรอกรหัสผ่าน' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="ยืนยันรหัสผ่านใหม่"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: 'กรุณายืนยันรหัสผ่าน' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve()
                  return Promise.reject(new Error('รหัสผ่านไม่ตรงกัน'))
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UsersPage
