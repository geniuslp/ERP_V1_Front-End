import React from 'react'
import { Table, Button, Tooltip, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import ConfirmDeleteButton from '@/components/common/ConfirmDeleteButton'
import type { PettyCashLineForm } from '@/types/pettyCash'

export type LineModalMode = 'view' | 'edit' | 'add'

interface Props {
  items: PettyCashLineForm[]
  /** false when the document is not DRAFT/REJECTED — hides the edit icon, keeps view. */
  canEdit: boolean
  onOpenLine: (mode: LineModalMode, index?: number) => void
  onDelete: (index: number) => void
  /** Row key to flag as the first offending (blank/incomplete) row after a failed validation. */
  errorKey?: string | null
}

const money = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ICON_COLOR = '#1d4ed8'
const blank = (r: PettyCashLineForm, v: React.ReactNode) => (r.isNew ? '-' : v)

const PettyCashLineSummaryTable: React.FC<Props> = ({ items, canEdit, onOpenLine, onDelete, errorKey }) => {
  const columns: ColumnsType<PettyCashLineForm> = [
    { title: 'No.', key: 'no', width: 60, align: 'center', render: (_v, _r, i) => i + 1 },
    {
      title: 'Expense',
      key: 'expense',
      render: (_v, r) => (r.isNew ? '-' : r.description || r.mat_name_th || '-'),
    },
    { title: 'Vendor', key: 'vendor', render: (_v, r) => (r.isNew ? '-' : r.supplier_name || '-') },
    { title: 'Amount', key: 'amount', align: 'right', render: (_v, r) => blank(r, money(r.amount)) },
    { title: 'Vat Amount', key: 'vat', align: 'right', render: (_v, r) => blank(r, money(r.line_vat)) },
    {
      title: 'WT%', key: 'wt_pct', align: 'center',
      render: (_v, r) => (!r.isNew && r.has_wht && r.wht_rate != null ? `${r.wht_rate}%` : '-'),
    },
    { title: 'WT Amount', key: 'wt_amount', align: 'right', render: (_v, r) => blank(r, money(r.line_wht)) },
    { title: 'Net Amount', key: 'net', align: 'right', render: (_v, r) => (r.isNew ? '-' : <strong>{money(r.line_net)}</strong>) },
    {
      title: 'Activity',
      key: 'activity',
      width: 150,
      align: 'center',
      render: (_v, _r, i) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          <Tooltip title="ดู">
            <Button type="text" size="small" icon={<EyeOutlined style={{ color: ICON_COLOR }} />} onClick={() => onOpenLine('view', i)} />
          </Tooltip>
          {canEdit && (
            <Tooltip title="แก้ไข">
              <Button type="text" size="small" icon={<EditOutlined style={{ color: ICON_COLOR }} />} onClick={() => onOpenLine('edit', i)} />
            </Tooltip>
          )}
          {canEdit && (
            <ConfirmDeleteButton type="text" size="small" title="ลบ" onConfirm={() => onDelete(i)} />
          )}
        </span>
      ),
    },
  ]

  return (
    <Table<PettyCashLineForm>
      rowKey="key"
      dataSource={items}
      columns={columns}
      pagination={false}
      size="small"
      bordered={false}
      scroll={{ x: 900 }}
      onRow={(r) => ({
        style: r.key === errorKey
          ? { background: '#ffe4e6', boxShadow: 'inset 3px 0 0 #dc2626' }
          : r.isNew ? { background: '#fff7e6' } : undefined,
      })}
      locale={{
        emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีรายการ" />,
      }}
    />
  )
}

export default PettyCashLineSummaryTable
