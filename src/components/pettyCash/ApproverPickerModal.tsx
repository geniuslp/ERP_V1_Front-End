import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Table, Input, Button, Tag, Space } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined } from '@ant-design/icons'
import axios from 'axios'
import { formatApproverOption } from '@/utils/formatApproverOption'
import { message } from 'antd'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

interface ApproverRow {
  key: number
  userId: number
  username?: string
  code: string
  name: string
  roleNames: string
  active: boolean
}

export interface ChosenApprover { userId: number; username?: string; code: string; name: string; roleNames: string }

interface Props {
  open: boolean
  /** Eligible-approver pool doc_type (GET /master/eligible-approvers). */
  docType: string
  /** Approver (user id) to pre-tick when the modal opens, e.g. when returning from the confirm step. */
  initialSelectedId?: number | null
  /** TEMPORARY mock flag: show the test tag and fall back to fake rows when the list is empty/fails. */
  mock?: boolean
  /** Shows the loading state on "ตกลง" while the caller saves + submits. */
  confirming?: boolean
  onOk: (approver: ChosenApprover) => void
  onCancel: () => void
}

const MOCK_ROWS: ApproverRow[] = [
  { key: 9001, userId: 9001, code: 'M001', name: 'ผู้อนุมัติทดสอบ 1', roleNames: 'ผู้จัดการ', active: true },
  { key: 9002, userId: 9002, code: 'M002', name: 'ผู้อนุมัติทดสอบ 2', roleNames: 'ผู้จัดการ', active: true },
  { key: 9003, userId: 9003, code: 'M003', name: 'ผู้อนุมัติทดสอบ 3', roleNames: 'ผู้อำนวยการ', active: false },
]

const ApproverPickerModal: React.FC<Props> = ({ open, docType, initialSelectedId = null, mock = false, confirming = false, onOk, onCancel }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [rows, setRows] = useState<ApproverRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setSelected(initialSelectedId)
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        // Real response items are { value: user id, label: full name, dept }. The pool only contains
        // active users; employee_code / role_names show "-" when empty.
        const res = await axios.get(`${BASE_URL}/master/eligible-approvers`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { doc_type: docType },
        })
        const raw = Array.isArray(res.data) ? res.data : res.data?.data?.data ?? res.data?.data ?? []
        const list: ApproverRow[] = (Array.isArray(raw) ? raw : []).map((u: any) => ({
          key: Number(u.value ?? u.id),
          userId: Number(u.value ?? u.id),
          username: u.username || undefined,
          code: u.employee_code || '-',
          name: u.full_name ?? u.label ?? u.fullName ?? u.username ?? '-',
          roleNames: Array.isArray(u.role_names)
            ? u.role_names.filter(Boolean).join(', ') || '-'
            : (u.role_names ? String(u.role_names) : '-'),
          active: u.is_active ?? true,
        }))
        if (!cancelled) setRows(list.length === 0 && mock ? MOCK_ROWS : list)
      } catch {
        if (cancelled) return
        message.error('โหลดรายชื่อผู้อนุมัติไม่สำเร็จ')
        setRows(mock ? MOCK_ROWS : [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, docType, mock, accessToken])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q
      ? rows.filter((r) => r.code.toLowerCase().includes(q) || (r.username ?? '').toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
      : rows
  }, [rows, search])

  const columns: ColumnsType<ApproverRow> = [
    { title: 'No', key: 'no', width: 60, align: 'center', render: (_v, _r, i) => i + 1 },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 120 },
    { title: 'Name', dataIndex: 'name', key: 'name', render: (_v, r) => formatApproverOption(r.username, r.userId) },
    { title: 'บทบาท', dataIndex: 'roleNames', key: 'roleNames', width: 220 },
    {
      title: 'Active', key: 'active', width: 110, align: 'center',
      render: (_v, r) => (r.active ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag>),
    },
  ]

  return (
    <Modal
      open={open}
      centered
      width={900}
      style={{ maxWidth: '95vw' }}
      destroyOnClose
      onCancel={confirming ? undefined : onCancel}
      maskClosable={false}
      title={
        <span style={{ fontFamily: 'Sarabun', color: '#1e3a8a', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          เลือกผู้อนุมัติ
          {mock && <Tag color="warning" style={{ margin: 0 }}>โหมดทดสอบ: ไม่บันทึกจริง</Tag>}
        </span>
      }
      styles={{ content: { borderRadius: 12, boxShadow: '0 8px 30px rgba(15,45,94,0.18)' } }}
      footer={
        <Space>
          <Button onClick={onCancel} disabled={confirming}>ยกเลิก</Button>
          <Button type="primary" disabled={selected == null} loading={confirming} onClick={() => {
            const r = rows.find((x) => x.userId === selected)
            if (r) onOk({ userId: r.userId, username: r.username, code: r.code, name: r.name, roleNames: r.roleNames })
          }}>
            ตกลง
          </Button>
        </Space>
      }
    >
      <Input
        prefix={<SearchOutlined style={{ color: '#93c5fd' }} />}
        allowClear
        placeholder="ค้นหารหัส / ชื่อ"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 12, height: 40 }}
      />
      <Table<ApproverRow>
        className="pc-approver-table"
        rowKey="key"
        size="small"
        bordered={false}
        loading={loading}
        dataSource={filtered}
        columns={columns}
        pagination={{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true }}
        locale={{ emptyText: 'ไม่พบผู้อนุมัติ' }}
        rowSelection={{
          type: 'checkbox',
          hideSelectAll: true,
          selectedRowKeys: selected != null ? [selected] : [],
          columnWidth: 64,
          getCheckboxProps: (r) => ({ disabled: !r.active }),
          // Single-select: ticking another row replaces the previous; unticking clears.
          onSelect: (r, checked) => setSelected(checked ? r.userId : null),
        }}
        rowClassName={(r) => (r.active ? '' : 'pc-approver-row-disabled')}
        onRow={(r) => ({
          onClick: () => { if (r.active) setSelected((cur) => (cur === r.userId ? null : r.userId)) },
          style: {
            cursor: r.active ? 'pointer' : 'not-allowed',
            color: r.active ? undefined : '#9ca3af',
            ...(selected === r.userId ? { background: '#eff6ff', boxShadow: 'inset 3px 0 0 #1d4ed8' } : {}),
          },
        })}
      />
    </Modal>
  )
}

export default ApproverPickerModal
