import React, { useState } from 'react'
import { Card, Select, Table, Checkbox, Button, message, Typography, Row, Col } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useAppSelector } from '@/store'
import PageHeader from '@/components/common/PageHeader'
import { PermissionAction } from '@/types'

const ACTIONS: PermissionAction[] = ['read', 'write', 'edit', 'delete']
const ACTION_LABELS: Record<PermissionAction, string> = { read: 'อ่าน', write: 'สร้าง', edit: 'แก้ไข', delete: 'ลบ' }

const mockUsers = [
  { value: 'u1', label: 'admin - ผู้ดูแลระบบ' },
  { value: 'u2', label: 'manager - สมชาย ผู้จัดการ' },
  { value: 'u3', label: 'user1 - สมหญิง พนักงาน' },
]

type PermMap = Record<string, Record<PermissionAction, boolean>>

const PermissionsPage: React.FC = () => {
  const { menus } = useAppSelector((state) => state.menu)
  const [selectedUser, setSelectedUser] = useState<string | undefined>()
  const [permMap, setPermMap] = useState<PermMap>({})

  const allMenus = menus.flatMap((m) => [m, ...(m.children || [])])

  const toggle = (menuId: string, action: PermissionAction, checked: boolean) => {
    setPermMap((prev) => ({
      ...prev,
      [menuId]: { ...(prev[menuId] || { read: false, write: false, edit: false, delete: false }), [action]: checked },
    }))
  }

  const columns = [
    { title: 'เมนู', dataIndex: 'label', render: (v: string, r: typeof allMenus[0]) => (
      <span style={{ paddingLeft: r.parentId ? 24 : 0, fontWeight: r.parentId ? 400 : 600 }}>
        {r.parentId ? '└ ' : ''}{v}
      </span>
    )},
    ...ACTIONS.map((action) => ({
      title: ACTION_LABELS[action],
      key: action,
      width: 80,
      align: 'center' as const,
      render: (_: unknown, r: typeof allMenus[0]) => (
        <Checkbox
          checked={permMap[r.id]?.[action] || false}
          disabled={!selectedUser}
          onChange={(e) => toggle(r.id, action, e.target.checked)}
        />
      ),
    })),
  ]

  return (
    <div>
      <PageHeader title="จัดการสิทธิ์" subtitle="กำหนดสิทธิ์การเข้าถึงเมนูสำหรับผู้ใช้แต่ละคน"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'System' }, { title: 'สิทธิ์' }]}
      />
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
        <Row gutter={16} align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Typography.Text strong style={{ color: '#1e3a8a' }}>เลือกผู้ใช้: </Typography.Text>
          </Col>
          <Col flex={1} style={{ maxWidth: 320 }}>
            <Select style={{ width: '100%' }} placeholder="เลือกผู้ใช้เพื่อกำหนดสิทธิ์" options={mockUsers} value={selectedUser} onChange={(v) => { setSelectedUser(v); setPermMap({}) }} />
          </Col>
          <Col>
            <Button type="primary" icon={<SaveOutlined />} disabled={!selectedUser} onClick={() => message.success('บันทึกสิทธิ์เรียบร้อย')}>บันทึก</Button>
          </Col>
        </Row>
        {!selectedUser && (
          <div style={{ textAlign: 'center', padding: 40, color: '#93c5fd' }}>
            กรุณาเลือกผู้ใช้เพื่อจัดการสิทธิ์
          </div>
        )}
        {selectedUser && (
          <Table dataSource={allMenus.map((m) => ({ ...m, key: m.id }))} columns={columns} size="small" pagination={false} />
        )}
      </Card>
    </div>
  )
}

export default PermissionsPage
