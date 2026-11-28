import React, { useCallback, useEffect, useState } from 'react'
import { Button, Card, Empty, Grid, Input, InputNumber, Modal, Select, Space, Spin, Switch, Table, Typography, message } from 'antd'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'

// "รายการลดยอด MEMO" — same flow as the PR reduction page (reports/of/PRReducePage.tsx): pick an approved memo,
// tick lines, enter how much to take off each line's balance, give a reason, save.
const BASE_URL = (import.meta as any).env?.VITE_API_URL
const MENU_CODE = 'MENU_MEMO_RPT_REDUCE'
const REASON_MAX = 500 // same limit as the backend
const NAVY = '#0f2d5e'

const cardStyle: React.CSSProperties = { borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }

interface MemoRow {
  id: number
  memo_no: string
  memo_date: string
  job_code: string | null
  project_code: string | null
  project_name: string | null
  requested_by: string
  remarks: string | null
}

interface LineRow {
  line_id: number
  line_no: number
  description: string
  unit: string
  quantity: number
  qty_used: number
  qty_balance: number
}

const formatQty = (v: number): string => Number(v).toLocaleString('th-TH', { maximumFractionDigits: 4 })
const projectLabel = (r: { project_code: string | null; project_name: string | null }) =>
  r.project_code ? `${r.project_code} ${r.project_name ?? ''}`.trim() : '-'

// Navy header cells with white text for both tables on this page.
const NavyHeaderCell: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ style, children, ...rest }) => (
  <th {...rest} style={{ ...style, background: NAVY, color: '#fff', fontWeight: 600 }}>{children}</th>
)
const tableComponents = { header: { cell: NavyHeaderCell } }
// antd draws a thin separator ::before each header cell; hide it so the navy bar is one solid strip.
const NO_SEPARATOR_CSS = '.memo-reduce-table .ant-table-thead > tr > th::before { display: none !important; }'

const errText = (e: any, fallback: string): string =>
  e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback

const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
    <div style={{ fontWeight: 600, color: NAVY, wordBreak: 'break-word' }}>{value}</div>
  </div>
)

const MemoReducePage: React.FC = () => {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  // search bar
  const [searchBy, setSearchBy] = useState<'doc_no' | 'project'>('doc_no')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  // memo table
  const [memos, setMemos] = useState<MemoRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [memoLoading, setMemoLoading] = useState(false)
  const [selected, setSelected] = useState<MemoRow | null>(null)

  // line table
  const [lines, setLines] = useState<LineRow[]>([])
  const [linesLoading, setLinesLoading] = useState(false)
  const [picked, setPicked] = useState<Record<number, boolean>>({})
  const [decrement, setDecrement] = useState<Record<number, number | null>>({})
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const loadMemos = useCallback(async () => {
    setMemoLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/reports/memo/reduce/memos`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { page, limit: pageSize, show_all: showAll, search_by: searchBy, search: search || undefined },
      })
      setMemos(res.data?.data ?? [])
      setTotal(res.data?.total ?? 0)
    } catch (e: any) {
      message.error(errText(e, 'โหลดรายการ Memo ไม่สำเร็จ'))
    } finally {
      setMemoLoading(false)
    }
  }, [accessToken, page, pageSize, showAll, searchBy, search])

  useEffect(() => { loadMemos() }, [loadMemos])

  const resetForm = () => {
    setPicked({})
    setDecrement({})
    setReason('')
  }

  const loadLines = useCallback(async (memoId: number) => {
    setLinesLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/reports/memo/reduce/memos/${memoId}/lines`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      setLines(res.data?.data ?? [])
    } catch (e: any) {
      message.error(errText(e, 'โหลดรายการใน Memo ไม่สำเร็จ'))
      setLines([])
    } finally {
      setLinesLoading(false)
    }
  }, [accessToken])

  // Picking a document (re)opens the modal with a clean slate: no leftover ticks, quantities or remark.
  const selectMemo = (m: MemoRow) => {
    setSelected(m)
    resetForm()
    setLines([])
    loadLines(m.id)
  }

  const closeModal = () => {
    if (saving) return
    setSelected(null)
    resetForm()
    setLines([])
  }

  const doSearch = () => {
    setPage(1)
    setSearch(searchInput.trim())
  }

  const handleSave = async () => {
    if (!selected) return
    const chosen = lines.filter((l) => picked[l.line_id])
    if (chosen.length === 0) {
      message.warning('กรุณาเลือกรายการที่ต้องการลดยอด')
      return
    }
    for (const l of chosen) {
      const d = decrement[l.line_id]
      if (!d || d <= 0) {
        message.warning(`กรุณาระบุจำนวนที่ลดของรายการที่ ${l.line_no}`)
        return
      }
      if (d > l.qty_balance) {
        message.warning(`รายการที่ ${l.line_no}: ลดได้ไม่เกินยอดคงเหลือ ${formatQty(l.qty_balance)}`)
        return
      }
    }
    if (!reason.trim()) {
      message.warning('กรุณาระบุหมายเหตุ')
      return
    }
    setSaving(true)
    try {
      await axios.post(
        `${BASE_URL}/reports/memo/reduce/memos/${selected.id}/reduce`,
        { reason: reason.trim(), items: chosen.map((l) => ({ line_id: l.line_id, qty_decrement: decrement[l.line_id] })) },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      message.success('บันทึกการลดยอดเรียบร้อย')
      resetForm()
      await Promise.all([loadLines(selected.id), loadMemos()])
    } catch (e: any) {
      message.error(errText(e, 'บันทึกการลดยอดไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  const memoColumns: ColumnsType<MemoRow> = [
    { title: 'ลำดับ', key: 'no', width: 60, align: 'center', render: (_v, _r, i) => (page - 1) * pageSize + i + 1 },
    { title: 'เลขที่ Memo', dataIndex: 'memo_no', key: 'memo_no', width: 150 },
    { title: 'วันที่', dataIndex: 'memo_date', key: 'memo_date', width: 110, render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '-') },
    { title: 'Job', dataIndex: 'job_code', key: 'job_code', width: 90, render: (v: string | null) => v ?? '-' },
    { title: 'โครงการ', key: 'project', width: 320, render: (_v, r) => projectLabel(r) },
    { title: 'ผู้ขอ', dataIndex: 'requested_by', key: 'requested_by', width: 160, render: (v: string) => v || '-' },
    { title: 'หมายเหตุ', dataIndex: 'remarks', key: 'remarks', width: 240, ellipsis: true, render: (v: string | null) => v || '-' },
  ]

  const togglePick = (l: LineRow, on: boolean) => {
    setPicked((p) => ({ ...p, [l.line_id]: on }))
    if (!on) setDecrement((d) => ({ ...d, [l.line_id]: null }))
  }
  const decrementInput = (l: LineRow) => (
    <InputNumber
      style={{ width: '100%' }}
      min={0}
      max={l.qty_balance}
      disabled={!picked[l.line_id]}
      placeholder="ใส่ค่าลดยอด"
      value={decrement[l.line_id] ?? null}
      onChange={(v) => setDecrement((d) => ({ ...d, [l.line_id]: v == null ? null : Number(v) }))}
    />
  )
  const pickedCount = lines.filter((l) => picked[l.line_id]).length

  const lineColumns: ColumnsType<LineRow> = [
    {
      title: 'เลือก',
      key: 'select',
      width: 80,
      align: 'center',
      render: (_v, l) => <Switch size="small" checked={!!picked[l.line_id]} disabled={l.qty_balance <= 0} onChange={(on) => togglePick(l, on)} />,
    },
    { title: 'ลำดับ', dataIndex: 'line_no', key: 'line_no', width: 70, align: 'center' },
    { title: 'รายละเอียด', dataIndex: 'description', key: 'description', width: 420 },
    { title: 'คงเหลือ', dataIndex: 'qty_balance', key: 'qty_balance', width: 110, align: 'right', render: (v: number) => formatQty(v) },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 100, render: (v: string) => v || '-' },
    { title: 'จำนวนที่ลด', key: 'decrement', width: 160, render: (_v, l) => decrementInput(l) },
  ]

  return (
    <div>
      <style>{NO_SEPARATOR_CSS}</style>
      <PageHeader
        title="รายการลดยอด MEMO"
        subtitle="ลดจำนวนของใบบันทึกขอซื้อที่ยังไม่ได้นำไปเปิด PR ครบ"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Memo' }, { title: 'รายงาน MEMO' }, { title: 'รายการลดยอด MEMO' }]}
      />

      <Card style={{ ...cardStyle, marginBottom: 16 }}>
        <Space wrap size={12} style={{ marginBottom: 12 }}>
          <span>ค้นหาโดย</span>
          <Select
            value={searchBy}
            onChange={setSearchBy}
            style={{ width: 160 }}
            options={[
              { value: 'doc_no', label: 'Document No.' },
              { value: 'project', label: 'โครงการ' },
            ]}
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={doSearch}
            placeholder={searchBy === 'doc_no' ? 'เลขที่ Memo' : 'รหัสหรือชื่อโครงการ'}
            style={{ width: isMobile ? '100%' : 280 }}
            allowClear
            suffix={<SearchOutlined style={{ cursor: 'pointer' }} onClick={doSearch} />}
          />
          <Space size={8}>
            <Switch
              checked={showAll}
              onChange={(v) => {
                setShowAll(v)
                setPage(1)
              }}
            />
            <span>แสดงเอกสารทั้งหมด</span>
          </Space>
        </Space>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          {showAll ? 'แสดง Memo ที่อนุมัติแล้วทั้งหมด' : 'แสดงเฉพาะ Memo ที่อนุมัติแล้วและยังมีรายการคงเหลือที่ยังไม่ได้นำไปเปิด PR'} — คลิกแถวเพื่อเลือกเอกสารที่ต้องการลดยอด
        </Typography.Text>
        <Table<MemoRow>
          size="small"
          rowKey="id"
          loading={memoLoading}
          className="memo-reduce-table"
          components={tableComponents}
          columns={memoColumns}
          dataSource={memos}
          scroll={{ x: 1130 }}
          rowClassName={(r) => (r.id === selected?.id ? 'ant-table-row-selected' : '')}
          onRow={(r) => ({ onClick: () => selectMemo(r), style: { cursor: 'pointer' } })}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      <Modal
        open={!!selected}
        onCancel={closeModal}
        footer={null}
        width={isMobile ? '100%' : 'min(1200px, 95vw)'}
        centered={!isMobile}
        style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw', paddingBottom: 0 } : undefined}
        destroyOnClose
        maskClosable={false}
        title={<span style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>{selected ? `รายการของ ${selected.memo_no}` : 'รายการ'}</span>}
        closeIcon={<CloseOutlined style={{ color: '#fff' }} />}
        styles={{
          content: { padding: 0, overflow: 'hidden', borderRadius: isMobile ? 0 : 14, boxShadow: '0 8px 30px rgba(15,45,94,0.18)' },
          header: { background: NAVY, margin: 0, padding: isMobile ? '12px 16px' : '16px 24px' },
          body: { padding: isMobile ? 12 : 24, maxHeight: isMobile ? 'calc(100vh - 56px)' : 'calc(100vh - 140px)', overflowY: 'auto' },
        }}
      >
        {selected && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, minmax(0, 1fr))',
                gap: 12,
                padding: isMobile ? 12 : 16,
                marginBottom: 16,
                background: '#f0f6ff',
                borderRadius: 10,
              }}
            >
              <InfoItem label="วันที่" value={selected.memo_date ? dayjs(selected.memo_date).format('DD/MM/YYYY') : '-'} />
              <InfoItem label="Job" value={selected.job_code ?? '-'} />
              <InfoItem label="ผู้ขอ" value={selected.requested_by || '-'} />
              <div style={{ gridColumn: '1 / -1' }}>
                <InfoItem label="โครงการ" value={projectLabel(selected)} />
              </div>
            </div>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
              เปิด "เลือก" ที่รายการที่ต้องการลดยอด แล้วกรอกจำนวนที่ลด (ลดได้ไม่เกินยอดคงเหลือ = จำนวนใน Memo ที่ยังไม่ได้นำไปเปิด PR)
              {lines.length > 0 && <> — เลือกแล้ว {pickedCount} จาก {lines.length} รายการ</>}
            </Typography.Text>
            {isMobile ? (
              <Spin spinning={linesLoading}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {lines.map((l) => (
                    <div
                      key={l.line_id}
                      style={{
                        border: `1px solid ${picked[l.line_id] ? '#2563eb' : '#e5e7eb'}`,
                        background: picked[l.line_id] ? '#eff6ff' : '#fff',
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: NAVY, wordBreak: 'break-word' }}>{l.line_no}. {l.description}</span>
                        <Switch size="small" checked={!!picked[l.line_id]} disabled={l.qty_balance <= 0} onChange={(on) => togglePick(l, on)} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13, color: '#4b5563', marginTop: 6 }}>
                        <span>คงเหลือ: <b>{formatQty(l.qty_balance)}</b></span>
                        <span>หน่วย: {l.unit || '-'}</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, marginBottom: 2 }}>จำนวนที่ลด</div>
                        {decrementInput(l)}
                      </div>
                    </div>
                  ))}
                  {!linesLoading && lines.length === 0 && <Empty description="ไม่มีรายการ" />}
                </div>
              </Spin>
            ) : (
              <Table<LineRow>
                size="middle"
                rowKey="line_id"
                loading={linesLoading}
                className="memo-reduce-table"
                components={tableComponents}
                columns={lineColumns}
                dataSource={lines}
                pagination={false}
                scroll={{ x: 'max-content' }}
              />
            )}
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 4 }}>
                หมายเหตุ <span style={{ color: '#dc2626' }}>*</span>
              </div>
              <Input.TextArea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={REASON_MAX}
                showCount
                rows={3}
                placeholder="ระบุเหตุผลในการลดยอด"
              />
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end', gap: 8 }}>
              <Button onClick={resetForm} disabled={saving} block={isMobile}>ยกเลิก</Button>
              <PermissionButton menuCode={MENU_CODE} action="edit" type="primary" loading={saving} onClick={handleSave} block={isMobile}>
                บันทึก
              </PermissionButton>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default MemoReducePage
