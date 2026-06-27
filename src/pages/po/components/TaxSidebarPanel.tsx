import React from 'react'
import { Checkbox, Segmented, Tag, Button, Divider, Space } from 'antd'
import { CloseOutlined } from '@ant-design/icons'

interface TaxSidebarPanelProps {
  open: boolean
  onClose: () => void
  useDisc: boolean
  onUseDiscChange: (v: boolean) => void
  discType: 'pct' | 'amt'
  onDiscTypeChange: (v: 'pct' | 'amt') => void
  useVat: boolean
  onUseVatChange: (v: boolean) => void
  useWht: boolean
  onUseWhtChange: (v: boolean) => void
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: '#60a5fa',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
}

const TaxSidebarPanel: React.FC<TaxSidebarPanelProps> = ({
  open, onClose,
  useDisc, onUseDiscChange, discType, onDiscTypeChange,
  useVat, onUseVatChange,
  useWht, onUseWhtChange,
}) => {
  return (
    <div
      style={{
        width: open ? 210 : 0,
        minWidth: open ? 210 : 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderLeft: open ? '0.5px solid #dbeafe' : 'none',
        background: '#ffffff',
        transition: 'width .3s cubic-bezier(.4,0,.2,1), min-width .3s cubic-bezier(.4,0,.2,1)',
      }}
    >
      <div style={{ width: 210, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 8px' }}>
          <span style={sectionTitleStyle}>ภาษี / ส่วนลด</span>
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>

          <Checkbox
            checked={useDisc}
            onChange={(e) => onUseDiscChange(e.target.checked)}
            style={{ fontWeight: 500 }}
          >
            ส่วนลด
          </Checkbox>
          {useDisc && (
            <div style={{ marginTop: 8 }}>
              <Segmented
                options={[
                  { label: '%', value: 'pct' },
                  { label: '฿', value: 'amt' },
                ]}
                value={discType}
                onChange={(v) => onDiscTypeChange(v as 'pct' | 'amt')}
                size="small"
                block
              />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                กรอกค่าในแต่ละแถวได้เลย
              </div>
            </div>
          )}

          <Divider style={{ margin: '16px 0' }} />

          <Checkbox
            checked={useVat}
            onChange={(e) => onUseVatChange(e.target.checked)}
            style={{ fontWeight: 500 }}
          >
            ภาษีมูลค่าเพิ่ม (VAT)
          </Checkbox>
          {useVat && (
            <div style={{ marginLeft: 22, marginBottom: 10, marginTop: 8 }}>
              <Tag color="gold" style={{ fontSize: 12 }}>VAT 7% Fixed</Tag>
            </div>
          )}

          <Divider style={{ margin: '16px 0' }} />

          <Checkbox
            checked={useWht}
            onChange={(e) => onUseWhtChange(e.target.checked)}
            style={{ fontWeight: 500 }}
          >
            หัก ณ ที่จ่าย (WHT)
          </Checkbox>
          {useWht && (
            <div style={{ marginLeft: 22, marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                เลือกอัตราในแต่ละแถวของตาราง
              </div>
              <Space size={4}>
                <Tag color="red">1%</Tag>
                <Tag color="red">3%</Tag>
                <Tag color="red">5%</Tag>
              </Space>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default TaxSidebarPanel
