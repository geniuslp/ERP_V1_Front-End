import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Button, Card, Col, DatePicker, Empty, Form, Grid, Input, InputNumber, Modal, Radio, Row, Select, Space, Spin, Tag,
  Tooltip, Typography, Upload, message,
} from 'antd'
import type { UploadFile } from 'antd'
import { DeleteOutlined, FileTextOutlined, InboxOutlined, LockOutlined, PaperClipOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons'
import RepairRequestPrint, { type RepairPrintData } from './RepairRequestPrint'
import { formatApproverOption } from '@/utils/formatApproverOption'
import dayjs, { type Dayjs } from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import PermissionButton from '@/components/common/PermissionButton'
import { useAppSelector } from '@/store'
import { useProjectOptions } from '@/hooks/useProjectOptions'
import { departmentService } from '@/services/departmentService'
import axios from 'axios'
import {
  PRIORITY, REPAIR_MENU_CODE, STATUS, repairApi, repairErrText,
  type RepairAttachment, type RepairPayload, type RepairPriority, type RepairRequest,
} from './repairRequest'

// เอกสารแจ้งซ่อม > 5.1 บันทึกการแจ้งซ่อม — create / edit a draft / view (layout follows the paper form).
// "วันที่" is locked: the server stamps today on save/submit (no back-dating).
const BASE_URL = (import.meta as any).env?.VITE_API_URL
const cardStyle: React.CSSProperties = { borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }
const itemCardStyle: React.CSSProperties = { borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafcff' }
// footer buttons (บันทึกร่าง / บันทึก / ยกเลิก): larger than default
const actionBtnStyle: React.CSSProperties = { minWidth: 140, height: 48, fontSize: 16, borderRadius: 10 }
const MAX_FILES = 10
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPT = '.jpg,.jpeg,.png,.pdf'

type Opt = { value: string | number; label: string }
interface FormItem { machine_name?: string; machine_code?: string; qty?: number; unit?: string; symptom?: string }
interface FormValues {
  project_code?: string
  dept_code?: string
  branch_code?: string
  equipment_category_id?: number
  need_date?: Dayjs | null
  priority?: RepairPriority
  items?: FormItem[]
  approver_id?: number
}

const emptyItem: FormItem = { qty: 1 }

const RepairRequestFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authUser = useAppSelector((s) => s.auth.user) as any
  const [form] = Form.useForm<FormValues>()

  const [loading, setLoading] = useState(!isNew)
  const [doc, setDoc] = useState<RepairRequest | null>(null)
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [existingFiles, setExistingFiles] = useState<RepairAttachment[]>([])
  const [removeIds, setRemoveIds] = useState<number[]>([])
  const [printData, setPrintData] = useState<RepairPrintData | null>(null)
  const [approvers, setApprovers] = useState<Opt[]>([])
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const approverPicked = Form.useWatch('approver_id', form)

  const [depts, setDepts] = useState<Opt[]>([])
  const [branches, setBranches] = useState<Opt[]>([])
  const [categories, setCategories] = useState<Opt[]>([])
  // Projects the user may use (a Project-department user: only their own). Warehouse projects included: repairs
  // happen at the factories too.
  const { options: projectOptions, loading: projectsLoading } = useProjectOptions({ scope: 'related' }, doc?.project_code)

  const editable = isNew || !!doc?.can_edit

  useEffect(() => {
    if (!accessToken) return
    departmentService.list(accessToken, true)
      .then((list: any[]) => setDepts(list.map((d) => ({ value: d.dept_code, label: `${d.dept_code} ${d.dept_name ?? ''}`.trim() }))))
      .catch(() => setDepts([]))
    axios.get(`${BASE_URL}/master/warehouses`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => setBranches((r.data?.data ?? []).filter((w: any) => w.is_active !== false)
        .map((w: any) => ({ value: w.warehouse_code, label: w.warehouse_name || w.warehouse_code }))))
      .catch(() => setBranches([]))
    repairApi.categories(accessToken)
      .then((list) => setCategories(list.map((c) => ({ value: c.id, label: c.name }))))
      .catch(() => setCategories([]))
    repairApi.approvers(accessToken)
      .then((list) => setApprovers(list.map((u) => {
        const uid = Number(u.value ?? u.id)
        return { value: uid, label: formatApproverOption(u.username, uid) }
      })))
      .catch(() => setApprovers([]))
  }, [accessToken])

  const fill = (r: RepairRequest) => {
    setDoc(r)
    setExistingFiles(r.attachments ?? [])
    setRemoveIds([])
    setFileList([])
    form.setFieldsValue({
      project_code: r.project_code,
      dept_code: r.dept_code ?? undefined,
      branch_code: r.branch_code ?? undefined,
      equipment_category_id: r.equipment_category_id ?? undefined,
      need_date: r.need_date ? dayjs(r.need_date) : null,
      priority: r.priority,
      approver_id: r.approver_id ?? undefined,
      items: (r.items ?? []).length > 0
        ? r.items!.map((it) => ({ machine_name: it.machine_name, machine_code: it.machine_code ?? undefined, qty: it.qty, unit: it.unit ?? undefined, symptom: it.symptom }))
        : [{ ...emptyItem }],
    })
  }

  useEffect(() => {
    if (isNew) {
      form.setFieldsValue({ priority: 'NORMAL', items: [{ ...emptyItem }] })
      return
    }
    if (!accessToken) return
    setLoading(true)
    repairApi.get(accessToken, id!)
      .then(fill)
      .catch((e) => { message.error(repairErrText(e, 'โหลดใบแจ้งซ่อมไม่สำเร็จ')); navigate('/repair/requests', { replace: true }) })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id])

  // the date shown: today until the request is sent, then the date it was sent
  const requestDate = doc && doc.status !== 'DRAFT' ? dayjs(doc.request_date) : dayjs()

  const toPayload = (v: FormValues, action: 'draft' | 'submit'): RepairPayload => ({
    action,
    project_code: v.project_code ?? '',
    dept_code: v.dept_code ?? null,
    branch_code: v.branch_code ?? null,
    repairer: doc?.repairer ?? 'GNE', // legacy column, no longer on the form (ผู้แจ้งซ่อม = the logged-in requester)
    equipment_category_id: v.equipment_category_id ?? null,
    need_date: v.need_date ? v.need_date.format('YYYY-MM-DD') : null,
    priority: v.priority ?? 'NORMAL',
    // approver picked = send for approval; empty = no approval (the server decides from approver_id)
    requires_approval: v.approver_id != null,
    approver_id: v.approver_id ?? null,
    items: (v.items ?? [])
      // a draft may keep an untouched empty block; drop it instead of saving an empty row
      .filter((it) => action === 'submit' || (it.machine_name || it.machine_code || it.unit || it.symptom))
      .map((it) => ({
        machine_name: (it.machine_name ?? '').trim(),
        machine_code: it.machine_code?.trim() || null,
        qty: Number(it.qty ?? 1) || 1,
        unit: it.unit?.trim() || null,
        symptom: (it.symptom ?? '').trim(),
      })),
    remove_attachment_ids: removeIds,
  })

  const save = async (action: 'draft' | 'submit') => {
    try {
      // Draft only needs the project; SAVE checks the whole form.
      if (action === 'draft') await form.validateFields(['project_code'])
      else await form.validateFields()
    } catch {
      message.warning(action === 'draft' ? 'กรุณาเลือกโครงการก่อนบันทึกร่าง' : 'กรุณากรอกข้อมูลให้ครบ')
      return
    }
    const v = form.getFieldsValue(true) as FormValues
    const run = async () => {
      setSaving(action)
      try {
        const files = fileList.map((f) => f.originFileObj as File).filter(Boolean)
        const res = await repairApi.save(accessToken, doc?.id ?? null, toPayload(v, action), files)
        message.success(res.message || 'บันทึกเรียบร้อย')
        if (isNew) navigate(`/repair/requests/${res.data.id}`, { replace: true })
        fill(res.data)
      } catch (e) {
        message.error(repairErrText(e, 'บันทึกใบแจ้งซ่อมไม่สำเร็จ'))
      } finally {
        setSaving(null)
      }
    }
    if (action === 'submit') {
      Modal.confirm({
        title: 'ยืนยันส่งใบแจ้งซ่อม',
        content: v.approver_id != null
          ? 'ใบแจ้งซ่อมจะถูกส่งไปให้ผู้อนุมัติพิจารณา ระหว่างรออนุมัติจะแก้ไขไม่ได้ ต้องการส่งหรือไม่'
          : 'ส่งแล้วจะแก้ไขไม่ได้ ต้องการส่งใบแจ้งซ่อมนี้หรือไม่',
        okText: 'ส่ง',
        cancelText: 'ยกเลิก',
        onOk: run,
      })
    } else {
      run()
    }
  }

  const beforeUpload = (file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ACCEPT.split(',').includes(ext)) {
      message.error(`${file.name}: แนบได้เฉพาะไฟล์ JPG / PNG / PDF`)
      return Upload.LIST_IGNORE
    }
    if (file.size > MAX_FILE_BYTES) {
      message.error(`${file.name}: ไฟล์ต้องมีขนาดไม่เกิน 10 MB`)
      return Upload.LIST_IGNORE
    }
    const kept = existingFiles.filter((f) => !removeIds.includes(f.id)).length
    if (kept + fileList.length >= MAX_FILES) {
      message.error(`แนบไฟล์ได้ไม่เกิน ${MAX_FILES} ไฟล์`)
      return Upload.LIST_IGNORE
    }
    return false // sent together with the form
  }

  // Approve / reject — only the assigned approver sees these buttons (doc.can_approve); the server checks again.
  const decide = async (action: 'approve' | 'reject', comments?: string) => {
    if (!doc) return
    setDeciding(action)
    try {
      await repairApi.decide(accessToken, doc.id, action, comments)
      message.success(action === 'approve' ? 'อนุมัติใบแจ้งซ่อมแล้ว' : 'บันทึกการไม่อนุมัติแล้ว')
      setRejectOpen(false)
      setRejectReason('')
      fill(await repairApi.get(accessToken, doc.id))
    } catch (e) {
      message.error(repairErrText(e, 'บันทึกผลการอนุมัติไม่สำเร็จ'))
    } finally {
      setDeciding(null)
    }
  }

  // Print from the SAVED document (doc), never from unsaved form values.
  const startPrint = () => {
    if (!doc) return
    const d = (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '')
    setPrintData({
      requestNo: doc.request_no,
      project: `${doc.project_code} ${doc.project_name ?? ''}`.trim(),
      dept: doc.dept_code ? `${doc.dept_code}${doc.dept_name ? ` ${doc.dept_name}` : ''}` : '',
      branch: doc.branch_name ?? doc.branch_code ?? '',
      priority: PRIORITY[doc.priority]?.label ?? doc.priority,
      requestDate: d(doc.status === 'DRAFT' ? dayjs().format('YYYY-MM-DD') : doc.request_date),
      needDate: d(doc.need_date),
      requester: doc.requested_by_name ?? doc.requested_by_username ?? '',
      requesterUsername: doc.requested_by_username ?? '',
      // approver box: filled only once the request is actually approved
      approverUsername: doc.status === 'APPROVED' ? doc.approver_username ?? '' : '',
      approvedDate: doc.status === 'APPROVED' ? d(doc.approved_at) : '',
      status: doc.status,
      items: (doc.items ?? []).map((it, i) => ({
        no: String(i + 1),
        machineName: it.machine_name,
        machineCode: it.machine_code ?? '',
        symptom: it.symptom,
        qty: it.qty,
        unit: it.unit ?? '',
      })),
    })
  }

  const keptFiles = useMemo(() => existingFiles.filter((f) => !removeIds.includes(f.id)), [existingFiles, removeIds])
  // saved request: its requester; new request: whoever is logged in
  const requesterName = doc
    ? doc.requested_by_name ?? doc.requested_by_username ?? '-'
    : authUser?.full_name_th || authUser?.fullName || authUser?.full_name || authUser?.username || '-'
  const title = doc ? `ใบบันทึกการแจ้งซ่อม ${doc.request_no}` : 'ใบบันทึกการแจ้งซ่อม'

  return (
    <div>
      <PageHeader
        title={title}
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'Memo' }, { title: 'เอกสารแจ้งซ่อม' }, { title: 'บันทึกการแจ้งซ่อม' }]}
      />
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" disabled={!editable} requiredMark={editable}>
          <Card style={{ ...cardStyle, marginBottom: 16 }}>
            {doc && (
              <Space style={{ marginBottom: 12 }} wrap>
                <Tag color={STATUS[doc.status]?.color}>{STATUS[doc.status]?.label ?? doc.status}</Tag>
                <Typography.Text type="secondary">ผู้แจ้ง: {doc.requested_by_name ?? '-'}</Typography.Text>
                {!editable && doc.status === 'DRAFT' && <Typography.Text type="secondary">(แก้ไขได้เฉพาะผู้แจ้งซ่อม)</Typography.Text>}
              </Space>
            )}
            {doc?.status === 'PENDING_APPROVAL' && (
              <Alert type="info" showIcon style={{ marginBottom: 12 }}
                message={`รอการอนุมัติจาก ${doc.approver_name ?? '-'}`} />
            )}
            {doc?.status === 'APPROVED' && (
              <Alert type="success" showIcon style={{ marginBottom: 12 }}
                message={`อนุมัติแล้วโดย ${doc.approver_name ?? '-'}${doc.approved_at ? ` เมื่อ ${dayjs(doc.approved_at).format('DD/MM/YYYY HH:mm')}` : ''}`} />
            )}
            {doc?.status === 'REJECTED' && (
              <Alert type="error" showIcon style={{ marginBottom: 12 }}
                message={`ไม่อนุมัติโดย ${doc.approver_name ?? '-'}`}
                description={<>
                  {doc.reject_reason && <div>เหตุผล: {doc.reject_reason}</div>}
                  {doc.can_edit && <div>แก้ไขข้อมูลแล้วกด "บันทึก" เพื่อส่งขออนุมัติใหม่</div>}
                </>} />
            )}
            <Row gutter={[24, 0]}>
              <Col xs={24} md={12}>
                <Form.Item name="project_code" label="โครงการ" rules={[{ required: true, message: 'กรุณาเลือกโครงการ' }]}>
                  <Select showSearch optionFilterProp="label" options={projectOptions} loading={projectsLoading} placeholder="เลือกโครงการ" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={<span>วันที่ <Tooltip title="ล็อกเป็นวันที่แจ้งซ่อม ระบบใส่ให้อัตโนมัติ ห้ามย้อนหลัง"><LockOutlined style={{ color: '#9ca3af' }} /></Tooltip></span>}>
                  <DatePicker value={requestDate} format="DD/MM/YYYY" disabled style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="dept_code" label="แผนก" rules={[{ required: true, message: 'กรุณาเลือกแผนก' }]}>
                  <Select showSearch optionFilterProp="label" options={depts} placeholder="เลือกแผนก" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="branch_code" label="สาขา" rules={[{ required: true, message: 'กรุณาเลือกสาขา' }]}>
                  <Select options={branches} placeholder="เลือกสาขา" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                {/* ผู้แจ้งซ่อม = the person who creates the request (locked, stamped by the server) */}
                <Form.Item label={<span>ผู้แจ้งซ่อม <LockOutlined style={{ color: '#9ca3af' }} /></span>}>
                  <Input value={requesterName} disabled />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="equipment_category_id" label="อุปกรณ์">
                  <Select allowClear options={categories} placeholder="เลือกประเภทอุปกรณ์" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="need_date" label="วันที่ต้องใช้งาน" rules={[{ required: true, message: 'กรุณาระบุวันที่ต้องใช้งาน' }]}>
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="priority" label="ระดับความสำคัญ" rules={[{ required: true, message: 'กรุณาเลือกระดับความสำคัญ' }]}>
                  <Radio.Group>
                    {(Object.keys(PRIORITY) as RepairPriority[]).map((k) => <Radio key={k} value={k}>{PRIORITY[k].label}</Radio>)}
                  </Radio.Group>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="approver_id" label="ผู้อนุมัติ"
                  extra={approverPicked ? 'กดบันทึกแล้วจะส่งให้ผู้อนุมัติพิจารณา' : 'เว้นว่างได้ ถ้าไม่ต้องอนุมัติ'}>
                  <Select allowClear showSearch optionFilterProp="label" options={approvers} placeholder="ไม่ต้องอนุมัติ" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card style={{ ...cardStyle, marginBottom: 16 }} title={<span><FileTextOutlined /> รายการที่แจ้งซ่อม</span>}>
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {fields.map((field, idx) => (
                    <Card key={field.key} size="small" style={itemCardStyle}
                      title={`รายการที่ ${idx + 1}`}
                      extra={editable && fields.length > 1
                        ? <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(field.name)}>ลบ</Button>
                        : null}>
                      <Row gutter={[16, 0]}>
                        <Col xs={24} md={16}>
                          <Form.Item name={[field.name, 'machine_name']} label="ชื่อเครื่องจักร" rules={[{ required: true, whitespace: true, message: 'กรุณาระบุชื่อเครื่องจักร' }]}>
                            <Input maxLength={100} showCount />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item name={[field.name, 'machine_code']} label="รหัสเครื่อง">
                            <Input maxLength={50} showCount />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={8}>
                          <Form.Item name={[field.name, 'qty']} label="จำนวน" rules={[{ required: true, message: 'กรุณาระบุจำนวน' }]}>
                            <InputNumber min={0.0001} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={8}>
                          <Form.Item name={[field.name, 'unit']} label="หน่วย">
                            <Input maxLength={50} />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item name={[field.name, 'symptom']} label="อาการเสีย / ปัญหาที่พบ" rules={[{ required: true, whitespace: true, message: 'กรุณาระบุอาการเสีย / ปัญหาที่พบ' }]}>
                            <Input.TextArea rows={3} maxLength={1000} showCount />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                  {editable && (
                    <div style={{ textAlign: 'right' }}>
                      <Button icon={<PlusOutlined />} onClick={() => add({ ...emptyItem })} disabled={fields.length >= 100}>เพิ่ม Item</Button>
                    </div>
                  )}
                </Space>
              )}
            </Form.List>
          </Card>

          <Card style={{ ...cardStyle, marginBottom: 16 }} title={<span><PaperClipOutlined /> แนบไฟล์ JPG / PDF / PNG</span>}>
            {keptFiles.length > 0 && (
              <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
                {keptFiles.map((f) => (
                  <Space key={f.id} style={{ justifyContent: 'space-between', width: '100%' }}>
                    <a href={f.file_path} target="_blank" rel="noreferrer"><PaperClipOutlined /> {f.file_name}</a>
                    {editable && (
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setRemoveIds((ids) => [...ids, f.id])}>
                        ลบ
                      </Button>
                    )}
                  </Space>
                ))}
              </Space>
            )}
            {editable ? (
              <Upload.Dragger
                multiple
                accept={ACCEPT}
                listType="picture"
                fileList={fileList}
                beforeUpload={beforeUpload}
                onChange={({ fileList: fl }) => setFileList(fl)}
              >
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p className="ant-upload-text">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
                <p className="ant-upload-hint">JPG / PNG / PDF ไม่เกิน {MAX_FILES} ไฟล์ ไฟล์ละไม่เกิน 10 MB</p>
              </Upload.Dragger>
            ) : keptFiles.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีไฟล์แนบ" />}
          </Card>
        </Form>

        <div style={{ display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          {doc?.can_approve && (
            <>
              <Button size="large" danger style={actionBtnStyle} onClick={() => setRejectOpen(true)} disabled={!!deciding} block={isMobile}>
                ไม่อนุมัติ
              </Button>
              <Button size="large" type="primary" style={{ ...actionBtnStyle, background: '#16a34a' }} loading={deciding === 'approve'}
                disabled={!!deciding} block={isMobile}
                onClick={() => Modal.confirm({ title: 'ยืนยันอนุมัติใบแจ้งซ่อม', okText: 'อนุมัติ', cancelText: 'ยกเลิก', onOk: () => decide('approve') })}>
                อนุมัติ
              </Button>
            </>
          )}
          {doc && (
            <Button size="large" style={actionBtnStyle} icon={<PrinterOutlined />} onClick={startPrint} loading={!!printData} disabled={!!saving} block={isMobile}>
              พิมพ์
            </Button>
          )}
          {editable && (
            <>
              <PermissionButton menuCode={REPAIR_MENU_CODE} action="write" size="large" style={actionBtnStyle} onClick={() => save('draft')} loading={saving === 'draft'} disabled={!!saving} block={isMobile}>
                บันทึกร่าง
              </PermissionButton>
              <PermissionButton menuCode={REPAIR_MENU_CODE} action="write" type="primary" size="large" style={actionBtnStyle} onClick={() => save('submit')} loading={saving === 'submit'} disabled={!!saving} block={isMobile}>
                บันทึก
              </PermissionButton>
            </>
          )}
          <Button size="large" style={actionBtnStyle} onClick={() => navigate('/repair/requests')} disabled={!!saving} block={isMobile}>
            {editable ? 'ยกเลิก' : 'กลับ'}
          </Button>
        </div>
      </Spin>
      <Modal
        open={rejectOpen}
        title="ไม่อนุมัติใบแจ้งซ่อม"
        okText="ยืนยันไม่อนุมัติ"
        cancelText="ยกเลิก"
        okButtonProps={{ danger: true, disabled: !rejectReason.trim() }}
        confirmLoading={deciding === 'reject'}
        onOk={() => decide('reject', rejectReason.trim())}
        onCancel={() => { if (!deciding) { setRejectOpen(false); setRejectReason('') } }}
        destroyOnClose
      >
        <Typography.Paragraph>กรุณาระบุเหตุผล (ผู้แจ้งจะเห็นเหตุผลนี้และแก้ไขส่งใหม่ได้)</Typography.Paragraph>
        <Input.TextArea rows={4} maxLength={500} showCount value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
      </Modal>
      {printData && (
        <RepairRequestPrint
          data={printData}
          onReady={() => {
            window.print()
            setPrintData(null)
          }}
        />
      )}
    </div>
  )
}

export default RepairRequestFormPage
