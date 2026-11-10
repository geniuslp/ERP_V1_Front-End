import api from '@/services/api'
import type { HowToSection, HowToSectionInput, HowToVideo, HowToVideoInput } from '@/types/howto'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_URL: string = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1'

const unwrap = <T,>(res: { data: { data?: T } & Record<string, unknown> }): T => (res.data?.data ?? (res.data as unknown)) as T

export const howtoService = {
  /** Sections + videos the current user may watch (filtered by each section's menu permission). */
  listSections: async (): Promise<HowToSection[]> => {
    const res = await api.get('/howto/sections')
    const raw = unwrap<HowToSection[]>(res)
    return Array.isArray(raw) ? raw : []
  },

  /** Every section incl. inactive ones — upload/manage page. */
  listManageSections: async (): Promise<HowToSection[]> => {
    const res = await api.get('/howto/manage/sections')
    const raw = unwrap<HowToSection[]>(res)
    return Array.isArray(raw) ? raw : []
  },

  /** Signed, short-lived (15 min) playback URL. Returns an absolute URL ready for <video src>. */
  getStreamUrl: async (videoId: number): Promise<string> => {
    const res = await api.get(`/howto/videos/${videoId}/stream-url`)
    const data = unwrap<{ url: string }>(res)
    return `${BASE_URL}${data.url}`
  },

  createSection: async (body: HowToSectionInput): Promise<void> => {
    await api.post('/howto/sections', body)
  },
  updateSection: async (id: number, body: HowToSectionInput): Promise<void> => {
    await api.put(`/howto/sections/${id}`, body)
  },
  deleteSection: async (id: number): Promise<void> => {
    await api.delete(`/howto/sections/${id}`)
  },

  /** Multipart upload with progress. timeout 0 = no client timeout (files are up to 100 MB). */
  uploadVideo: async (
    sectionId: number,
    file: File,
    meta: { title?: string; description?: string },
    onProgress?: (percent: number) => void,
  ): Promise<HowToVideo> => {
    const fd = new FormData()
    fd.append('file', file)
    if (meta.title) fd.append('title', meta.title)
    if (meta.description) fd.append('description', meta.description)
    const res = await api.post(`/howto/sections/${sectionId}/videos`, fd, {
      // Without this the shared client's JSON content type would turn the FormData into JSON.
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
    return unwrap<HowToVideo>(res)
  },
  updateVideo: async (id: number, body: HowToVideoInput): Promise<void> => {
    await api.put(`/howto/videos/${id}`, body)
  },
  deleteVideo: async (id: number): Promise<void> => {
    await api.delete(`/howto/videos/${id}`)
  },
}

export const formatFileSize = (bytes?: number | null): string => {
  if (bytes == null) return '-'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
