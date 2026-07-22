import React from 'react'
import { useParams } from 'react-router-dom'
import RequisitionForm from '@/components/stock/RequisitionForm'

const MaterialRequisitionEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  return <RequisitionForm mode="edit" borrowId={id} />
}

export default MaterialRequisitionEditPage
