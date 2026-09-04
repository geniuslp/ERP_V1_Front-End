import React, { useEffect, useState, useCallback } from 'react'
import { Modal, Table, Button, Space, Empty, Input, Form, Popconfirm, message, Tag, Typography } from 'antd'
import { PlusOutlined, EditOutlined, StopOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useAppSelector } from '@/store'
import type { JobTypeOption } from '@/constants/jobTypes'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const { Text } = Typography

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
}

interface Props {
  open: boolean
  onClose: () => void
  jobType: JobTypeOption | null
}

const CostCodeJobTypeModal: React.FC<Props> = ({ open, onClose, jobType }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [loading, setLoading] = useState(false)
  // Resolved once per open — the numeric job_id backing this Job Type's
  // filterSubjectCode/filterJobCode. null when the Job Type has no backing
  // cost_subject/cost_job yet (the 6 unbacked codes) — shows an Empty state.
  const [jobId, setJobId] = useState<number | null>(null)
  const [unbacked, setUnbacked] = useState(false)
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

  const fetchGroups = useCallback(async (jid: number) => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/master/cost-code/groups`, {
        params: { job_id: jid },
        headers: authHeader,
      })
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
      setGroups(Array.isArray(list) ? list : [])
    } catch {
      message.error('โหลดข้อมูล Group ไม่สำเร็จ')
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  const fetchSubgroups = useCallback(async (groupId: number) => {
    setSubgroupsLoading((p) => ({ ...p, [groupId]: true }))
    try {
      const res = await axios.get(`${BASE_URL}/master/cost-code/subgroups`, {
        params: { group_id: groupId },
        headers: authHeader,
      })
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
      setSubgroupsByGroup((p) => ({ ...p, [groupId]: Array.isArray(list) ? list : [] }))
    } catch {
      message.error('โหลดข้อมูล Subgroup ไม่สำเร็จ')
    } finally {
      setSubgroupsLoading((p) => ({ ...p, [groupId]: false }))
    }
  }, [accessToken])

  // Resolve subject_code + job_code (from JOB_TYPES) to their numeric
  // subject_id/job_id, then load groups. null filters (the 6 unbacked codes)
  // skip resolution entirely and show the Empty state instead.
  useEffect(() => {
    if (!open || !jobType || !accessToken) return
    setGroups([])
    setSubgroupsByGroup({})
    setExpandedKeys([])
    setJobId(null)
    setUnbacked(false)

    if (!jobType.filterSubjectCode || !jobType.filterJobCode) {
      setUnbacked(true)
      return
    }

    const resolve = async () => {
      setLoading(true)
      try {
        const subjRes = await axios.get(`${BASE_URL}/master/cost-code/subjects`, { headers: authHeader })
        const subjects = Array.isArray(subjRes.data) ? subjRes.data : subjRes.data?.data ?? []
        const subject = subjects.find((s: any) => s.subject_code === jobType.filterSubjectCode)
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
  }, [open, jobType, accessToken, fetchGroups])

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
    setAddSubgroupSaving(true)
    try {
      await axios.post(`${BASE_URL}/master/cost-code/subgroups`, {
        group_id: addSubgroupForGroup.id, subgroup_code: values.subgroup_code, subgroup_name: values.subgroup_name,
      }, { headers: authHeader })
      message.success('เพิ่ม Subgroup สำเร็จ')
      const gid = addSubgroupForGroup.id
      setAddSubgroupForGroup(null)
      addSubgroupForm.resetFields()
      fetchSubgroups(gid)
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'เพิ่ม Subgroup ไม่สำเร็จ')
    } finally {
      setAddSubgroupSaving(false)
    }
  }

  const handleEditSubgroup = async () => {
    if (!editSubgroup) return
    const values = await editSubgroupForm.validateFields()
    setEditSubgroupSaving(true)
    try {
      await axios.patch(`${BASE_URL}/master/cost-code/subgroups/${editSubgroup.id}`, {
        subgroup_name: values.subgroup_name,
      }, { headers: authHeader })
      message.success('แก้ไข Subgroup สำเร็จ')
      const gid = editSubgroup.group_id
      setEditSubgroup(null)
      fetchSubgroups(gid)
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'แก้ไข Subgroup ไม่สำเร็จ')
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

  const subgroupColumns = [
    { title: 'รหัส Subgroup', dataIndex: 'subgroup_code', width: 140 },
    { title: 'ชื่อ Subgroup', dataIndex: 'subgroup_name' },
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
            onClick={() => { setEditSubgroup(r); editSubgroupForm.setFieldsValue({ subgroup_name: r.subgroup_name }) }}
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Button
                type="primary" icon={<PlusOutlined />}
                disabled={!jobId}
                onClick={() => { addGroupForm.resetFields(); setAddGroupOpen(true) }}
              >
                เพิ่ม Group
              </Button>
            </div>
            <Table
              rowKey="id"
              loading={loading}
              dataSource={groups}
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
                    dataSource={subgroupsByGroup[record.id] ?? []}
                    columns={subgroupColumns}
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
        <Form form={addSubgroupForm} layout="vertical">
          <Form.Item name="subgroup_code" label="รหัส Subgroup" rules={[{ required: true, message: 'กรุณากรอกรหัส Subgroup' }]}>
            <Input placeholder="เช่น 01" maxLength={5} />
          </Form.Item>
          <Form.Item name="subgroup_name" label="ชื่อ Subgroup" rules={[{ required: true, message: 'กรุณากรอกชื่อ Subgroup' }]}>
            <Input placeholder="ชื่อ Subgroup" />
          </Form.Item>
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
        </Form>
      </Modal>
    </>
  )
}

export default CostCodeJobTypeModal
