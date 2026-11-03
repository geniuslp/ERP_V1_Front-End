// Marks every antd button whose label starts with "ยกเลิก" (or "Cancel") with .btn-cancel-red — the red styling itself
// lives in index.css next to the print (blue) and edit (yellow) button colours. Done with one observer instead of
// touching the ~90 places that render such a button (page buttons, modal footers, cancelText of Modal / Modal.confirm).
const CANCEL_LABEL = /^(ยกเลิก|cancel)/i
const CLASS = 'btn-cancel-red'

const tag = (root: ParentNode) => {
  root.querySelectorAll<HTMLButtonElement>('button.ant-btn').forEach((b) => {
    const isCancel = CANCEL_LABEL.test((b.textContent ?? '').trim())
    const has = b.classList.contains(CLASS)
    // Only write when something changes, so our own edit never re-triggers the observer.
    if (isCancel && !has) b.classList.add(CLASS)
    else if (!isCancel && has) b.classList.remove(CLASS)
  })
}

export const startActionButtonTint = () => {
  if (typeof document === 'undefined') return
  let queued = false
  const run = () => {
    queued = false
    tag(document)
  }
  const schedule = () => {
    if (queued) return
    queued = true
    setTimeout(run, 16)
  }
  new MutationObserver(schedule).observe(document.body, {
    childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'],
  })
  run()
}
