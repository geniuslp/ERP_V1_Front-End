import React, { useState } from 'react'
import { Modal, Form, Input } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import PermissionButton from '@/components/common/PermissionButton'

interface WOEditApprovedButtonProps {
  woId: number | string
  woNo: string
  menuCode?: string
  size?: 'small' | 'middle' | 'large'
}

// Edit-approved requires a mandatory reason before navigating into WorkOrderCreatePage's edit
// flow — the reason travels via router state and WorkOrderCreatePage sends it to
// PUT /work-order/:id/edit-approved instead of the normal PUT /work-order/:id on save.
// Mirrors pages/po/components/EditApprovedButton.tsx.
const WOEditApprovedButton: React.FC<WOEditApprovedButtonProps> = ({
  woId, woNo, menuCode = 'MENU_WO_CREATE', size,
}) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const handleConfirm = async () => {
    try {
      const { reason } = await form.validateFields()
      setOpen(false)
      form.resetFields()
      navigate(`/work-order/${woId}/edit`, { state: { editApprovedReason: reason } })
    } catch {
      // validation errors shown inline
    }
  }

  return (
    <>
      <PermissionButton menuCode={menuCode} action="write" icon={<EditOutlined />} size={size} onClick={() => setOpen(true)}>
        แก้ไขหลังอนุมัติ
      </PermissionButton>
      <Modal
        open={open}
        title="แก้ไขหนังสือสั่งจ้างที่อนุมัติแล้ว"
        okText="ดำเนินการต่อ"
        cancelText="ยกเลิก"
        onOk={handleConfirm}
        onCancel={() => { setOpen(false); form.resetFields() }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="reason"
            label={`เหตุผลในการแก้ไข WO ${woNo}`}
            rules={[
              { required: true, message: 'กรุณาระบุเหตุผลในการแก้ไข' },
              { min: 5, message: 'เหตุผลต้องมีอย่างน้อย 5 ตัวอักษร' },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="ระบุเหตุผลที่ต้องการแก้ไขหนังสือสั่งจ้างที่อนุมัติแล้ว..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default WOEditApprovedButton
