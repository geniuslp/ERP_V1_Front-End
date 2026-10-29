import React, { useEffect, useRef, useState } from 'react'
import { Modal, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Resizable, type ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import api from '@/services/api'

// Row of GET /po/cost-budget/:projectCode/cost-codes/:costSubgroupId/po-lines
interface CostCodePoLine {
  // 'PC' rows: po_id/po_no/po_status hold the petty cash header id / document number / status.
  source?: 'PO' | 'PC' | 'TR'
  // 'TR' rows (project transfer): po_no is the TF document number, project_name the OTHER project of the
  // transfer, quantity negative when the goods left this project; doc_project_code owns the document.
  doc_project_code?: string | null
  po_id: number
  po_no: string
  project_code: string
  project_name: string
  line_no: number
  mat_code: string
  item_name: string | null
  quantity: number
  unit: string | null
  remarks: string | null
  po_status: string
  amount: number
}

export interface CostCodePoLinesTarget {
  projectCode: string
  projectName: string
  // 'none' = the unassigned petty cash row
  subgroupId: number | 'none'
  costCode: string
  description: string
}

interface Props {
  target: CostCodePoLinesTarget | null
  onClose: () => void
}

const MIN_COL_WIDTH = 80
const DEFAULT_WIDTHS: Record<string, number> = {
  // Sum 1120 ~ the modal body at 1170px (was 1010 at 900px), so the extra width is used.
  source: 100,
  po_no: 170,
  project_name: 240,
  item_name: 320,
  quantity: 110,
  unit: 90,
  remarks: 190,
}

// Same react-resizable pattern as POStatusPage.tsx (copied locally, no shared component).
interface ResizableTitleProps extends React.HTMLAttributes<HTMLElement> {
  onResize?: (e: React.SyntheticEvent, data: ResizeCallbackData) => void
  width?: number
}

const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResize, width, ...restProps } = props
  if (!width || !onResize) return <th {...restProps} />
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[MIN_COL_WIDTH, 0]}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', right: -5, bottom: 0, top: 0, width: 10, cursor: 'col-resize', zIndex: 1 }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative' }} />
    </Resizable>
  )
}

// Up to 4 decimals, trailing zeros trimmed, thousand separators.
const fmtQty = (n?: number) => (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 4 })

const CostCodePoLinesModal: React.FC<Props> = ({ target, onClose }) => {
  const [rows, setRows] = useState<CostCodePoLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [widths, setWidths] = useState<Record<string, number>>(DEFAULT_WIDTHS)
  const reqSeq = useRef(0)

  useEffect(() => {
    // Every open/switch bumps the sequence, so a slow response for a previous row is ignored.
    const seq = ++reqSeq.current
    setRows([])
    setError(null)
    if (!target) {
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .get(`/po/cost-budget/${encodeURIComponent(target.projectCode)}/cost-codes/${target.subgroupId}/po-lines`)
      .then((res) => {
        if (seq !== reqSeq.current) return
        const body = res.data?.data ?? res.data
        setRows(Array.isArray(body) ? body : [])
      })
      .catch((err: any) => {
        if (seq !== reqSeq.current) return
        setError(err?.response?.data?.message || err?.response?.data?.error || 'โหลดรายการ PO ไม่สำเร็จ')
      })
      .finally(() => {
        if (seq === reqSeq.current) setLoading(false)
      })
  }, [target?.projectCode, target?.subgroupId])

  const col = (key: string) => ({
    width: widths[key],
    onHeaderCell: () =>
      ({
        width: widths[key],
        onResize: (_e: React.SyntheticEvent, data: ResizeCallbackData) =>
          setWidths((prev) => ({ ...prev, [key]: Math.max(MIN_COL_WIDTH, Math.round(data.size.width)) })),
      }) as React.HTMLAttributes<HTMLElement>,
  })

  const columns: ColumnsType<CostCodePoLine> = [
    {
      title: 'ประเภท',
      dataIndex: 'source',
      key: 'source',
      ...col('source'),
      render: (v: 'PO' | 'PC' | 'TR' | undefined) =>
        v === 'PC' ? (
          <Tag color="orange" style={{ margin: 0 }}>เงินสดย่อย</Tag>
        ) : v === 'TR' ? (
          <Tag color="green" style={{ margin: 0 }}>โอน</Tag>
        ) : (
          <Tag color="blue" style={{ margin: 0 }}>PO</Tag>
        ),
    },
    {
      title: 'เลขที่เอกสาร',
      dataIndex: 'po_no',
      key: 'po_no',
      ...col('po_no'),
      // Detail routes open in a new tab (PO without the approval-scoping flag).
      render: (v: string, r) => (
        <a
          href={
            r.source === 'PC'
              ? `/petty-cash/${r.po_id}`
              : r.source === 'TR'
                ? `/ic/projects/${r.doc_project_code}/movement/${r.po_id}`
                : `/po/approval/${r.po_id}`
          }
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 600 }}
        >
          {v}
        </a>
      ),
    },
    {
      title: 'ชื่อโครงการ',
      dataIndex: 'project_name',
      key: 'project_name',
      ...col('project_name'),
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: 'ชื่อสินค้า',
      dataIndex: 'item_name',
      key: 'item_name',
      ...col('item_name'),
      render: (v: string | null, r) => v || r.mat_code || '-',
    },
    {
      title: 'จำนวน',
      dataIndex: 'quantity',
      key: 'quantity',
      ...col('quantity'),
      align: 'right',
      render: (v: number) => fmtQty(v),
    },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit', ...col('unit'), render: (v: string | null) => v || '-' },
    {
      title: 'หมายเหตุ',
      dataIndex: 'remarks',
      key: 'remarks',
      ...col('remarks'),
      ellipsis: { showTitle: false },
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v} placement="topLeft">
            <span>{v}</span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
  ]

  const scrollX = Object.values(widths).reduce((a, b) => a + b, 0)

  return (
    <Modal
      open={!!target}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={1170}
      style={{ maxWidth: '95vw' }}
      title={
        target ? (
          <div>
            <div>{`รายการ PO / เงินสดย่อย / โอน - ${target.costCode} ${target.description ?? ''}`.trim()}</div>
            <div style={{ fontSize: 12, fontWeight: 400, color: '#60a5fa', marginTop: 2 }}>
              {`${target.projectCode} ${(target.projectName ?? '').replace(/\s+/g, ' ')}`.trim()}
            </div>
          </div>
        ) : (
          ''
        )
      }
    >
      <Table
        rowKey={(r) => `${r.source ?? 'PO'}-${r.po_id}-${r.line_no}`}
        size="small"
        loading={loading}
        columns={columns}
        components={{ header: { cell: ResizableTitle } }}
        dataSource={rows}
        pagination={false}
        // 55vh x 1.3 = ~72vh, capped to the viewport minus the modal chrome (max 90vh).
        scroll={{ x: scrollX, y: 'min(72vh, calc(100vh - 260px))' }}
        locale={{
          emptyText: loading ? ' ' : error ? <span style={{ color: '#dc2626' }}>{error}</span> : 'ไม่มีรายการ PO เงินสดย่อย หรือโอนภายใต้รหัสต้นทุนนี้',
        }}
      />
    </Modal>
  )
}

export default CostCodePoLinesModal
