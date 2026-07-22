import React, { useState } from 'react'
import { Card, Input, Button, Table, Descriptions, InputNumber, Space, message, Modal, Rate, Alert } from 'antd'
import { SearchOutlined, InboxOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import type {
  POSearchResult, POSearchLine, GRNCreateLine, GRNCreateResult, GRNScorePayload,
} from '@/types'

const MENU_CODE = 'MENU_STOCK_RECEIVING'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const formatDate = (d?: string | null) => (d ? dayjs(d).format('DD MMM YYYY') : '—')

interface ReceiptLine extends POSearchLine {
  add_qty: number
}

const GoodsReceiptPage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [poNoInput, setPoNoInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [po, setPo] = useState<POSearchResult | null>(null)
  const [lines, setLines] = useState<ReceiptLine[]>([])
  const [saving, setSaving] = useState(false)

  const [matches, setMatches] = useState<POSearchResult[]>([])
  const [pickModalOpen, setPickModalOpen] = useState(false)

  const [scoreModalOpen, setScoreModalOpen] = useState(false)
  const [scoreGrnId, setScoreGrnId] = useState<number | null>(null)
  const [scoreQuality, setScoreQuality] = useState(0)
  const [scoreQuantity, setScoreQuantity] = useState(0)
  const [scoreOntime, setScoreOntime] = useState(0)
  const [scoreNotes, setScoreNotes] = useState('')
  const [scoreSaving, setScoreSaving] = useState(false)

  const resetSearch = () => {
    setPoNoInput('')
    setPo(null)
    setLines([])
    setNotFound(false)
    setMatches([])
    setPickModalOpen(false)
  }

  const selectMatch = (m: POSearchResult) => {
    setPo(m)
    setLines(
      (m.lines || []).map((l) => ({
        ...l,
        add_qty: Math.max(0, l.qty_ordered - l.qty_received),
      }))
    )
    setPickModalOpen(false)
  }

  const handleSearch = async () => {
    const poNo = poNoInput.trim()
    if (!poNo) return
    setSearching(true)
    setNotFound(false)
    setPo(null)
    setLines([])
    setMatches([])
    try {
      const res = await axios.get(`${BASE_URL}/po/search`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { po_no: poNo },
      })
      const data = res.data?.data
      // /po/search now does partial/suffix matching on po_no, so it can
      // return more than one candidate — never assume a single result.
      const results: POSearchResult[] = Array.isArray(data) ? data : data ? [data] : []

      if (results.length === 0) {
        setNotFound(true)
      } else if (results.length === 1) {
        selectMatch(results[0])
      } else {
        setMatches(results)
        setPickModalOpen(true)
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true)
      } else {
        message.error(err?.response?.data?.message || err?.message || 'ค้นหา PO ไม่สำเร็จ')
      }
    } finally {
      setSearching(false)
    }
  }

  const setLineAddQty = (poLineId: number, val: number | null) => {
    setLines((prev) => prev.map((l) => (l.po_line_id === poLineId ? { ...l, add_qty: val ?? 0 } : l)))
  }

  const handleSave = async () => {
    if (!po) return
    if (lines.some((l) => l.add_qty < 0)) {
      message.warning('จำนวนที่รับเข้าต้องไม่ติดลบ')
      return
    }
    const receivingLines: GRNCreateLine[] = lines
      .filter((l) => l.add_qty > 0)
      .map((l) => ({ po_line_id: l.po_line_id, mat_code: l.mat_code, add_qty: l.add_qty }))

    if (receivingLines.length === 0) {
      message.warning('กรุณาระบุจำนวนที่รับเข้าอย่างน้อย 1 รายการ')
      return
    }

    setSaving(true)
    try {
      const res = await axios.post(
        `${BASE_URL}/grn/receive`,
        {
          po_id: po.po_id,
          warehouse_code: po.warehouse_code,
          supplier_code: po.supplier_code,
          lines: receivingLines,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const result: GRNCreateResult = res.data?.data
      message.success(`บันทึกรับเข้าสำเร็จ (${result.grn_no})`)
      setScoreGrnId(result.grn_id)
      setScoreQuality(0)
      setScoreQuantity(0)
      setScoreOntime(0)
      setScoreNotes('')
      setScoreModalOpen(true)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'บันทึกรับเข้าไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveScore = async () => {
    if (!scoreGrnId) return
    if (scoreQuality < 1 || scoreQuantity < 1 || scoreOntime < 1) {
      message.warning('กรุณาให้คะแนนครบทั้ง 3 หัวข้อ')
      return
    }
    const payload: GRNScorePayload = {
      score_quality: scoreQuality,
      score_quantity: scoreQuantity,
      score_ontime: scoreOntime,
      score_notes: scoreNotes || undefined,
    }
    setScoreSaving(true)
    try {
      await axios.post(`${BASE_URL}/grn/${scoreGrnId}/score`, payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      message.success('บันทึกคะแนนสำเร็จ')
      setScoreModalOpen(false)
      resetSearch()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'บันทึกคะแนนไม่สำเร็จ')
    } finally {
      setScoreSaving(false)
    }
  }

  const columns = [
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'ชื่อวัสดุ', dataIndex: 'item_name', key: 'item_name', ellipsis: true },
    { title: 'จำนวนสั่งซื้อ', dataIndex: 'qty_ordered', key: 'qty_ordered', align: 'right' as const },
    {
      title: 'คงเหลือในคลัง ณ ตอนนี้',
      dataIndex: 'current_stock_qty',
      key: 'current_stock_qty',
      align: 'right' as const,
      render: (val: number | null) => (val ?? 0).toLocaleString(),
    },
    {
      title: 'จำนวนที่รับเข้า',
      key: 'add_qty',
      align: 'right' as const,
      render: (_: any, record: ReceiptLine) => (
        <InputNumber
          min={0}
          value={record.add_qty}
          onChange={(val) => setLineAddQty(record.po_line_id, val)}
          style={{ width: 110 }}
        />
      ),
    },
    {
      title: 'จะเป็น',
      key: 'will_be',
      align: 'right' as const,
      render: (_: any, record: ReceiptLine) => {
        const total = (record.current_stock_qty ?? 0) + (record.add_qty || 0)
        return <span style={{ fontWeight: 600, color: '#2563eb' }}>{total.toLocaleString()}</span>
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="รับเข้า"
        subtitle="ค้นหา PO ที่อนุมัติแล้วเพื่อบันทึกรับเข้าสินค้า"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'รับเข้า' }]}
      />

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="ค้นหาเลข PO"
            value={poNoInput}
            onChange={(e) => setPoNoInput(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={handleSearch}>
            ค้นหา
          </Button>
        </Space>

        {notFound && (
          <Alert
            type="warning"
            showIcon
            message="ไม่พบ PO หรือ PO ยังไม่ได้รับการอนุมัติ"
            style={{ marginBottom: 16 }}
          />
        )}

        {po && (
          <>
            <Descriptions
              bordered
              size="small"
              column={2}
              style={{ marginBottom: 20 }}
              labelStyle={{ width: 140, fontWeight: 600, background: '#f8fafc' }}
            >
              <Descriptions.Item label="เลข PO">{po.po_no}</Descriptions.Item>
              <Descriptions.Item label="Supplier">{po.supplier_code}</Descriptions.Item>
              <Descriptions.Item label="Warehouse">{po.warehouse_code || '—'}</Descriptions.Item>
              <Descriptions.Item label="สถานะ PO">{po.status}</Descriptions.Item>
              <Descriptions.Item label="สกุลเงิน">{po.currency}</Descriptions.Item>
              <Descriptions.Item label="มูลค่าสุทธิ">{po.net_amount?.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="วันที่ส่ง">{formatDate(po.expected_date)}</Descriptions.Item>
            </Descriptions>

            <Table
              rowKey="po_line_id"
              columns={columns}
              dataSource={lines}
              pagination={false}
              locale={{ emptyText: 'ไม่มีรายการใน PO นี้' }}
            />

            <div style={{ textAlign: 'right', marginTop: 20 }}>
              <PermissionButton
                menuCode={MENU_CODE}
                action="write"
                type="primary"
                icon={<InboxOutlined />}
                loading={saving}
                onClick={handleSave}
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
              >
                บันทึกรับเข้า
              </PermissionButton>
            </div>
          </>
        )}
      </Card>

      <Modal
        title="พบ PO มากกว่า 1 รายการ — กรุณาเลือก"
        open={pickModalOpen}
        onCancel={() => setPickModalOpen(false)}
        footer={null}
        width={760}
        destroyOnClose
      >
        <Table
          rowKey="po_id"
          dataSource={matches}
          pagination={false}
          size="small"
          columns={[
            { title: 'เลข PO', dataIndex: 'po_no', key: 'po_no' },
            { title: 'Supplier', dataIndex: 'supplier_code', key: 'supplier_code' },
            { title: 'สถานะ', dataIndex: 'status', key: 'status' },
            {
              title: 'วันที่ส่ง',
              dataIndex: 'expected_date',
              key: 'expected_date',
              render: (v: string | null) => formatDate(v),
            },
            {
              title: '',
              key: 'action',
              render: (_: unknown, record: POSearchResult) => (
                <Button type="link" onClick={() => selectMatch(record)}>เลือก</Button>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title="ให้คะแนนซัพพลายเออร์"
        open={scoreModalOpen}
        onCancel={() => { setScoreModalOpen(false); resetSearch() }}
        footer={null}
        width={440}
        centered
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 4, color: '#64748b', fontSize: 13 }}>คุณภาพสินค้า</div>
            <Rate value={scoreQuality} onChange={setScoreQuality} />
          </div>
          <div>
            <div style={{ marginBottom: 4, color: '#64748b', fontSize: 13 }}>ความครบถ้วนของจำนวน</div>
            <Rate value={scoreQuantity} onChange={setScoreQuantity} />
          </div>
          <div>
            <div style={{ marginBottom: 4, color: '#64748b', fontSize: 13 }}>ความตรงเวลาในการส่งของ</div>
            <Rate value={scoreOntime} onChange={setScoreOntime} />
          </div>
          <div>
            <div style={{ marginBottom: 4, color: '#64748b', fontSize: 13 }}>หมายเหตุ (ถ้ามี)</div>
            <Input.TextArea rows={3} value={scoreNotes} onChange={(e) => setScoreNotes(e.target.value)} />
          </div>
          <Button type="primary" loading={scoreSaving} onClick={handleSaveScore} block>
            บันทึกคะแนน
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default GoodsReceiptPage
