import PanelTabs from '@/components/common/PanelTabs'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Modal, Table, Button, Space, Empty, Input, Form, Popconfirm, message, Tag, Typography, Switch } from 'antd'
import { PlusOutlined, EditOutlined, StopOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useAppSelector } from '@/store'
import type { FormInstance } from 'antd'
import type { JobTypeOption } from '@/constants/jobTypes'
import { usePermissionContext } from '@/contexts/PermissionContext'
import { clearPettyCashCostCodeCache } from '@/components/pettyCash/PettyCashLineModal'
import PermissionGate from '@/components/permission/PermissionGate'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const { Text } = Typography

const MENU_CODE = 'MENU_MASTER_COST_CODE'

interface GroupRow {
  id: number
  job_id: number
  group_code: string
  group_name: string
  is_active: boolean
}

interface SubgroupRow {
  id: number
  group_id: number
  subgroup_code: string
  subgroup_name: string
  is_active: boolean
  // Head rows are hidden from PR/PO pickers; only returned here via include_head=true.
  is_head?: boolean
  // Major rows sit above Head rows (Major -> Head -> normal); also hidden from
  // pickers and returned here only via include_head=true.
  is_major?: boolean
}

// Display order: Head rows first, then normal rows (stable within each). Major rows
// are never shown in the table — they render in the header block.
const rankRow = (r: SubgroupRow) => (r.is_head ? 0 : 1)
const sortSubgroups = (rows: SubgroupRow[]) =>
  rows.map((r, i) => ({ r, i })).sort((a, b) => rankRow(a.r) - rankRow(b.r) || a.i - b.i).map((x) => x.r)

interface Props {
  open: boolean
  onClose: () => void
  jobType: JobTypeOption | null
}

// "เป็น Head" switch for the add/edit subgroup forms. Hidden unless the user
// has edit permission on the page's menu code.
const HeadSwitchField: React.FC<{ form: FormInstance }> = ({ form }) => {
  const isHead = Form.useWatch('is_head', form)
  return (
    <PermissionGate menuCode={MENU_CODE} action="edit">
      <Form.Item name="is_head" valuePropName="checked" label="เป็น Head" extra={
        isHead ? 'Head จะไม่ถูกแสดงให้เลือกใน PR/PO' : 'รายการนี้เลือกใช้ใน PR/PO ได้'
      }>
        <Switch />
      </Form.Item>
    </PermissionGate>
  )
}

const CostCodeJobTypeModal: React.FC<Props> = ({ open, onClose, jobType }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const { can } = usePermissionContext()
  const canEditHead = can(MENU_CODE, 'edit')
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [loading, setLoading] = useState(false)
  // Resolved once per open (and again whenever the active subject tab
  // changes) — the numeric job_id backing this Job Type's active subject +
  // filterJobCode. null when the Job Type has no backing cost_subject/cost_job
  // yet (the 6 unbacked codes) — shows an Empty state.
  const [jobId, setJobId] = useState<number | null>(null)
  const [unbacked, setUnbacked] = useState(false)
  // Which of jobType.filterSubjectCodes is currently being viewed/administered.
  // Only relevant (and only shown as Tabs) when there's more than one — e.g.
  // 'MP' has ['M','S'] (Material + Subcontract share job letter P but have
  // different Group/Subgroup data), while single-subject Job Types like 'FS'
  // never show tabs and always resolve to their one subject.
  const [activeSubjectCode, setActiveSubjectCode] = useState<string | null>(null)
  // subject_code -> subject_name, fetched once per open — feeds both the id
  // resolution below and the Tabs' labels (real DB names, not hardcoded).
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({})

  const subjectCodes = jobType?.filterSubjectCodes ?? []
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [subgroupsByGroup, setSubgroupsByGroup] = useState<Record<number, SubgroupRow[]>>({})
  const [subgroupsLoading, setSubgroupsLoading] = useState<Record<number, boolean>>({})
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])

  const [addGroupOpen, setAddGroupOpen] = useState(false)
  const [addGroupSaving, setAddGroupSaving] = useState(false)
  const [addGroupForm] = Form.useForm()

  const [editGroup, setEditGroup] = useState<GroupRow | null>(null)
  const [editGroupSaving, setEditGroupSaving] = useState(false)
  const [editGroupForm] = Form.useForm()

  const [addSubgroupForGroup, setAddSubgroupForGroup] = useState<GroupRow | null>(null)
  const [addSubgroupSaving, setAddSubgroupSaving] = useState(false)
  const [addSubgroupForm] = Form.useForm()

  const [editSubgroup, setEditSubgroup] = useState<SubgroupRow | null>(null)
  const [editSubgroupSaving, setEditSubgroupSaving] = useState(false)
  const [editSubgroupForm] = Form.useForm()

  const fetchSubgroups = useCallback(async (groupId: number) => {
    setSubgroupsLoading((p) => ({ ...p, [groupId]: true }))
    try {
      const res = await axios.get(`${BASE_URL}/master/cost-code/subgroups`, {
        // include_head: this admin page only — pickers never pass it.
        params: { group_id: groupId, include_head: true },
        headers: authHeader,
      })
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
      const rows: SubgroupRow[] = (Array.isArray(list) ? list : []).map((r: any) => ({
        ...r,
        is_head: typeof r.is_head === 'boolean' ? r.is_head : typeof r.isHead === 'boolean' ? r.isHead : undefined,
        is_major: typeof r.is_major === 'boolean' ? r.is_major : undefined,
      }))
      if (import.meta.env.DEV && rows.length > 0 && rows.every((r) => r.is_head === undefined)) {
        // eslint-disable-next-line no-console
        console.warn('[cost-code] /subgroups rows carry no is_head key — keys:', Object.keys(list[0] ?? {}))
      }
      setSubgroupsByGroup((p) => ({ ...p, [groupId]: sortSubgroups(rows) }))
    } catch {
      message.error('โหลดข้อมูล Subgroup ไม่สำเร็จ')
    } finally {
      setSubgroupsLoading((p) => ({ ...p, [groupId]: false }))
    }
  }, [accessToken])

  const fetchGroups = useCallback(async (jid: number) => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/cost-code/groups`, {
        params: { job_id: jid },
        headers: authHeader,
      })
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
      const arr: GroupRow[] = Array.isArray(list) ? list : []
      setGroups(arr)
      // Major lives in group '00'; load it eagerly so the header block can show it.
      const g00 = arr.find((g) => g.group_code === '00')
      if (g00) fetchSubgroups(g00.id)
    } catch {
      message.error('โหลดข้อมูล Group ไม่สำเร็จ')
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [accessToken, fetchSubgroups])

  // Reset per-open state and pick the default active subject tab (the first
  // entry, same as the old hardcoded [0] behavior) whenever the modal opens
  // for a (possibly different) Job Type.
  useEffect(() => {
    if (!open || !jobType) return
    const codes = jobType.filterSubjectCodes ?? []
    if (codes.length === 0 || !jobType.filterJobCode) {
      // No backing subject at all (the unbacked codes) — no subject to
      // resolve or activate, show the Empty state via the resolve effect
      // below short-circuiting on a null activeSubjectCode... but that
      // effect requires activeSubjectCode truthy to run, so set unbacked
      // directly here instead.
      setActiveSubjectCode(null)
      setUnbacked(true)
      setGroups([])
      setSubgroupsByGroup({})
      setExpandedKeys([])
      setJobId(null)
      return
    }
    setActiveSubjectCode(codes[0])
  }, [open, jobType])

  // Resolve subject_code + job_code (from JOB_TYPES) to their numeric
  // subject_id/job_id, then load groups. Re-runs whenever activeSubjectCode
  // changes (i.e. the admin switches subject tabs) so switching tabs reloads
  // that subject's own Group/Subgroup data instead of leaving the previously
  // active tab's data on screen.
  useEffect(() => {
    if (!open || !jobType || !accessToken || !activeSubjectCode) return
    setGroups([])
    setSubgroupsByGroup({})
    setExpandedKeys([])
    setJobId(null)
    setUnbacked(false)

    const resolve = async () => {
      setLoading(true)
      try {
        const subjRes = await axios.get(`${BASE_URL}/master/cost-code/subjects`, { headers: authHeader })
        const subjects = Array.isArray(subjRes.data) ? subjRes.data : subjRes.data?.data ?? []
        setSubjectNames(
          subjects.reduce((acc: Record<string, string>, s: any) => {
            if (s.subject_code) acc[s.subject_code] = s.subject_name
            return acc
          }, {}),
        )
        const subject = subjects.find((s: any) => s.subject_code === activeSubjectCode)
        if (!subject) { setUnbacked(true); setLoading(false); return }

        const jobRes = await axios.get(`${BASE_URL}/master/cost-code/jobs`, {
          params: { subject_id: subject.id },
          headers: authHeader,
        })
        const jobs = Array.isArray(jobRes.data) ? jobRes.data : jobRes.data?.data ?? []
        const job = jobs.find((j: any) => j.job_code === jobType.filterJobCode)
        if (!job) { setUnbacked(true); setLoading(false); return }

        setJobId(job.id)
        await fetchGroups(job.id)
      } catch {
        message.error('โหลดข้อมูล Cost Code ไม่สำเร็จ')
        setLoading(false)
      }
    }
    resolve()
  }, [open, jobType, accessToken, activeSubjectCode, fetchGroups])

  // Major (group '00' / subgroup '000', one per job) is shown in a header block, never
  // as a table row. Group '00' stays in the table only if it also has non-Major subgroups.
  const group00 = groups.find((g) => g.group_code === '00')
  const majorRow = group00 ? (subgroupsByGroup[group00.id] ?? []).find((r) => r.is_major) : undefined
  const majorCode = majorRow && group00
    ? `${activeSubjectCode ?? ''}${jobType?.filterJobCode ?? ''}${group00.group_code}${majorRow.subgroup_code}`
    : ''
  const visibleGroups = groups.filter((g) => {
    if (g.group_code !== '00') return true
    const rows = subgroupsByGroup[g.id]
    return !rows || rows.some((r) => !r.is_major)
  })

  const subjectTabItems = useMemo(
    () => subjectCodes.map((code) => ({
      key: code,
      label: subjectNames[code] ? `${code} - ${subjectNames[code]}` : code,
    })),
    [subjectCodes, subjectNames],
  )

  const handleExpand = (expanded: boolean, record: GroupRow) => {
    setExpandedKeys((prev) => expanded ? [...prev, record.id] : prev.filter((k) => k !== record.id))
    if (expanded && !subgroupsByGroup[record.id]) fetchSubgroups(record.id)
  }

  const handleAddGroup = async () => {
    if (!jobId) return
    const values = await addGroupForm.validateFields()
    setAddGroupSaving(true)
    try {
      await axios.post(`${BASE_URL}/master/cost-code/groups`, {
        job_id: jobId, group_code: values.group_code, group_name: values.group_name,
      }, { headers: authHeader })
      message.success('เพิ่ม Group สำเร็จ')
      setAddGroupOpen(false)
      addGroupForm.resetFields()
      fetchGroups(jobId)
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'เพิ่ม Group ไม่สำเร็จ')
    } finally {
      setAddGroupSaving(false)
    }
  }

  const handleEditGroup = async () => {
    if (!editGroup || !jobId) return
    const values = await editGroupForm.validateFields()
    setEditGroupSaving(true)
    try {
      await axios.patch(`${BASE_URL}/master/cost-code/groups/${editGroup.id}`, {
        group_name: values.group_name,
      }, { headers: authHeader })
      message.success('แก้ไข Group สำเร็จ')
      setEditGroup(null)
      fetchGroups(jobId)
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'แก้ไข Group ไม่สำเร็จ')
    } finally {
      setEditGroupSaving(false)
    }
  }

  const handleDeactivateGroup = async (group: GroupRow) => {
    if (!jobId) return
    try {
      await axios.patch(`${BASE_URL}/master/cost-code/groups/${group.id}/deactivate`, {}, { headers: authHeader })
      message.success('ปิดใช้งาน Group สำเร็จ')
      fetchGroups(jobId)
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'ปิดใช้งาน Group ไม่สำเร็จ')
    }
  }

  const handleAddSubgroup = async () => {
    if (!addSubgroupForGroup) return
    const values = await addSubgroupForm.validateFields()
    const gid = addSubgroupForGroup.id
    setAddSubgroupSaving(true)
    try {
      const res = await axios.post(`${BASE_URL}/master/cost-code/subgroups`, {
        group_id: gid, subgroup_code: values.subgroup_code, subgroup_name: values.subgroup_name,
      }, { headers: authHeader })
      message.success('เพิ่ม Subgroup สำเร็จ')
      if (canEditHead && values.is_head) {
        // Create response shape isn't documented; accept the usual id keys.
        const d = res.data?.data ?? res.data ?? {}
        const newId = d.id ?? d.subgroup_id
        if (newId == null) {
          message.warning('เพิ่ม Subgroup แล้ว แต่ไม่ได้รับรหัสรายการจากระบบ จึงยังไม่ได้ตั้งเป็น Head — กรุณากดแก้ไขรายการนี้เพื่อตั้งค่า Head')
        } else {
          try {
            await applyHead(Number(newId), gid, true)
          } catch (err: any) {
            message.error(`เพิ่ม Subgroup แล้ว แต่ตั้งเป็น Head ไม่สำเร็จ: ${apiMessage(err, 'เปลี่ยนสถานะ Head ไม่สำเร็จ')}`)
          }
        }
      }
      setAddSubgroupForGroup(null)
      addSubgroupForm.resetFields()
      fetchSubgroups(gid)
    } catch (err: any) {
      message.error(apiMessage(err, 'เพิ่ม Subgroup ไม่สำเร็จ'))
    } finally {
      setAddSubgroupSaving(false)
    }
  }

  const handleEditSubgroup = async () => {
    if (!editSubgroup) return
    const values = await editSubgroupForm.validateFields()
    const target = editSubgroup
    setEditSubgroupSaving(true)
    try {
      await axios.patch(`${BASE_URL}/master/cost-code/subgroups/${target.id}`, {
        subgroup_name: values.subgroup_name,
      }, { headers: authHeader })
    } catch (err: any) {
      message.error(`ยังไม่ได้บันทึกอะไร: ${apiMessage(err, 'แก้ไข Subgroup ไม่สำเร็จ')}`)
      setEditSubgroupSaving(false)
      return
    }
    try {
      // Only call the Head endpoint when the switch actually changed.
      if (canEditHead && !!values.is_head !== !!target.is_head) {
        await applyHead(target.id, target.group_id, !!values.is_head)
      }
      message.success('แก้ไข Subgroup สำเร็จ')
      setEditSubgroup(null)
      fetchSubgroups(target.group_id)
    } catch (err: any) {
      // Name update succeeded, Head change did not — keep the modal open.
      message.error(`บันทึกชื่อ Subgroup แล้ว แต่เปลี่ยนสถานะ Head ไม่สำเร็จ: ${apiMessage(err, 'เปลี่ยนสถานะ Head ไม่สำเร็จ')}`)
      setEditSubgroup({ ...target, subgroup_name: values.subgroup_name })
      fetchSubgroups(target.group_id)
    } finally {
      setEditSubgroupSaving(false)
    }
  }

  const handleDeactivateSubgroup = async (subgroup: SubgroupRow) => {
    try {
      await axios.patch(`${BASE_URL}/master/cost-code/subgroups/${subgroup.id}/deactivate`, {}, { headers: authHeader })
      message.success('ปิดใช้งาน Subgroup สำเร็จ')
      fetchSubgroups(subgroup.group_id)
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'ปิดใช้งาน Subgroup ไม่สำเร็จ')
    }
  }

  const groupColumns = [
    { title: 'รหัส Group', dataIndex: 'group_code', width: 120 },
    { title: 'ชื่อ Group', dataIndex: 'group_name' },
    {
      title: 'สถานะ', dataIndex: 'is_active', width: 100,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'ใช้งาน' : 'ปิดใช้งาน'}</Tag>,
    },
    {
      title: '', key: 'action', width: 220,
      render: (_: unknown, r: GroupRow) => (
        <Space size={4}>
          <Button size="small" onClick={() => { setAddSubgroupForGroup(r); addSubgroupForm.resetFields() }}>
            + Subgroup
          </Button>
          <Button
            size="small" icon={<EditOutlined />}
            onClick={() => { setEditGroup(r); editGroupForm.setFieldsValue({ group_name: r.group_name }) }}
          />
          {r.is_active && (
            <Popconfirm title="ยืนยันปิดใช้งาน Group นี้?" onConfirm={() => handleDeactivateGroup(r)}>
              <Button size="small" danger icon={<StopOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // PATCH /master/cost-code/subgroups/:id/head. Updates the local row from the
  // response (matched on subgroup_id) and surfaces in_use counts. Throws on
  // failure so the caller can say what was and wasn't saved.
  const applyHead = async (subgroupId: number, groupId: number, next: boolean) => {
    const res = await axios.patch(
      `${BASE_URL}/master/cost-code/subgroups/${subgroupId}/head`,
      { is_head: next },
      { headers: authHeader },
    )
    clearPettyCashCostCodeCache()
    const d = res.data?.data ?? res.data ?? {}
    const updated = d.row ?? d
    const inUse = d.in_use ?? updated?.in_use
    const isHead = typeof updated?.is_head === 'boolean' ? updated.is_head : next
    const targetId = updated?.subgroup_id ?? d.subgroup_id ?? subgroupId
    setSubgroupsByGroup((p) => ({
      ...p,
      [groupId]: sortSubgroups((p[groupId] ?? []).map((r) => (r.id === targetId ? { ...r, is_head: isHead } : r))),
    }))
    if (isHead) {
      const parts: string[] = []
      if (inUse?.pr_lines > 0) parts.push(`PR ${inUse.pr_lines} บรรทัด`)
      if (inUse?.po_lines > 0) parts.push(`PO ${inUse.po_lines} บรรทัด`)
      if (inUse?.materials > 0) parts.push(`วัสดุ ${inUse.materials} รายการ`)
      if (parts.length > 0) message.info(`มีการใช้งานแล้ว: ${parts.join(', ')} — ข้อมูลเดิมไม่ถูกแก้ไข`)
    }
  }

  const apiMessage = (err: any, fallback: string) =>
    err?.response?.data?.message || err?.response?.data?.error || fallback

  const subgroupColumns = [
    { title: 'รหัส Subgroup', dataIndex: 'subgroup_code', width: 140 },
    {
      title: 'ชื่อ Subgroup', dataIndex: 'subgroup_name',
      render: (v: string, r: SubgroupRow) => (
        <Space size={6}>
          <span>{v}</span>
          {r.is_head && <Tag color="blue" style={{ margin: 0 }}>Head</Tag>}
        </Space>
      ),
    },
    {
      title: 'สถานะ', dataIndex: 'is_active', width: 100,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'ใช้งาน' : 'ปิดใช้งาน'}</Tag>,
    },
    {
      title: '', key: 'action', width: 100,
      render: (_: unknown, r: SubgroupRow) => (
        <Space size={4}>
          <Button
            size="small" icon={<EditOutlined />}
            onClick={() => { setEditSubgroup(r); editSubgroupForm.setFieldsValue({ subgroup_name: r.subgroup_name, is_head: !!r.is_head }) }}
          />
          {r.is_active && (
            <Popconfirm title="ยืนยันปิดใช้งาน Subgroup นี้?" onConfirm={() => handleDeactivateSubgroup(r)}>
              <Button size="small" danger icon={<StopOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Modal
        title={<span style={{ color: '#1e3a8a', fontWeight: 700 }}>
          Cost Code — {jobType ? jobType.label : ''}
        </span>}
        open={open}
        onCancel={onClose}
        width={900}
        destroyOnClose
        footer={<Button onClick={onClose}>ปิด</Button>}
      >
        {unbacked ? (
          <Empty description="ยังไม่มีข้อมูล Cost Code สำหรับประเภทนี้" />
        ) : (
          <>
            {subjectCodes.length > 1 && (
              <PanelTabs className="panel-tabs-nav-only"
                activeKey={activeSubjectCode ?? undefined}
                onChange={(key) => setActiveSubjectCode(key)}
                items={subjectTabItems}
                style={{ marginBottom: 4 }}
              />
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Button
                type="primary" icon={<PlusOutlined />}
                disabled={!jobId}
                onClick={() => { addGroupForm.resetFields(); setAddGroupOpen(true) }}
              >
                เพิ่ม Group
              </Button>
            </div>
            {majorRow && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 16px',
                background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
              }}>
                <Tag color="#7c3aed" style={{ margin: 0, fontWeight: 600 }}>Major</Tag>
                <Text strong style={{ color: '#1e3a8a' }}>{majorCode}</Text>
                <Text>{majorRow.subgroup_name}</Text>
              </div>
            )}
            <Table
              rowKey="id"
              loading={loading}
              dataSource={visibleGroups}
              columns={groupColumns}
              pagination={false}
              size="small"
              expandable={{
                expandedRowKeys: expandedKeys,
                onExpand: handleExpand,
                expandedRowRender: (record: GroupRow) => (
                  <Table
                    rowKey="id"
                    loading={!!subgroupsLoading[record.id]}
                    dataSource={(subgroupsByGroup[record.id] ?? []).filter((r) => !r.is_major)}
                    columns={subgroupColumns}
                    onRow={(r: SubgroupRow) => (r.is_head ? { style: { background: '#eff6ff' } } : {})}
                    pagination={false}
                    size="small"
                    locale={{ emptyText: 'ยังไม่มี Subgroup' }}
                  />
                ),
              }}
              locale={{ emptyText: 'ยังไม่มี Group' }}
            />
          </>
        )}
      </Modal>

      {/* Add Group */}
      <Modal
        title="เพิ่ม Group"
        open={addGroupOpen}
        onCancel={() => setAddGroupOpen(false)}
        onOk={handleAddGroup}
        confirmLoading={addGroupSaving}
        destroyOnClose
      >
        <Form form={addGroupForm} layout="vertical">
          <Form.Item name="group_code" label="รหัส Group" rules={[{ required: true, message: 'กรุณากรอกรหัส Group' }]}>
            <Input placeholder="เช่น 01" maxLength={5} />
          </Form.Item>
          <Form.Item name="group_name" label="ชื่อ Group" rules={[{ required: true, message: 'กรุณากรอกชื่อ Group' }]}>
            <Input placeholder="ชื่อ Group" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Group */}
      <Modal
        title="แก้ไข Group"
        open={!!editGroup}
        onCancel={() => setEditGroup(null)}
        onOk={handleEditGroup}
        confirmLoading={editGroupSaving}
        destroyOnClose
      >
        <Form form={editGroupForm} layout="vertical">
          {editGroup && <Text type="secondary">รหัส Group: {editGroup.group_code}</Text>}
          <Form.Item name="group_name" label="ชื่อ Group" rules={[{ required: true, message: 'กรุณากรอกชื่อ Group' }]} style={{ marginTop: 8 }}>
            <Input placeholder="ชื่อ Group" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Subgroup */}
      <Modal
        title={`เพิ่ม Subgroup${addSubgroupForGroup ? ` — ${addSubgroupForGroup.group_name}` : ''}`}
        open={!!addSubgroupForGroup}
        onCancel={() => setAddSubgroupForGroup(null)}
        onOk={handleAddSubgroup}
        confirmLoading={addSubgroupSaving}
        destroyOnClose
      >
        <Form form={addSubgroupForm} layout="vertical" initialValues={{ is_head: false }}>
          <Form.Item name="subgroup_code" label="รหัส Subgroup" rules={[{ required: true, message: 'กรุณากรอกรหัส Subgroup' }]}>
            <Input placeholder="เช่น 01" maxLength={5} />
          </Form.Item>
          <Form.Item name="subgroup_name" label="ชื่อ Subgroup" rules={[{ required: true, message: 'กรุณากรอกชื่อ Subgroup' }]}>
            <Input placeholder="ชื่อ Subgroup" />
          </Form.Item>
          <HeadSwitchField form={addSubgroupForm} />
        </Form>
      </Modal>

      {/* Edit Subgroup */}
      <Modal
        title="แก้ไข Subgroup"
        open={!!editSubgroup}
        onCancel={() => setEditSubgroup(null)}
        onOk={handleEditSubgroup}
        confirmLoading={editSubgroupSaving}
        destroyOnClose
      >
        <Form form={editSubgroupForm} layout="vertical">
          {editSubgroup && <Text type="secondary">รหัส Subgroup: {editSubgroup.subgroup_code}</Text>}
          <Form.Item name="subgroup_name" label="ชื่อ Subgroup" rules={[{ required: true, message: 'กรุณากรอกชื่อ Subgroup' }]} style={{ marginTop: 8 }}>
            <Input placeholder="ชื่อ Subgroup" />
          </Form.Item>
          <HeadSwitchField form={editSubgroupForm} />
        </Form>
      </Modal>
    </>
  )
}

export default CostCodeJobTypeModal
