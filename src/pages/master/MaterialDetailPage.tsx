import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Select, Switch, Button, Row, Col, message, Spin, Tooltip } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { materialMasterService } from '@/services/materialMaster.service'
import RenameMasterValueModal from '@/components/master/RenameMasterValueModal'
import type { MaterialMasterOption, MasterLookupKind, RenameTarget } from '@/types/materialMaster'

const RENAME_TITLE: Record<MasterLookupKind, string> = {
  group: 'แก้ไขชื่อกลุ่ม',
  subgroup: 'แก้ไขชื่อกลุ่มย่อย',
  mat_name: 'แก้ไขชื่อวัสดุ',
  spec: 'แก้ไขคำอธิบายสเปค',
  brand: 'แก้ไขชื่อยี่ห้อ',
  unit: 'แก้ไขชื่อหน่วยนับ',
}

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const MaterialDetailPage: React.FC = () => {
  const navigate = useNavigate()
  // Keyed by mat_code (string), not a numeric id — confirmed backend contract:
  // GET/PUT /master/materials/:code.
  const { code } = useParams<{ code: string }>()
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [groups, setGroups] = useState<MaterialMasterOption[]>([])
  const [subgroups, setSubgroups] = useState<MaterialMasterOption[]>([])
  const [matNames, setMatNames] = useState<MaterialMasterOption[]>([])
  const [specs, setSpecs] = useState<MaterialMasterOption[]>([])
  const [brands, setBrands] = useState<MaterialMasterOption[]>([])
  const [units, setUnits] = useState<MaterialMasterOption[]>([])

  const groupId: number | undefined = Form.useWatch('group_id', form)
  const subgroupId: number | undefined = Form.useWatch('subgroup_id', form)
  const matNameId: number | undefined = Form.useWatch('mat_name_id', form)
  const specId: number | undefined = Form.useWatch('spec_id', form)
  const brandId: number | undefined = Form.useWatch('brand_id', form)
  const unitId: number | undefined = Form.useWatch('unit_id', form)

  // Renaming a shared master lookup value (group/subgroup/mat_name/spec/
  // brand/unit) is a separate, immediate action — independent from the
  // main "บันทึก" button below, which only saves which ids this material
  // links to (per the original material detail-page spec).
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [renaming, setRenaming] = useState(false)

  // These four cascade effects handle the INTERACTIVE case — user changes a
  // Select after the page has loaded. They also fire once, redundantly but
  // harmlessly, right after the initial load's Promise.all above (since
  // form.setFieldsValue sets group_id/subgroup_id/mat_name_id/spec_id, which
  // these watches immediately pick up) — that's an accepted extra request,
  // not a bug; the options are already correct by then regardless.
  // subgroups depend on group
  useEffect(() => {
    if (!accessToken || !groupId) { setSubgroups([]); return }
    materialMasterService.getSubgroups(accessToken, groupId).then(setSubgroups).catch(() => setSubgroups([]))
  }, [accessToken, groupId])

  // mat-names depend on subgroup
  useEffect(() => {
    if (!accessToken || !subgroupId) { setMatNames([]); return }
    materialMasterService.getMatNames(accessToken, subgroupId).then(setMatNames).catch(() => setMatNames([]))
  }, [accessToken, subgroupId])

  // specs depend on mat-name
  useEffect(() => {
    if (!accessToken || !matNameId) { setSpecs([]); return }
    materialMasterService.getSpecs(accessToken, matNameId).then(setSpecs).catch(() => setSpecs([]))
  }, [accessToken, matNameId])

  // brands depend on spec
  useEffect(() => {
    if (!accessToken || !specId) { setBrands([]); return }
    materialMasterService.getBrands(accessToken, specId).then(setBrands).catch(() => setBrands([]))
  }, [accessToken, specId])

  useEffect(() => {
    if (!code || !accessToken) return
    const fetchDetail = async () => {
      setLoading(true)
      try {
        const m = await materialMasterService.get(accessToken, code)

        // Fetch every dropdown's options — including the three cascaded ones,
        // scoped to THIS item's actual group_id/subgroup_id/mat_name_id/
        // spec_id — and await them all before touching the form. The Form
        // itself doesn't mount until `loading` flips false (see the
        // `{!loading && <Form>...}` guard below), so as long as every
        // options array is populated before that happens, each Select
        // already has a matching option the moment it renders. This
        // replaces the earlier per-field "seed a synthetic option" patch,
        // which only masked the race for 5 of 6 fields and never covered
        // the top-level "กลุ่ม" Select at all.
        const [gs, us, sgs, mns, sps, brs] = await Promise.all([
          materialMasterService.getGroups(accessToken).catch(() => []),
          // ⚠️ /master/units is unconfirmed (see materialMaster.service.ts) —
          // fails soft to an empty list rather than blocking the rest of the page.
          materialMasterService.getUnits(accessToken).catch(() => []),
          materialMasterService.getSubgroups(accessToken, m.group_id).catch(() => []),
          materialMasterService.getMatNames(accessToken, m.subgroup_id).catch(() => []),
          materialMasterService.getSpecs(accessToken, m.mat_name_id).catch(() => []),
          materialMasterService.getBrands(accessToken, m.spec_id).catch(() => []),
        ])
        setGroups(gs)
        setUnits(us)
        setSubgroups(sgs)
        setMatNames(mns)
        setSpecs(sps)
        setBrands(brs)

        form.setFieldsValue({
          mat_code: m.mat_code,
          group_id: m.group_id,
          subgroup_id: m.subgroup_id,
          mat_name_id: m.mat_name_id,
          spec_description: m.spec_description,
          spec_id: m.spec_id,
          brand_id: m.brand_id,
          unit_id: m.unit_id,
          is_active: m.is_active,
        })
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'โหลดข้อมูลวัสดุไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [code, accessToken])

  // Reset the dependent chain when a parent Select changes by user action —
  // same cascading-reset UX as MaterialPage.tsx's InsertRow, so the user
  // can't save a mismatched group/subgroup/mat-name/spec/brand combo.
  const handleGroupChange = () => {
    form.setFieldsValue({ subgroup_id: undefined, mat_name_id: undefined, spec_id: undefined, brand_id: undefined })
  }
  const handleSubgroupChange = () => {
    form.setFieldsValue({ mat_name_id: undefined, spec_id: undefined, brand_id: undefined })
  }
  const handleMatNameChange = () => {
    form.setFieldsValue({ spec_id: undefined, brand_id: undefined })
  }
  const handleSpecChange = () => {
    form.setFieldsValue({ brand_id: undefined })
  }

  const openRename = (kind: MasterLookupKind, id: number | undefined, currentValue: string | undefined) => {
    if (id == null) return
    setRenameTarget({ kind, id, currentValue: currentValue ?? '' })
  }

  // Re-fetches just the one dropdown that was renamed, from its list
  // endpoint, so the new label shows immediately without a full page
  // reload — the option list is parent-scoped for subgroup/mat_name/
  // spec/brand, so re-run with whatever parent is currently selected.
  const refreshLookupOptions = async (kind: MasterLookupKind) => {
    if (!accessToken) return
    switch (kind) {
      case 'group':
        setGroups(await materialMasterService.getGroups(accessToken).catch(() => groups))
        break
      case 'subgroup':
        if (groupId) setSubgroups(await materialMasterService.getSubgroups(accessToken, groupId).catch(() => subgroups))
        break
      case 'mat_name':
        if (subgroupId) setMatNames(await materialMasterService.getMatNames(accessToken, subgroupId).catch(() => matNames))
        break
      case 'spec':
        if (matNameId) setSpecs(await materialMasterService.getSpecs(accessToken, matNameId).catch(() => specs))
        break
      case 'brand':
        if (specId) setBrands(await materialMasterService.getBrands(accessToken, specId).catch(() => brands))
        break
      case 'unit':
        setUnits(await materialMasterService.getUnits(accessToken).catch(() => units))
        break
    }
  }

  const handleRenameSave = async (newValue: string) => {
    if (!renameTarget) return
    setRenaming(true)
    try {
      await materialMasterService.renameLookup(accessToken, renameTarget.kind, renameTarget.id, newValue)
      await refreshLookupOptions(renameTarget.kind)
      message.success('แก้ไขค่าสำเร็จ')
      setRenameTarget(null)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'แก้ไขไม่สำเร็จ')
    } finally {
      setRenaming(false)
    }
  }

  const handleSave = async () => {
    if (!code) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      await materialMasterService.update(accessToken, code, {
        mat_code: values.mat_code,
        group_id: values.group_id,
        subgroup_id: values.subgroup_id,
        mat_name_id: values.mat_name_id,
        spec_id: values.spec_id,
        brand_id: values.brand_id,
        unit_id: values.unit_id,
        is_active: values.is_active ?? true,
      })
      message.success('บันทึกข้อมูลวัสดุสำเร็จ')
      navigate('/master/materials')
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.response?.data?.message || err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="แก้ไขข้อมูลวัสดุ"
        subtitle="แก้ไขรหัสวัสดุ กลุ่ม สเปค ยี่ห้อ และหน่วยนับ"
        breadcrumbs={[
          { title: 'หน้าหลัก' },
          { title: 'ข้อมูลหลัก' },
          { title: 'วัสดุ', href: '/master/materials' },
          { title: 'แก้ไข' },
        ]}
      />

      <Card style={cardStyle} loading={loading}>
        {!loading && (
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  label="รหัสวัสดุ"
                  name="mat_code"
                  rules={[{ required: true, message: 'กรุณากรอกรหัสวัสดุ' }]}
                >
                  <Input placeholder="เช่น MAT001" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="กลุ่ม" required>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {/* Select must be Form.Item's DIRECT child for the form's
                        clone-based value/onChange binding to reach it — the
                        outer Form.Item above has no `name`, so this inner one
                        (noStyle: no extra label/spacing) is what's actually
                        bound to the field. Wrapping Select one level deeper
                        inside a plain <div> (for the edit-icon layout) without
                        this inner Form.Item was the root cause of the blank
                        dropdowns: the div silently absorbed value/onChange
                        instead of Select ever receiving them. */}
                    <Form.Item name="group_id" noStyle rules={[{ required: true, message: 'กรุณาเลือกกลุ่ม' }]}>
                      <Select
                        key={loading ? 'loading' : 'loaded'}
                        showSearch
                        style={{ flex: 1 }}
                        placeholder="เลือกกลุ่ม"
                        filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={groups.map((g) => ({ value: g.id, label: g.label }))}
                        onChange={handleGroupChange}
                      />
                    </Form.Item>
                    <Tooltip title="แก้ไขนี้จะมีผลกับวัสดุอื่นที่ใช้ค่านี้ร่วมกันด้วย">
                      <Button
                        icon={<EditOutlined />}
                        disabled={!groupId}
                        onClick={() => openRename('group', groupId, groups.find((g) => g.id === groupId)?.name)}
                      />
                    </Tooltip>
                  </div>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="กลุ่มย่อย" required>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Form.Item name="subgroup_id" noStyle rules={[{ required: true, message: 'กรุณาเลือกกลุ่มย่อย' }]}>
                      <Select
                        key={loading ? 'loading' : 'loaded'}
                        showSearch
                        allowClear
                        style={{ flex: 1 }}
                        disabled={!groupId}
                        placeholder="เลือกกลุ่มย่อย"
                        filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={subgroups.map((s) => ({ value: s.id, label: s.label }))}
                        onChange={handleSubgroupChange}
                      />
                    </Form.Item>
                    <Tooltip title="แก้ไขนี้จะมีผลกับวัสดุอื่นที่ใช้ค่านี้ร่วมกันด้วย">
                      <Button
                        icon={<EditOutlined />}
                        disabled={!subgroupId}
                        onClick={() => openRename('subgroup', subgroupId, subgroups.find((s) => s.id === subgroupId)?.name)}
                      />
                    </Tooltip>
                  </div>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="ชื่อวัสดุ" required>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Form.Item name="mat_name_id" noStyle rules={[{ required: true, message: 'กรุณาเลือกชื่อวัสดุ' }]}>
                      <Select
                        key={loading ? 'loading' : 'loaded'}
                        showSearch
                        allowClear
                        style={{ flex: 1 }}
                        disabled={!subgroupId}
                        placeholder="เลือกชื่อวัสดุ"
                        filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={matNames.map((m) => ({ value: m.id, label: m.label }))}
                        onChange={handleMatNameChange}
                      />
                    </Form.Item>
                    <Tooltip title="แก้ไขนี้จะมีผลกับวัสดุอื่นที่ใช้ค่านี้ร่วมกันด้วย">
                      <Button
                        icon={<EditOutlined />}
                        disabled={!matNameId}
                        onClick={() => openRename('mat_name', matNameId, matNames.find((m) => m.id === matNameId)?.name)}
                      />
                    </Tooltip>
                  </div>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="สเปค" required>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Form.Item name="spec_id" noStyle rules={[{ required: true, message: 'กรุณาเลือกสเปค' }]}>
                      <Select
                        key={loading ? 'loading' : 'loaded'}
                        showSearch
                        allowClear
                        style={{ flex: 1 }}
                        disabled={!matNameId}
                        placeholder="เลือกสเปค"
                        filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={specs.map((s) => ({ value: s.id, label: s.label }))}
                        onChange={handleSpecChange}
                      />
                    </Form.Item>
                    <Tooltip title="แก้ไขนี้จะมีผลกับวัสดุอื่นที่ใช้ค่านี้ร่วมกันด้วย">
                      <Button
                        icon={<EditOutlined />}
                        disabled={!specId}
                        onClick={() => openRename('spec', specId, specs.find((s) => s.id === specId)?.name ?? form.getFieldValue('spec_description'))}
                      />
                    </Tooltip>
                  </div>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                {/* Read-only display of the current spec's free-text description —
                    editing the spec value itself is done by picking a different
                    spec_id above, same as MaterialPage.tsx's edit modal keeps
                    spec_description separate from spec_id/spec_code. */}
                <Form.Item label="คำอธิบายสเปค" name="spec_description">
                  <Input disabled placeholder="ตามสเปคที่เลือกด้านบน" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="ยี่ห้อ" required>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Form.Item name="brand_id" noStyle rules={[{ required: true, message: 'กรุณาเลือกยี่ห้อ' }]}>
                      <Select
                        key={loading ? 'loading' : 'loaded'}
                        showSearch
                        allowClear
                        style={{ flex: 1 }}
                        disabled={!specId}
                        placeholder="เลือกยี่ห้อ"
                        filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={brands.map((b) => ({ value: b.id, label: b.label }))}
                      />
                    </Form.Item>
                    <Tooltip title="แก้ไขนี้จะมีผลกับวัสดุอื่นที่ใช้ค่านี้ร่วมกันด้วย">
                      <Button
                        icon={<EditOutlined />}
                        disabled={!brandId}
                        onClick={() => openRename('brand', brandId, brands.find((b) => b.id === brandId)?.name)}
                      />
                    </Tooltip>
                  </div>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="หน่วยนับ" required>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Form.Item name="unit_id" noStyle rules={[{ required: true, message: 'กรุณาเลือกหน่วยนับ' }]}>
                      <Select
                        key={loading ? 'loading' : 'loaded'}
                        showSearch
                        allowClear
                        style={{ flex: 1 }}
                        placeholder="เลือกหน่วยนับ"
                        filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={units.map((u) => ({ value: u.id, label: u.label }))}
                      />
                    </Form.Item>
                    <Tooltip title="แก้ไขนี้จะมีผลกับวัสดุอื่นที่ใช้ค่านี้ร่วมกันด้วย">
                      <Button
                        icon={<EditOutlined />}
                        disabled={!unitId}
                        onClick={() => openRename('unit', unitId, units.find((u) => u.id === unitId)?.name)}
                      />
                    </Tooltip>
                  </div>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="สถานะใช้งาน" name="is_active" valuePropName="checked" initialValue>
                  <Switch checkedChildren="ใช้งาน" unCheckedChildren="ปิดใช้งาน" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={() => navigate('/master/materials')}>ยกเลิก</Button>
        <Button
          type="primary"
          loading={saving}
          onClick={handleSave}
          style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none' }}
        >
          บันทึก
        </Button>
      </div>

      <RenameMasterValueModal
        open={renameTarget !== null}
        title={renameTarget ? RENAME_TITLE[renameTarget.kind] : ''}
        currentValue={renameTarget?.currentValue ?? ''}
        loading={renaming}
        onCancel={() => setRenameTarget(null)}
        onSave={handleRenameSave}
      />
    </div>
  )
}

export default MaterialDetailPage
