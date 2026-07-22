import React, { useRef } from 'react'
import { Input } from 'antd'
import { QrcodeOutlined } from '@ant-design/icons'

interface Props {
  onScan: (value: string) => void
  placeholder?: string
  loading?: boolean
}

const QRScanInput: React.FC<Props> = ({ onScan, placeholder = 'Scan QR Code or enter item code...', loading }) => {
  const ref = useRef<any>(null)

  const handlePressEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const val = (e.target as HTMLInputElement).value.trim()
    if (val) {
      onScan(val)
      setTimeout(() => ref.current?.setValue?.(''), 100)
    }
  }

  return (
    <Input
      ref={ref}
      prefix={<QrcodeOutlined style={{ color: '#6b7280' }} />}
      placeholder={placeholder}
      onPressEnter={handlePressEnter}
      disabled={loading}
      style={{ width: 320 }}
      allowClear
    />
  )
}

export default QRScanInput
