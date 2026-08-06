import React, { useEffect, useRef, useState } from 'react'
import { Card, Select, Spin, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

// Confirmed real contract (internal/handlers/po.go GetReceivablePOs) — no
// supplier_name field, only supplier_code.
interface EligiblePO {
  po_id: number
  po_no: string
  po_date: string
  supplier_code: string
  status: string
  status_receive: string
}

// GET /po/receivable?search=&page=&page_size= — backend-filtered to
// status='APPROVED' AND status_receive IN ('NOT_SENT','SENT','PARTIALLY_RECEIVED')
// AND at least one OPEN/PARTIAL line, so every option here is guaranteed
// receivable. Server-side search, debounced ~300ms — same pattern as
// MaterialSearchSelect.tsx's GET /materials/search.
const GoodsReceiptSearchPage: React.FC = () => {
  const navigate = useNavigate()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [options, setOptions] = useState<EligiblePO[]>([])
  const [fetching, setFetching] = useState(false)
  const [touched, setTouched] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // guards against out-of-order responses overwriting newer results
  const reqIdRef = useRef(0)

  const fetchPOs = (term: string) => {
    const reqId = ++reqIdRef.current
    const run = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/po/receivable`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { search: term.trim() || undefined, page: 1, page_size: 20 },
        })
        if (reqId !== reqIdRef.current) return // stale response — ignore
        const list: EligiblePO[] = res.data?.data?.data ?? []
        setOptions(list)
      } catch (err: any) {
        if (reqId !== reqIdRef.current) return
        setOptions([])
        message.error(err?.response?.data?.message || err?.message || 'ค้นหา PO ไม่สำเร็จ')
      } finally {
        if (reqId === reqIdRef.current) setFetching(false)
      }
    }
    run()
  }

  // Show a default list on first mount, before the user has typed anything.
  useEffect(() => {
    setFetching(true)
    fetchPOs('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // show the spinner immediately while the debounce window elapses
    setFetching(true)
    setTouched(true)
    debounceRef.current = setTimeout(() => fetchPOs(value), 300)
  }

  const handleSelect = (poId: number | null) => {
    if (poId != null) navigate(`/stock/receiving/${poId}`)
  }

  return (
    <div>
      <PageHeader
        title="รับเข้า"
        subtitle="เลือก PO ที่อนุมัติแล้วและยังรับสินค้าไม่ครบ เพื่อบันทึกรับเข้าสินค้า"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'รับเข้า' }]}
      />

      <Card style={cardStyle}>
        <Select
          showSearch
          value={null}
          style={{ width: 420 }}
          placeholder="ค้นหาด้วยเลข PO"
          filterOption={false}
          onSearch={handleSearch}
          onSelect={handleSelect}
          notFoundContent={
            fetching ? (
              <div style={{ textAlign: 'center', padding: 8 }}>
                <Spin size="small" />
              </div>
            ) : touched ? (
              'ไม่พบ PO ที่รอรับเข้า'
            ) : null
          }
          options={options.map((po) => ({
            value: po.po_id,
            po_no: po.po_no,
            supplier_code: po.supplier_code,
            po_date: po.po_date,
          }))}
          optionRender={(option) => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>
                {option.data.po_no}
                {option.data.supplier_code ? ` — ${option.data.supplier_code}` : ''}
              </span>
              <span style={{ color: '#9ca3af', fontSize: 12, flexShrink: 0 }}>
                {option.data.po_date ? dayjs(option.data.po_date).format('DD-MM-YY') : ''}
              </span>
            </div>
          )}
        />
      </Card>
    </div>
  )
}

export default GoodsReceiptSearchPage
