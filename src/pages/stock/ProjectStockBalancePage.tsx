import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Button, Space } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { stockTransferService } from '@/services/stockTransfer.service'
import type { ProjectStockBalanceItem } from '@/types/stockTransfer'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const ProjectStockBalancePage: React.FC = () => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)

  const [data, setData] = useState<ProjectStockBalanceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [projectCode, setProjectCode] = useState('')
  const [matCode, setMatCode] = useState('')

  const fetchData = async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const result = await stockTransferService.projectBalance(accessToken, {
        projectCode: projectCode || undefined,
        matCode: matCode || undefined,
      })
      setData(result.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const columns = [
    { title: 'รหัสโครงการ', dataIndex: 'project_code', key: 'project_code' },
    { title: 'ชื่อโครงการ', dataIndex: 'project_name', key: 'project_name' },
    { title: 'รหัสวัสดุ', dataIndex: 'mat_code', key: 'mat_code' },
    { title: 'ชื่อวัสดุ', dataIndex: 'item_name', key: 'item_name', ellipsis: true },
    { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 90 },
    { title: 'คงเหลือที่โครงการ', dataIndex: 'qty_on_hand', key: 'qty_on_hand', align: 'right' as const },
  ]

  return (
    <div>
      <PageHeader
        title="ยอดคงเหลือที่โครงการ"
        subtitle="วัสดุที่เบิกออกไปโครงการและยังไม่ได้คืน"
        breadcrumbs={[{ title: 'Home' }, { title: 'Stock Management' }, { title: 'ยอดคงเหลือที่โครงการ' }]}
      />

      <Card style={cardStyle}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="รหัสโครงการ"
            value={projectCode}
            onChange={(e) => setProjectCode(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 180 }}
            allowClear
          />
          <Input
            placeholder="รหัสวัสดุ"
            value={matCode}
            onChange={(e) => setMatCode(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 180 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>ค้นหา</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setProjectCode(''); setMatCode(''); fetchData() }}>ล้างตัวกรอง</Button>
        </Space>

        <Table
          rowKey={(r) => `${r.project_code}-${r.mat_code}`}
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: 'ไม่พบยอดคงเหลือที่โครงการ' }}
        />
      </Card>
    </div>
  )
}

export default ProjectStockBalancePage
