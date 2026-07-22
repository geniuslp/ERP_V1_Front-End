import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Select, InputNumber, Button, Space, Row, Col, message, Divider } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import PageHeader from '@/components/common/PageHeader'
import { useAppSelector } from '@/store'
import { mockStockItems } from '@/utils/mockStockData'
import type { StockItem } from '@/types/stock'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
  marginBottom: 16,
}

interface Category { id: number; name: string }

const StockItemCreateEditPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/stock/categories`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? []
        setCategories(list)
      } catch {
        setCategories([
          { id: 1, name: 'Tools' },
          { id: 2, name: 'Safety Equipment' },
          { id: 3, name: 'Consumables' },
        ])
      }
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    if (!isEdit) return
    const fetchItem = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/stock/items/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const item: StockItem = res.data?.data ?? res.data
        form.setFieldsValue({
          itemCode: item.itemCode,
          itemName: item.itemName,
          description: item.description,
          itemType: item.itemType,
          trackingType: item.trackingType,
          unit: item.unit,
          minQty: item.minQty,
          categoryId: item.categoryId,
        })
      } catch {
        const item = mockStockItems.find((s) => s.id === Number(id))
        if (item) form.setFieldsValue(item)
      } finally {
        setLoading(false)
      }
    }
    fetchItem()
  }, [id])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (isEdit) {
        await axios.put(`${BASE_URL}/stock/items/${id}`, values, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('Item updated')
      } else {
        await axios.post(`${BASE_URL}/stock/items`, values, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        message.success('Item created')
      }
      navigate('/stock/items')
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
        <Form form={form} layout="vertical" initialValues={{ trackingType: 'sku', minQty: 0 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Item Code" name="itemCode" rules={[{ required: true, message: 'Item code is required' }]}>
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
                    { value: 'returnable', label: 'Returnable' },
                    { value: 'consumable', label: 'Consumable' },
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
              <Form.Item label="Min Qty (Alert Threshold)" name="minQty">
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
