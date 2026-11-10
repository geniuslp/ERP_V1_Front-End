import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, Col, Empty, Input, Row, Spin, Tag, Typography, message } from 'antd'
import { PlayCircleOutlined, SearchOutlined, VideoCameraOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import { howtoService, formatFileSize } from '@/services/howtoService'
import type { HowToSection, HowToVideo } from '@/types/howto'

const { Text, Paragraph } = Typography

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 2px 12px rgba(15,45,94,0.08)',
}

const errText = (err: unknown, fallback: string): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any
  return e?.response?.data?.error || e?.response?.data?.message || e?.message || fallback
}

const HowToVideosPage: React.FC = () => {
  const [sections, setSections] = useState<HowToSection[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<HowToVideo | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [srcLoading, setSrcLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const retriedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    howtoService
      .listSections()
      .then((data) => {
        if (cancelled) return
        // Nothing is selected or played until the user picks a video from the list.
        setSections(data)
      })
      .catch((err) => message.error(errText(err, 'โหลดวิดีโอไม่สำเร็จ')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const loadSrc = useCallback(async (video: HowToVideo) => {
    setSrcLoading(true)
    try {
      setSrc(await howtoService.getStreamUrl(video.id))
    } catch (err) {
      setSrc(null)
      message.error(errText(err, 'เปิดวิดีโอไม่สำเร็จ'))
    } finally {
      setSrcLoading(false)
    }
  }, [])

  useEffect(() => {
    retriedRef.current = false
    if (selected) loadSrc(selected)
    else setSrc(null)
  }, [selected, loadSrc])

  // The signed URL lives 15 minutes; if playback fails (e.g. a tab left open), fetch a fresh one once and resume.
  const handleVideoError = async () => {
    if (!selected || retriedRef.current) return
    retriedRef.current = true
    const resumeAt = videoRef.current?.currentTime ?? 0
    try {
      const fresh = await howtoService.getStreamUrl(selected.id)
      setSrc(fresh)
      setTimeout(() => {
        if (videoRef.current) videoRef.current.currentTime = resumeAt
      }, 300)
    } catch (err) {
      message.error(errText(err, 'เล่นวิดีโอไม่สำเร็จ'))
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sections
    return sections
      .map((s) => {
        const sectionHit = s.name.toLowerCase().includes(q)
        const videos = sectionHit ? s.videos : s.videos.filter((v) => v.title.toLowerCase().includes(q))
        return { ...s, videos }
      })
      .filter((s) => s.videos.length > 0)
  }, [sections, search])

  const totalVideos = sections.reduce((n, s) => n + s.videos.length, 0)

  return (
    <div>
      <PageHeader
        title="video การใช้งาน"
        subtitle="วิดีโอสอนการใช้งานระบบ แยกตามหมวด"
        breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'How To use' }, { title: 'video การใช้งาน' }]}
      />

      <Spin spinning={loading}>
        {!loading && totalVideos === 0 ? (
          <Card style={cardStyle}>
            <Empty description="ยังไม่มีวิดีโอที่คุณมีสิทธิ์ดู" />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14} xl={16}>
              <Card style={cardStyle} styles={{ body: { padding: 16 } }}>
                {selected ? (
                  <>
                    <Spin spinning={srcLoading}>
                      <div style={{ background: '#000', borderRadius: 12, overflow: 'hidden', aspectRatio: '16 / 9' }}>
                        {src && (
                          <video
                            key={src}
                            ref={videoRef}
                            src={src}
                            controls
                            autoPlay
                            preload="metadata"
                            onError={handleVideoError}
                            style={{ width: '100%', height: '100%', display: 'block' }}
                          />
                        )}
                      </div>
                    </Spin>
                    <div style={{ marginTop: 14 }}>
                      <Text strong style={{ fontSize: 18, color: '#0f2d5e' }}>
                        {selected.title}
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        <Tag color="blue">{sections.find((s) => s.id === selected.section_id)?.name}</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatFileSize(selected.size_bytes)}
                        </Text>
                      </div>
                      {selected.description && (
                        <Paragraph style={{ marginTop: 10, marginBottom: 0, whiteSpace: 'pre-wrap' }}>{selected.description}</Paragraph>
                      )}
                    </div>
                  </>
                ) : (
                  <Empty description="เลือกวิดีโอจากรายการด้านขวา" />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={10} xl={8}>
              <Card style={cardStyle} styles={{ body: { padding: 16 } }}>
                <Input
                  allowClear
                  prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="ค้นหาวิดีโอหรือหมวด"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                {visible.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่พบวิดีโอที่ค้นหา" />
                ) : (
                  visible.map((s) => (
                    <div key={s.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <VideoCameraOutlined style={{ color: '#2563eb' }} />
                        <Text strong style={{ color: '#0f2d5e' }}>
                          {s.name}
                        </Text>
                        <Tag style={{ marginLeft: 'auto' }}>{s.videos.length}</Tag>
                      </div>
                      {s.videos.length === 0 ? (
                        <Text type="secondary" style={{ fontSize: 12, paddingLeft: 24 }}>
                          ยังไม่มีวิดีโอ
                        </Text>
                      ) : (
                        s.videos.map((v) => {
                          const active = selected?.id === v.id
                          return (
                            <div
                              key={v.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelected(v)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setSelected(v)
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 12px',
                                marginBottom: 4,
                                borderRadius: 8,
                                cursor: 'pointer',
                                background: active ? '#eff6ff' : 'transparent',
                                border: `1px solid ${active ? '#93c5fd' : 'transparent'}`,
                              }}
                            >
                              <PlayCircleOutlined style={{ fontSize: 20, color: active ? '#2563eb' : '#9ca3af' }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: active ? 600 : 400, color: '#1f2937', wordBreak: 'break-word' }}>{v.title}</div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {formatFileSize(v.size_bytes)}
                                </Text>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  ))
                )}
              </Card>
            </Col>
          </Row>
        )}
      </Spin>
    </div>
  )
}

export default HowToVideosPage
