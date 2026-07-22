import React from 'react'
import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'

const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate()
  return (
    <Result
      status="403"
      title="403"
      subTitle="คุณไม่มีสิทธิ์เข้าถึงหน้านี้"
      extra={
        <Button type="primary" onClick={() => navigate('/')}>
          กลับหน้าแรก
        </Button>
      }
    />
  )
}

export default ForbiddenPage
