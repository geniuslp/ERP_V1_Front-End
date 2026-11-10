// How To use — tutorial videos grouped by section (backend: /howto/*).
export interface HowToVideo {
  id: number
  section_id: number
  title: string
  description: string | null
  original_name: string | null
  mime_type: string | null
  size_bytes: number | null
  sort_order: number
  created_at: string
}

export interface HowToSection {
  id: number
  name: string
  description: string | null
  /** Menu whose "read" permission is required to watch; null = every logged-in user. */
  menu_code: string | null
  menu_name: string | null
  sort_order: number
  is_active: boolean
  videos: HowToVideo[]
}

export interface HowToSectionInput {
  name: string
  description?: string | null
  menu_code?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface HowToVideoInput {
  title?: string
  description?: string | null
  sort_order?: number
  section_id?: number
}

/** Per-file upload cap enforced by the API (and checked here before sending). */
export const HOWTO_MAX_VIDEO_BYTES = 100 * 1024 * 1024
