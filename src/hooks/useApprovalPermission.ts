import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

export type ApprovalDocType = 'PO' | 'MEMO'

interface UseApprovalPermissionResult {
  canApprove: boolean
  canReject: boolean
  isAssignedApprover: boolean
  currentStepNo: number | null
  currentStepName: string | null
  docStatus: string | null
  loading: boolean
}

export const useApprovalPermission = (
  docType: ApprovalDocType,
  docId: string | number | undefined,
): UseApprovalPermissionResult => {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [isAssignedApprover, setIsAssignedApprover] = useState(false)
  const [currentStepNo, setCurrentStepNo] = useState<number | null>(null)
  const [currentStepName, setCurrentStepName] = useState<string | null>(null)
  const [docStatus, setDocStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if ((docType as string) === 'PR') {
      if (import.meta.env.DEV) {
        console.warn(
          '[useApprovalPermission] docType "PR" has no approval workflow — PR approval UI should have been removed. Skipping call to /approval-request/PR/:docId/my-status.',
        )
      }
      setIsAssignedApprover(false)
      setCurrentStepNo(null)
      setCurrentStepName(null)
      setDocStatus(null)
      setLoading(false)
      return
    }

    if (!docId) {
      setIsAssignedApprover(false)
      setCurrentStepNo(null)
      setCurrentStepName(null)
      setDocStatus(null)
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchMyStatus = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${BASE_URL}/approval-request/${docType}/${docId}/my-status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const data = res.data?.data ?? res.data ?? {}
        if (!cancelled) {
          setIsAssignedApprover(Boolean(data.is_assigned_approver))
          setCurrentStepNo(data.current_step_no ?? null)
          setCurrentStepName(data.current_step_name ?? null)
          setDocStatus(data.doc_status ?? null)
        }
      } catch (err: any) {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.warn(
              `[useApprovalPermission] GET /approval-request/${docType}/${docId}/my-status failed:`,
              err?.response?.data?.message || err?.message || err,
            )
          }
          setIsAssignedApprover(false)
          setCurrentStepNo(null)
          setCurrentStepName(null)
          setDocStatus(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchMyStatus()

    return () => {
      cancelled = true
    }
  }, [docType, docId, accessToken])

  return {
    canApprove: isAssignedApprover,
    canReject: isAssignedApprover,
    isAssignedApprover,
    currentStepNo,
    currentStepName,
    docStatus,
    loading,
  }
}

export default useApprovalPermission
