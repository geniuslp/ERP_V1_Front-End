import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Button, Table, Select, Input, Modal, Form, message, Tooltip } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAppSelector } from '@/store'
import { approvalDelegationService } from '@/services/approvalDelegation.service'
import { approvalConfigService } from '@/services/approvalConfig.service'
import { permissionMatrixService } from '@/services/permissionMatrix.service'
import type { ApprovalExtraApprover } from '@/types'
import type { ApprovalDocType } from '@/types/approval.types'

const { TextArea } = Input

type UserOption = { id: number; username: string; full_name: string; department: string }

type FormValues = {
  userId: number
  docType: string | null
  reason?: string
}

const ActionsCell: React.FC<{
  approver: ApprovalExtraApprover
  onDelete: (a: ApprovalExtraApprover) => void
}> = React.memo(({ approver, onDelete }) => (
  <Tooltip title="ลบ">
    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(approver)} />
  </Tooltip>
))
ActionsCell.displayName = 'ActionsCell'

const ApprovalExtraApproverTab: React.FC = () => {
  const accessToken =
    useAppSelector((s) => s.auth.tokens?.accessToken) ??
    sessionStorage.getItem('accessToken') ??
    ''

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [approvers, setApprovers] = useState<ApprovalExtraApprover[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [docTypes, setDocTypes] = useState<ApprovalDocType[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<FormValues>()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [ap, ul, dt] = await Promise.all([
        approvalDelegationService.getExtraApprovers(accessToken),
        permissionMatrixService.getUsers(accessToken),
        approvalConfigService.getDocTypes(accessToken),
      ])
      setApprovers(ap)
      setUsers(ul)
      setDocTypes(dt)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ',
      )
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { fetchAll() }, [fetchAll])

  const userMap = useMemo(() => {
    const map = new Map<number, UserOption>()
    for (const u of users) map.set(u.id, u)
    return map
  }, [users])

  const docTypeLabel = useCallback(
    (docType: string | null) => {
      if (docType === null) return 'ทั้งหมด'
      return docTypes.find((d) => d.doc_type === docType)?.doc_label ?? docType
    },
    [docTypes],
  )

  const userOptions = useMemo(
    () => users.map((u) => ({ value: u.id, label: `${u.full_name} (${u.username})` })),
    [users],
  )

  const docTypeOptions = useMemo(
    () => [{ value: '__ALL__', label: 'ทั้งหมด' }, ...docTypes.map((d) => ({ value: d.doc_type, label: d.doc_label }))],
    [docTypes],
  )

  const openCreateModal = useCallback(() => {
    form.resetFields()
    setModalOpen(true)
  }, [form])

  const handleDelete = useCallback((a: ApprovalExtraApprover) => {
    Modal.confirm({
      title: 'ยืนยันการลบผู้อนุมัติพิเศษคนนี้?',
      content: `${a.userName} — ${docTypeLabel(a.docType)}`,
      okText: 'ลบ',
      cancelText: 'ยกเลิก',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await approvalDelegationService.deleteExtraApprover(accessToken, a.id)
          setApprovers((prev) => prev.filter((x) => x.id !== a.id))
          message.success('ลบผู้อนุมัติพิเศษสำเร็จ')
        } catch (err: any) {
          message.error(
            err?.response?.data?.message || err?.response?.data?.error || err?.message || 'ลบไม่สำเร็จ กรุณาลองใหม่',
          )
        }
      },
    })
  }, [accessToken, docTypeLabel])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      setSubmitting(true)
      try {
        const user = userMap.get(values.userId)
        const created = await approvalDelegationService.createExtraApprover(accessToken, {
          docType: values.docType === '__ALL__' ? null : values.docType,
          userId: values.userId,
          userName: user?.full_name ?? '',
          reason: values.reason?.trim() || undefined,
        })
        setApprovers((prev) => [...prev, created])
        message.success('เพิ่มผู้อนุมัติพิเศษสำเร็จ')
        setModalOpen(false)
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่',
        )
      } finally {
        setSubmitting(false)
      }
    } catch {
      // form validation error — antd already highlights the fields
    }
  }

  const columns: ColumnsType<ApprovalExtraApprover> = [
    { title: 'ผู้อนุมัติเพิ่ม', dataIndex: 'userName', key: 'userName' },
    {
      title: 'เอกสาร',
      dataIndex: 'docType',
      key: 'docType',
      render: (v: string | null) => docTypeLabel(v),
    },
    {
      title: 'เหตุผล',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'จัดการ',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_: unknown, record: ApprovalExtraApprover) => (
        <ActionsCell approver={record} onDelete={handleDelete} />
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
          style={{ background: '#1d4ed8', border: 'none' }}
        >
          เพิ่มผู้อนุมัติพิเศษ
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={approvers}
        columns={columns}
        pagination={false}
        size="small"
        scroll={{ x: 600 }}
      />

      <Modal
        title="เพิ่มผู้อนุมัติพิเศษ"
        open={modalOpen}
        onCancel={() => !submitting && setModalOpen(false)}
        onOk={handleSubmit}
        okText="บันทึก"
        cancelText="ยกเลิก"
        okButtonProps={{ loading: submitting, style: { background: '#1d4ed8', border: 'none' } }}
        closable={!submitting}
        destroyOnHidden
        width={480}
      >
        <Form form={form} layout="vertical" initialValues={{ docType: '__ALL__' }}>
          <Form.Item
            name="userId"
            label="เลือกผู้ใช้"
            rules={[{ required: true, message: 'กรุณาเลือกผู้ใช้' }]}
          >
            <Select
              showSearch
              placeholder="เลือกผู้ใช้"
              options={userOptions}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item name="docType" label="ประเภทเอกสาร" rules={[{ required: true }]}>
            <Select options={docTypeOptions} />
          </Form.Item>

          <Form.Item name="reason" label="เหตุผล">
            <TextArea rows={3} placeholder="เช่น ช่วยอนุมัติช่วงงานเร่งด่วน" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ApprovalExtraApproverTab
