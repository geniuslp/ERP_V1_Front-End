import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Select, InputNumber, Button, Row, Col, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { stockService } from '@/services/stock.service'
import type { StockCategory } from '@/types'
import StockItemImageGallery from '@/components/stock/StockItemImageGallery'

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

const StockItemCreateEditPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<StockCategory[]>([])

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const list = await stockService.listCategories(accessToken!)
        setCategories(list)
      } catch {
        setCategories([])
      }
    }
    fetchCategories()
  }, [accessToken])

  useEffect(() => {
    if (!isEdit || !id) return
    const fetchItem = async () => {
      setLoading(true)
      try {
        const item = await stockService.getItem(accessToken!, id)
        // Temporary runtime confirmation while verifying the fetch-shape fix — remove once confirmed in prod.
        console.log('[StockItemCreateEditPage] loaded item:', item)
        form.setFieldsValue({
          matCode: item.matCode,
          itemName: item.itemName,
          description: item.description,
          itemType: item.itemType,
          trackingType: item.trackingType,
          unit: item.unit,
          unitCost: item.unitCost,
          qty: item.qty,
          categoryId: item.categoryId,
        })
      } catch (err: any) {
        message.error(err?.response?.data?.message || err?.message || 'Failed to load item')
      } finally {
        setLoading(false)
      }
    }
    fetchItem()
  }, [id, isEdit, accessToken])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        matCode: values.matCode,
        itemName: values.itemName,
        description: values.description || undefined,
        categoryId: values.categoryId,
        itemType: values.itemType,
        trackingType: values.trackingType,
        unit: values.unit,
        unitCost: values.unitCost ?? 0,
        qty: values.qty ?? 0,
      }
      if (isEdit && id) {
        const updated = await stockService.updateItem(accessToken!, id, payload)
        console.log('[StockItemCreateEditPage] save response:', updated)
        message.success('Item updated')
        navigate('/stock/items')
      } else {
        const newItem = await stockService.createItem(accessToken!, payload)
        message.success('Item created')
        navigate(`/stock/items/${newItem.id}/edit`)
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.response?.data?.message || err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Item' : 'Add Item'}
        subtitle={isEdit ? 'Update stock item details' : 'Create a new stock item'}
        breadcrumbs={[
          { title: 'Home' },
          { title: 'Stock Management' },
          { title: 'Item Master', href: '/stock/items' },
          { title: isEdit ? 'Edit' : 'Create' },
        ]}
      />

      <Card title="General Information" style={cardStyle} loading={loading}>
        <Form form={form} layout="vertical" initialValues={{ trackingType: 'sku', unitCost: 0, qty: 0 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Item Code" name="matCode" rules={[{ required: true, message: 'Item code is required' }]}>
                <Input placeholder="e.g. STK-001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item label="Item Name" name="itemName" rules={[{ required: true, message: 'Item name is required' }]}>
                <Input placeholder="Enter item name" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Description" name="description">
                <Input.TextArea rows={3} placeholder="Optional description" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Item Type" name="itemType" rules={[{ required: true, message: 'Select item type' }]}>
                <Select
                  options={[
                    { value: 'RETURNABLE', label: 'Returnable' },
                    { value: 'CONSUMABLE', label: 'Consumable' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Tracking Type" name="trackingType">
                <Select
                  disabled
                  options={[
                    { value: 'sku', label: 'Per SKU' },
                    { value: 'serial', label: 'Per Serial (future)' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Unit" name="unit" rules={[{ required: true, message: 'Unit is required' }]}>
                <Input placeholder="e.g. EA, BOX, KG" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Unit Cost" name="unitCost">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Qty" name="qty">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Category" name="categoryId">
                <Select
                  allowClear
                  placeholder="Select category"
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {isEdit && id && (
        <Card style={cardStyle}>
          <StockItemImageGallery itemId={Number(id)} />
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={() => navigate('/stock/items')}>Cancel</Button>
        <Button
          type="primary"
          loading={saving}
          onClick={handleSave}
          style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none' }}
        >
          Save
        </Button>
      </div>
    </div>
  )
}

export default StockItemCreateEditPage
