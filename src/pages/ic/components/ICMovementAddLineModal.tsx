import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Form, Select, Input, InputNumber, Button, Row, Col, Typography, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useAppSelector } from '@/store'
import ICMovementMaterialPickerModal, {
  type ICMovementMaterialOption,
} from '@/pages/ic/components/ICMovementMaterialPickerModal'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

type MaterialOption = ICMovementMaterialOption

interface ProjectOption {
  project_code: string
  project_name: string
}

interface CostCodeOption {
  cost_subgroup_id: number
  cost_code: string
  cost_name: string
}

interface ICMovementAddLineModalProps {
  open: boolean
  projectCode: string
  movementId: string
  jobCode?: string
  onClose: () => void
  onSuccess: () => void
}

const ICMovementAddLineModal: React.FC<ICMovementAddLineModalProps> = ({
  open,
  projectCode,
  movementId,
  jobCode,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const [selectedMaterial, setSelectedMaterial] = useState<MaterialOption | undefined>(undefined)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [selectedToProject, setSelectedToProject] = useState<string | undefined>(undefined)

  const [costCodes, setCostCodes] = useState<CostCodeOption[]>([])
  const [costCodesLoading, setCostCodesLoading] = useState(false)
  const [selectedCostSubgroupId, setSelectedCostSubgroupId] = useState<number | undefined>(undefined)

  const [submitting, setSubmitting] = useState(false)

  const selectedToProjectOption = useMemo(
    () => projects.find((p) => p.project_code === selectedToProject),
    [projects, selectedToProject]
  )
  const selectedCostCode = useMemo(
    () => costCodes.find((c) => c.cost_subgroup_id === selectedCostSubgroupId),
    [costCodes, selectedCostSubgroupId]
  )

  // Reset local state each time the modal is (re)opened.
  useEffect(() => {
    if (!open) return
    form.resetFields()
    setSelectedMaterial(undefined)
    setSelectedToProject(undefined)
    setSelectedCostSubgroupId(undefined)
    setCostCodes([])
  }, [open, form])

  // Full project master list for "To Project" — same source as the IC project list page.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const fetchProjects = async () => {
      setProjectsLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects`, {
          headers: authHeader,
          params: { page: 1, page_size: 1000 },
        })
        const payload = res.data?.data ?? res.data
        const rows = Array.isArray(payload) ? payload : payload?.data ?? []
        if (!cancelled) {
          setProjects(
            (Array.isArray(rows) ? rows : []).map((p: any) => ({
              project_code: p.project_code,
              project_name: p.project_name,
            }))
          )
        }
      } catch (err: any) {
        if (!cancelled) message.error(err?.response?.data?.message || err?.message || 'โหลดรายชื่อโครงการไม่สำเร็จ')
      } finally {
        if (!cancelled) setProjectsLoading(false)
      }
    }
    fetchProjects()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Re-fetch cost codes whenever "To Project" changes, and clear the previous ToCostCode value.
  useEffect(() => {
    form.setFieldValue('to_cost_subgroup_id', undefined)
    setSelectedCostSubgroupId(undefined)
    if (!selectedToProject) {
      setCostCodes([])
      return
    }
    let cancelled = false
    const fetchCostCodes = async () => {
      setCostCodesLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/ic/projects/${selectedToProject}/cost-codes`, {
          headers: authHeader,
        })
        const raw = res.data?.data ?? res.data
        const list = Array.isArray(raw) ? raw : []
        if (!cancelled) {
          setCostCodes(
            list.map((c: any) => ({
              cost_subgroup_id: c.cost_subgroup_id,
              cost_code: c.cost_code,
              // GET /ic/projects/:projectCode/cost-codes' actual response key
              // is `subgroup_name` (confirmed against the raw API response) —
              // neither `cost_name` nor `cost_subgroup_name` (both guessed
              // from this app's other, different cost-code endpoints) match
              // this specific one. Local field stays named `cost_name` since
              // it's referenced that way elsewhere in this component.
              cost_name: c.subgroup_name,
            }))
          )
        }
      } catch (err: any) {
        if (!cancelled) message.error(err?.response?.data?.message || err?.message || 'โหลดรหัสต้นทุนปลายทางไม่สำเร็จ')
      } finally {
        if (!cancelled) setCostCodesLoading(false)
      }
    }
    fetchCostCodes()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToProject])

  const handleMaterialSelect = (material: MaterialOption) => {
    setSelectedMaterial(material)
    form.setFieldValue('mat_code', material.mat_code)
    form.setFieldValue('qty', undefined)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (!selectedMaterial) return
      setSubmitting(true)
      const payload = {
        mat_code: values.mat_code,
        cost_subgroup_id: selectedMaterial.cost_subgroup_id,
        qty: values.qty,
        to_project_code: values.to_project_code,
        to_cost_subgroup_id: values.to_cost_subgroup_id,
        remarks: values.remark || undefined,
      }
      await axios.post(`${BASE_URL}/ic/projects/${projectCode}/movements/${movementId}/lines`, payload, {
        headers: authHeader,
      })
      message.success('เพิ่มรายการสำเร็จ')
      onSuccess()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.response?.data?.message || err?.message || 'เพิ่มรายการไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="เพิ่มรายการ"
      open={open}
      onCancel={onClose}
      width={680}
      footer={[
        <Button key="cancel" onClick={onClose}>
          ยกเลิก
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          บันทึก
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Form.Item name="mat_code" label="MatCode" rules={[{ required: true, message: 'กรุณาเลือกวัสดุ' }]}>
              <Input
                readOnly
                placeholder="- เลือกวัสดุ -"
                value={selectedMaterial ? `${selectedMaterial.mat_code} - ${selectedMaterial.mat_name}` : ''}
                onClick={() => setPickerOpen(true)}
                suffix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                style={{ cursor: 'pointer' }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="MatName">
              <Input value={selectedMaterial?.mat_name || ''} disabled />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Form.Item label="CostCode">
              <Input value={selectedMaterial?.cost_code || ''} disabled />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="CostName">
              <Input value={selectedMaterial?.cost_name || ''} disabled />
            </Form.Item>
          </Col>
        </Row>

        {selectedMaterial && (
          <Typography.Text style={{ display: 'block', marginBottom: 8, color: '#0f2d5e' }}>
            คงเหลือ: {selectedMaterial.qty_on_hand} {selectedMaterial.unit}
          </Typography.Text>
        )}

        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="qty"
              label="QTY"
              rules={[
                { required: true, message: 'กรุณากรอกจำนวน' },
                {
                  validator: (_, value) => {
                    if (value === undefined || value === null) return Promise.resolve()
                    if (value <= 0) return Promise.reject(new Error('จำนวนต้องมากกว่า 0'))
                    if (selectedMaterial && value > selectedMaterial.qty_on_hand) {
                      return Promise.reject(new Error('จำนวนเกินคงเหลือ'))
                    }
                    return Promise.resolve()
                  },
                },
              ]}
            >
              <InputNumber style={{ width: '100%' }} min={0} disabled={!selectedMaterial} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="UNIT">
              <Input value={selectedMaterial?.unit || ''} disabled />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="to_project_code"
              label="To Project"
              rules={[{ required: true, message: 'กรุณาเลือกโครงการปลายทาง' }]}
            >
              <Select
                placeholder="- เลือกรายการ -"
                loading={projectsLoading}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={projects.map((p) => ({
                  value: p.project_code,
                  label: `${p.project_code} — ${p.project_name}`,
                }))}
                onChange={(value) => setSelectedToProject(value)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="ProjectName">
              <Input value={selectedToProjectOption?.project_name || ''} disabled />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="to_cost_subgroup_id"
              label="ToCostCode"
              rules={[{ required: true, message: 'กรุณาเลือกรหัสต้นทุนปลายทาง' }]}
            >
              <Select
                placeholder={selectedToProject ? '- เลือกรายการ -' : 'กรุณาเลือกโครงการปลายทางก่อน'}
                loading={costCodesLoading}
                showSearch
                disabled={!selectedToProject}
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={costCodes.map((c) => ({ value: c.cost_subgroup_id, label: c.cost_code }))}
                onChange={(value) => setSelectedCostSubgroupId(value)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="CostCode Name">
              <Input value={selectedCostCode?.cost_name || ''} disabled />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="remark" label="Remark">
          <Input.TextArea rows={3} placeholder="หมายเหตุ (ถ้ามี)" />
        </Form.Item>
      </Form>

      <ICMovementMaterialPickerModal
        open={pickerOpen}
        projectCode={projectCode}
        movementId={movementId}
        jobCode={jobCode}
        onClose={() => setPickerOpen(false)}
        onSelect={handleMaterialSelect}
      />
    </Modal>
  )
}

export default ICMovementAddLineModal
