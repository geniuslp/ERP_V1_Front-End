import React, { useState } from 'react'
import { Badge, Button, Empty, Popover, Tag } from 'antd'
import {
  BellOutlined, CheckCircleOutlined, CloseCircleOutlined, DollarOutlined, FileSearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { AppNotification, NotificationType } from '@/hooks/useNotifications'

const TYPE_STYLE: Record<NotificationType, { icon: React.ReactNode; color: string; bg: string }> = {
  APPROVAL_REQUEST: { icon: <FileSearchOutlined />, color: '#d97706', bg: '#fef3c7' },
  APPROVED:         { icon: <CheckCircleOutlined />, color: '#16a34a', bg: '#dcfce7' },
  REJECTED:         { icon: <CloseCircleOutlined />, color: '#dc2626', bg: '#fee2e2' },
  FINANCE_PAYABLE:  { icon: <DollarOutlined />, color: '#1d4ed8', bg: '#dbeafe' },
}

interface Props {
  items: AppNotification[]
  attention: number // unread + approval requests still pending
  unread: number
  pendingTotal: number
  onOpen: (n: AppNotification) => void
  onMarkAllRead: () => void
}

/** Bell with a live unread badge; the popover lists the latest notifications, each one links to its document. */
const NotificationBell: React.FC<Props> = ({ items, attention, unread, pendingTotal, onOpen, onMarkAllRead }) => {
  const [open, setOpen] = useState(false)

  const content = (
    <div style={{ width: 360, maxWidth: '86vw' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 8px' }}>
        <span style={{ fontWeight: 600, color: '#0f2d5e' }}>
          การแจ้งเตือน{pendingTotal > 0 ? ` · รออนุมัติ ${pendingTotal} รายการ` : ''}
        </span>
        <Button type="link" size="small" disabled={unread === 0} onClick={onMarkAllRead}>
          อ่านทั้งหมด
        </Button>
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto', margin: '0 -8px' }}>
        {items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีการแจ้งเตือน" style={{ padding: '16px 0' }} />
        ) : (
          items.map((n) => {
            const st = TYPE_STYLE[n.type] ?? TYPE_STYLE.APPROVAL_REQUEST
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => { setOpen(false); onOpen(n) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setOpen(false); onOpen(n) } }}
                style={{
                  display: 'flex', gap: 10, padding: '10px 12px', cursor: n.link ? 'pointer' : 'default',
                  background: n.pending ? '#fff7e6' : n.is_read ? 'transparent' : '#f0f7ff', borderBottom: '1px solid #eef2f7',
                  borderLeft: n.pending ? '3px solid #d97706' : '3px solid transparent',
                }}
              >
                <div style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: st.bg, color: st.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {st.icon}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: n.is_read && !n.pending ? 500 : 700, fontSize: 13, color: '#1f2937' }}>
                    {n.title}
                    {n.pending && <Tag color="orange" style={{ marginLeft: 6, marginRight: 0 }}>ยังไม่อนุมัติ</Tag>}
                  </div>
                  <div style={{ fontSize: 12, color: '#4b5563', overflowWrap: 'anywhere' }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{dayjs(n.created_at).format('DD/MM/YYYY HH:mm')}</div>
                </div>
                {!n.is_read && <span style={{ flexShrink: 0, width: 8, height: 8, borderRadius: '50%', background: '#2563eb', marginTop: 6 }} />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )

  return (
    <Popover content={content} trigger="click" placement="bottomRight" open={open} onOpenChange={setOpen} arrow>
      <Badge count={attention} size="small" overflowCount={99}>
        <Button type="text" className="tn-icon-btn" aria-label="การแจ้งเตือน" icon={<BellOutlined style={{ fontSize: 18 }} />} />
      </Badge>
    </Popover>
  )
}

export default NotificationBell
