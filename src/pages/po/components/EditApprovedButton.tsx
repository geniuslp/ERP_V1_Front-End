import React, { useState } from 'react'
import { Modal, Form, Input } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import PermissionButton from '@/components/common/PermissionButton'

interface EditApprovedButtonProps {
  poId: number
  poNo: string
  menuCode?: string
  size?: 'small' | 'middle' | 'large'
}

// Edit-approved requires a mandatory reason (per the original edit-approved
// backend design) before navigating into POCreatePage's edit flow — the
// reason travels via router state and POCreatePage sends it to
// PUT /po/:id/edit-approved instead of the normal PUT /po/:id on save.
const EditApprovedButton: React.FC<EditApprovedButtonProps> = ({
  poId, poNo, menuCode = 'MENU_PO_STATUS', size,
}) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const handleConfirm = async () => {
    try {
      const { reason } = await form.validateFields()
      setOpen(false)
      form.resetFields()
      navigate(`/po/${poId}/edit`, { state: { editApprovedReason: reason } })
    } catch {
      // validation errors shown inline
    }
  }

  return (
    <>
      <PermissionButton
        menuCode={menuCode}
        action="edit"
        icon={<EditOutlined />}
        size={size}
        onClick={() => setOpen(true)}
      >
        แก้ไข
      </PermissionButton>
      <Modal
        open={open}
        title="แก้ไขใบสั่งซื้อที่อนุมัติแล้ว"
        okText="ดำเนินการต่อ"
        cancelText="ยกเลิก"
        onOk={handleConfirm}
        onCancel={() => { setOpen(false); form.resetFields() }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="reason"
            label={`เหตุผลในการแก้ไข PO ${poNo}`}
            rules={[
              { required: true, message: 'กรุณาระบุเหตุผลในการแก้ไข' },
              { min: 5, message: 'เหตุผลต้องมีอย่างน้อย 5 ตัวอักษร' },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="ระบุเหตุผลที่ต้องการแก้ไขใบสั่งซื้อที่อนุมัติแล้ว..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default EditApprovedButton
