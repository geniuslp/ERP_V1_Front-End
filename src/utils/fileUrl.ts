const BASE_URL = (import.meta as any).env?.VITE_API_URL
const FILE_BASE_URL = (BASE_URL ?? '').replace(/\/api\/v1\/?$/, '')

// Backend returns file_path/filePath as a bare relative path (e.g.
// "uploads/pr/xxx.pdf"), served as a static file off the API host, not
// under /api/v1. Used directly in <a href> it resolves against the current
// page path instead — broken once the app moved under a path prefix (e.g.
// /erp). Prepend the API host (with /api/v1 stripped) to get a real
// absolute URL; already-absolute values pass through unchanged.
export const resolveFileUrl = (filePath?: string | null): string | undefined => {
  if (!filePath) return undefined
  if (/^https?:\/\//i.test(filePath)) return filePath
  return `${FILE_BASE_URL}/${filePath.replace(/^\/+/, '')}`
}
