import React, { useEffect, useRef, useState } from 'react'
import { Modal, Table, Tag, Spin, Popover, message } from 'antd'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import api from '@/services/api'
import type { ProjectStatus } from '@/types/project'

export interface CostBudgetDetailLine {
  subgroup_id: number
  cost_code: string
  description: string
  budget: number
  pu_cost: number
  pu_bal: number
  ac_cost: number
  ac_bal: number
}

export interface CostBudgetDetailTotals {
  budget: number
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

export interface CostBudgetPurchaseLine {
  po_no: string
  pr_no: string | null
  mat_code: string
  item_name: string | null
  qty_ordered: number
  unit_price: number
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
  const [purchases, setPurchases] = useState<Record<number, CostBudgetPurchaseLine[]>>({})
  const [purchasesLoading, setPurchasesLoading] = useState<Record<number, boolean>>({})
  const [purchasesError, setPurchasesError] = useState<Record<number, boolean>>({})
  const reqSeq = useRef(0)

  useEffect(() => {
    // reset on every open/close/switch; stale responses are ignored via reqSeq
    const seq = ++reqSeq.current
    setData(null)
    setPurchases({})
    setPurchasesLoading({})
    setPurchasesError({})
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

  const loadPurchases = (subgroupId: number) => {
    if (!projectCode || purchases[subgroupId] || purchasesLoading[subgroupId]) return
    const seq = reqSeq.current
    setPurchasesLoading((p) => ({ ...p, [subgroupId]: true }))
    setPurchasesError((p) => ({ ...p, [subgroupId]: false }))
    api
      .get(`/po/${encodeURIComponent(projectCode)}/cost-budget-detail/${subgroupId}/purchases`)
      .then((res) => {
        if (seq !== reqSeq.current) return
        const body = res.data?.data ?? res.data
        setPurchases((p) => ({ ...p, [subgroupId]: Array.isArray(body) ? body : [] }))
      })
      .catch(() => {
        if (seq !== reqSeq.current) return
        setPurchasesError((p) => ({ ...p, [subgroupId]: true }))
      })
      .finally(() => {
        if (seq === reqSeq.current) setPurchasesLoading((p) => ({ ...p, [subgroupId]: false }))
      })
  }

  const purchaseColumns: ColumnsType<CostBudgetPurchaseLine> = [
    { title: 'PO No', dataIndex: 'po_no', key: 'po_no', width: 130 },
    { title: 'PR No', dataIndex: 'pr_no', key: 'pr_no', width: 130, render: (v: string | null) => v || '—' },
    { title: 'Item', key: 'item', render: (_: unknown, r) => r.item_name || r.mat_code },
    { title: 'Qty', dataIndex: 'qty_ordered', key: 'qty', render: (v: number) => thb(v), align: 'right', width: 80 },
    { title: 'Unit price', dataIndex: 'unit_price', key: 'unit_price', align: 'right', width: 110, render: (v: number) => thb(v) },
  ]

  const renderPopover = (subgroupId: number) => {
    if (purchasesLoading[subgroupId] || (!purchases[subgroupId] && !purchasesError[subgroupId])) {
      return (
        <div style={{ padding: 16, textAlign: 'center', minWidth: 200 }}>
          <Spin size="small" />
        </div>
      )
    }
    if (purchasesError[subgroupId]) {
      return <div style={{ color: '#dc2626', fontSize: 13 }}>โหลดรายการสั่งซื้อไม่สำเร็จ</div>
    }
    return (
      <div style={{ maxHeight: 300, overflowY: 'auto', maxWidth: 640 }}>
        <Table
          rowKey={(r, i) => `${r.po_no}-${i}`}
          size="small"
          pagination={false}
          columns={purchaseColumns}
          dataSource={purchases[subgroupId]}
          locale={{ emptyText: 'ยังไม่มีรายการสั่งซื้อ' }}
        />
      </div>
    )
  }

  const bal = (v: number) => <span style={{ color: v < 0 ? '#dc2626' : undefined }}>{thb(v)}</span>

  const columns: ColumnsType<CostBudgetDetailLine> = [
    { title: 'No.', key: 'no', width: 60, align: 'center', render: (_: unknown, __: unknown, i: number) => i + 1 },
    {
      title: 'CostCode',
      dataIndex: 'cost_code',
      key: 'cost_code',
      width: 140,
      render: (v: string, r) => (
        <Popover
          mouseEnterDelay={0.2}
          destroyTooltipOnHide
          onOpenChange={(open) => open && loadPurchases(r.subgroup_id)}
          content={renderPopover(r.subgroup_id)}
        >
          <span style={{ color: '#2563eb', cursor: 'help' }}>{v}</span>
        </Popover>
      ),
    },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Budget', dataIndex: 'budget', key: 'budget', align: 'right', render: (v: number) => thb(v) },
    { title: 'PuCost', dataIndex: 'pu_cost', key: 'pu_cost', align: 'right', render: (v: number) => thb(v) },
    { title: 'PuBal', dataIndex: 'pu_bal', key: 'pu_bal', align: 'right', render: bal },
    { title: 'Ac.Cost', dataIndex: 'ac_cost', key: 'ac_cost', align: 'right', render: (v: number) => thb(v) },
    { title: 'Ac.Bal', dataIndex: 'ac_bal', key: 'ac_bal', align: 'right', render: bal },
  ]

  const p = data?.project
  const dateText =
    p && (p.start_date || p.end_date)
      ? `${p.start_date ? dayjs(p.start_date).format('DD/MM/YY') : '—'} - ${p.end_date ? dayjs(p.end_date).format('DD/MM/YY') : '—'}`
      : null

  return (
    <Modal
      open={!!projectCode}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={1100}
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
            <HeaderField label="Contract">{p.contract || dash}</HeaderField>
            <HeaderField label="Contact">{p.contact || dash}</HeaderField>
            <HeaderField label="Status">
              <Tag color={statusColor[p.status]} style={{ margin: 0 }}>
                {statusLabel[p.status]}
              </Tag>
            </HeaderField>
          </div>
          <div style={gridStyle}>
            <HeaderField label="Owner">{p.owner_name || dash}</HeaderField>
            <HeaderField label="Budget">{thb(p.budget_amount)}</HeaderField>
            <HeaderField label="Date">{dateText || dash}</HeaderField>
          </div>
        </div>
      )}

      <Spin spinning={loading}>
        <style>{`
          .cb-table .ant-table-thead > tr > th { background: #eff6ff; color: #1e40af; font-weight: 600; border-bottom: 1px solid #dbeafe; }
          .cb-table .ant-table-tbody > tr > td { border-bottom: 1px solid #dbeafe; }
          .cb-table .ant-table-tbody > tr:hover > td { background: #f0f5ff !important; }
        `}</style>
        <Table
          className="cb-table"
          rowKey="subgroup_id"
          size="small"
          pagination={false}
          columns={columns}
          dataSource={data?.rows ?? []}
          scroll={{ y: '60vh' }}
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
    </Modal>
  )
}

export default CostBudgetModal
