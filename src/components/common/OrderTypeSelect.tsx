import React from 'react'
import { Modal, Select } from 'antd'
import { ORDER_TYPE_OPTIONS, isOhOrderType } from '@/constants/orderTypes'

interface OrderTypeSelectProps {
  // Injected by the surrounding <Form.Item name="order_type">.
  value?: string
  onChange?: (value?: string) => void
  disabled?: boolean
  allowClear?: boolean
  placeholder?: string
  // True when at least one line already carries a cost code. Switching
  // between the OH group (asset_equipment/office_equipment/asset_tool) and
  // stock/cost makes those cost codes incompatible, so the change is gated
  // behind a confirm dialog and `onClearCostCodes` runs only after OK.
  hasCostCodes: boolean
  onClearCostCodes: () => void
}

// Select for PR/PO "ประเภทการสั่งซื้อ". Switching stock <-> cost (or between the
// OH types) applies immediately, exactly as before.
const OrderTypeSelect: React.FC<OrderTypeSelectProps> = ({
  value, onChange, disabled, allowClear, placeholder, hasCostCodes, onClearCostCodes,
}) => {
  const handleChange = (next?: string) => {
    const crossesOhBoundary = isOhOrderType(value) !== isOhOrderType(next)
    if (!crossesOhBoundary || !hasCostCodes) {
      onChange?.(next)
      return
    }
    Modal.confirm({
      title: 'เปลี่ยนประเภทการสั่งซื้อ?',
      content: 'Cost Code ที่เลือกไว้ในรายการไม่ตรงกับประเภทใหม่ ระบบจะล้าง Cost Code ทุกรายการ ต้องการดำเนินการต่อหรือไม่',
      okText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      onOk: () => {
        onClearCostCodes()
        onChange?.(next)
      },
    })
  }

  return (
    <Select
      placeholder={placeholder}
      style={{ width: '100%' }}
      allowClear={allowClear}
      disabled={disabled}
      value={value}
      onChange={handleChange}
      options={ORDER_TYPE_OPTIONS}
    />
  )
}

export default OrderTypeSelect
