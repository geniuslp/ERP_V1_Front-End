import { message } from 'antd'

export const LINKED_WAREHOUSE_ISSUE_NOT_SUPPORTED = 'LINKED_WAREHOUSE_ISSUE_NOT_SUPPORTED'
export const LINKED_TO_LINKED_TRANSFER_NOT_SUPPORTED = 'LINKED_TO_LINKED_TRANSFER_NOT_SUPPORTED'

export const MOVEMENT_ERROR_MESSAGES: Record<string, string> = {
  [LINKED_WAREHOUSE_ISSUE_NOT_SUPPORTED]:
    "โครงการนี้ผูกกับคลัง ไม่รองรับการตัดเบิก (ISSUE) กรุณาใช้ 'โอนข้ามโครงการ' แทน",
  [LINKED_TO_LINKED_TRANSFER_NOT_SUPPORTED]:
    'ไม่สามารถโอนระหว่างโครงการที่ผูกคลังทั้งสองฝั่งได้ กรุณาใช้เมนูโอนสต็อก (Stock Transfer) แทน',
}

export const REDIRECT_DELAY_MS = 1500

/**
 * If the error carries a known movement rejection code, shows the Thai message and
 * returns the code; otherwise returns null so the caller keeps its existing handling.
 */
export const showMovementError = (err: any): string | null => {
  const code = err?.response?.data?.code
  if (typeof code === 'string' && MOVEMENT_ERROR_MESSAGES[code]) {
    message.error(MOVEMENT_ERROR_MESSAGES[code])
    return code
  }
  return null
}
