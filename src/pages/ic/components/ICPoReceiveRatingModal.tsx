import React, { useEffect } from 'react'
import { Modal, Form, Rate, Input, message } from 'antd'
import axios from 'axios'
import { useAppSelector } from '@/store'

const { TextArea } = Input

const BASE_URL = (import.meta as any).env?.VITE_API_URL

interface RatingFormValues {
  score_quality: number
  score_quantity: number
  score_ontime: number
  score_notes?: string
}

interface ICPoReceiveRatingModalProps {
  open: boolean
  poId: number | null
  docId: number | null
  onClose: () => void
  // Fired after a successful submit OR an already-rated (409) response —
  // either way, this modal has nothing more to do for this document.
  onDone?: () => void
}

const labelStyle: React.CSSProperties = { fontWeight: 500, color: '#0f2d5e' }

const ICPoReceiveRatingModal: React.FC<ICPoReceiveRatingModalProps> = ({ open, poId, docId, onClose, onDone }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [form] = Form.useForm<RatingFormValues>()
  const [submitting, setSubmitting] = React.useState(false)

  useEffect(() => {
    if (open) form.resetFields()
  }, [open, form])

  const handleSubmit = async (values: RatingFormValues) => {
    if (!poId || !docId) return
    setSubmitting(true)
    try {
      await axios.put(
        `${BASE_URL}/ic/pos/${poId}/receive-documents/${docId}/rating`,
        {
          score_quality: values.score_quality,
          score_quantity: values.score_quantity,
          score_ontime: values.score_ontime,
          score_notes: values.score_notes || undefined,
        },
        { headers: authHeader },
      )
      message.success('บันทึกคะแนนประเมินผู้ขายสำเร็จ')
      onDone?.()
      onClose()
    } catch (err: any) {
      const status = err?.response?.status
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message
      if (status === 409) {
        // Someone else (or an earlier attempt) already rated this document —
        // not an error the user needs to act on, just stop quietly.
        message.info(serverMsg || 'เอกสารนี้ถูกประเมินไปแล้ว')
        onDone?.()
        onClose()
      } else if (status === 400) {
        message.error(serverMsg || 'ไม่สามารถบันทึกคะแนนประเมินได้')
      } else {
        message.error(serverMsg || err?.message || 'บันทึกคะแนนประเมินไม่สำเร็จ')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="ประเมินผู้ขาย"
      open={open}
      // Mandatory: no X, no "ปิด", not dismissible by Esc or clicking outside. Sits above the
      // success modal until the rating is saved.
      closable={false}
      maskClosable={false}
      keyboard={false}
      zIndex={1100}
      onOk={() => form.submit()}
      okText="บันทึกคะแนน"
      cancelButtonProps={{ style: { display: 'none' } }}
      confirmLoading={submitting}
      destroyOnHidden
      width={480}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label={<span style={labelStyle}>คุณภาพสินค้า</span>}
          name="score_quality"
          rules={[{ required: true, type: 'number', min: 1, message: 'กรุณาให้คะแนนคุณภาพสินค้า' }]}
        >
          <Rate allowClear={false} />
        </Form.Item>
        <Form.Item
          label={<span style={labelStyle}>ปริมาณ/ความครบถ้วน</span>}
          name="score_quantity"
          rules={[{ required: true, type: 'number', min: 1, message: 'กรุณาให้คะแนนปริมาณ/ความครบถ้วน' }]}
        >
          <Rate allowClear={false} />
        </Form.Item>
        <Form.Item
          label={<span style={labelStyle}>ความตรงเวลา</span>}
          name="score_ontime"
          rules={[{ required: true, type: 'number', min: 1, message: 'กรุณาให้คะแนนความตรงเวลา' }]}
        >
          <Rate allowClear={false} />
        </Form.Item>
        <Form.Item label={<span style={labelStyle}>หมายเหตุ</span>} name="score_notes">
          <TextArea rows={3} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ICPoReceiveRatingModal
