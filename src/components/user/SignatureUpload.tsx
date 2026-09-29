import React, { useEffect, useRef, useState } from 'react'
import { Card, Button, Space, message } from 'antd'
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const MAX_SIZE_BYTES = 1 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg']

const validateFile = (file: File): boolean => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    message.error('รองรับเฉพาะไฟล์ PNG หรือ JPG เท่านั้น')
    return false
  }
  if (file.size > MAX_SIZE_BYTES) {
    message.error('ขนาดไฟล์ต้องไม่เกิน 1 MB')
    return false
  }
  return true
}

interface SignatureUploadProps {
  // Edit mode when given (an existing user's id) — uploads/deletes hit the API
  // immediately, independent of the surrounding form's own Save button.
  userId?: string | number
  // Edit mode only — whether GET /users/:id/signature has anything to fetch.
  // Skipped (no GET at all) when false, so we don't fire a guaranteed-404 request.
  hasSignature?: boolean
  // Create mode only (no userId) — reports the locally-selected file back to the
  // parent so it can be uploaded once the new user's id exists. No API calls here.
  onChange?: (file: File | null) => void
}

const SignatureUpload: React.FC<SignatureUploadProps> = ({ userId, hasSignature, onChange }) => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const isEdit = userId !== undefined && userId !== null
  const inputRef = useRef<HTMLInputElement>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Revoke whatever object URL is currently held before replacing/unmounting —
  // GET /users/:id/signature needs the Bearer token, so a plain <img src> can't
  // hit it directly; we fetch the bytes ourselves and hand the browser a blob URL.
  const revokeCurrent = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return prev
    })
  }

  useEffect(() => {
    if (!isEdit) return
    if (!hasSignature) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    const fetchSignature = async () => {
      setLoadingPreview(true)
      try {
        const res = await axios.get(`${BASE_URL}/users/${userId}/signature`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: 'blob',
        })
        if (cancelled) return
        objectUrl = URL.createObjectURL(res.data)
        setPreviewUrl(objectUrl)
      } catch {
        if (!cancelled) setPreviewUrl(null)
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }
    fetchSignature()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, userId, hasSignature, accessToken])

  // Revoke the object URL this component created on unmount, in either mode.
  useEffect(() => () => revokeCurrent(), [])

  const handlePickFile = () => inputRef.current?.click()

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!validateFile(file)) return

    if (!isEdit) {
      revokeCurrent()
      setPreviewUrl(URL.createObjectURL(file))
      onChange?.(file)
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await axios.post(`${BASE_URL}/users/${userId}/signature`, formData, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'multipart/form-data' },
      })
      revokeCurrent()
      setPreviewUrl(URL.createObjectURL(file))
      message.success('อัปโหลดลายเซ็นสำเร็จ')
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'อัปโหลดลายเซ็นไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!isEdit) {
      revokeCurrent()
      setPreviewUrl(null)
      onChange?.(null)
      return
    }

    setDeleting(true)
    try {
      await axios.delete(`${BASE_URL}/users/${userId}/signature`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      revokeCurrent()
      setPreviewUrl(null)
      message.success('ลบลายเซ็นสำเร็จ')
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'ลบลายเซ็นไม่สำเร็จ')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card
      title="ลายเซ็น"
      size="small"
      style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
      <div
        style={{
          width: 220,
          height: 110,
          border: '1px dashed #bfdbfe',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f5ff',
          marginBottom: 12,
          overflow: 'hidden',
        }}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="ลายเซ็น" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ color: '#9ca3af', fontSize: 13 }}>
            {loadingPreview ? 'กำลังโหลด...' : 'ยังไม่มีลายเซ็น'}
          </span>
        )}
      </div>
      <Space>
        <Button icon={<UploadOutlined />} onClick={handlePickFile} loading={uploading}>
          อัปโหลด/เปลี่ยนรูป
        </Button>
        <Button icon={<DeleteOutlined />} danger onClick={handleDelete} disabled={!previewUrl} loading={deleting}>
          ลบ
        </Button>
      </Space>
      <div style={{ marginTop: 8, fontSize: 12, color: '#60a5fa' }}>แนะนำ PNG พื้นหลังโปร่งใส</div>
      {isEdit && (
        <div style={{ marginTop: 4, fontSize: 12, color: '#9ca3af' }}>
          บันทึกทันทีเมื่ออัปโหลด/ลบ — ไม่ต้องกดปุ่มบันทึกของฟอร์มหลัก
        </div>
      )}
    </Card>
  )
}

export default SignatureUpload
