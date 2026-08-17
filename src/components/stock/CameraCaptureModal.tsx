import React, { useEffect, useRef, useState } from 'react'
import { Modal, Button, Space, Alert, Upload, Badge } from 'antd'
import {
  CameraOutlined, RetweetOutlined, DeleteOutlined,
  CheckOutlined, CloseOutlined, UploadOutlined,
} from '@ant-design/icons'

interface CapturedShot {
  id: string
  blob: Blob
  previewUrl: string
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (files: File[]) => void
}

const CameraCaptureModal: React.FC<Props> = ({ open, onClose, onConfirm }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noCamera, setNoCamera] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceIndex, setDeviceIndex] = useState(0)
  const [shots, setShots] = useState<CapturedShot[]>([])

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const startStream = async (deviceId?: string) => {
    setStarting(true)
    setError(null)
    stopStream()
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' } },
        audio: false,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      try {
        const list = await navigator.mediaDevices.enumerateDevices()
        setDevices(list.filter((d) => d.kind === 'videoinput'))
      } catch {
        // ignore — flip button just won't show
      }
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
      const notFound = err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError'
      setNoCamera(notFound)
      setError(
        denied
          ? 'ไม่ได้รับอนุญาตให้เข้าถึงกล้อง กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์แล้วลองใหม่อีกครั้ง'
          : notFound
          ? 'ไม่พบกล้องในอุปกรณ์นี้ — สามารถเลือกรูปภาพจากคลังภาพแทนได้'
          : 'ไม่สามารถเปิดกล้องได้ — ' + (err?.message ?? err),
      )
    } finally {
      setStarting(false)
    }
  }

  useEffect(() => {
    if (open) {
      setShots([])
      setError(null)
      setNoCamera(false)
      setDeviceIndex(0)
      startStream()
    } else {
      stopStream()
    }
    return () => stopStream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleFlip = () => {
    if (devices.length < 2) return
    const nextIndex = (deviceIndex + 1) % devices.length
    setDeviceIndex(nextIndex)
    startStream(devices[nextIndex].deviceId)
  }

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const previewUrl = URL.createObjectURL(blob)
        setShots((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, blob, previewUrl }])
      },
      'image/jpeg',
      0.92,
    )
  }

  const handleRemoveShot = (id: string) => {
    setShots((prev) => {
      const target = prev.find((s) => s.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((s) => s.id !== id)
    })
  }

  const handleClose = () => {
    shots.forEach((s) => URL.revokeObjectURL(s.previewUrl))
    stopStream()
    onClose()
  }

  const handleConfirm = () => {
    const files = shots.map(
      (s, i) => new File([s.blob], `capture-${Date.now()}-${i}.jpg`, { type: 'image/jpeg' }),
    )
    stopStream()
    onConfirm(files)
    setShots([])
  }

  const handleGalleryFallback = (fileList: File[]) => {
    stopStream()
    onConfirm(fileList)
    setShots([])
    return false
  }

  return (
    <Modal
      title={
        <Space>
          <CameraOutlined style={{ color: '#2563eb' }} />
          <span>ถ่ายภาพ</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={420}
      centered
      destroyOnClose
    >
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {error ? (
        <div>
          <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
          <Upload
            accept="image/*"
            multiple
            showUploadList={false}
            beforeUpload={(_file, fileList) => handleGalleryFallback(fileList)}
          >
            <Button block icon={<UploadOutlined />}>เลือกรูปภาพจากคลังภาพแทน</Button>
          </Upload>
        </div>
      ) : (
        <div>
          <div
            style={{
              position: 'relative',
              width: '100%',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#000',
              minHeight: 260,
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', display: 'block', maxHeight: 360, objectFit: 'cover' }}
            />
            {devices.length > 1 && (
              <Button
                shape="circle"
                icon={<RetweetOutlined />}
                onClick={handleFlip}
                style={{ position: 'absolute', top: 8, right: 8 }}
              />
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
            {starting ? 'กำลังเปิดกล้อง...' : 'จัดกรอบวัตถุแล้วกดปุ่มถ่ายภาพ — ถ่ายได้หลายรูปก่อนยืนยัน'}
          </div>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={<CameraOutlined />}
              disabled={starting}
              onClick={handleCapture}
              style={{ width: 56, height: 56 }}
            />
          </div>

          {shots.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {shots.map((shot) => (
                <div key={shot.id} style={{ position: 'relative', width: 64, height: 64 }}>
                  <img
                    src={shot.previewUrl}
                    alt=""
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }}
                  />
                  <Button
                    size="small"
                    shape="circle"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveShot(shot.id)}
                    style={{ position: 'absolute', top: -6, right: -6 }}
                  />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Button icon={<CloseOutlined />} onClick={handleClose}>ยกเลิก</Button>
            <Badge count={shots.length} size="small" offset={[-6, 4]}>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                disabled={shots.length === 0}
                onClick={handleConfirm}
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none' }}
              >
                ยืนยัน ({shots.length})
              </Button>
            </Badge>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default CameraCaptureModal
