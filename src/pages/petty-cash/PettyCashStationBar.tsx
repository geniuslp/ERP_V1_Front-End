import React from 'react'
import { Grid, Tooltip } from 'antd'
import {
  CheckOutlined, PrinterOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import PermissionButton from '@/components/common/PermissionButton'

const { useBreakpoint } = Grid

type StationState = 'done' | 'current' | 'pending' | 'error'

interface Props {
  /** Document status; undefined = document not created yet. */
  status?: string
  /** Click handler for the Submit approve pill (still disabled until that task is built). */
  onSubmitClick?: () => void
  /** Submit approve pill is clickable only when true (remarks filled + at least one line, editable doc). */
  submitEnabled?: boolean
}

const COLORS = {
  done: '#16a34a',
  current: '#1d4ed8',
  error: '#dc2626',
  pendingBg: '#e5e7eb',
  pendingFg: '#9ca3af',
  line: '#e5e7eb',
}

export const stationStates = (status?: string): StationState[] => {
  switch (status) {
    case 'PENDING_APPROVAL': return ['done', 'current', 'pending', 'pending']
    case 'APPROVED': return ['done', 'done', 'current', 'pending']
    case 'REJECTED': return ['done', 'done', 'pending', 'error']
    case 'CANCELLED': return ['pending', 'pending', 'pending', 'pending']
    default: return ['current', 'pending', 'pending', 'pending'] // none / DRAFT
  }
}

const STATIONS = [
  { no: 1, title: 'Print form', caption: 'พิมพ์ใบเบิก', btn: 'พิมพ์', icon: <PrinterOutlined />, menu: 'MENU_PETTY_CASH_CREATE', danger: false },
  { no: 2, title: 'Submit approve', caption: 'รออนุมัติ', btn: 'ส่งอนุมัติ', icon: <SendOutlined />, menu: 'MENU_PETTY_CASH_CREATE', danger: false },
  { no: 3, title: 'SignComplete', caption: 'เซ็นเอกสารเสร็จสิ้น', btn: 'SignComplete', icon: <CheckCircleOutlined />, menu: 'MENU_PETTY_CASH_APPROVAL', danger: false },
  { no: 4, title: 'Reject', caption: 'ไม่อนุมัติ / ส่งกลับแก้ไข', btn: 'Reject', icon: <CloseCircleOutlined />, menu: 'MENU_PETTY_CASH_APPROVAL', danger: true },
]

const nodeStyle = (state: StationState): React.CSSProperties => ({
  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 14, fontWeight: 700, color: '#fff',
  background:
    state === 'done' ? COLORS.done
    : state === 'current' ? COLORS.current
    : state === 'error' ? COLORS.error
    : COLORS.pendingBg,
  ...(state === 'pending' ? { color: COLORS.pendingFg } : {}),
  // soft navy-tone ring on the current station (no black shadows)
  boxShadow:
    state === 'current' ? '0 0 0 4px rgba(29,78,216,0.18)'
    : state === 'error' ? '0 0 0 4px rgba(220,38,38,0.15)'
    : undefined,
})

const PettyCashStationBar: React.FC<Props> = ({ status, onSubmitClick, submitEnabled = false }) => {
  const screens = useBreakpoint()
  const vertical = screens.md === false
  const states = stationStates(status)

  const renderNode = (i: number) => {
    const state = states[i]
    if (state === 'done') return <span style={nodeStyle(state)}><CheckOutlined /></span>
    if (state === 'error') return <span style={nodeStyle(state)}><CloseCircleOutlined /></span>
    return <span style={nodeStyle(state)}>{STATIONS[i].no}</span>
  }

  const renderText = (i: number, align: 'center' | 'left') => {
    const st = STATIONS[i]
    const state = states[i]
    const titleColor =
      state === 'error' ? COLORS.error : state === 'pending' ? COLORS.pendingFg : '#1e3a8a'
    return (
      <div style={{ textAlign: align, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: state === 'current' || state === 'error' ? 700 : 500, color: titleColor }}>
          {st.title}
        </div>
        <div style={{ fontSize: 12, color: state === 'pending' ? COLORS.pendingFg : '#64748b', marginTop: 2 }}>
          {st.caption}
        </div>
        <div style={{ marginTop: 8 }}>
          {/* Only Submit approve is wired; the other actions stay visibly disabled. */}
          <Tooltip
            title={
              st.no !== 2
                ? 'เร็ว ๆ นี้ (Coming soon)'
                : submitEnabled ? undefined : 'กรอกหมายเหตุผู้เบิกและเพิ่มรายการอย่างน้อย 1 รายการก่อนส่งอนุมัติ'
            }
          >
            <span style={{ display: 'inline-block' }}>
              <PermissionButton
                menuCode={st.menu}
                action="edit"
                mode="disable"
                size="small"
                danger={st.danger}
                icon={st.icon}
                disabled={st.no === 2 ? !submitEnabled : true}
                style={{ borderRadius: 999 }}
                onClick={st.no === 2 ? onSubmitClick : undefined}
              >
                {st.btn}
              </PermissionButton>
            </span>
          </Tooltip>
        </div>
      </div>
    )
  }

  const lineColor = (i: number) => (states[i] === 'done' ? COLORS.done : COLORS.line)

  return (
    // Bare stepper — framing (card, border, shadow, sticky) is owned by the page footer card.
    <div style={{ width: '100%', minWidth: 0 }}>
      {vertical ? (
        // Narrow: vertical stepper, node + connector down the left edge.
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {STATIONS.map((st, i) => (
            <div key={st.no} style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {renderNode(i)}
                {i < STATIONS.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 16, background: lineColor(i), margin: '4px 0' }} />
                )}
              </div>
              <div style={{ paddingBottom: i < STATIONS.length - 1 ? 16 : 0 }}>{renderText(i, 'left')}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex' }}>
          {STATIONS.map((st, i) => (
            <div key={st.no} style={{ flex: 1, minWidth: 0 }}>
              {/* node row: half-connector | node | half-connector */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, height: 2, background: i === 0 ? 'transparent' : lineColor(i - 1) }} />
                {renderNode(i)}
                <div style={{ flex: 1, height: 2, background: i === STATIONS.length - 1 ? 'transparent' : lineColor(i) }} />
              </div>
              <div style={{ marginTop: 10, padding: '0 8px' }}>{renderText(i, 'center')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PettyCashStationBar
