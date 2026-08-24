import React, { useMemo, useState } from 'react'
import { Row, Col, Card, Table, Tag, Typography, Progress, Input, Select } from 'antd'
import {
  FileTextOutlined, FileProtectOutlined, DollarOutlined, AccountBookOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'

const { Text } = Typography

const PROJECT_OPTIONS = [
  { value: 'all', label: 'ทุกโครงการ' },
  { value: 'B1', label: 'อาคาร 1 — ปรับปรุงระบบไฟฟ้า' },
  { value: 'B2', label: 'อาคาร 2 — งานสุขาภิบาล' },
  { value: 'FAC-S', label: 'FAC-S ศาลายา — ปรับปรุงคลัง' },
  { value: 'FAC-P', label: 'FAC-P ปราจีนบุรี — ต่อเติมโรงงาน' },
]

const PERIOD_OPTIONS = [
  { value: 'month', label: 'เดือนนี้' },
  { value: 'quarter', label: 'ไตรมาสนี้' },
  { value: 'year', label: 'ปีนี้' },
]

const statCards = [
  {
    label: 'PO รออนุมัติ', value: '18', sub: '฿2,450,000',
    color: '#d97706', bg: '#fef3c7', icon: <FileTextOutlined />,
  },
  {
    label: 'WO รออนุมัติ', value: '6', sub: '฿980,000',
    color: '#2563eb', bg: '#dbeafe', icon: <FileProtectOutlined />,
  },
  {
    label: 'เงินสดย่อยรออนุมัติ', value: '11', sub: '฿62,300',
    color: '#16a34a', bg: '#dcfce7', icon: <DollarOutlined />,
  },
  {
    label: 'มูลค่ารวมเดือนนี้', value: '฿3.49M', sub: '▲ 8% จากเดือนก่อน', subColor: '#16a34a',
    color: '#7c3aed', bg: '#ede9fe', icon: <AccountBookOutlined />,
  },
]

const monthlyChart = [
  { month: 'เม.ย.', po: 1.8, wo: 0.6, pc: 0.05 },
  { month: 'พ.ค.', po: 2.1, wo: 0.9, pc: 0.07 },
  { month: 'มิ.ย.', po: 1.6, wo: 0.7, pc: 0.04 },
  { month: 'ก.ค.', po: 2.6, wo: 1.1, pc: 0.06 },
  { month: 'ส.ค.', po: 2.9, wo: 1.3, pc: 0.08 },
  { month: 'ก.ย.', po: 2.45, wo: 0.98, pc: 0.062 },
]

const statusPie = [
  { label: 'อนุมัติแล้ว', value: 58, color: '#16a34a' },
  { label: 'รออนุมัติ', value: 22, color: '#d97706' },
  { label: 'ตีกลับ/ยกเลิก', value: 10, color: '#dc2626' },
  { label: 'ร่าง', value: 10, color: '#7dd3fc' },
]

const projectCosts = [
  { key: 'B1', project: 'อาคาร 1 — ปรับปรุงระบบไฟฟ้า', po: 7, wo: 2, amount: 1240000, pct: 72 },
  { key: 'B2', project: 'อาคาร 2 — งานสุขาภิบาล', po: 4, wo: 3, amount: 860000, pct: 48 },
  { key: 'FAC-S', project: 'FAC-S ศาลายา — ปรับปรุงคลัง', po: 5, wo: 1, amount: 980000, pct: 56 },
  { key: 'FAC-P', project: 'FAC-P ปราจีนบุรี — ต่อเติมโรงงาน', po: 2, wo: 0, amount: 410000, pct: 24 },
]

const actionItems = [
  { key: '1', type: 'PO', docNo: 'PO-2026-000412', project: 'อาคาร 1', projectKey: 'B1', item: 'จัดซื้อเหล็กโครงสร้าง', amount: 540000, status: 'รออนุมัติ' },
  { key: '2', type: 'WO', docNo: 'WO26080012', project: 'FAC-S ศาลายา', projectKey: 'FAC-S', item: 'งานปรับปรุงอาคาร', amount: 980000, status: 'รออนุมัติ' },
  { key: '3', type: 'เงินสดย่อย', docNo: 'PC-000088', project: 'อาคาร 2', projectKey: 'B2', item: 'ค่าน้ำมันรถขนส่ง', amount: 1200, status: 'เกินกำหนด' },
]

const typeTagColor: Record<string, string> = {
  PO: 'gold',
  WO: 'blue',
  'เงินสดย่อย': 'green',
}

const statusTagStyle: Record<string, { color: string; bg: string }> = {
  'รออนุมัติ': { color: '#d97706', bg: '#fef3c7' },
  'เกินกำหนด': { color: '#dc2626', bg: '#fee2e2' },
}

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const tableTitleStyle: React.CSSProperties = {
  color: '#1e3a8a',
  fontWeight: 600,
  fontFamily: "'Sarabun', sans-serif",
}

const BarChartMock: React.FC = () => {
  const width = 560
  const height = 260
  const padding = { top: 20, right: 10, bottom: 30, left: 40 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom
  const maxVal = 3
  const groupW = chartW / monthlyChart.length
  const barW = 12

  const yTicks = [0, 1, 2, 3]

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
        {yTicks.map((t) => {
          const y = padding.top + chartH - (t / maxVal) * chartH
          return (
            <g key={t}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={padding.left - 8} y={y + 4} fontSize={10} fill="#94a3b8" textAnchor="end">{t}M</text>
            </g>
          )
        })}
        {monthlyChart.map((d, i) => {
          const gx = padding.left + i * groupW
          const bars = [
            { v: d.po, color: '#f59e0b' },
            { v: d.wo, color: '#3b82f6' },
            { v: d.pc, color: '#4ade80' },
          ]
          return (
            <g key={d.month}>
              {bars.map((b, bi) => {
                const h = (b.v / maxVal) * chartH
                const x = gx + groupW / 2 - (barW * 3 + 6) / 2 + bi * (barW + 3)
                const y = padding.top + chartH - h
                return <rect key={bi} x={x} y={y} width={barW} height={h} fill={b.color} rx={2} />
              })}
              <text x={gx + groupW / 2} y={height - padding.bottom + 16} fontSize={11} fill="#64748b" textAnchor="middle">
                {d.month}
              </text>
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 8 }}>
        {[
          { label: 'PO', color: '#f59e0b' },
          { label: 'WO', color: '#3b82f6' },
          { label: 'เงินสดย่อย', color: '#4ade80' },
        ].map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: 'inline-block' }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  )
}

const DonutChartMock: React.FC = () => {
  const size = 180
  const strokeW = 26
  const r = (size - strokeW) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  let offset = 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width={size} height={size}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {statusPie.map((s) => {
            const dash = (s.value / 100) * circumference
            const circle = (
              <circle
                key={s.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={strokeW}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            )
            offset += dash
            return circle
          })}
        </g>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {statusPie.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
            <span>{s.label}</span>
            <span style={{ fontWeight: 600, color: '#1e3a8a' }}>{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const DashboardPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [period, setPeriod] = useState('month')

  const filteredActionItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return actionItems.filter((row) => {
      const matchesProject = projectFilter === 'all' || row.projectKey === projectFilter
      const matchesSearch =
        !q ||
        row.docNo.toLowerCase().includes(q) ||
        row.project.toLowerCase().includes(q) ||
        row.item.toLowerCase().includes(q)
      return matchesProject && matchesSearch
    })
  }, [search, projectFilter])

  const filteredProjectCosts = useMemo(() => {
    if (projectFilter === 'all') return projectCosts
    return projectCosts.filter((row) => row.key === projectFilter)
  }, [projectFilter])

  const projectCostColumns = [
    { title: 'โครงการ', dataIndex: 'project', key: 'project' },
    { title: 'จำนวน PO', dataIndex: 'po', key: 'po', align: 'right' as const },
    { title: 'จำนวน WO', dataIndex: 'wo', key: 'wo', align: 'right' as const },
    {
      title: 'มูลค่ารวม', dataIndex: 'amount', key: 'amount', align: 'right' as const,
      render: (v: number) => `฿${v.toLocaleString()}`,
    },
    {
      title: 'สัดส่วนงบ', dataIndex: 'pct', key: 'pct',
      render: (v: number) => <Progress percent={v} showInfo={false} strokeColor="#2563eb" size="small" />,
    },
  ]

  const actionColumns = [
    {
      title: 'ประเภท', dataIndex: 'type', key: 'type',
      render: (v: string) => <Tag color={typeTagColor[v]}>{v}</Tag>,
    },
    {
      title: 'เลขที่', dataIndex: 'docNo', key: 'docNo',
      render: (v: string) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{v}</span>,
    },
    { title: 'โครงการ', dataIndex: 'project', key: 'project' },
    { title: 'รายการ', dataIndex: 'item', key: 'item' },
    {
      title: 'มูลค่า', dataIndex: 'amount', key: 'amount', align: 'right' as const,
      render: (v: number) => `฿${v.toLocaleString()}`,
    },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const s = statusTagStyle[v] || { color: '#64748b', bg: '#f1f5f9' }
        return (
          <Tag style={{ color: s.color, background: s.bg, border: 'none', fontWeight: 500 }}>{v}</Tag>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="ภาพรวมระบบจัดซื้อจัดจ้าง"
        breadcrumbs={[{ title: 'หน้าหลัก' }]}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={10}>
          <Input
            placeholder="ค้นหาเลขที่ PO / WO / โครงการ"
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Select
            style={{ width: '100%' }}
            options={PROJECT_OPTIONS}
            value={projectFilter}
            onChange={setProjectFilter}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Select
            style={{ width: '100%' }}
            options={PERIOD_OPTIONS}
            value={period}
            onChange={setPeriod}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {statCards.map((c) => (
          <Col xs={24} sm={12} xl={6} key={c.label}>
            <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ color: '#64748b', fontSize: 12 }}>{c.label}</Text>
                  <div style={{ fontSize: 25, fontWeight: 600, color: '#1e3a8a', marginTop: 6, fontFamily: 'Sarabun' }}>
                    {c.value}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: c.subColor || '#94a3b8' }}>{c.sub}</div>
                </div>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: c.bg, color: c.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  {c.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} xl={14}>
          <Card style={cardStyle} title={<span style={tableTitleStyle}>มูลค่าเอกสารรายเดือน (6 เดือนล่าสุด)</span>}>
            <BarChartMock />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card style={cardStyle} title={<span style={tableTitleStyle}>สัดส่วนสถานะเอกสารทั้งหมด</span>}>
            <DonutChartMock />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card style={cardStyle} title={<span style={tableTitleStyle}>ค่าใช้จ่ายแยกตามโครงการ</span>}>
            <Table
              dataSource={filteredProjectCosts}
              columns={projectCostColumns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card style={cardStyle} title={<span style={tableTitleStyle}>รายการที่ต้องดำเนินการ</span>}>
            <Table
              dataSource={filteredActionItems}
              columns={actionColumns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DashboardPage
