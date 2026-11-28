import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert, Button, Card, Col, Descriptions, Empty, Form, Image, Input, Modal, Row, Select, Space, Spin, Tag, Timeline,
  Typography, Upload, message,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  ArrowLeftOutlined, CalendarOutlined, CheckOutlined, CloseOutlined, DownOutlined, PaperClipOutlined, PlusOutlined,
  SaveOutlined, UpOutlined, UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { erpIssueService, erpIssueErrText } from '@/services/erpIssueService'
import { formatFileSize } from '@/services/howtoService'
import {
  ERP_ISSUE_ADMIN_STATUSES, ERP_ISSUE_STATUS, ERP_ISSUE_TYPE_LABEL, formatIssueMenu,
  type ERPIssue, type ERPIssueAttachment, type ERPIssueLog, type ERPIssueStatus,
} from '@/types/erpIssue'

const { Text } = Typography

const MAX_FILES = 10
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.mp4'
/** Long details fold above this height, with a "show all" toggle. */
const DETAIL_FOLD_PX = 420

const cardStyle: React.CSSProperties = { borderRadius: 12, marginBottom: 16 }
const readingStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.85,
  color: '#1f2937',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
}
const fmtDate = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-')

const statusTag = (s: string) => {
  const st = ERP_ISSUE_STATUS[s as ERPIssueStatus]
  return <Tag color={st?.color} style={{ marginInlineEnd: 0 }}>{st?.label ?? s}</Tag>
}

const isImage = (a: ERPIssueAttachment) =>
  (a.file_type ?? '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.file_name)

/** Images as clickable thumbnails (preview / zoom), other files as download links. */
const AttachmentList: React.FC<{ items: ERPIssueAttachment[]; size?: 'md' | 'lg' }> = ({ items, size = 'md' }) => {
  if (items.length === 0) return <Text type="secondary">ไม่มีไฟล์แนบ</Text>
  const [w, h] = size === 'lg' ? [180, 135] : [130, 98]
  const images = items.filter(isImage)
  const others = items.filter((a) => !isImage(a))
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      {images.length > 0 && (
        <Image.PreviewGroup>
          <Space wrap size={10}>
            {images.map((a) => (
              <Image
                key={a.id}
                src={a.file_path}
                alt={a.file_name}
                width={w}
                height={h}
                style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
            ))}
          </Space>
        </Image.PreviewGroup>
      )}
      {others.map((a) => (
        <a key={a.id} href={a.file_path} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
          <PaperClipOutlined /> {a.file_name}
          {a.file_size ? <Text type="secondary"> ({formatFileSize(a.file_size)})</Text> : null}
        </a>
      ))}
    </Space>
  )
}

/** Comfortable reading block; folds very long text behind a "show all" toggle instead of a cramped cell. */
const LongText: React.FC<{ text: string }> = ({ text }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useLayoutEffect(() => {
    if (ref.current) setOverflow(ref.current.scrollHeight > DETAIL_FOLD_PX + 40)
  }, [text])

  const folded = overflow && !expanded
  return (
    <div>
      <div
        ref={ref}
        style={{
          ...readingStyle,
          maxHeight: folded ? DETAIL_FOLD_PX : undefined,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {text}
        {folded && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, height: 72,
              background: 'linear-gradient(rgba(255,255,255,0), #fff)',
            }}
          />
        )}
      </div>
      {overflow && (
        <Button type="link" style={{ padding: 0, marginTop: 4 }} icon={expanded ? <UpOutlined /> : <DownOutlined />}
          onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'ย่อ' : 'แสดงทั้งหมด'}
        </Button>
      )}
    </div>
  )
}

const ERPIssueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const forApproval = searchParams.get('for_approval') === 'true'
  const navigate = useNavigate()
  const location = useLocation()
  // opened from Administration › จัดการใบแจ้งปัญหา ERP (/admin/erp-issues/:id) or from How To use (/howto/issues/:id)
  const fromAdmin = location.pathname.startsWith('/admin/')
  const listPath = fromAdmin ? '/admin/erp-issues' : '/howto/issues'
  const user = useAppSelector((s) => s.auth.user)

  const [issue, setIssue] = useState<ERPIssue | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [adminForm] = Form.useForm()
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminFiles, setAdminFiles] = useState<UploadFile[]>([])
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const r = await erpIssueService.get(id)
      setIssue(r.issue)
      setCanManage(r.canManage)
      setError(null)
      adminForm.setFieldsValue({ status: r.issue.status, admin_remark: '' })
    } catch (err) {
      setError(erpIssueErrText(err, 'โหลดใบแจ้งปัญหาไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }, [id, adminForm])

  useEffect(() => {
    load()
  }, [load])

  const attachments = useMemo(() => issue?.attachments ?? [], [issue])
  const reporterFiles = useMemo(() => attachments.filter((a) => a.log_id == null), [attachments])
  const filesByLog = useMemo(() => {
    const m = new Map<number, ERPIssueAttachment[]>()
    attachments.forEach((a) => {
      if (a.log_id != null) m.set(a.log_id, [...(m.get(a.log_id) ?? []), a])
    })
    return m
  }, [attachments])
  // updates made by the admin (approval decisions start from PENDING_APPROVAL and are not included), newest first
  const adminUpdates: ERPIssueLog[] = useMemo(
    () => (issue?.logs ?? [])
      .filter((l) => l.from_status != null && ERP_ISSUE_ADMIN_STATUSES.includes(l.from_status as ERPIssueStatus))
      .filter((l) => l.remarks || filesByLog.has(l.id) || l.from_status !== l.to_status)
      .reverse(),
    [issue, filesByLog],
  )

  const isAssignedApprover =
    !!issue && issue.status === 'PENDING_APPROVAL' && issue.approver_id != null && String(issue.approver_id) === String(user?.id)
  const adminEditable = canManage && !!issue && ERP_ISSUE_ADMIN_STATUSES.includes(issue.status)

  const approve = () => {
    if (!issue) return
    Modal.confirm({
      title: `อนุมัติคำขอ Module ใหม่ ${issue.issue_no}?`,
      content: 'เมื่ออนุมัติแล้ว ใบแจ้งจะเปลี่ยนเป็น Pending และแจ้งผู้ดูแลระบบ',
      okText: 'อนุมัติ',
      cancelText: 'ยกเลิก',
      onOk: async () => {
        setDeciding(true)
        try {
          await erpIssueService.approve(issue.id)
          message.success('อนุมัติแล้ว')
          await load()
        } catch (err) {
          message.error(erpIssueErrText(err, 'อนุมัติไม่สำเร็จ'))
        } finally {
          setDeciding(false)
        }
      },
    })
  }

  const reject = async () => {
    if (!issue) return
    if (!rejectReason.trim()) {
      message.warning('กรุณาระบุเหตุผลที่ไม่อนุมัติ')
      return
    }
    setDeciding(true)
    try {
      await erpIssueService.reject(issue.id, rejectReason.trim())
      message.success('บันทึกการไม่อนุมัติแล้ว')
      setRejectOpen(false)
      setRejectReason('')
      await load()
    } catch (err) {
      message.error(erpIssueErrText(err, 'บันทึกไม่สำเร็จ'))
    } finally {
      setDeciding(false)
    }
  }

  const beforeAdminUpload = (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      message.error(`${file.name}: ไฟล์ต้องมีขนาดไม่เกิน 10 MB`)
      return Upload.LIST_IGNORE
    }
    if (adminFiles.length >= MAX_FILES) {
      message.error(`แนบไฟล์ได้ไม่เกิน ${MAX_FILES} ไฟล์`)
      return Upload.LIST_IGNORE
    }
    return false // kept locally, sent with the status update
  }

  // full-size preview of a picked file: the original file, not antd's ~200px thumbUrl
  const onAdminPreview = (file: UploadFile) => {
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

  const saveAdmin = async () => {
    if (!issue) return
    const v = await adminForm.validateFields()
    const files = adminFiles.map((f) => f.originFileObj as File).filter(Boolean)
    if (v.status === issue.status && !v.admin_remark?.trim() && files.length === 0) {
      message.info('ไม่มีการเปลี่ยนแปลง')
      return
    }
    setAdminSaving(true)
    try {
      await erpIssueService.updateStatus(issue.id, v.status, v.admin_remark, files)
      message.success('บันทึกแล้ว — แจ้งผู้แจ้งเรียบร้อย')
      setAdminFiles([])
      await load()
    } catch (err) {
      message.error(erpIssueErrText(err, 'บันทึกไม่สำเร็จ'))
    } finally {
      setAdminSaving(false)
    }
  }

  const back = () => navigate(listPath)

  if (loading && !issue) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }
  if (error || !issue) {
    return (
      <Card style={cardStyle}>
        <Empty description={error || 'ไม่พบใบแจ้งปัญหา'} />
        <div style={{ textAlign: 'center' }}><Button icon={<ArrowLeftOutlined />} onClick={back}>กลับ</Button></div>
      </Card>
    )
  }

  const rejectLog = issue.status === 'REJECTED' ? [...(issue.logs ?? [])].reverse().find((l) => l.to_status === 'REJECTED') : undefined
  const menuText = issue.menu_code ? formatIssueMenu(issue) : null

  return (
    <div>
      <PageHeader
        title={`ใบแจ้งปัญหา ${issue.issue_no}`}
        breadcrumbs={fromAdmin
          ? [{ title: 'Administration' }, { title: 'จัดการใบแจ้งปัญหา ERP', href: listPath }, { title: issue.issue_no }]
          : [{ title: 'How To use' }, { title: 'ใบแจ้งปัญหาการใช้งาน ERP', href: listPath }, { title: issue.issue_no }]}
        extra={<Button icon={<ArrowLeftOutlined />} onClick={back}>กลับ</Button>}
      />

      {/* ── state banners (approval buttons live here, at the top) ─────────────────────────── */}
      {issue.status === 'PENDING_APPROVAL' && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 12 }}
          message={<span style={{ fontSize: 15, fontWeight: 600 }}>คำขอ Module ใหม่ — รอ {issue.approver_name ?? 'ผู้อนุมัติ'} อนุมัติ</span>}
          description={isAssignedApprover ? 'คุณเป็นผู้อนุมัติของคำขอนี้ อ่านรายละเอียดด้านล่างแล้วกดอนุมัติหรือไม่อนุมัติ' : undefined}
          action={isAssignedApprover && (
            <Space wrap>
              <Button type="primary" size="large" icon={<CheckOutlined />} loading={deciding} onClick={approve}>อนุมัติ</Button>
              <Button danger size="large" icon={<CloseOutlined />} disabled={deciding} onClick={() => setRejectOpen(true)}>ไม่อนุมัติ</Button>
            </Space>
          )}
        />
      )}
      {forApproval && issue.status !== 'PENDING_APPROVAL' && (
        <Alert type="success" showIcon style={{ marginBottom: 16, borderRadius: 12 }} message="คำขอนี้ได้รับการพิจารณาแล้ว" />
      )}
      {issue.status === 'REJECTED' && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16, borderRadius: 12 }}
          message="ไม่อนุมัติ"
          description={rejectLog?.remarks ? <span style={{ whiteSpace: 'pre-wrap' }}>เหตุผล: {rejectLog.remarks}</span> : undefined}
        />
      )}
      {issue.status === 'PREVIEW' && (
        <Alert type="info" showIcon style={{ marginBottom: 16, borderRadius: 12 }}
          message="Preview (Test on UAT) — การแก้ไขขึ้นระบบ UAT แล้ว กรุณาทดสอบบน UAT แล้วแจ้งผลกับผู้ดูแลระบบ" />
      )}
      {issue.status === 'RESOLVED' && (
        <Alert type="success" showIcon style={{ marginBottom: 16, borderRadius: 12 }}
          message="ผู้ดูแลระบบแก้ไขปัญหานี้แล้ว — ดูรายละเอียดและรูปประกอบได้ที่ “ผลการดำเนินการ”" />
      )}

      {/* ── title block ─────────────────────────────────────────────────────────────────── */}
      <Card style={cardStyle} styles={{ body: { padding: '18px 22px' } }}>
        <Space wrap size={8} style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontWeight: 600 }}>{issue.issue_no}</Text>
          <Tag color={issue.issue_type === 'NEW_MODULE' ? 'purple' : issue.issue_type === 'BUG' ? 'red' : 'blue'} style={{ marginInlineEnd: 0 }}>
            {ERP_ISSUE_TYPE_LABEL[issue.issue_type] ?? issue.issue_type}
          </Tag>
          {statusTag(issue.status)}
        </Space>
        <div style={{
          fontFamily: 'Sarabun, sans-serif', fontSize: 22, fontWeight: 700, color: '#0f2d5e', lineHeight: 1.4,
          wordBreak: 'break-word', marginBottom: 8,
        }}>
          {issue.title}
        </div>
        <Space wrap size={[16, 4]} style={{ color: '#6b7280' }}>
          <span><UserOutlined /> {issue.reported_by_name ?? '-'}{issue.reported_dept ? ` (${issue.reported_dept})` : ''}</span>
          <span><CalendarOutlined /> {fmtDate(issue.reported_at)}</span>
          {menuText && <span>เมนู: {menuText}</span>}
          {issue.module_name && <span>Module: <b style={{ color: '#374151' }}>{issue.module_name}</b></span>}
        </Space>
      </Card>

      {/* ── facts + history side by side, then the content full width ───────────────────── */}
      <Row gutter={16} align="stretch">
        <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <Card style={{ ...cardStyle, flex: 1 }} title="ข้อมูลใบแจ้ง">
            <Descriptions column={1} size="small" colon={false} labelStyle={{ width: 110, color: '#6b7280' }}>
              <Descriptions.Item label="สถานะ">{statusTag(issue.status)}</Descriptions.Item>
              <Descriptions.Item label="วันที่แจ้ง">{fmtDate(issue.reported_at)}</Descriptions.Item>
              <Descriptions.Item label="ผู้แจ้ง">
                {issue.reported_by_name ?? '-'}{issue.reported_dept ? <Text type="secondary"> ({issue.reported_dept})</Text> : null}
              </Descriptions.Item>
              <Descriptions.Item label="ประเภท">{ERP_ISSUE_TYPE_LABEL[issue.issue_type] ?? issue.issue_type}</Descriptions.Item>
              <Descriptions.Item label="เมนู">{menuText ?? '-'}</Descriptions.Item>
              {issue.issue_type === 'NEW_MODULE' && (
                <Descriptions.Item label="Module">{issue.module_name ?? '-'}</Descriptions.Item>
              )}
              {issue.issue_type === 'NEW_MODULE' && (
                <Descriptions.Item label="ผู้อนุมัติ">{issue.approver_name ?? '-'}</Descriptions.Item>
              )}
              <Descriptions.Item label="ผู้ดำเนินการ">
                {issue.handled_by_name ? <>{issue.handled_by_name}<br /><Text type="secondary">{fmtDate(issue.handled_at)}</Text></> : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column' }}>
          {/* a long history scrolls inside the card so the facts card next to it doesn't stretch */}
          <Card style={{ ...cardStyle, flex: 1 }} title="ประวัติสถานะ" styles={{ body: { maxHeight: 340, overflowY: 'auto' } }}>
            <Timeline
              items={(issue.logs ?? []).map((l) => ({
                children: (
                  <div>
                    <div>
                      {l.from_status && l.from_status !== l.to_status ? <>{statusTag(l.from_status)} → </> : null}
                      {statusTag(l.to_status)}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{fmtDate(l.changed_at)} · {l.changed_by_name ?? '-'}</Text>
                    {l.remarks ? (
                      <Typography.Paragraph
                        ellipsis={{ rows: 3, expandable: true, symbol: 'ดูเพิ่ม' }}
                        style={{ whiteSpace: 'pre-wrap', color: '#374151', margin: '4px 0 0' }}
                      >
                        {l.remarks}
                      </Typography.Paragraph>
                    ) : null}
                    {filesByLog.has(l.id) && (
                      <div><Text type="secondary" style={{ fontSize: 12 }}><PaperClipOutlined /> แนบไฟล์ {filesByLog.get(l.id)?.length} ไฟล์</Text></div>
                    )}
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Card style={cardStyle} title="รายละเอียด">
        <LongText text={issue.detail} />
      </Card>

      <Card style={cardStyle} title={`ไฟล์แนบจากผู้แจ้ง${reporterFiles.length ? ` (${reporterFiles.length})` : ''}`}>
        <AttachmentList items={reporterFiles} size="lg" />
      </Card>

      <Card style={cardStyle} title="ผลการดำเนินการจากผู้ดูแลระบบ">
        {adminUpdates.length === 0 ? (
          <Text type="secondary">ยังไม่มีการอัปเดตจากผู้ดูแลระบบ</Text>
        ) : (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            {adminUpdates.map((l) => (
              <div
                key={l.id}
                style={{
                  border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px',
                  background: l.to_status === 'RESOLVED' ? '#f0fdf4' : '#fff',
                }}
              >
                <Space wrap size={8} style={{ marginBottom: 8 }}>
                  {statusTag(l.to_status)}
                  <Text type="secondary">{fmtDate(l.changed_at)} · {l.changed_by_name ?? '-'}</Text>
                </Space>
                {l.remarks ? <div style={{ ...readingStyle, marginBottom: 10 }}>{l.remarks}</div> : null}
                {filesByLog.has(l.id) && <AttachmentList items={filesByLog.get(l.id) ?? []} />}
              </div>
            ))}
          </Space>
        )}
      </Card>

      {adminEditable && (
        <Card style={cardStyle} title="อัปเดตสถานะ (ผู้ดูแลระบบ)">
          <Form form={adminForm} layout="vertical">
            <Form.Item name="status" label="สถานะ" rules={[{ required: true }]} style={{ maxWidth: 320 }}>
              <Select options={ERP_ISSUE_ADMIN_STATUSES.map((s) => ({ value: s, label: ERP_ISSUE_STATUS[s].label }))} />
            </Form.Item>
            <Form.Item name="admin_remark" label="ข้อความถึงผู้แจ้ง">
              <Input.TextArea
                autoSize={{ minRows: 5, maxRows: 18 }} maxLength={2000} showCount
                style={{ fontSize: 15, lineHeight: 1.7 }}
                placeholder="เช่น แก้ไขแล้ว ลองใช้งานอีกครั้งตามรูปที่แนบ"
              />
            </Form.Item>
            <Form.Item label={`รูป / ไฟล์ประกอบ (ไม่เกิน ${MAX_FILES} ไฟล์, ไฟล์ละไม่เกิน 10 MB)`}>
              <Upload
                listType="picture-card"
                multiple
                accept={ACCEPT}
                fileList={adminFiles}
                beforeUpload={beforeAdminUpload}
                onChange={({ fileList }) => setAdminFiles(fileList.slice(0, MAX_FILES))}
                onPreview={onAdminPreview}
              >
                {adminFiles.length < MAX_FILES && (
                  <div><PlusOutlined /><div style={{ marginTop: 6 }}>แนบไฟล์</div></div>
                )}
              </Upload>
            </Form.Item>
            <Button type="primary" icon={<SaveOutlined />} loading={adminSaving} onClick={saveAdmin}>
              บันทึกและแจ้งผู้แจ้ง
            </Button>
          </Form>
        </Card>
      )}

      {previewSrc && (
        <Image
          src={previewSrc}
          style={{ display: 'none' }}
          preview={{ visible: true, onVisibleChange: (v) => { if (!v) closePreview() } }}
        />
      )}

      <Modal
        title="ไม่อนุมัติคำขอ Module ใหม่"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={reject}
        okText="ยืนยันไม่อนุมัติ"
        cancelText="ยกเลิก"
        okButtonProps={{ danger: true, loading: deciding }}
      >
        <Input.TextArea
          autoSize={{ minRows: 4, maxRows: 12 }} maxLength={1000} placeholder="เหตุผลที่ไม่อนุมัติ (จำเป็น)"
          value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  )
}

export default ERPIssueDetailPage
