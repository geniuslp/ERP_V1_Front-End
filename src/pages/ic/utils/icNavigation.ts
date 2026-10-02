import { Modal } from 'antd'
import type { NavigateFunction } from 'react-router-dom'

// Route of ICProjectListPage (see the <Route path="/ic/projects"> entry in App.tsx).
export const IC_PROJECT_LIST_ROUTE = '/ic/projects'

/**
 * Return to the IC project selection page with the same project pre-selected and the
 * three-tile modal reopened (ICProjectListPage consumes `project`/`open` and strips `open`).
 * `preparedBy` is round-tripped so the "ผู้จัดทำ" choice survives the trip.
 */
export const goBackToICProject = (
  navigate: NavigateFunction,
  projectCode: string,
  preparedBy?: string | null,
) => {
  let url = `${IC_PROJECT_LIST_ROUTE}?project=${encodeURIComponent(projectCode)}&open=1`
  if (preparedBy) url += `&prepared_by=${encodeURIComponent(preparedBy)}`
  navigate(url, { replace: true })
}

/** Runs `leave` immediately, or after a confirm dialog when there is unsaved typed data. */
export const confirmLeaveIfDirty = (dirty: boolean, leave: () => void) => {
  if (!dirty) {
    leave()
    return
  }
  Modal.confirm({
    title: 'ข้อมูลที่กรอกยังไม่ถูกบันทึก ต้องการออกหรือไม่?',
    okText: 'ออก',
    cancelText: 'อยู่ต่อ',
    onOk: leave,
  })
}
