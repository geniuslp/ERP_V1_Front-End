import React from 'react'
import { Modal, Table, Tag, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ExclamationCircleOutlined } from '@ant-design/icons'

export interface SubmitApproveChainRow {
  key: string | number
  employeeCode: string
  seq: number
  approveBy: string
  roleNames: string
  /** null → "-"; PENDING / APPROVED / REJECTED (matched case-insensitively) */
  status: string | null
}

export interface SubmitApproveSummary {
  docNo: string
  docTypeLabel: string
  docDate: string
  projectCode: string
  orderTypeLabel: string
  deptLabel: string
  netAmount: number
}

interface Props {
  open: boolean
  summary: SubmitApproveSummary
  chain: SubmitApproveChainRow[]
  submitting: boolean
  mock?: boolean
  onBack: () => void
  onConfirm: () => void
}

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f2d5e', wordBreak: 'break-word' }}>{children || '-'}</div>
  </div>
)

const rowStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }

const PettyCashSubmitApprove: React.FC<Props> = ({ open, summary, chain, submitting, mock = false, onBack, onConfirm }) => {
  const columns: ColumnsType<SubmitApproveChainRow> = [
    { title: 'No', key: 'no', width: 60, align: 'center', render: (_v, _r, i) => i + 1 },
    { title: 'Code Employee', dataIndex: 'employeeCode', key: 'employeeCode', width: 150, render: (v: string) => v || '-' },
    { title: 'Seq.App', dataIndex: 'seq', key: 'seq', width: 90, align: 'center' },
    { title: 'ApproveBy', dataIndex: 'approveBy', key: 'approveBy' },
    { title: 'Level App', dataIndex: 'roleNames', key: 'roleNames', width: 200, align: 'center', render: (v: string) => v || '-' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130, align: 'center',
      render: (s: SubmitApproveChainRow['status']) => {
        switch (s?.toUpperCase()) {
          case 'PENDING': return <Tag color="orange">รออนุมัติ</Tag>
          case 'APPROVED': return <Tag color="green">อนุมัติแล้ว</Tag>
          case 'REJECTED': return <Tag color="red">ไม่อนุมัติ</Tag>
          default: return '-'
        }
      },
    },
  ]

  return (
    <Modal
      open={open}
      centered
      width={900}
      style={{ maxWidth: '95vw' }}
      maskClosable={false}
      keyboard={false}
      closable={false}
      destroyOnClose
      title={
        <div style={{ textAlign: 'center', fontFamily: 'Sarabun', fontWeight: 700, color: '#1e3a8a', fontSize: 24 }}>
          Form Submit Approve
          {mock && <Tag color="warning" style={{ margin: '0 0 0 12px', fontSize: 12, verticalAlign: 'middle' }}>โหมดทดสอบ (ไม่บันทึกจริง)</Tag>}
        </div>
      }
      styles={{
        content: { borderRadius: 12, boxShadow: '0 8px 30px rgba(15,45,94,0.18)' },
        body: { maxHeight: '70vh', overflowY: 'auto' },
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onBack} disabled={submitting}>กลับ</Button>
          <Button type="primary" onClick={onConfirm} loading={submitting} disabled={submitting}>
            ยืนยันการอนุมัติ
          </Button>
        </div>
      }
    >
      <div style={{ color: '#d97706', fontWeight: 500, margin: '8px 0 20px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <ExclamationCircleOutlined style={{ marginTop: 4 }} />
        <span>*** กรุณาตรวจสอบข้อมูลก่อนทำการส่งอนุมัติ หากต้องการเลือกใหม่ ให้กดที่ปุ่ม กลับ เพื่อเลือก form ใหม่</span>
      </div>

      <div style={rowStyle}>
        <Field label="เลขที่เอกสาร">{summary.docNo}</Field>
        <Field label="ประเภทเอกสาร">{summary.docTypeLabel}</Field>
        <Field label="วันที่เอกสาร">{summary.docDate}</Field>
      </div>
      <div style={rowStyle}>
        <Field label="โครงการ">{summary.projectCode}</Field>
        <Field label="ประเภทการสั่งซื้อ">{summary.orderTypeLabel}</Field>
      </div>
      <div style={rowStyle}>
        <Field label="แผนก">{summary.deptLabel}</Field>
        <Field label="ยอดเงินสุทธิรวมทั้งหมด">{`${fmt(summary.netAmount)} บาท`}</Field>
      </div>

      <Table<SubmitApproveChainRow>
        rowKey="key"
        size="small"
        bordered={false}
        dataSource={chain}
        columns={columns}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'ไม่พบข้อมูลผู้อนุมัติ' }}
      />
    </Modal>
  )
}

export default PettyCashSubmitApprove
