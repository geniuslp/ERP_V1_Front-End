import React, { useRef, useState } from 'react'
import { Button, Space, Progress, Tooltip, Dropdown } from 'antd'
import { CameraOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { message } from 'antd'
import { useAppSelector } from '@/store'
import CameraCaptureModal from './CameraCaptureModal'
import { isCameraCaptureSupported, uploadStockItemImages, StockItemImage } from './stockImageUtils'

interface Props {
  itemId: number
  variant?: 'full' | 'icon'
  onUploaded: (images: StockItemImage[]) => void
}

const CAMERA_UNSUPPORTED_HINT = 'ถ่ายภาพในแอปต้องใช้การเชื่อมต่อที่ปลอดภัย (HTTPS) — ใช้ "เลือกไฟล์" แทน'

const StockItemPhotoUploader: React.FC<Props> = ({ itemId, variant = 'full', onUploaded }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraSupported] = useState(isCameraCaptureSupported)

  const uploadFiles = async (files: File[]) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const uploaded = await uploadStockItemImages(itemId, files, accessToken, setUploadProgress)
      message.success(`อัปโหลดรูปภาพสำเร็จ ${uploaded.length} รูป`)
      onUploaded(uploaded)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'อัปโหลดรูปภาพไม่สำเร็จ')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    uploadFiles(Array.from(files))
  }

  const handleCameraConfirm = (files: File[]) => {
    setCameraOpen(false)
    if (files.length > 0) uploadFiles(files)
  }

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      style={{ display: 'none' }}
      onChange={handleFilesSelected}
    />
  )

  const cameraModal = (
    <CameraCaptureModal open={cameraOpen} onClose={() => setCameraOpen(false)} onConfirm={handleCameraConfirm} />
  )

  if (variant === 'icon') {
    return (
      <>
        {hiddenInput}
        {cameraModal}
        <Dropdown
          menu={{
            items: [
              {
                key: 'camera',
                label: 'ถ่ายภาพ',
                icon: <CameraOutlined />,
                disabled: !cameraSupported,
                title: cameraSupported ? undefined : CAMERA_UNSUPPORTED_HINT,
              },
              { key: 'gallery', label: 'เลือกไฟล์', icon: <FolderOpenOutlined /> },
            ],
            onClick: ({ key }) => {
              if (key === 'camera') setCameraOpen(true)
              else inputRef.current?.click()
            },
          }}
          trigger={['click']}
        >
          <Button size="small" shape="circle" icon={<CameraOutlined />} loading={uploading} onClick={(e) => e.stopPropagation()} />
        </Dropdown>
      </>
    )
  }

  return (
    <div>
      {hiddenInput}
      {cameraModal}
      <Space direction="vertical" align="end" size={4}>
        <Space>
          <Tooltip title={cameraSupported ? undefined : CAMERA_UNSUPPORTED_HINT}>
            <Button icon={<CameraOutlined />} disabled={!cameraSupported} onClick={() => setCameraOpen(true)} loading={uploading}>
              ถ่ายภาพ
            </Button>
          </Tooltip>
          <Button icon={<FolderOpenOutlined />} onClick={() => inputRef.current?.click()} loading={uploading}>
            เลือกไฟล์
          </Button>
        </Space>
        {!cameraSupported && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{CAMERA_UNSUPPORTED_HINT}</span>
        )}
      </Space>
      {uploading && <Progress percent={uploadProgress} size="small" style={{ marginTop: 8 }} />}
    </div>
  )
}

export default StockItemPhotoUploader
