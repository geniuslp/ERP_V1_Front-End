import React, { useState } from 'react'
import { Button, Modal, Radio, message } from 'antd'
import type { ButtonProps } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { useAppSelector } from '@/store'
import { workOrderService } from '@/services/workOrderService'
import WorkOrderPrintView, { type WOPrintTemplate, type WOPrintData } from '@/pages/workOrder/WorkOrderPrintView'

const TEMPLATE_OPTIONS: { value: WOPrintTemplate; label: string }[] = [
  { value: 'WO_STANDARD', label: 'แบบฟอร์มสัญญาสั่งจ้าง' },
  { value: 'PO_HEADER', label: 'แบบฟอร์มรายละเอียดสัญญาจ้าง' },
]

interface Props {
  // Saved-record path: fetches GET /work-order/:id when clicked.
  id?: number | string
  // Unsaved-preview path: a getter (not a static value) so it's read at
  // confirm-click time — typing into the caller's antd Form doesn't
  // re-render this component, so a plain snapshot prop would go stale as
  // soon as the user edits a field after mount. Used by WorkOrderCreatePage's
  // temporary "always show the print button, even on a blank new form" state
  // (see TODO there). `id` takes priority when both are given, since it's
  // the source of truth once a record is actually saved.
  getFormData?: () => WOPrintData
  buttonProps?: ButtonProps
  label?: string
  // When set, the button prints that template straight away (no picker modal) — used where each template gets its own button.
  fixedTemplate?: WOPrintTemplate
}

// Shared by WorkOrderDetailPage (single doc) and WorkOrderListPage (row action)
// so the template-picker + print flow lives in one place instead of being
// duplicated per page. Same Modal-based "choose an option before proceeding"
// pattern used elsewhere in this codebase (e.g. the reject-reason Modal on
// WorkOrderDetailPage / POApprovalDetailPage).
const WorkOrderPrintTrigger: React.FC<Props> = ({ id, getFormData, buttonProps, label = 'พิมพ์เอกสาร', fixedTemplate }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickedTemplate, setTemplate] = useState<WOPrintTemplate>('WO_STANDARD')
  const template = fixedTemplate ?? pickedTemplate
  const [loading, setLoading] = useState(false)
  const [printData, setPrintData] = useState<WOPrintData | null>(null)

  const handleConfirm = async () => {
    if (id) {
      setLoading(true)
      try {
        // Same data source for both templates — GET /work-order/:id — only the
        // rendered layout differs.
        const wo = await workOrderService.get(accessToken, id)
        // The retention remark (7.3) lives in the payment conditions, not on the WO itself. A failed load only drops the remark.
        let retentionRemarks: string | null = null
        try {
          const pc = await workOrderService.getPaymentConditions(accessToken, id)
          retentionRemarks = pc.retentions.map((r) => (r.remarks ?? '').trim()).filter(Boolean).join(', ') || null
        } catch { /* print without the remark */ }
        setPrintData({ ...wo, retention_remarks: retentionRemarks })
        setPickerOpen(false)
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลสำหรับพิมพ์ไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
      return
    }

    // No saved id yet — render straight from the caller's in-memory form
    // state instead of fetching. See TODO on WorkOrderCreatePage.
    setPrintData(getFormData?.() ?? {})
    setPickerOpen(false)
  }

  return (
    <>
      <Button
        icon={<PrinterOutlined />}
        loading={fixedTemplate ? loading : undefined}
        onClick={() => (fixedTemplate ? handleConfirm() : setPickerOpen(true))}
        {...buttonProps}
      >
        {label}
      </Button>

      <Modal
        title="เลือกรูปแบบเอกสาร"
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onOk={handleConfirm}
        confirmLoading={loading}
        okText="🖨️ พิมพ์ / บันทึกเป็น PDF"
        cancelText="ยกเลิก"
      >
        <Radio.Group
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {TEMPLATE_OPTIONS.map((o) => (
            <Radio key={o.value} value={o.value}>{o.label}</Radio>
          ))}
        </Radio.Group>
      </Modal>

      {printData && (
        <WorkOrderPrintView
          data={printData}
          template={template}
          onReady={() => {
            window.print()
            setPrintData(null)
          }}
        />
      )}
    </>
  )
}

export default WorkOrderPrintTrigger
