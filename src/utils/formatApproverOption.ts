// Label text for approver pickers (options of GET /master/eligible-approvers).
// Show username only. A missing username is NOT papered over with the full name (that hid a
// stale/incomplete API response): it renders "-" and warns with the user id so it gets noticed.
// To show something else, change it here only.
export const formatApproverOption = (username: string | null | undefined, id?: number | string): string => {
  if (username) return username
  console.warn('[approver picker] option has no username, user id:', id)
  return '-'
}
