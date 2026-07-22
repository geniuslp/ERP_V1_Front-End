// TEMPLATE — copy this action bar pattern when building any new Create/Edit page.
// Replace MENU_CODE_HERE with the real menu_code for the page (check the menus table).
import { Button, Space, Card } from 'antd'
import { SaveOutlined, SendOutlined, EditOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons'
import PermissionButton from '@/components/common/PermissionButton'

const MENU_CODE = 'MENU_CODE_HERE'

function ActionBarTemplate({ submitting, onSaveDraft, onSubmit, onEdit, onCancel, onDelete }: {
  submitting: boolean
  onSaveDraft?: () => void
  onSubmit?: () => void
  onEdit?: () => void
  onCancel?: () => void
  onDelete?: () => void
}) {
  return (
    <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
      <Space wrap>
        {onEdit && (
          <PermissionButton action="update" menuCode={MENU_CODE} icon={<EditOutlined />} disabled={submitting} onClick={onEdit}>
            แก้ไข
          </PermissionButton>
        )}
        {onCancel && (
          <PermissionButton action="update" menuCode={MENU_CODE} icon={<CloseOutlined />} danger disabled={submitting} onClick={onCancel}>
            ยกเลิก
          </PermissionButton>
        )}
        {onDelete && (
          <PermissionButton action="delete" menuCode={MENU_CODE} icon={<DeleteOutlined />} danger disabled={submitting} onClick={onDelete}>
            ลบ
          </PermissionButton>
        )}
        {onSaveDraft && (
          <PermissionButton action="write" menuCode={MENU_CODE} icon={<SaveOutlined />} loading={submitting} disabled={submitting} onClick={onSaveDraft}>
            บันทึกร่าง
          </PermissionButton>
        )}
        {onSubmit && (
          <PermissionButton action="write" menuCode={MENU_CODE} type="primary" icon={<SendOutlined />} loading={submitting} disabled={submitting} onClick={onSubmit}>
            ส่ง
          </PermissionButton>
        )}
        {/* Reject/Approve intentionally left as plain <Button> — see CLAUDE.md Permission
            Gating section for why. Do not gate these with write/update as a stopgap. */}
      </Space>
    </Card>
  )
}

export default ActionBarTemplate
