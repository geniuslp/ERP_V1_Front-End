import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Col, Form, Image, Input, Row, Select, Space, TreeSelect, Upload, message } from 'antd'
import type { UploadFile } from 'antd'
import { ArrowLeftOutlined, InboxOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '@/services/api'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { erpIssueService, erpIssueErrText } from '@/services/erpIssueService'
import { ERP_ISSUE_TYPE_OPTIONS, type ERPIssueType } from '@/types/erpIssue'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const MAX_FILES = 10
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.mp4'

interface MenuNode {
  menu_code: string
  menu_name: string
  is_active?: boolean
  children?: MenuNode[]
}
interface TreeNode {
  value: string
  title: string
  children?: TreeNode[]
}
interface ApproverOption {
  value: number
  label: string
  dept?: string | null
  role_names?: string
}

// /menus also returns switched-off menus (e.g. the old MENU_PETTY_CASH / MENU_WO); the API rejects those, so hide them
// together with their children. A backend without is_active (undefined) keeps everything.
const toTree = (nodes: MenuNode[]): TreeNode[] =>
  nodes
    .filter((n) => n.is_active !== false)
    .map((n) => {
      const children = n.children?.length ? toTree(n.children) : []
      return { value: n.menu_code, title: n.menu_name, children: children.length ? children : undefined }
    })

const ERPIssueCreatePage: React.FC = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const user = useAppSelector((s) => s.auth.user)
  const issueType: ERPIssueType | undefined = Form.useWatch('issue_type', form)
  const isNewModule = issueType === 'NEW_MODULE'

  // locked at the moment the form opens; the server stamps the real time and reporter on save
  const [openedAt] = useState(() => dayjs())
  const [menuTree, setMenuTree] = useState<TreeNode[]>([])
  const [approvers, setApprovers] = useState<ApproverOption[]>([])
  const [approversLoading, setApproversLoading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [saving, setSaving] = useState(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  useEffect(() => {
    api.get('/menus')
      .then((res) => {
        const raw = res.data?.data ?? res.data
        setMenuTree(toTree(Array.isArray(raw) ? raw : []))
      })
      .catch(() => setMenuTree([]))
  }, [])

  useEffect(() => {
    if (!isNewModule || approvers.length > 0) return
    setApproversLoading(true)
    api.get('/master/eligible-approvers', { params: { doc_type: 'ERP_ISSUE' } })
      .then((res) => {
        const raw = res.data?.data ?? []
        setApprovers(Array.isArray(raw) ? raw : [])
      })
      .catch(() => message.error('โหลดรายชื่อผู้อนุมัติไม่สำเร็จ'))
      .finally(() => setApproversLoading(false))
  }, [isNewModule, approvers.length])

  const reporterName = useMemo(
    () => user?.full_name_th || user?.fullName || user?.full_name || user?.username || '-',
    [user],
  )

  const beforeUpload = (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      message.error(`${file.name}: ไฟล์ต้องมีขนาดไม่เกิน 10 MB`)
      return Upload.LIST_IGNORE
    }
    if (fileList.length >= MAX_FILES) {
      message.error(`แนบไฟล์ได้ไม่เกิน ${MAX_FILES} ไฟล์`)
      return Upload.LIST_IGNORE
    }
    return false // keep locally, sent together with the form
  }

  // click a thumbnail → full-size preview (images only). Uses the original file, not antd's thumbUrl
  // (that one is a ~200px canvas thumbnail, so the enlarged view looked tiny/blurry).
  const onPreview = (file: UploadFile) => {
    const raw = file.originFileObj as File | undefined
    if (!raw || !(raw.type ?? '').startsWith('image/')) return
    setPreviewSrc(URL.createObjectURL(raw))
  }
  const closePreview = () => {
    setPreviewSrc((src) => {
      if (src) URL.revokeObjectURL(src)
      return null
    })
  }

  const onSubmit = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      const res = await erpIssueService.create({
        issue_type: v.issue_type,
        title: v.title.trim(),
        detail: v.detail.trim(),
        menu_code: v.menu_code || undefined,
        module_name: isNewModule ? v.module_name?.trim() : undefined,
        approver_id: isNewModule ? v.approver_id : undefined,
        files: fileList.map((f) => f.originFileObj as File).filter(Boolean),
      })
      message.success(
        res.status === 'PENDING_APPROVAL'
          ? `ส่งใบแจ้งปัญหา ${res.issue_no} แล้ว — รอผู้อนุมัติพิจารณา`
          : `ส่งใบแจ้งปัญหา ${res.issue_no} แล้ว — สถานะ Pending และแจ้งผู้ดูแลระบบแล้ว`,
      )
      navigate(`/howto/issues/${res.id}`, { replace: true })
    } catch (err) {
      message.error(erpIssueErrText(err, 'บันทึกใบแจ้งปัญหาไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="แจ้งปัญหาการใช้งาน ERP"
        breadcrumbs={[
          { title: 'How To use' },
          { title: 'ใบแจ้งปัญหาการใช้งาน ERP', href: '/howto/issues' },
          { title: 'แจ้งปัญหาใหม่' },
        ]}
      />

      <Form form={form} layout="vertical" initialValues={{ issue_type: 'BUG' }}>
        <Card style={cardStyle} title="ข้อมูลการแจ้ง">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="วันที่แจ้ง">
                <Input value={openedAt.format('DD/MM/YYYY HH:mm')} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="ผู้แจ้ง">
                <Input value={reporterName} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="issue_type" label="ประเภทการแจ้ง" rules={[{ required: true, message: 'กรุณาเลือกประเภทการแจ้ง' }]}>
                <Select options={ERP_ISSUE_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="menu_code"
                label={isNewModule ? 'อยู่ภายใต้เมนู (ถ้ามี)' : 'เมนูที่พบปัญหา'}
                rules={isNewModule ? [] : [{ required: true, message: 'กรุณาเลือกเมนู' }]}
              >
                <TreeSelect
                  showSearch
                  allowClear
                  treeData={menuTree}
                  treeNodeFilterProp="title"
                  placeholder="เลือกเมนู"
                  popupMatchSelectWidth={false}
                  listHeight={360}
                />
              </Form.Item>
            </Col>

            {isNewModule && (
              <>
                <Col xs={24}>
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="การขอ Module ใหม่ต้องได้รับการอนุมัติก่อน — หลังผู้อนุมัติอนุมัติแล้ว ใบแจ้งจะเปลี่ยนเป็น Pending และส่งถึงผู้ดูแลระบบ"
                  />
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="module_name"
                    label="ชื่อ Module ที่ต้องการ"
                    rules={[{ required: true, whitespace: true, message: 'กรุณาระบุชื่อ Module' }]}
                  >
                    <Input maxLength={200} placeholder="เช่น ระบบจองห้องประชุม" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="approver_id" label="ผู้อนุมัติ" rules={[{ required: true, message: 'กรุณาเลือกผู้อนุมัติ' }]}>
                    <Select
                      showSearch
                      loading={approversLoading}
                      placeholder="เลือกผู้อนุมัติ"
                      optionFilterProp="label"
                      options={approvers.map((a) => ({
                        value: a.value,
                        label: a.role_names ? `${a.label} (${a.role_names})` : a.label,
                      }))}
                      notFoundContent={approversLoading ? 'กำลังโหลด…' : 'ยังไม่มีผู้อนุมัติ (ตั้งค่าใน Approval Matrix)'}
                    />
                  </Form.Item>
                </Col>
              </>
            )}

            <Col xs={24}>
              <Form.Item name="title" label="หัวข้อ" rules={[{ required: true, whitespace: true, message: 'กรุณาระบุหัวข้อ' }]}>
                <Input maxLength={200} showCount placeholder="สรุปปัญหาสั้น ๆ" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="detail" label="รายละเอียด" rules={[{ required: true, whitespace: true, message: 'กรุณาระบุรายละเอียด' }]}>
                <Input.TextArea
                  autoSize={{ minRows: 6, maxRows: 24 }}
                  style={{ fontSize: 15, lineHeight: 1.7 }}
                  maxLength={5000}
                  showCount
                  placeholder="อธิบายขั้นตอนที่ทำ สิ่งที่เกิดขึ้น และสิ่งที่คาดว่าจะเกิด" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label={`ไฟล์แนบ (ไม่เกิน ${MAX_FILES} ไฟล์, ไฟล์ละไม่เกิน 10 MB)`}>
                <Upload.Dragger
                  multiple
                  accept={ACCEPT}
                  listType="picture"
                  fileList={fileList}
                  beforeUpload={beforeUpload}
                  onChange={({ fileList: fl }) => setFileList(fl.slice(0, MAX_FILES))}
                  onPreview={onPreview}
                >
                  <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                  <p className="ant-upload-text">คลิกหรือลากไฟล์มาวางที่นี่</p>
                  <p className="ant-upload-hint">รองรับ รูปภาพ, PDF, Word, Excel, TXT, MP4</p>
                </Upload.Dragger>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card style={cardStyle} styles={{ body: { padding: 16 } }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/howto/issues')}>กลับ</Button>
            <Button type="primary" icon={<SendOutlined />} loading={saving} onClick={onSubmit}>
              {isNewModule ? 'ส่งขออนุมัติ' : 'ส่งใบแจ้งปัญหา'}
            </Button>
          </Space>
        </Card>
      </Form>

      {previewSrc && (
        <Image
          src={previewSrc}
          style={{ display: 'none' }}
          preview={{ visible: true, onVisibleChange: (v) => { if (!v) closePreview() } }}
        />
      )}
    </div>
  )
}

export default ERPIssueCreatePage
