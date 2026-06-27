import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Button, Space, Table, Switch, Select, Tooltip, Popconfirm, Modal, message, Badge } from 'antd'
import {
  AppstoreOutlined, ReloadOutlined, CheckOutlined, CloseOutlined,
  PlusOutlined, DeleteOutlined, TeamOutlined, SaveOutlined, UndoOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAppSelector } from '@/store'
import PageHeader from '@/components/common/PageHeader'
import MatrixGrid from '@/components/approval/MatrixGrid'
import DocTypeModal from '@/components/approval/DocTypeModal'
import RoleModal from '@/components/approval/RoleModal'
import { approvalConfigService } from '@/services/approvalConfig.service'
import type { ApprovalDocType, ApprovalConfig, ApprovalRole, CreateRolePayload } from '@/types/approval.types'

// cellKey format: `${docType}|${roleId}`
const makeCellKey = (docType: string, roleId: number) => `${docType}|${roleId}`
const parseCellKey = (key: string): { docType: string; roleId: number } => {
  const sep = key.indexOf('|')
  return { docType: key.slice(0, sep), roleId: parseInt(key.slice(sep + 1)) }
}

const ApprovalMatrix: React.FC = () => {
  const accessToken =
    useAppSelector((s) => s.auth.tokens?.accessToken) ??
    sessionStorage.getItem('accessToken') ??
    ''

  // ── Data ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [docTypes, setDocTypes] = useState<ApprovalDocType[]>([])
  const [roles, setRoles] = useState<ApprovalRole[]>([])
  const [serverConfigs, setServerConfigs] = useState<ApprovalConfig[]>([])

  // ── Draft state ───────────────────────────────────────────────
  const [pendingAdds, setPendingAdds] = useState<Set<string>>(new Set())
  const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)

  // ── Modal open state ──────────────────────────────────────────
  const [docTypeModalOpen, setDocTypeModalOpen] = useState(false)
  const [roleModalOpen, setRoleModalOpen] = useState(false)

  // ── Table filters ─────────────────────────────────────────────
  const [filterDocType, setFilterDocType] = useState<string>('')
  const [filterRole, setFilterRole] = useState<number | ''>('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [dt, rl, cf] = await Promise.all([
        approvalConfigService.getDocTypes(accessToken),
        approvalConfigService.getRoles(accessToken),
        approvalConfigService.getConfigs(accessToken),
      ])
      setDocTypes(dt)
      setRoles(rl)
      setServerConfigs(cf)
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'โหลดข้อมูลไม่สำเร็จ',
      )
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Draft: cell click (no API call) ───────────────────────────
  const handleCellClick = (docType: string, roleId: number) => {
    const cellKey = makeCellKey(docType, roleId)
    const existingConfig = serverConfigs.find(
      (c) => c.doc_type === docType && c.approver_role_id === roleId,
    )

    if (pendingAdds.has(cellKey)) {
      setPendingAdds((prev) => { const next = new Set(prev); next.delete(cellKey); return next })
      return
    }

    if (existingConfig && pendingDeletes.has(existingConfig.id)) {
      setPendingDeletes((prev) => { const next = new Set(prev); next.delete(existingConfig.id); return next })
      return
    }

    if (existingConfig) {
      setPendingDeletes((prev) => new Set([...prev, existingConfig.id]))
      return
    }

    setPendingAdds((prev) => new Set([...prev, cellKey]))
  }

  const hasDiff = pendingAdds.size > 0 || pendingDeletes.size > 0
  const diffCount = pendingAdds.size + pendingDeletes.size

  const handleCancelDraft = () => {
    setPendingAdds(new Set())
    setPendingDeletes(new Set())
  }

  // ── Diff summary for confirm modal ────────────────────────────
  const diffSummary = useMemo(() => {
    const adds = Array.from(pendingAdds).map((key) => {
      const { docType, roleId } = parseCellKey(key)
      const role = roles.find((r) => r.id === roleId)
      const dt = docTypes.find((d) => d.doc_type === docType)
      return { role: role?.role_name ?? String(roleId), docLabel: dt?.doc_label ?? docType }
    })

    const deletes = Array.from(pendingDeletes)
      .map((id) => {
        const config = serverConfigs.find((c) => c.id === id)
        if (!config) return null
        const role = roles.find((r) => r.id === config.approver_role_id)
        const dt = docTypes.find((d) => d.doc_type === config.doc_type)
        return {
          role: role?.role_name ?? String(config.approver_role_id),
          docLabel: dt?.doc_label ?? config.doc_type,
        }
      })
      .filter((x): x is { role: string; docLabel: string } => x !== null)

    return { adds, deletes }
  }, [pendingAdds, pendingDeletes, roles, docTypes, serverConfigs])

  // ── Batch submit ──────────────────────────────────────────────
  const handleSubmitBatch = async () => {
    setSubmitting(true)
    try {
      const creates = Array.from(pendingAdds).map((key) => {
        const { docType, roleId } = parseCellKey(key)
        return { doc_type: docType, approver_role_id: roleId }
      })
      const deletes = Array.from(pendingDeletes)

      await approvalConfigService.batchUpdate(accessToken, { create: creates, delete: deletes })

      const newConfigs = await approvalConfigService.getConfigs(accessToken)
      setServerConfigs(newConfigs)
      setPendingAdds(new Set())
      setPendingDeletes(new Set())
      setConfirmOpen(false)
      message.success(
        `บันทึกสำเร็จ${creates.length ? ` — เพิ่ม ${creates.length} Rule` : ''}${deletes.length ? ` ลบ ${deletes.length} Rule` : ''}`,
      )
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'บันทึกไม่สำเร็จ กรุณาลองใหม่',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── Table operations (immediate, bypass draft) ─────────────────
  const handleTableToggle = async (cfg: ApprovalConfig, next: boolean) => {
    setServerConfigs((prev) => prev.map((c) => (c.id === cfg.id ? { ...c, is_active: next } : c)))
    try {
      await approvalConfigService.toggleConfig(accessToken, cfg.id, next)
      message.success(next ? 'เปิดใช้งาน Rule แล้ว' : 'ปิดใช้งาน Rule แล้ว')
    } catch (err: any) {
      setServerConfigs((prev) => prev.map((c) => (c.id === cfg.id ? { ...c, is_active: cfg.is_active } : c)))
      message.error(err?.response?.data?.message || err?.message || 'เกิดข้อผิดพลาด')
    }
  }

  const handleTableDelete = async (cfg: ApprovalConfig) => {
    setServerConfigs((prev) => prev.filter((c) => c.id !== cfg.id))
    setPendingDeletes((prev) => { const next = new Set(prev); next.delete(cfg.id); return next })
    try {
      await approvalConfigService.deleteConfig(accessToken, cfg.id)
      message.success('ลบ Rule สำเร็จ')
    } catch (err: any) {
      setServerConfigs((prev) => [...prev, cfg])
      message.error(err?.response?.data?.message || err?.message || 'ลบ Rule ไม่สำเร็จ')
    }
  }

  // ── DocType handlers ──────────────────────────────────────────
  const handleDocTypeToggle = async (id: number, is_active: boolean) => {
    const prev = docTypes.find((d) => d.id === id)
    setDocTypes((dt) => dt.map((d) => (d.id === id ? { ...d, is_active } : d)))
    try {
      await approvalConfigService.toggleDocType(accessToken, id, is_active)
      message.success(is_active ? 'เปิดประเภทเอกสารแล้ว' : 'ปิดประเภทเอกสารแล้ว')
    } catch (err: any) {
      if (prev) setDocTypes((dt) => dt.map((d) => (d.id === id ? prev : d)))
      message.error(err?.response?.data?.message || err?.message || 'เกิดข้อผิดพลาด')
      throw err
    }
  }

  const handleDocTypeAdd = async (body: Omit<ApprovalDocType, 'id'>) => {
    try {
      const created = await approvalConfigService.createDocType(accessToken, body)
      setDocTypes((dt) => [...dt, created])
      message.success(`เพิ่ม "${created.doc_label}" สำเร็จ — คอลัมน์ใหม่โผล่ใน Matrix แล้ว`)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'เพิ่มประเภทเอกสารไม่สำเร็จ')
      throw err
    }
  }

  // ── Role handlers ─────────────────────────────────────────────
  const handleRoleToggle = async (id: number, is_active: boolean) => {
    const prev = roles.find((r) => r.id === id)
    setRoles((rl) => rl.map((r) => (r.id === id ? { ...r, is_active } : r)))
    try {
      await approvalConfigService.toggleRole(accessToken, id, is_active)
      message.success(is_active ? 'เปิด Role แล้ว' : 'ปิด Role แล้ว')
    } catch (err: any) {
      if (prev) setRoles((rl) => rl.map((r) => (r.id === id ? prev : r)))
      message.error(err?.response?.data?.message || err?.message || 'เกิดข้อผิดพลาด')
      throw err
    }
  }

  const handleRoleAdd = async (payload: CreateRolePayload) => {
    try {
      const created = await approvalConfigService.createRole(accessToken, payload)
      setRoles((rl) => [...rl, created])
      message.success(`เพิ่ม Role "${created.role_name}" สำเร็จ — row ใหม่โผล่ใน Matrix แล้ว`)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'เพิ่ม Role ไม่สำเร็จ')
      throw err
    }
  }

  const handleRoleDelete = async (id: number) => {
    const prev = roles.find((r) => r.id === id)
    setRoles((rl) => rl.filter((r) => r.id !== id))
    try {
      await approvalConfigService.deleteRole(accessToken, id)
      message.success('ลบ Role สำเร็จ')
    } catch (err: any) {
      if (prev) setRoles((rl) => [...rl, prev])
      message.error(err?.response?.data?.message || err?.message || 'ลบ Role ไม่สำเร็จ')
    }
  }

  // ── Table ─────────────────────────────────────────────────────
  const docTypeLabel = (dt: string) => docTypes.find((d) => d.doc_type === dt)?.doc_label ?? dt
  const roleName = (id: number) => roles.find((r) => r.id === id)?.role_name ?? String(id)

  const filteredConfigs = serverConfigs.filter((c) => {
    if (filterDocType && c.doc_type !== filterDocType) return false
    if (filterRole !== '' && c.approver_role_id !== filterRole) return false
    return true
  })

  const columns: ColumnsType<ApprovalConfig> = [
    {
      title: 'ประเภทเอกสาร',
      dataIndex: 'doc_type',
      key: 'doc_type',
      width: 180,
      render: (v: string) => docTypeLabel(v),
    },
    {
      title: 'Role',
      dataIndex: 'approver_role_id',
      key: 'approver_role_id',
      width: 180,
      render: (v: number) => roleName(v),
    },
    { title: 'Step', dataIndex: 'step_no', key: 'step_no', width: 60, align: 'center' },
    { title: 'ชื่อ Step', dataIndex: 'step_name', key: 'step_name' },
    {
      title: 'เปิดใช้',
      key: 'is_active',
      width: 80,
      align: 'center',
      render: (_: unknown, record: ApprovalConfig) => (
        <Switch
          size="small"
          checked={record.is_active}
          onChange={(checked) => handleTableToggle(record, checked)}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      align: 'center',
      render: (_: unknown, record: ApprovalConfig) => (
        <Popconfirm
          title="ยืนยันการลบ"
          description="Rule นี้จะถูกลบถาวร"
          okText="ลบ"
          cancelText="ยกเลิก"
          okButtonProps={{ danger: true }}
          onConfirm={() => handleTableDelete(record)}
        >
          <Tooltip title="ลบ">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ]

  // ── Legend items ──────────────────────────────────────────────
  const legendItems = [
    { bg: '#f6ffed', border: '1.5px solid #52c41a',  icon: <CheckOutlined />, color: '#52c41a', label: 'มี Rule' },
    { bg: '#f0fdf4', border: '2px dashed #22c55e',   icon: <CheckOutlined />, color: '#22c55e', label: 'รอเพิ่ม (draft)' },
    { bg: '#fafafa', border: '1.5px dashed #d9d9d9', icon: <PlusOutlined />,  color: '#bfbfbf', label: 'ไม่มี Rule' },
  ]

  return (
    <div>
      <PageHeader
        title="Approval Matrix"
        subtitle="คลิก cell เพื่อเพิ่ม/ลบ Rule ใน draft — กด บันทึก เพื่อ submit ทั้งหมดพร้อมกัน"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Admin' }, { title: 'Approval Matrix' }]}
        extra={
          <Space>
            <Button icon={<TeamOutlined />} onClick={() => setRoleModalOpen(true)}>
              จัดการ Role
            </Button>
            <Button icon={<AppstoreOutlined />} onClick={() => setDocTypeModalOpen(true)}>
              จัดการประเภทเอกสาร
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>
              โหลดใหม่
            </Button>
          </Space>
        }
      />

      {/* ── Matrix Card ── */}
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ marginBottom: 16, fontWeight: 600, color: '#0f2d5e', fontSize: 15 }}>
          ภาพรวม Approval Matrix
        </div>

        <MatrixGrid
          docTypes={docTypes}
          roles={roles}
          configs={serverConfigs}
          pendingAdds={pendingAdds}
          pendingDeletes={pendingDeletes}
          loading={loading}
          onCellClick={handleCellClick}
        />

        {/* Legend + Action bar */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {legendItems.map(({ bg, border, icon, color, label }) => (
              <div
                key={label}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    background: bg,
                    border,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 10,
                    color,
                  }}
                >
                  {icon}
                </div>
                {label}
              </div>
            ))}
          </div>

          <Space>
            {hasDiff && (
              <Button icon={<UndoOutlined />} onClick={handleCancelDraft}>
                ยกเลิกการเปลี่ยนแปลง
              </Button>
            )}
            <Badge count={hasDiff ? diffCount : 0} size="small" offset={[-4, 4]}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                disabled={!hasDiff}
                onClick={() => setConfirmOpen(true)}
                style={hasDiff ? { background: '#1d4ed8', border: 'none' } : {}}
              >
                บันทึก
              </Button>
            </Badge>
          </Space>
        </div>
      </div>

      {/* ── Rules Table ── */}
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
          padding: 20,
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}
        >
          <span style={{ fontWeight: 600, color: '#0f2d5e', fontSize: 15 }}>รายการ Rules ทั้งหมด</span>
          <Select
            style={{ width: 190 }}
            placeholder="กรองตามประเภทเอกสาร"
            allowClear
            value={filterDocType || undefined}
            onChange={(v) => setFilterDocType(v ?? '')}
            options={docTypes.map((d) => ({ value: d.doc_type, label: d.doc_label }))}
          />
          <Select
            style={{ width: 190 }}
            placeholder="กรองตาม Role"
            allowClear
            value={filterRole || undefined}
            onChange={(v) => setFilterRole(v ?? '')}
            options={roles.map((r) => ({ value: r.id, label: r.role_name }))}
          />
        </div>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={filteredConfigs}
          columns={columns}
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
        />
      </div>

      {/* ── Confirm Submit Modal ── */}
      <Modal
        title="ยืนยันการเปลี่ยนแปลง"
        open={confirmOpen}
        onCancel={() => !submitting && setConfirmOpen(false)}
        onOk={handleSubmitBatch}
        okText="ยืนยัน"
        cancelText="ยกเลิก"
        okButtonProps={{ loading: submitting, style: { background: '#1d4ed8', border: 'none' } }}
        closable={!submitting}
        width={480}
      >
        {diffSummary.adds.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#15803d', marginBottom: 8, fontSize: 13 }}>
              เพิ่ม Rule ({diffSummary.adds.length} รายการ)
            </div>
            {diffSummary.adds.map((item, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', marginBottom: 4, fontSize: 13 }}
              >
                <PlusOutlined style={{ color: '#22c55e', fontSize: 11, flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>{item.role}</span>
                <span style={{ color: '#9ca3af' }}>→</span>
                <span>{item.docLabel}</span>
              </div>
            ))}
          </div>
        )}

        {diffSummary.deletes.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, color: '#b91c1c', marginBottom: 8, fontSize: 13 }}>
              ลบ Rule ({diffSummary.deletes.length} รายการ)
            </div>
            {diffSummary.deletes.map((item, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', marginBottom: 4, fontSize: 13 }}
              >
                <CloseOutlined style={{ color: '#ef4444', fontSize: 11, flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>{item.role}</span>
                <span style={{ color: '#9ca3af' }}>→</span>
                <span>{item.docLabel}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <DocTypeModal
        open={docTypeModalOpen}
        onClose={() => setDocTypeModalOpen(false)}
        docTypes={docTypes}
        onToggle={handleDocTypeToggle}
        onAdd={handleDocTypeAdd}
      />

      <RoleModal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        roles={roles}
        configs={serverConfigs}
        onToggle={handleRoleToggle}
        onAdd={handleRoleAdd}
        onDelete={handleRoleDelete}
      />
    </div>
  )
}

export default ApprovalMatrix
