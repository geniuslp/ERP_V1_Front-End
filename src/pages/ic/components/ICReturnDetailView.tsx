import React, { useEffect, useState } from 'react'
import { Button, Descriptions, Space, Spin, Table, message } from 'antd'
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import { useAppSelector } from '@/store'
import ICDocTypeTag from './ICDocTypeTag'
import ICPoReturnPrint, { buildReturnPrintData, type ICReturnPrintData } from './ICPoReturnPrint'
import { runBrowserPrint } from './ICPrintLayout'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

interface Props {
  returnId: number
  onBack: () => void
}

const formatQty = (value: number) =>
  value.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Read-only view of one PO Return document (GET /ic/returns/:id) with a print button. */
const ICReturnDetailView: React.FC<Props> = ({ returnId, onBack }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [raw, setRaw] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [printData, setPrintData] = useState<ICReturnPrintData | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    axios
      .get(`${BASE_URL}/ic/returns/${returnId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => { if (!cancelled) setRaw(res.data) })
      .catch((err) => {
        if (!cancelled) message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลใบคืนไม่สำเร็จ')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnId])

  const d = raw?.data ?? raw ?? {}
  const h = d.header ?? d.return ?? d
  const lines: any[] = d.lines ?? h.lines ?? []
  const print = raw ? buildReturnPrintData(raw) : null
  const projectCode = d.project_code ?? h.project_code
  const projectName = d.project_name ?? h.project_name
  const when = h.return_date ?? h.created_at

  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ paddingLeft: 0 }}>
          กลับไปที่รายการเอกสาร
        </Button>
        <Button icon={<PrinterOutlined />} disabled={!print} onClick={() => print && setPrintData(print)}>
          พิมพ์ใบคืน
        </Button>
      </div>

      <Space size={8} style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#d97706' }}>{print?.returnNo || '-'}</span>
        <ICDocTypeTag docType="RETURN" />
      </Space>

      <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="เลขที่ใบสั่งซื้อ">{print?.poNo || '-'}</Descriptions.Item>
        <Descriptions.Item label="โครงการ">
          {[projectCode, projectName].filter(Boolean).join(' ') || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="ผู้ขาย">{print?.supplierName || '-'}</Descriptions.Item>
        <Descriptions.Item label="วันที่คืน">{when ? dayjs(when).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
        <Descriptions.Item label="ผู้สร้าง">{h.created_by_name ?? d.created_by_name ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="หมายเหตุ">
          <span style={{ whiteSpace: 'pre-wrap' }}>{print?.remarks?.trim() || '-'}</span>
        </Descriptions.Item>
      </Descriptions>

      <Table
        rowKey={(_, i) => String(i)}
        size="small"
        pagination={false}
        dataSource={lines}
        locale={{ emptyText: 'ไม่พบรายการสินค้า' }}
        columns={[
          { title: 'ลำดับ', key: 'no', width: 60, render: (_: unknown, __: any, i: number) => i + 1 },
          { title: 'CostCode', dataIndex: 'cost_code', key: 'cost_code', width: 120, render: (v: string) => v || '-' },
          { title: 'MatCode', dataIndex: 'mat_code', key: 'mat_code', width: 120 },
          {
            title: 'รายการ',
            key: 'desc',
            render: (_: unknown, l: any) =>
              `${l.mat_name ?? l.item_name ?? l.description ?? ''}${l.spec_name ?? l.spec ? ' ' + (l.spec_name ?? l.spec) : ''}`,
          },
          { title: 'หน่วย', key: 'unit', width: 80, render: (_: unknown, l: any) => l.unit_name ?? l.unit ?? '-' },
          {
            title: 'จำนวนคืน',
            key: 'return_qty',
            width: 110,
            align: 'right' as const,
            render: (_: unknown, l: any) => formatQty(Number(l.return_qty ?? l.qty ?? 0)),
          },
          { title: 'หมายเหตุ', dataIndex: 'remarks', key: 'remarks', render: (v: string) => v || '-' },
        ]}
      />

      {printData && <ICPoReturnPrint data={printData} onReady={() => runBrowserPrint(() => setPrintData(null))} />}
    </Spin>
  )
}

export default ICReturnDetailView
