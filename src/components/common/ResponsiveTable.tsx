import React, { useState } from 'react'
import { Empty, Grid, Pagination, Spin, Table } from 'antd'
import type { TableProps } from 'antd'

/**
 * Drop-in replacement for antd <Table> on LIST pages.
 * Desktop (>= md): renders the normal antd Table, untouched.
 * Mobile (< md): renders one card per row, built from the same `columns`:
 *   - first data column (after a "ลำดับ"/No column)  -> card title
 *   - columns with no title / key actions|action|manage / title "จัดการ" -> buttons at the card's top-right
 *   - every other column                              -> "label : value" rows (empty values are skipped)
 * Pagination follows the table's own `pagination` prop (server-side when it passes `total`, otherwise client-side).
 * Do not use for editable line-item tables (rowSelection / expandable / inputs in cells) — keep those as <Table>.
 */

type AnyRec = Record<string, any>

const getValue = (rec: AnyRec, dataIndex: any) => {
  if (dataIndex === undefined || dataIndex === null) return undefined
  if (Array.isArray(dataIndex)) return dataIndex.reduce((o, k) => (o == null ? o : o[k]), rec)
  return rec[dataIndex]
}

const unwrap = (node: any): any =>
  node && typeof node === 'object' && !React.isValidElement(node) && !Array.isArray(node) && 'children' in node
    ? node.children
    : node

const isEmpty = (v: any) => v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0)

const isActionCol = (c: AnyRec) => {
  const k = String(c.key ?? c.dataIndex ?? '')
  const noTitle = c.title === '' || c.title === undefined || c.title === null
  return (noTitle && c.dataIndex === undefined) || c.title === 'จัดการ' || /^(actions?|manage|operation)$/i.test(k)
}

const isIndexCol = (c: AnyRec) => {
  const k = String(c.key ?? c.dataIndex ?? '')
  return c.title === 'ลำดับ' || c.title === 'No' || c.title === 'No.' || c.title === '#' || /^(no|index|idx|seq|row_?no)$/i.test(k)
}

const labelOf = (c: AnyRec): React.ReactNode => {
  if (typeof c.title === 'function') return String(c.key ?? c.dataIndex ?? '')
  return c.title
}

function flatten(cols: any[]): any[] {
  return cols.flatMap((c) => (c.children ? flatten(c.children) : [c]))
}

function ResponsiveTable<T extends AnyRec>(props: TableProps<T>) {
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
  const [localPage, setLocalPage] = useState(1)

  if (!isMobile) return <Table<T> {...props} />

  const { columns = [], dataSource = [], loading, rowKey, pagination, onRow, locale } = props
  const cols = flatten(columns as any[]).filter((c) => !c.hidden)
  const idxCol = cols.find(isIndexCol)
  const actionCols = cols.filter((c) => c !== idxCol && isActionCol(c))
  const dataCols = cols.filter((c) => c !== idxCol && !actionCols.includes(c))
  const titleCol = dataCols[0]
  const restCols = dataCols.slice(1)

  const pg = pagination === false ? null : (pagination as AnyRec | undefined) ?? {}
  const serverSide = !!pg && typeof pg.total === 'number' && typeof pg.onChange === 'function'
  const pageSize: number = pg?.pageSize ?? 10
  const current: number = serverSide ? pg!.current ?? 1 : localPage
  const total: number = serverSide ? pg!.total : dataSource.length
  const rows: T[] = serverSide || !pg ? ([...dataSource] as T[]) : ([...dataSource] as T[]).slice((current - 1) * pageSize, current * pageSize)
  const offset = serverSide || !pg ? (serverSide ? (current - 1) * pageSize : 0) : (current - 1) * pageSize

  const keyOf = (r: T, i: number) =>
    typeof rowKey === 'function' ? (rowKey as any)(r) : rowKey ? r[rowKey as string] : (r as AnyRec).key ?? i

  const cell = (c: AnyRec, r: T, i: number) => {
    const v = getValue(r, c.dataIndex)
    const out = c.render ? unwrap(c.render(v, r, offset + i)) : v
    return out
  }

  const isLoading = typeof loading === 'boolean' ? loading : !!(loading as AnyRec | undefined)?.spinning

  return (
    <Spin spinning={isLoading}>
      {rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={(locale as AnyRec | undefined)?.emptyText ?? 'ไม่พบข้อมูล'} />
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>ทั้งหมด {total} รายการ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((r, i) => {
              const rowProps = (onRow ? onRow(r, i) : {}) as AnyRec
              const clickable = typeof rowProps?.onClick === 'function'
              return (
                <div
                  key={keyOf(r, i)}
                  onClick={rowProps?.onClick}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e9f2',
                    borderLeft: '3px solid #2563eb',
                    borderRadius: 10,
                    padding: '12px 12px 10px',
                    cursor: clickable ? 'pointer' : undefined,
                    ...(rowProps?.style ?? {}),
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>#{offset + i + 1}</div>
                      {titleCol && (
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1e3a8a', wordBreak: 'break-word' }}>
                          {(() => { const v = cell(titleCol, r, i); return isEmpty(v) ? '-' : v })()}
                        </div>
                      )}
                    </div>
                    {actionCols.length > 0 && (
                      <div style={{ flexShrink: 0, display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        {actionCols.map((c, k) => <span key={k}>{cell(c, r, i)}</span>)}
                      </div>
                    )}
                  </div>
                  {restCols.length > 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto minmax(0, 1fr)',
                        columnGap: 12,
                        rowGap: 4,
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: '1px solid #eef1f7',
                        fontSize: 13,
                      }}
                    >
                      {restCols.map((c, k) => {
                        const v = cell(c, r, i)
                        if (isEmpty(v)) return null
                        return (
                          <React.Fragment key={k}>
                            <span style={{ color: '#6b7280' }}>{labelOf(c)}</span>
                            <span style={{ wordBreak: 'break-word', minWidth: 0 }}>{v}</span>
                          </React.Fragment>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {pg && total > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <Pagination
                simple
                current={current}
                pageSize={pageSize}
                total={total}
                showSizeChanger={false}
                onChange={(p, s) => (serverSide ? pg.onChange(p, s) : setLocalPage(p))}
              />
            </div>
          )}
        </>
      )}
    </Spin>
  )
}

export default ResponsiveTable
