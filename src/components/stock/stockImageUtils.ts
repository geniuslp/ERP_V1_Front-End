import axios from 'axios'

const BASE_URL = (import.meta as any).env?.VITE_API_URL
const FILE_BASE_URL = (BASE_URL ?? '').replace(/\/api\/v1\/?$/, '')

export interface StockItemImage {
  id: number
  item_id: number
  file_path: string
  file_name: string
  is_primary: boolean
  sort_order: number
  created_at: string
}

export const resolveImageUrl = (filePath?: string | null): string | undefined => {
  if (!filePath) return undefined
  if (/^https?:\/\//i.test(filePath)) return filePath
  return `${FILE_BASE_URL}/${filePath.replace(/^\/+/, '')}`
}

// getUserMedia requires a secure context (HTTPS or localhost). This app is
// currently served over plain HTTP in some environments, so this must be a
// runtime check, not a build-time flag — the "Take Photo" button reappears
// automatically once the app is served over HTTPS, with no redeploy needed.
export const isCameraCaptureSupported = (): boolean =>
  typeof window !== 'undefined' &&
  window.isSecureContext === true &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function'

export const uploadStockItemImages = async (
  itemId: number,
  files: File[],
  accessToken: string | undefined,
  onProgress?: (percent: number) => void,
): Promise<StockItemImage[]> => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  const res = await axios.post(`${BASE_URL}/stock/items/${itemId}/images`, formData, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (evt.total && onProgress) onProgress(Math.round((evt.loaded * 100) / evt.total))
    },
  })
  // TEMP DEBUG — remove once the "thumbnail doesn't refresh" report is confirmed/resolved.
  // eslint-disable-next-line no-console
  console.log('[stock image upload] raw response:', JSON.stringify(res.data, null, 2))
  const uploaded = res.data?.data ?? []
  return Array.isArray(uploaded) ? uploaded : []
}
