import React, { useEffect, useState } from 'react'
import { Image, Button, Space, Tag, Empty, message, Popconfirm, Tooltip } from 'antd'
import { DeleteOutlined, StarOutlined, StarFilled, PictureOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useAppSelector } from '@/store'
import StockItemPhotoUploader from './StockItemPhotoUploader'
import { StockItemImage, resolveImageUrl } from './stockImageUtils'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

interface Props {
  itemId: number
}

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const StockItemImageGallery: React.FC<Props> = ({ itemId }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [images, setImages] = useState<StockItemImage[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const fetchImages = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/stock/items/${itemId}/images`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const list = res.data?.data ?? []
      setImages(Array.isArray(list) ? list : [])
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Failed to load photos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (itemId) fetchImages()
  }, [itemId])

  const handleUploaded = (uploaded: StockItemImage[]) => {
    // TEMP DEBUG — remove once the "gallery doesn't refresh" report is confirmed/resolved.
    // eslint-disable-next-line no-console
    console.log('[gallery] handleUploaded called with:', uploaded)
    setImages((prev) => {
      const next = [...prev, ...uploaded]
      // eslint-disable-next-line no-console
      console.log('[gallery] images state before/after:', prev.length, '->', next.length)
      return next
    })
  }

  const handleDelete = async (image: StockItemImage) => {
    setBusyId(image.id)
    try {
      await axios.delete(`${BASE_URL}/stock/items/${itemId}/images/${image.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      setImages((prev) => prev.filter((img) => img.id !== image.id))
      message.success('ลบรูปภาพแล้ว')
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'ลบรูปภาพไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  const handleSetPrimary = async (image: StockItemImage) => {
    if (image.is_primary) return
    setBusyId(image.id)
    try {
      await axios.put(
        `${BASE_URL}/stock/items/${itemId}/images/${image.id}/primary`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      setImages((prev) => prev.map((img) => ({ ...img, is_primary: img.id === image.id })))
      message.success('ตั้งเป็นรูปหลักแล้ว')
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'ตั้งรูปหลักไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <PictureOutlined style={{ color: '#2563eb' }} />
          <span style={{ fontWeight: 600 }}>รูปภาพ ({images.length})</span>
        </Space>
        <StockItemPhotoUploader itemId={itemId} onUploaded={handleUploaded} />
      </div>

      {!loading && images.length === 0 ? (
        <Empty description="ยังไม่มีรูปภาพ" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Image.PreviewGroup>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {images.map((img) => (
              <div
                key={img.id}
                style={{
                  ...cardStyle,
                  position: 'relative',
                  width: 140,
                  height: 140,
                  overflow: 'hidden',
                  border: img.is_primary ? '2px solid #2563eb' : '1px solid #e5e7eb',
                }}
              >
                <Image
                  src={resolveImageUrl(img.file_path)}
                  alt={img.file_name}
                  width={140}
                  height={140}
                  style={{ objectFit: 'cover' }}
                />
                {img.is_primary && (
                  <Tag color="blue" style={{ position: 'absolute', top: 4, left: 4, margin: 0 }}>
                    หลัก
                  </Tag>
                )}
                <Space
                  size={4}
                  style={{ position: 'absolute', top: 4, right: 4 }}
                >
                  <Tooltip title={img.is_primary ? 'รูปหลัก' : 'ตั้งเป็นรูปหลัก'}>
                    <Button
                      size="small"
                      shape="circle"
                      loading={busyId === img.id}
                      icon={img.is_primary ? <StarFilled style={{ color: '#f59e0b' }} /> : <StarOutlined />}
                      onClick={() => handleSetPrimary(img)}
                    />
                  </Tooltip>
                  <Popconfirm title="ลบรูปภาพนี้?" okText="ลบ" cancelText="ยกเลิก" onConfirm={() => handleDelete(img)}>
                    <Tooltip title="ลบ">
                      <Button size="small" shape="circle" danger loading={busyId === img.id} icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        </Image.PreviewGroup>
      )}
    </div>
  )
}

export default StockItemImageGallery
