import React, { useEffect, useRef, useState } from 'react'
import { Modal, Table, Tag, Spin, Tooltip, message } from 'antd'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import api from '@/services/api'
import type { ProjectStatus } from '@/types/project'
import { formatCostCodeDisplay } from '@/utils/costCode'
import CostCodePoLinesModal, { type CostCodePoLinesTarget } from './CostCodePoLinesModal'

export interface CostBudgetDetailLine {
  subgroup_id: number | null
  cost_code: string
  description: string
  budget: number
  // pu_cost = po_cost + pc_cost (petty cash charged to the cost code)
  po_cost?: number
  pc_cost?: number
  // Petty cash with no cost code; always the last row, row_type stays 'ITEM' on purpose.
  is_unassigned?: boolean
  pu_cost: number
  pu_bal: number
  ac_cost: number
  ac_bal: number
  // Flat ordered list from the API: MAJOR, then each group's HEAD followed by its ITEMs.
  row_type: CostBudgetRowType
}

export type CostBudgetRowType = 'MAJOR' | 'HEAD' | 'ITEM'

// MAJOR/HEAD rows are not selectable and have no POs, so only ITEM rows open the PO list.
const isItemRow = (r: CostBudgetDetailLine) => r.row_type === 'ITEM'

// The unassigned row has subgroup_id null, so it needs its own table key / modal id ("none").
const rowKeyOf = (r: CostBudgetDetailLine) => (r.is_unassigned ? 'none' : String(r.subgroup_id))

// Row-type colours (applied via .cb-row-major / .cb-row-head in the scoped <style> below):
// Major = purple, Head = amber. The same hues feed the legend swatches.
const ROW_COLOR = {
  MAJOR: { bg: '#F3E8FF', hover: '#E9D5FF', bar: '#7C3AED' },
  HEAD: { bg: '#FEF3C7', hover: '#FDE68A', bar: '#D97706' },
}
const ROW_TYPE_LABEL: Partial<Record<CostBudgetRowType, string>> = { MAJOR: 'Major', HEAD: 'Head' }
const INDENT: Record<CostBudgetRowType, number> = { MAJOR: 0, HEAD: 16, ITEM: 32 }

export interface CostBudgetDetailTotals {
  budget: number
  po_cost?: number
  pc_cost?: number
  pu_cost: number
  pu_bal: number
  ac_cost: number
  ac_bal: number
}

export interface CostBudgetDetailProject {
  project_code: string
  project_name: string
  status: ProjectStatus
  contract: string | null
  contact: string | null
  owner_name: string | null
  budget_amount: number
  start_date: string | null
  end_date: string | null
}

export interface CostBudgetDetailResponse {
  project: CostBudgetDetailProject
  rows: CostBudgetDetailLine[]
  totals: CostBudgetDetailTotals
}

interface Props {
  projectCode: string | null
  onClose: () => void
}
const thb = (n?: number) =>
  (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Same label/color mapping as POCostBudgetPage / ProjectListPage.
const statusColor: Record<ProjectStatus, string> = { ACTIVE: 'green', INACTIVE: 'default', CLOSED: 'red' }
const statusLabel: Record<ProjectStatus, string> = {
  ACTIVE: 'ดำเนินการ',
  INACTIVE: 'ไม่ใช้งาน',
  CLOSED: 'ปิดโครงการ',
}

const dash = <span style={{ color: '#9ca3af' }}>—</span>

const HeaderField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 12, color: '#60a5fa' }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e3a8a', wordBreak: 'break-word' }}>{children}</div>
  </div>
)

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 16,
}

const CostBudgetModal: React.FC<Props> = ({ projectCode, onClose }) => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CostBudgetDetailResponse | null>(null)
  const [poTarget, setPoTarget] = useState<CostCodePoLinesTarget | null>(null)
  const reqSeq = useRef(0)

  useEffect(() => {
    // reset on every open/close/switch; stale responses are ignored via reqSeq
    const seq = ++reqSeq.current
    setData(null)
    setPoTarget(null)
    if (!projectCode) {
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .get(`/po/${encodeURIComponent(projectCode)}/cost-budget-detail`)
      .then((res) => {
        if (seq !== reqSeq.current) return
        const body = res.data?.data ?? res.data
        setData({ project: body?.project, rows: body?.rows ?? [], totals: body?.totals })
      })
      .catch((err: any) => {
        if (seq !== reqSeq.current) return
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลงบประมาณต้นทุนไม่สำเร็จ')
      })
      .finally(() => {
        if (seq === reqSeq.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode])

  // Running number for ITEM rows only, from the full API list (stable; MAJOR/HEAD get none).
  const itemNo = new Map<string, number>()
  ;(data?.rows ?? []).filter(isItemRow).forEach((r, i) => itemNo.set(rowKeyOf(r), i + 1))

  const bal = (v: number) => <span style={{ color: v < 0 ? '#dc2626' : undefined }}>{thb(v)}</span>

  const columns: ColumnsType<CostBudgetDetailLine> = [
    {
      title: 'No.',
      key: 'no',
      width: 78,
      align: 'center',
      // First cell: Major/Head rows have no number, so it carries the row-type tooltip
      // (colour alone must not be the only cue).
      render: (_: unknown, r) =>
        isItemRow(r) ? (
          r.is_unassigned ? '' : itemNo.get(rowKeyOf(r)) ?? ''
        ) : (
          <Tooltip title={ROW_TYPE_LABEL[r.row_type]}>
            <span aria-label={ROW_TYPE_LABEL[r.row_type]} style={{ display: 'inline-block', minWidth: 32, minHeight: 20 }} />
          </Tooltip>
        ),
    },
    {
      title: 'CostCode',
      dataIndex: 'cost_code',
      key: 'cost_code',
      width: 182,
      render: (v: string, r) => r.is_unassigned ? (
        <span className="cb-item-link" style={{ paddingLeft: INDENT.ITEM, color: '#6b7280', fontStyle: 'italic', cursor: 'pointer' }}>
          ไม่ระบุรหัสต้นทุน
        </span>
      ) : !isItemRow(r) ? (
        <span style={{ paddingLeft: INDENT[r.row_type], fontWeight: 700, whiteSpace: 'nowrap' }}>
          {formatCostCodeDisplay(v)}
        </span>
      ) : (
        <span className="cb-item-link" style={{ paddingLeft: INDENT.ITEM, color: '#2563eb', cursor: 'pointer' }}>
          {formatCostCodeDisplay(v)}
        </span>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string, r) =>
        r.is_unassigned ? (
          <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>เงินสดย่อยที่ยังไม่ระบุรหัสต้นทุน</span>
        ) : isItemRow(r) ? (
          v
        ) : (
          <span style={{ fontWeight: 700 }}>{v}</span>
        ),
    },
    { title: 'Budget', dataIndex: 'budget', key: 'budget', align: 'right', render: (v: number) => thb(v) },
    {
      title: 'Pu.Cost',
      dataIndex: 'pu_cost',
      key: 'pu_cost',
      align: 'right',
      render: (v: number, r) => {
        const po = r.po_cost ?? 0
        const pc = r.pc_cost ?? 0
        // Split only when the API sent it; petty cash part hidden when 0.
        if (r.po_cost == null && r.pc_cost == null) return thb(v)
        const split = `PO ${thb(po)}${pc ? ` / เงินสดย่อย ${thb(pc)}` : ''}`
        return (
          <div>
            <div>{thb(v)}</div>
            <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{split}</div>
          </div>
        )
      },
    },
    { title: 'Pu.Bal', dataIndex: 'pu_bal', key: 'pu_bal', align: 'right', render: bal },
    { title: 'Ac.Cost', dataIndex: 'ac_cost', key: 'ac_cost', align: 'right', render: (v: number) => thb(v) },
    { title: 'Ac.Bal', dataIndex: 'ac_bal', key: 'ac_bal', align: 'right', render: bal },
  ]

  const p = data?.project
  const dateText =
    p && (p.start_date || p.end_date)
      ? `${p.start_date ? dayjs(p.start_date).format('DD/MM/YY') : '—'} - ${p.end_date ? dayjs(p.end_date).format('DD/MM/YY') : '—'}`
      : null
  // Calendar days from start_date to end_date; "—" unless both dates are present.
  const durationText =
    p?.start_date && p?.end_date
      ? `${dayjs(p.end_date).startOf('day').diff(dayjs(p.start_date).startOf('day'), 'day').toLocaleString('th-TH')} วัน`
      : null

  return (
    <Modal
      open={!!projectCode}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={1430}
      style={{ maxWidth: '95vw' }}
      title="งบประมาณต้นทุน"
    >
      {p && (
        <div
          style={{
            background: '#f8fbff',
            border: '1px solid #dbeafe',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={gridStyle}>
            <HeaderField label="Project">{`${p.project_code} ${(p.project_name ?? '').replace(/\s+/g, ' ')}`.trim()}</HeaderField>
            <HeaderField label="Contact">{p.contact || dash}</HeaderField>
            <HeaderField label="Status">
              <Tag color={statusColor[p.status]} style={{ margin: 0 }}>
                {statusLabel[p.status]}
              </Tag>
            </HeaderField>
          </div>
          <div style={gridStyle}>
            <HeaderField label="Owner">{p.owner_name || dash}</HeaderField>
            <HeaderField label="Budget">{`${thb(p.budget_amount)} บาท`}</HeaderField>
            <HeaderField label="Date">{dateText || dash}</HeaderField>
            <HeaderField label="ระยะเวลา">{durationText || dash}</HeaderField>
          </div>
        </div>
      )}

      <Spin spinning={loading}>
        <style>{`
          .cb-table .ant-table-thead > tr > th { background: #eff6ff; color: #1e40af; font-weight: 600; border-bottom: 1px solid #dbeafe; }
          .cb-table .ant-table-tbody > tr > td { border-bottom: 1px solid #dbeafe; }
          .cb-table .ant-table-tbody > tr:hover > td { background: #f0f5ff !important; }
          .cb-table .cb-item-link:hover { text-decoration: underline; }
          .cb-table .ant-table-tbody > tr.cb-row-major > td { background: ${ROW_COLOR.MAJOR.bg}; color: #1f1235; }
          .cb-table .ant-table-tbody > tr.cb-row-major > td:first-child { box-shadow: inset 4px 0 0 ${ROW_COLOR.MAJOR.bar}; }
          .cb-table .ant-table-tbody > tr.cb-row-major:hover > td { background: ${ROW_COLOR.MAJOR.hover} !important; }
          .cb-table .ant-table-tbody > tr.cb-row-head > td { background: ${ROW_COLOR.HEAD.bg}; color: #3b2a05; }
          .cb-table .ant-table-tbody > tr.cb-row-head > td:first-child { box-shadow: inset 4px 0 0 ${ROW_COLOR.HEAD.bar}; }
          .cb-table .ant-table-tbody > tr.cb-row-head:hover > td { background: ${ROW_COLOR.HEAD.hover} !important; }
          .cb-legend-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
        `}</style>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginBottom: 8, fontSize: 12, color: '#475569' }}>
          <span>
            <span className="cb-legend-swatch" style={{ background: ROW_COLOR.MAJOR.bg, border: `1px solid ${ROW_COLOR.MAJOR.bar}`, borderLeftWidth: 4 }} />
            Major
          </span>
          <span>
            <span className="cb-legend-swatch" style={{ background: ROW_COLOR.HEAD.bg, border: `1px solid ${ROW_COLOR.HEAD.bar}`, borderLeftWidth: 4 }} />
            Head
          </span>
        </div>
        <Table
          className="cb-table"
          rowKey={(r) => `${r.row_type}-${rowKeyOf(r)}`}
          rowClassName={(r) => (r.row_type === 'MAJOR' ? 'cb-row-major' : r.row_type === 'HEAD' ? 'cb-row-head' : '')}
          onRow={(r) => {
            if (isItemRow(r)) {
              // Click on a sub cost code (ITEM) row lists the POs charged to it; MAJOR/HEAD rows are inert.
              return {
                style: { cursor: 'pointer' },
                onClick: () => {
                  if (!projectCode) return
                  setPoTarget({
                    projectCode,
                    projectName: data?.project?.project_name ?? '',
                    subgroupId: r.is_unassigned ? 'none' : (r.subgroup_id as number),
                    costCode: r.is_unassigned ? '' : formatCostCodeDisplay(r.cost_code),
                    description: r.description,
                  })
                },
              }
            }
            return {}
          }}
          size="small"
          pagination={false}
          columns={columns}
          dataSource={data?.rows ?? []}
          // 60vh x 1.3 = 78vh, but never taller than the viewport minus the modal chrome (max 90vh).
          scroll={{ y: 'min(78vh, calc(100vh - 420px))' }}
          locale={{ emptyText: loading ? ' ' : 'ไม่พบรายการสั่งซื้อของโครงการนี้' }}
          summary={() =>
            data?.totals ? (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ fontWeight: 700, background: '#eff6ff' }}>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    รวม
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">{thb(data.totals.budget)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">{thb(data.totals.pu_cost)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">{bal(data.totals.pu_bal)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">{thb(data.totals.ac_cost)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">{bal(data.totals.ac_bal)}</Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            ) : null
          }
        />
      </Spin>
      <CostCodePoLinesModal target={poTarget} onClose={() => setPoTarget(null)} />
    </Modal>
  )
}

export default CostBudgetModal
