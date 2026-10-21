import { message } from 'antd'

export const APPROVAL_FORBIDDEN_DEFAULT_MSG = 'เอกสารนี้ไม่ได้ถูกกำหนดให้คุณเป็นผู้อนุมัติ'
export const APPROVAL_EMPTY_TEXT = 'ไม่มีเอกสารที่รอคุณอนุมัติ'

// Approval list -> detail links carry this query so the detail page sends ?for_approval=true to the API.
// Requester / history / print views never add it.
export const FOR_APPROVAL_QUERY = 'for_approval=true'

/**
 * Handles a 403 from an approval detail request: shows the API message (default text otherwise)
 * and returns true so the caller can navigate back to the list. Other statuses return false.
 */
export const handleApprovalForbidden = (err: any): boolean => {
  if (err?.response?.status !== 403) return false
  message.error(err?.response?.data?.message || err?.response?.data?.error || APPROVAL_FORBIDDEN_DEFAULT_MSG)
  return true
}
