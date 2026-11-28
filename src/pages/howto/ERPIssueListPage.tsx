import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, DatePicker, Input, Segmented, Select, Space, Table, Tag, Grid, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PaperClipOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { erpIssueService, erpIssueErrText, type ERPIssueListParams } from '@/services/erpIssueService'
import {
  ERP_ISSUE_STATUS, ERP_ISSUE_TYPE_LABEL, ERP_ISSUE_TYPE_OPTIONS, formatIssueMenu,
  type ERPIssue, type ERPIssueStatus,
} from '@/types/erpIssue'

const MENU_CODE = 'MENU_ERP_ISSUE'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

type UserScope = 'mine' | 'approval'

interface Props {
  /** true = Administration › จัดการใบแจ้งปัญหา ERP (every ticket); false = How To use (own tickets + create). */
  admin?: boolean
}

const ERPIssueListPage: React.FC<Props> = ({ admin = false }) => {
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false

  const [scope, setScope] = useState<UserScope>('mine')
  const [status, setStatus] = useState<string | undefined>()
  const [issueType, setIssueType] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [rows, setRows] = useState<ERPIssue[]>([])
  const [loading, setLoading] = useState(false)

  // admin: the status filter is applied client-side so the per-status counts stay visible
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: ERPIssueListParams = { scope: admin ? 'all' : scope }
      if (!admin && status) params.status = status
      if (issueType) params.issue_type = issueType
      if (search.trim()) params.search = search.trim()
      if (range?.[0]) params.date_from = range[0].format('YYYY-MM-DD')
      if (range?.[1]) params.date_to = range[1].format('YYYY-MM-DD')
      setRows(await erpIssueService.list(params))
    } catch (err) {
      message.error(erpIssueErrText(err, 'โหลดรายการใบแจ้งปัญหาไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }, [admin, scope, status, issueType, search, range])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.status] = (m[r.status] ?? 0) + 1 })
    return m
  }, [rows])
  const shown = admin && status ? rows.filter((r) => r.status === status) : rows

  const columns: ColumnsType<ERPIssue> = [
    {
      title: 'เลขที่', dataIndex: 'issue_no', width: 150,
      render: (v: string) => <span style={{ fontWeight: 600, color: '#1d4ed8' }}>{v}</span>,
    },
    {
      title: 'วันที่แจ้ง', dataIndex: 'reported_at', width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'ผู้แจ้ง', dataIndex: 'reported_by_name', width: 180,
      render: (v: string | null, r) => (
        <span>{v || '-'}{admin && r.reported_dept ? <div style={{ color: '#6b7280', fontSize: 12 }}>{r.reported_dept}</div> : null}</span>
      ),
    },
    {
      title: 'ประเภท', dataIndex: 'issue_type', width: 140,
      render: (v: ERPIssue['issue_type']) => (
        <Tag color={v === 'NEW_MODULE' ? 'purple' : v === 'BUG' ? 'red' : 'blue'}>{ERP_ISSUE_TYPE_LABEL[v] ?? v}</Tag>
      ),
    },
    {
      title: 'เมนู / Module', key: 'menu', width: 220,
      render: (_, r) => (r.issue_type === 'NEW_MODULE' && r.module_name
        ? <span>{r.module_name}{r.menu_name ? <span style={{ color: '#6b7280' }}> ({formatIssueMenu(r)})</span> : null}</span>
        : formatIssueMenu(r)),
    },
    {
      title: 'หัวข้อ', dataIndex: 'title', ellipsis: true,
      render: (v: string, r) => (
        <span>{v}{r.attachment_count > 0 && <PaperClipOutlined style={{ marginLeft: 6, color: '#6b7280' }} />}</span>
      ),
    },
    {
      title: 'สถานะ', dataIndex: 'status', width: 130,
      render: (v: ERPIssueStatus) => <Tag color={ERP_ISSUE_STATUS[v]?.color}>{ERP_ISSUE_STATUS[v]?.label ?? v}</Tag>,
    },
    ...(admin
      ? [{
          title: 'ผู้ดำเนินการ', dataIndex: 'handled_by_name', width: 150,
          render: (v: string | null) => v || '-',
        }]
      : []),
  ]

  const detailPath = (r: ERPIssue) => {
    if (admin) return `/admin/erp-issues/${r.id}`
    return scope === 'approval' ? `/howto/issues/${r.id}?for_approval=true` : `/howto/issues/${r.id}`
  }

  return (
    <div>
      <PageHeader
        title={admin ? 'จัดการใบแจ้งปัญหา ERP' : 'ใบแจ้งปัญหาการใช้งาน ERP'}
        breadcrumbs={admin
          ? [{ title: 'Administration' }, { title: 'จัดการใบแจ้งปัญหา ERP' }]
          : [{ title: 'How To use' }, { title: 'ใบแจ้งปัญหาการใช้งาน ERP' }]}
        extra={!admin && (
          <PermissionButton
            menuCode={MENU_CODE}
            action="write"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/howto/issues/new')}
          >
            แจ้งปัญหาใหม่
          </PermissionButton>
        )}
      />

      <Card style={cardStyle}>
        {admin && (
          <div style={{ overflowX: 'auto', marginBottom: 12 }}>
            <Segmented
              value={status ?? ''}
              onChange={(v) => setStatus((v as string) || undefined)}
              options={[
                { value: '', label: `ทั้งหมด (${rows.length})` },
                ...(['PENDING', 'IN_PROGRESS', 'PREVIEW', 'PENDING_APPROVAL', 'RESOLVED', 'CLOSED', 'REJECTED'] as ERPIssueStatus[])
                  .map((s) => ({ value: s, label: `${ERP_ISSUE_STATUS[s].label} (${counts[s] ?? 0})` })),
              ]}
            />
          </div>
        )}
        <Space wrap style={{ marginBottom: 16 }} size={[8, 8]}>
          {!admin && (
            <>
              <Segmented
                value={scope}
                options={[{ value: 'mine', label: 'ของฉัน' }, { value: 'approval', label: 'รอฉันอนุมัติ' }]}
                onChange={(v) => setScope(v as UserScope)}
              />
              <Select
                allowClear placeholder="สถานะ" style={{ width: 160 }} value={status} onChange={setStatus}
                options={Object.entries(ERP_ISSUE_STATUS).map(([value, s]) => ({ value, label: s.label }))}
              />
            </>
          )}
          <Select
            allowClear placeholder="ประเภท" style={{ width: 200 }} value={issueType} onChange={setIssueType}
            options={ERP_ISSUE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: ERP_ISSUE_TYPE_LABEL[o.value] }))}
          />
          <DatePicker.RangePicker
            format="DD/MM/YYYY" value={range} onChange={(v) => setRange(v as [Dayjs | null, Dayjs | null] | null)}
          />
          <Input.Search
            allowClear placeholder="ค้นหาเลขที่ / หัวข้อ / ผู้แจ้ง / เมนู" style={{ width: isMobile ? '100%' : 280 }}
            onSearch={setSearch}
          />
        </Space>

        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={shown}
          scroll={{ x: admin ? 1250 : 1100 }}
          pagination={{ pageSize: 20, showTotal: (t) => `ทั้งหมด ${t} รายการ` }}
          onRow={(r) => ({ style: { cursor: 'pointer' }, onClick: () => navigate(detailPath(r)) })}
        />
      </Card>
    </div>
  )
}

export default ERPIssueListPage
