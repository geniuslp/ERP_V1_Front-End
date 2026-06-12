import React from 'react'
import { Card, Tabs, Form, Input, Switch, Select, Button, Space, message, Typography, Row, Col, Divider } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'

const { Title, Text } = Typography

const GeneralSettings = () => {
  const [form] = Form.useForm()
  return (
    <Form form={form} layout="vertical" onFinish={() => message.success('บันทึกการตั้งค่าเรียบร้อย')}>
      <Row gutter={16}>
        <Col xs={24} md={12}><Form.Item label="ชื่อระบบ" name="systemName" initialValue="ERP System"><Input /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="เวอร์ชัน" name="version" initialValue="1.0.0"><Input disabled /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="ภาษาเริ่มต้น" name="language" initialValue="th"><Select options={[{ value: 'th', label: 'ภาษาไทย' }, { value: 'en', label: 'English' }]} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="โซนเวลา" name="timezone" initialValue="Asia/Bangkok"><Select options={[{ value: 'Asia/Bangkok', label: 'Asia/Bangkok (UTC+7)' }]} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="รูปแบบวันที่" name="dateFormat" initialValue="DD/MM/YYYY"><Select options={[{ value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }, { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }]} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="สกุลเงิน" name="currency" initialValue="THB"><Select options={[{ value: 'THB', label: 'บาท (THB)' }, { value: 'USD', label: 'Dollar (USD)' }]} /></Form.Item></Col>
      </Row>
      <Form.Item><Button type="primary" htmlType="submit" icon={<SaveOutlined />}>บันทึก</Button></Form.Item>
    </Form>
  )
}

const AuthSettings = () => {
  const [form] = Form.useForm()
  return (
    <Form form={form} layout="vertical" onFinish={() => message.success('บันทึกการตั้งค่าเรียบร้อย')}>
      <Title level={5} style={{ color: '#1e3a8a', marginBottom: 16 }}>JWT Configuration</Title>
      <Row gutter={16}>
        <Col xs={24} md={12}><Form.Item label="Access Token Expiry" name="accessTokenExpiry" initialValue="15m" tooltip="เวลาหมดอายุของ Access Token"><Select options={[{ value: '5m', label: '5 นาที' }, { value: '15m', label: '15 นาที' }, { value: '30m', label: '30 นาที' }, { value: '1h', label: '1 ชั่วโมง' }]} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="Refresh Token Expiry" name="refreshTokenExpiry" initialValue="7d" tooltip="เวลาหมดอายุของ Refresh Token"><Select options={[{ value: '1d', label: '1 วัน' }, { value: '7d', label: '7 วัน' }, { value: '30d', label: '30 วัน' }, { value: '90d', label: '90 วัน' }]} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="JWT Secret Key" name="jwtSecret"><Input.Password placeholder="กรอก Secret Key" /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="Algorithm" name="algorithm" initialValue="HS256"><Select options={[{ value: 'HS256' }, { value: 'RS256' }]} /></Form.Item></Col>
      </Row>
      <Divider />
      <Title level={5} style={{ color: '#1e3a8a', marginBottom: 16 }}>Security</Title>
      <Row gutter={16}>
        <Col xs={24} md={12}><Form.Item label="Max Login Attempts" name="maxAttempts" initialValue="5"><Input type="number" /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="Lockout Duration (นาที)" name="lockoutDuration" initialValue="15"><Input type="number" /></Form.Item></Col>
        <Col xs={24}><Form.Item label="Two-Factor Authentication" name="twoFactor" valuePropName="checked"><Switch /></Form.Item></Col>
      </Row>
      <Form.Item><Button type="primary" htmlType="submit" icon={<SaveOutlined />}>บันทึก</Button></Form.Item>
    </Form>
  )
}

const NotificationSettings = () => {
  const [form] = Form.useForm()
  return (
    <Form form={form} layout="vertical" onFinish={() => message.success('บันทึกการตั้งค่าเรียบร้อย')}>
      <Row gutter={16}>
        <Col xs={24} md={12}><Form.Item label="SMTP Host" name="smtpHost"><Input placeholder="smtp.example.com" /></Form.Item></Col>
        <Col xs={24} md={6}><Form.Item label="SMTP Port" name="smtpPort" initialValue="587"><Input /></Form.Item></Col>
        <Col xs={24} md={6}><Form.Item label="SSL/TLS" name="smtpSsl" valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="อีเมลผู้ส่ง" name="fromEmail"><Input placeholder="noreply@example.com" /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="ชื่อผู้ส่ง" name="fromName"><Input placeholder="ERP System" /></Form.Item></Col>
      </Row>
      <Divider />
      <Text strong style={{ color: '#1e3a8a' }}>การแจ้งเตือน</Text>
      <div style={{ marginTop: 12 }}>
        {['แจ้งเตือนเมื่อมี PR ใหม่', 'แจ้งเตือนเมื่ออนุมัติ PR', 'แจ้งเตือนเมื่อสร้าง PO', 'แจ้งเตือนเมื่อ PO ส่งมอบ'].map((label) => (
          <Form.Item key={label} label={label} name={label} valuePropName="checked" style={{ marginBottom: 8 }}><Switch defaultChecked /></Form.Item>
        ))}
      </div>
      <Form.Item><Button type="primary" htmlType="submit" icon={<SaveOutlined />}>บันทึก</Button></Form.Item>
    </Form>
  )
}

const SystemConfigPage: React.FC = () => (
  <div>
    <PageHeader title="System Config" subtitle="ตั้งค่าระบบทั้งหมด"
      breadcrumbs={[{ title: 'หน้าหลัก' }, { title: 'System' }, { title: 'Config' }]} />
    <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(15,45,94,0.08)' }}>
      <Tabs
        items={[
          { key: 'general', label: 'ทั่วไป', children: <GeneralSettings /> },
          { key: 'auth', label: 'การยืนยันตัวตน (JWT)', children: <AuthSettings /> },
          { key: 'notification', label: 'การแจ้งเตือน', children: <NotificationSettings /> },
        ]}
      />
    </Card>
  </div>
)

export default SystemConfigPage
