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
        department: u.dept_name ?? '-',
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
  const handleDeptChange = async (deptCode: string) => {
    // Guard the same race openEdit guards against: if allRoles hasn't finished
    // its initial fetch yet, don't filter against an empty list — that would
    // wrongly wipe out valid role options/selections.
    let roles = allRoles
    if (roles.length === 0 && accessToken) {
      try {
        roles = await permissionMatrixService.getRoles(accessToken as string)
        setAllRoles(roles)
      } catch {
        roles = []
      }
    }
    const rolesForDept = roles.filter((role) => role.dept_code === deptCode)
    setRoleOptions(rolesForDept)
    const currentRoleIds: number[] = form.getFieldValue('roleIds') ?? []
    const filtered = currentRoleIds.filter((id) => rolesForDept.some((role) => role.id === id))
    form.setFieldValue('roleIds', filtered)
  }
  const handleDelete = async (key: string) => {
    const target = data.find((d) => d.key === key)
    if (!target) return
    try {
      await axios.delete(`${BASE_URL}/users/${target.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      setData(data.filter((d) => d.key !== key))
      message.success('ลบผู้ใช้เรียบร้อย')
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'ลบผู้ใช้ไม่สำเร็จ'
      message.error(errMsg)
    }
  }

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
          // Backend split: PUT /users/:id's UpdateUserRequest only accepts a
          // singular `role_id`, not a `role_ids` array — sending `role_ids` here
          // gets silently ignored (no error, just dropped). Role assignment has
          // its own endpoint, PUT /users/:id/roles, which takes { role_ids: [...] }.
          // Profile fields and roles must therefore be saved as two separate calls.
          const profilePayload = {
            username: values.username,
            full_name: values.fullName,
            email: values.email,
            dept_code: values.deptCode,
          }
          const rolesPayload = { role_ids: values.roleIds ?? [] }
          console.log('[UsersPage] PUT /users/:id payload', profilePayload)
          console.log('[UsersPage] PUT /users/:id/roles payload', rolesPayload)

          let profileFailed = false
          let rolesFailed = false
          let profileErrMsg = ''
          let rolesErrMsg = ''

          try {
            await axios.put(`${BASE_URL}/users/${editing.id}`, profilePayload, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
          } catch (err: any) {
            profileFailed = true
            profileErrMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'unknown error'
          }

          try {
            await axios.put(`${BASE_URL}/users/${editing.id}/roles`, rolesPayload, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
          } catch (err: any) {
            rolesFailed = true
            rolesErrMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'unknown error'
          }

          if (profileFailed && rolesFailed) {
            message.error(`บันทึกข้อมูลทั่วไปไม่สำเร็จ: ${profileErrMsg} และบันทึกบทบาทไม่สำเร็จ: ${rolesErrMsg}`)
            return
          }
          if (profileFailed) {
            message.error(`บันทึกข้อมูลทั่วไปไม่สำเร็จ: ${profileErrMsg} (บทบาทถูกบันทึกแล้ว)`)
            return
          }
          if (rolesFailed) {
            message.error(`บันทึกข้อมูลทั่วไปสำเร็จ แต่บันทึกบทบาทไม่สำเร็จ: ${rolesErrMsg}`)
            return
          }

          // Don't trust the submitted form values as the new state — re-fetch the
          // user from the server so we display what was *actually* persisted.
          // (Backend has a known bug class where a field present in the payload
          // silently doesn't make it into the UPDATE/join SQL and still returns 200.)
          const verifyRes = await axios.get(`${BASE_URL}/users/${editing.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const fresh = verifyRes.data?.data ?? verifyRes.data
          // Compare only the fields we actually submitted — never diff sentPayload
          // against the whole `fresh` object, since `fresh` legitimately carries
          // extra keys (`department` raw column, `dept_name` joined display) that
          // were never part of the payload and aren't mismatches.
          // Role objects' id key isn't confirmed (`role_id` vs `id`) — accept either.
          const freshRoleIds: number[] = Array.isArray(fresh?.roles)
            ? fresh.roles.map((rl: any) => rl.role_id ?? rl.id).filter((id: unknown) => id != null)
            : []
          // GET /users/:id does NOT reliably return a `dept_code` key (see openEdit
          // above, which avoids it for the same reason). Post backend fix, the real
          // FK-code value lives on `department` (raw column); `dept_name` is only the
          // joined display label — never compare against that. Fall back through the
          // possible shapes rather than assuming one key name.
          // `fresh.department` is the raw free-text column and is null by design
          // (confirmed by backend) — it never holds a dept_code, so don't fall
          // back to it. Only `dept_code` directly, or resolving `dept_name` back
          // to its code via the departments master, are valid sources here.
          const freshDeptCode: string | null =
            fresh?.dept_code ??
            departments.find((d) => d.dept_name === fresh?.dept_name)?.dept_code ??
            null
          const dept = departments.find((d) => d.dept_code === freshDeptCode)

          const deptMatches = freshDeptCode === values.deptCode
          const roleIdsMatch =
            JSON.stringify([...freshRoleIds].sort()) === JSON.stringify([...(values.roleIds ?? [])].sort())

          if (!deptMatches || !roleIdsMatch) {
            console.error('User update did not persist as submitted.', {
              sentPayload: { ...profilePayload, ...rolesPayload },
              serverReturned: fresh,
            })
            message.warning('บันทึกสำเร็จ แต่ค่าที่ระบบเก็บไว้ไม่ตรงกับที่ส่ง — กรุณาตรวจสอบอีกครั้ง')
          } else {
            message.success('แก้ไขข้อมูลเรียบร้อย')
          }

          setData(data.map((d) => d.key === editing.key ? {
            ...d,
            username: fresh?.username ?? values.username,
            fullName: fresh?.full_name ?? fresh?.fullName ?? values.fullName,
            email: fresh?.email ?? values.email,
            deptCode: freshDeptCode,
            roleId: freshRoleIds[0] ?? null,
            roleIds: freshRoleIds,
            roles: fresh?.roles ?? d.roles,
            department: dept?.dept_name ?? d.department,
            role: (fresh?.roles ?? []).map((r: UserRole) => r.role_name).join(', ') || d.role,
          } : d))
          setOpen(false)
        } catch {
          message.error('แก้ไขข้อมูลไม่สำเร็จ')
        }
      } else {
        try {
          const payload = {
            username: values.username,
            full_name: values.fullName,
            email: values.email,
            password: values.password,
            dept_code: values.deptCode,
            role_ids: values.roleIds,
          }
          const res = await axios.post(`${BASE_URL}/users`, payload, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const created = res.data?.data ?? res.data
          const dept = departments.find((d) => d.dept_code === values.deptCode)
          const selectedRoles = allRoles
            .filter((r) => (values.roleIds ?? []).includes(r.id))
            .map((r) => ({ role_id: r.id, role_code: r.role_code, role_name: r.role_name }))
          const newUser: UserRecord = {
            key: String(created?.id ?? Date.now()),
            id: String(created?.id ?? Date.now()),
            username: values.username,
            fullName: values.fullName,
            email: values.email,
            role: selectedRoles.map((r) => r.role_name).join(', ') || '-',
            department: dept?.dept_name ?? '-',
            isActive: true,
            roleId: values.roleIds?.[0] ?? null,
            roleIds: values.roleIds ?? [],
            roles: selectedRoles,
            deptCode: values.deptCode ?? null,
          }
          setData([...data, newUser])
          message.success('เพิ่มผู้ใช้เรียบร้อย')
          setOpen(false)
        } catch (err: any) {
          const errMsg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            'เพิ่มผู้ใช้ไม่สำเร็จ'
          message.error(errMsg)
        }
      }
    })
    .catch((err) => {
      console.error('User form validation failed:', err)
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
