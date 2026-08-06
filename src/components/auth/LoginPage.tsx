import React, { useState } from 'react'
import axios from 'axios'
import { Form, Input, Button, Checkbox, message, Typography } from 'antd'
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/store'
import { loginStart, loginSuccess, loginFailure } from '@/store/slices/authSlice'
import type { User } from '@/types'

const { Title, Text } = Typography
const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    dispatch(loginStart())
    try {
      const res = await axios.post(
        `${BASE_URL}/auth/login`,
        { username: values.username, password: values.password },
        { withCredentials: false }
      )
      const { access_token, refresh_token } = res.data.data
      // ✅ ยิง /auth/me เพื่อเอาข้อมูล user
      const meRes = await axios.get(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${access_token}` }
      })
      const userData = meRes.data.data ?? meRes.data

      const mappedUser: User = {
        id: String(userData.id),
        username: userData.username,
        fullName: userData.full_name ?? userData.fullName ?? userData.username,
        email: userData.email,
        roles: Array.isArray(userData.roles)
          ? userData.roles
          : userData.role
            ? [userData.role]
            : [],
        department: userData.department,
      }

      // ✅ เก็บลง sessionStorage
      sessionStorage.setItem('accessToken', access_token)
      sessionStorage.setItem('refreshToken', refresh_token)
      sessionStorage.setItem('user', JSON.stringify(mappedUser))
      dispatch(loginSuccess({
        user: mappedUser,
        tokens: { accessToken: access_token, refreshToken: refresh_token }
      }))
      
      message.success('เข้าสู่ระบบสำเร็จ')
      navigate('/')
    } catch {
      dispatch(loginFailure())
      message.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f2d5e 0%, #1a3f7a 40%, #2563eb 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(59,130,246,0.15)' }} />
      <div style={{ position: 'absolute', bottom: -150, left: -100, width: 500, height: 500, borderRadius: '50%', background: 'rgba(37,99,235,0.1)' }} />
      <div style={{ position: 'absolute', top: '30%', left: '10%', width: 2, height: 200, background: 'rgba(255,255,255,0.1)', transform: 'rotate(30deg)' }} />
      <div style={{ position: 'absolute', top: '20%', right: '15%', width: 2, height: 150, background: 'rgba(255,255,255,0.08)', transform: 'rotate(-20deg)' }} />

      <div className="login-card" style={{
        background: 'rgba(255,255,255,0.97)',
        borderRadius: 20,
        padding: '48px 40px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 25px 60px rgba(9,32,63,0.4)',
        backdropFilter: 'blur(10px)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
          }}>
            <span style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>E</span>
          </div>
          <Title level={3} style={{ margin: 0, color: '#1e3a8a', fontFamily: 'Sarabun', fontWeight: 700 }}>
            ERP System
          </Title>
          <Text style={{ color: '#60a5fa', fontSize: 13 }}>Enterprise Resource Planning</Text>
        </div>

        <Form layout="vertical" onFinish={handleLogin} initialValues={{ remember: true }}>
          <Form.Item name="username" rules={[{ required: true, message: 'กรุณากรอกชื่อผู้ใช้' }]}>
            <Input
              prefix={<UserOutlined style={{ color: '#2563eb' }} />}
              placeholder="ชื่อผู้ใช้"
              size="large"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: 'กรุณากรอกรหัสผ่าน' }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: '#2563eb' }} />}
              placeholder="รหัสผ่าน"
              size="large"
              style={{ borderRadius: 10 }}
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Form.Item name="remember" valuePropName="checked" style={{ margin: 0 }}>
              <Checkbox>จดจำการเข้าสู่ระบบ</Checkbox>
            </Form.Item>
            <Button type="link" style={{ padding: 0, color: '#2563eb' }}>ลืมรหัสผ่าน?</Button>
          </div>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary" htmlType="submit" loading={loading}
              size="large" block
              style={{
                borderRadius: 10, height: 48, fontWeight: 600, fontSize: 15,
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Text style={{ color: '#93c5fd', fontSize: 12 }}>
            ทดลองใช้: admin / admin123
          </Text>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
