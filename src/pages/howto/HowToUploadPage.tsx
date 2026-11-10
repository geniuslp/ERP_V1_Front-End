import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, Form, Input, InputNumber, Modal, Progress, Select, Space, Spin, Switch, Table, Tag, Tooltip, Typography, Upload, Grid, message } from 'antd'
import type { UploadFile } from 'antd'
import { EditOutlined, EyeOutlined, FolderAddOutlined, InboxOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import ConfirmDeleteButton from '@/components/common/ConfirmDeleteButton'
import { useAppSelector } from '@/store'
import { howtoService, formatFileSize } from '@/services/howtoService'
import { HOWTO_MAX_VIDEO_BYTES } from '@/types/howto'
import type { HowToSection, HowToVideo } from '@/types/howto'

const { Text } = Typography
const MENU_CODE = 'MENU_HOWTO_UPLOAD'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_URL: string = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const errText = (err: unknown, fallback: string): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any
  if (e?.response?.status === 413) return 'ไฟล์ใหญ่เกินที่เซิร์ฟเวอร์รับได้ (nginx/API จำกัดขนาด) กรุณาติดต่อผู้ดูแลระบบ'
  return e?.response?.data?.error || e?.response?.data?.message || e?.message || fallback
}

interface MenuOption {
  label: string
  options: { value: string; label: string }[]
}

interface MenuNode {
  menu_code: string
  menu_name: string
  children?: MenuNode[]
}

const HowToUploadPage: React.FC = () => {
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
  const token = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [sections, setSections] = useState<HowToSection[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([])

  // section modal
  const [sectionOpen, setSectionOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<HowToSection | null>(null)
  const [sectionSaving, setSectionSaving] = useState(false)
  const [sectionForm] = Form.useForm()

  // upload modal
  const [uploadFor, setUploadFor] = useState<HowToSection | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploading, setUploading] = useState(false)
  const [percent, setPercent] = useState(0)

  // video edit / preview
  const [editingVideo, setEditingVideo] = useState<HowToVideo | null>(null)
  const [videoSaving, setVideoSaving] = useState(false)
  const [videoForm] = Form.useForm()
  const [preview, setPreview] = useState<{ title: string; src: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSections(await howtoService.listManageSections())
    } catch (err) {
      message.error(errText(err, 'โหลดข้อมูลไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Menus a section can be tied to (the menu's "read" permission then controls who sees the section).
  useEffect(() => {
    if (!token) return
    axios
      .get(`${BASE_URL}/menus`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const raw = res.data?.data ?? res.data
        const roots: MenuNode[] = Array.isArray(raw) ? raw : []
        const groups: MenuOption[] = roots
          .map((r) => ({
            label: r.menu_name,
            options: [r, ...(r.children ?? [])].map((m) => ({ value: m.menu_code, label: m.menu_name })),
          }))
          .filter((g) => g.options.length > 0)
        setMenuOptions(groups)
      })
      .catch(() => setMenuOptions([]))
  }, [token])

  const menuLabel = useMemo(() => {
    const map = new Map<string, string>()
    menuOptions.forEach((g) => g.options.forEach((o) => map.set(o.value, `${g.label} › ${o.label}`)))
    return map
  }, [menuOptions])

  // ── sections ──────────────────────────────────────────────────────────────
  const openSectionModal = (s: HowToSection | null) => {
    setEditingSection(s)
    sectionForm.resetFields()
    sectionForm.setFieldsValue(
      s
        ? { name: s.name, description: s.description ?? '', menu_code: s.menu_code ?? undefined, sort_order: s.sort_order, is_active: s.is_active }
        : { is_active: true },
    )
    setSectionOpen(true)
  }

  const saveSection = async () => {
    let v
    try {
      v = await sectionForm.validateFields()
    } catch {
      return
    }
    setSectionSaving(true)
    try {
      const body = {
        name: String(v.name).trim(),
        description: v.description?.trim() || null,
        menu_code: v.menu_code || null,
        sort_order: v.sort_order,
        is_active: v.is_active,
      }
      if (editingSection) await howtoService.updateSection(editingSection.id, body)
      else await howtoService.createSection(body)
      message.success(editingSection ? 'บันทึกการแก้ไข section แล้ว' : 'เพิ่ม section แล้ว')
      setSectionOpen(false)
      load()
    } catch (err) {
      message.error(errText(err, 'บันทึกไม่สำเร็จ'))
    } finally {
      setSectionSaving(false)
    }
  }

  const removeSection = async (s: HowToSection) => {
    try {
      await howtoService.deleteSection(s.id)
      message.success('ลบ section และวิดีโอทั้งหมดแล้ว')
      load()
    } catch (err) {
      message.error(errText(err, 'ลบไม่สำเร็จ'))
    }
  }

  // ── upload ────────────────────────────────────────────────────────────────
  const openUpload = (s: HowToSection) => {
    setUploadFor(s)
    setFileList([])
    setUploadTitle('')
    setUploadDesc('')
    setPercent(0)
  }

  const closeUpload = () => {
    if (uploading) return
    setUploadFor(null)
  }

  const submitUpload = async () => {
    const file = fileList[0]?.originFileObj as File | undefined
    if (!uploadFor || !file) {
      message.warning('กรุณาเลือกไฟล์วิดีโอ')
      return
    }
    setUploading(true)
    setPercent(0)
    try {
      await howtoService.uploadVideo(uploadFor.id, file, { title: uploadTitle.trim(), description: uploadDesc.trim() }, setPercent)
      message.success('อัปโหลดวิดีโอเรียบร้อย')
      setUploadFor(null)
      load()
    } catch (err) {
      message.error(errText(err, 'อัปโหลดไม่สำเร็จ'))
    } finally {
      setUploading(false)
    }
  }

  const beforeSelect = (file: File) => {
    const okType = /\.(mp4|webm)$/i.test(file.name)
    if (!okType) {
      message.error('รองรับเฉพาะไฟล์ .mp4 และ .webm')
      return Upload.LIST_IGNORE
    }
    if (file.size > HOWTO_MAX_VIDEO_BYTES) {
      message.error(`ไฟล์ใหญ่เกิน ${HOWTO_MAX_VIDEO_BYTES / 1024 / 1024}MB (${formatFileSize(file.size)})`)
      return Upload.LIST_IGNORE
    }
    if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^.]+$/, ''))
    return false // keep the file in the list, upload manually on "อัปโหลด"
  }

  // ── videos ────────────────────────────────────────────────────────────────
  const openVideoEdit = (v: HowToVideo) => {
    setEditingVideo(v)
    videoForm.setFieldsValue({ title: v.title, description: v.description ?? '', sort_order: v.sort_order, section_id: v.section_id })
  }

  const saveVideo = async () => {
    if (!editingVideo) return
    let v
    try {
      v = await videoForm.validateFields()
    } catch {
      return
    }
    setVideoSaving(true)
    try {
      await howtoService.updateVideo(editingVideo.id, {
        title: String(v.title).trim(),
        description: v.description?.trim() || '',
        sort_order: v.sort_order,
        section_id: v.section_id,
      })
      message.success('บันทึกแล้ว')
      setEditingVideo(null)
      load()
    } catch (err) {
      message.error(errText(err, 'บันทึกไม่สำเร็จ'))
    } finally {
      setVideoSaving(false)
    }
  }

  const removeVideo = async (v: HowToVideo) => {
    try {
      await howtoService.deleteVideo(v.id)
      message.success('ลบวิดีโอแล้ว')
      load()
    } catch (err) {
      message.error(errText(err, 'ลบไม่สำเร็จ'))
    }
  }

  const openPreview = async (v: HowToVideo) => {
    try {
      setPreview({ title: v.title, src: await howtoService.getStreamUrl(v.id) })
    } catch (err) {
      message.error(errText(err, 'เปิดวิดีโอไม่สำเร็จ'))
    }
  }

  const videoColumns = [
    { title: 'ชื่อวิดีโอ', dataIndex: 'title', key: 'title', render: (t: string) => <Text strong>{t}</Text> },
    { title: 'ไฟล์', dataIndex: 'original_name', key: 'original_name', ellipsis: true, render: (t: string | null) => t || '-' },
    { title: 'ขนาด', dataIndex: 'size_bytes', key: 'size', width: 100, render: (n: number | null) => formatFileSize(n) },
    { title: 'ลำดับ', dataIndex: 'sort_order', key: 'sort', width: 80, align: 'center' as const },
    { title: 'อัปโหลดเมื่อ', dataIndex: 'created_at', key: 'created', width: 150, render: (d: string) => dayjs(d).format('DD/MM/YYYY HH:mm') },
    {
      title: '',
      key: 'action',
      width: 150,
      render: (_: unknown, v: HowToVideo) => (
        <Space size={4}>
          <Tooltip title="ดูตัวอย่าง">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openPreview(v)} />
          </Tooltip>
          <PermissionButton menuCode={MENU_CODE} action="update" size="small" icon={<EditOutlined />} onClick={() => openVideoEdit(v)} />
          <ConfirmDeleteButton menuCode={MENU_CODE} size="small" text="ลบวิดีโอนี้? ไฟล์จะถูกลบถาวร" onConfirm={() => removeVideo(v)} />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="upload วิดีโอ"
        subtitle="สร้าง section และอัปโหลดวิดีโอสอนการใช้งาน (MP4 / WebM ไม่เกิน 100MB ต่อไฟล์)"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'How To use' }, { title: 'upload วิดีโอ' }]}
        extra={
          <PermissionButton menuCode={MENU_CODE} action="write" type="primary" icon={<FolderAddOutlined />} onClick={() => openSectionModal(null)}>
            เพิ่ม Section
          </PermissionButton>
        }
      />

      <Spin spinning={loading}>
        {!loading && sections.length === 0 && (
          <Card style={cardStyle}>
            <Empty description='ยังไม่มี section — กด "เพิ่ม Section" เพื่อเริ่มต้น' />
          </Card>
        )}

        {sections.map((s) => (
          <Card key={s.id} style={cardStyle} styles={{ body: { padding: isMobile ? 12 : 24 } }}>
            {/* Custom header (not Card title/extra): it wraps on narrow screens instead of squeezing the title away. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <Space wrap size={8} style={{ minWidth: 0 }}>
                <span style={{ color: '#0f2d5e', fontWeight: 700, fontSize: 16, wordBreak: 'break-word' }}>{s.name}</span>
                {s.menu_code ? (
                  <Tooltip title="ผู้ที่มีสิทธิ์ read ของเมนูนี้เท่านั้นที่ดู section นี้ได้">
                    <Tag color="blue" style={{ whiteSpace: 'normal', height: 'auto' }}>
                      ต้องมีสิทธิ์: {menuLabel.get(s.menu_code) ?? s.menu_name ?? s.menu_code}
                    </Tag>
                  </Tooltip>
                ) : (
                  <Tag color="green">ทุกคน</Tag>
                )}
                {!s.is_active && <Tag color="red">ปิดใช้งาน</Tag>}
                <Tag>{s.videos.length} วิดีโอ</Tag>
              </Space>
              <Space wrap>
                <PermissionButton menuCode={MENU_CODE} action="write" type="primary" icon={<UploadOutlined />} onClick={() => openUpload(s)}>
                  อัปโหลดวิดีโอ
                </PermissionButton>
                <PermissionButton menuCode={MENU_CODE} action="update" icon={<EditOutlined />} onClick={() => openSectionModal(s)}>
                  แก้ไข
                </PermissionButton>
                <ConfirmDeleteButton
                  menuCode={MENU_CODE}
                  text={`ลบ section "${s.name}" และวิดีโอทั้ง ${s.videos.length} รายการ? ไฟล์จะถูกลบถาวร`}
                  onConfirm={() => removeSection(s)}
                >
                  ลบ
                </ConfirmDeleteButton>
              </Space>
            </div>
            {s.description && <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{s.description}</Text>}

            {isMobile ? (
              // Phones: one block per video with its actions underneath, instead of a wide table that hides the buttons.
              s.videos.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีวิดีโอใน section นี้" />
              ) : (
                s.videos.map((v) => (
                  <div key={v.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                    <Text strong style={{ wordBreak: 'break-word' }}>{v.title}</Text>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, wordBreak: 'break-all' }}>{v.original_name || '-'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {formatFileSize(v.size_bytes)} · ลำดับ {v.sort_order} · {dayjs(v.created_at).format('DD/MM/YYYY HH:mm')}
                    </div>
                    <Space style={{ marginTop: 8 }} wrap>
                      <Button size="small" icon={<EyeOutlined />} onClick={() => openPreview(v)}>
                        ดู
                      </Button>
                      <PermissionButton menuCode={MENU_CODE} action="update" size="small" icon={<EditOutlined />} onClick={() => openVideoEdit(v)}>
                        แก้ไข
                      </PermissionButton>
                      <ConfirmDeleteButton menuCode={MENU_CODE} size="small" text="ลบวิดีโอนี้? ไฟล์จะถูกลบถาวร" onConfirm={() => removeVideo(v)}>
                        ลบ
                      </ConfirmDeleteButton>
                    </Space>
                  </div>
                ))
              )
            ) : (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                columns={videoColumns}
                dataSource={s.videos}
                scroll={{ x: 760 }}
                locale={{ emptyText: 'ยังไม่มีวิดีโอใน section นี้' }}
              />
            )}
          </Card>
        ))}
      </Spin>

      {/* Section add / edit */}
      <Modal
        title={editingSection ? 'แก้ไข Section' : 'เพิ่ม Section'}
        open={sectionOpen}
        onCancel={() => setSectionOpen(false)}
        onOk={saveSection}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={sectionSaving}
        destroyOnClose
      >
        <Form form={sectionForm} layout="vertical" autoComplete="off">
          <Form.Item name="name" label="ชื่อ Section" rules={[{ required: true, whitespace: true, message: 'กรุณาระบุชื่อ section' }]}>
            <Input placeholder="เช่น Memo, ใบขอซื้อ (PR), ใบสั่งซื้อ (PO)" maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="คำอธิบาย">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
          <Form.Item
            name="menu_code"
            label="ผูกสิทธิ์กับเมนู"
            extra="เลือกเมนู = เฉพาะผู้ที่มีสิทธิ์ read ของเมนูนั้นใน Permission Matrix จึงเห็น section นี้ (ถ้าเลือกชื่อกลุ่ม เช่น Memo ใช้ได้เมื่อมีสิทธิ์ read เมนูย่อยตัวใดตัวหนึ่งในกลุ่ม) / ไม่เลือก = ทุกคนที่ล็อกอินเห็น"
          >
            <Select
              allowClear
              showSearch
              placeholder="ทุกคน (ไม่ผูกเมนู)"
              options={menuOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          <Space size={24} wrap>
            <Form.Item name="sort_order" label="ลำดับ">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="is_active" label="เปิดใช้งาน" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Upload */}
      <Modal
        title={uploadFor ? `อัปโหลดวิดีโอ — ${uploadFor.name}` : ''}
        open={!!uploadFor}
        onCancel={closeUpload}
        onOk={submitUpload}
        okText="อัปโหลด"
        cancelText="ยกเลิก"
        okButtonProps={{ disabled: fileList.length === 0, loading: uploading, icon: <UploadOutlined /> }}
        cancelButtonProps={{ disabled: uploading }}
        maskClosable={false}
        closable={!uploading}
        destroyOnClose
      >
        <Upload.Dragger
          accept=".mp4,.webm,video/mp4,video/webm"
          multiple={false}
          maxCount={1}
          fileList={fileList}
          beforeUpload={beforeSelect}
          onChange={(info) => setFileList(info.fileList.slice(-1))}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">คลิกหรือลากไฟล์วิดีโอมาวางที่นี่</p>
          <p className="ant-upload-hint">MP4 หรือ WebM ขนาดไม่เกิน 100MB</p>
        </Upload.Dragger>
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="ชื่อวิดีโอ">
            <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="ถ้าไม่ระบุจะใช้ชื่อไฟล์" maxLength={200} disabled={uploading} />
          </Form.Item>
          <Form.Item label="คำอธิบาย">
            <Input.TextArea rows={2} value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} maxLength={500} disabled={uploading} />
          </Form.Item>
        </Form>
        {uploading && (
          <div>
            <Progress percent={percent} status="active" />
            <Text type="secondary" style={{ fontSize: 12 }}>
              กำลังอัปโหลด กรุณาอย่าปิดหน้านี้
            </Text>
          </div>
        )}
      </Modal>

      {/* Video edit */}
      <Modal
        title="แก้ไขวิดีโอ"
        open={!!editingVideo}
        onCancel={() => setEditingVideo(null)}
        onOk={saveVideo}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={videoSaving}
        destroyOnClose
      >
        <Form form={videoForm} layout="vertical" autoComplete="off">
          <Form.Item name="title" label="ชื่อวิดีโอ" rules={[{ required: true, whitespace: true, message: 'กรุณาระบุชื่อวิดีโอ' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="คำอธิบาย">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
          <Form.Item name="section_id" label="ย้ายไป Section">
            <Select options={sections.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item name="sort_order" label="ลำดับ">
            <InputNumber min={0} style={{ width: 120 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Preview */}
      <Modal
        title={preview?.title}
        open={!!preview}
        onCancel={() => setPreview(null)}
        footer={null}
        width={isMobile ? '95vw' : 860}
        destroyOnClose
      >
        {preview && <video src={preview.src} controls autoPlay style={{ width: '100%', borderRadius: 8, background: '#000' }} />}
      </Modal>
    </div>
  )
}

export default HowToUploadPage
