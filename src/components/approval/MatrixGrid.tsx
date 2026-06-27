import React from 'react'
import { Tooltip, Spin } from 'antd'
import { CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons'
import type { ApprovalDocType, ApprovalConfig, ApprovalRole } from '@/types/approval.types'

interface MatrixGridProps {
  docTypes: ApprovalDocType[]
  roles: ApprovalRole[]
  configs: ApprovalConfig[]
  pendingAdds: Set<string>     // key: `${docType}|${roleId}`
  pendingDeletes: Set<number>  // config IDs
  loading: boolean
  onCellClick: (docType: string, roleId: number) => void
}

type CellState = 'active' | 'inactive' | 'pending-add' | 'pending-delete' | 'empty'

const CELL_SIZE = 44

function getCellState(
  docType: string,
  roleId: number,
  configs: ApprovalConfig[],
  pendingAdds: Set<string>,
  pendingDeletes: Set<number>,
): CellState {
  const config = configs.find((c) => c.doc_type === docType && c.approver_role_id === roleId)
  const cellKey = `${docType}|${roleId}`

  if (!config) return pendingAdds.has(cellKey) ? 'pending-add' : 'empty'
  if (pendingDeletes.has(config.id)) return 'pending-delete'
  return config.is_active ? 'active' : 'inactive'
}

const CELL_VISUALS: Record<
  CellState,
  { bg: string; border: string; color: string; icon: React.ReactNode; tooltip: string }
> = {
  active: {
    bg: '#f6ffed',
    border: '1.5px solid #52c41a',
    color: '#52c41a',
    icon: <CheckOutlined />,
    tooltip: 'มี Rule — คลิกเพื่อทำเครื่องหมายลบ',
  },
  inactive: {
    bg: '#fff2f0',
    border: '1.5px solid #ff4d4f',
    color: '#ff4d4f',
    icon: <CloseOutlined />,
    tooltip: 'Rule ปิดอยู่ — คลิกเพื่อทำเครื่องหมายลบ',
  },
  'pending-add': {
    bg: '#f0fdf4',
    border: '2px dashed #22c55e',
    color: '#22c55e',
    icon: <CheckOutlined />,
    tooltip: 'รอเพิ่ม — คลิกเพื่อยกเลิก',
  },
  'pending-delete': {
    bg: '#f9fafb',
    border: '2px dashed #d1d5db',
    color: '#d1d5db',
    icon: <CloseOutlined />,
    tooltip: 'รอลบ — คลิกเพื่อยกเลิก',
  },
  empty: {
    bg: '#fafafa',
    border: '1.5px dashed #d9d9d9',
    color: '#bfbfbf',
    icon: <PlusOutlined />,
    tooltip: 'คลิกเพื่อเพิ่ม Rule',
  },
}

const MatrixCell: React.FC<{ state: CellState; onClick: () => void }> = ({ state, onClick }) => {
  const v = CELL_VISUALS[state]
  return (
    <Tooltip title={v.tooltip}>
      <div
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: CELL_SIZE,
          height: CELL_SIZE,
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.15s',
          background: v.bg,
          border: v.border,
          fontSize: 16,
          color: v.color,
          opacity: state === 'pending-delete' ? 0.55 : 1,
        }}
      >
        {v.icon}
      </div>
    </Tooltip>
  )
}

const MatrixGrid: React.FC<MatrixGridProps> = ({
  docTypes,
  roles,
  configs,
  pendingAdds,
  pendingDeletes,
  loading,
  onCellClick,
}) => {
  const activeDocTypes = docTypes.filter((d) => d.is_active)
  const activeRoles = roles.filter((r) => r.is_active)

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    background: '#f0f5ff',
    border: '1px solid #e8eaf0',
    fontWeight: 600,
    color: '#0f2d5e',
    whiteSpace: 'nowrap',
  }

  const tdBaseStyle: React.CSSProperties = {
    padding: '10px 16px',
    border: '1px solid #e8eaf0',
    textAlign: 'center',
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" tip="กำลังโหลด..." />
      </div>
    )
  }

  if (activeDocTypes.length === 0 || activeRoles.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 13 }}>
        {activeDocTypes.length === 0 ? 'ไม่มีประเภทเอกสาร — เพิ่มผ่าน "จัดการประเภทเอกสาร"' : 'ไม่มี Role — เพิ่มผ่าน "จัดการ Role"'}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 400 }}>
        <thead>
          <tr>
            <th
              style={{
                ...thStyle,
                textAlign: 'left',
                position: 'sticky',
                left: 0,
                zIndex: 2,
                minWidth: 200,
              }}
            >
              Role / เอกสาร
            </th>
            {activeDocTypes.map((dt) => (
              <th key={dt.id} style={{ ...thStyle, textAlign: 'center', minWidth: 130 }}>
                <div style={{ fontSize: 13 }}>{dt.doc_label}</div>
                <div style={{ fontSize: 10, color: '#6b82b5', fontWeight: 400, marginTop: 2 }}>{dt.doc_type}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeRoles.map((role, ri) => (
            <tr key={role.id}>
              <td
                style={{
                  ...tdBaseStyle,
                  textAlign: 'left',
                  background: ri % 2 === 0 ? '#fff' : '#fafafa',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                }}
              >
                <div style={{ fontWeight: 500, color: '#333', fontSize: 13 }}>{role.role_name}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>{role.role_code}</div>
              </td>
              {activeDocTypes.map((dt) => {
                const state = getCellState(dt.doc_type, role.id, configs, pendingAdds, pendingDeletes)
                return (
                  <td
                    key={dt.id}
                    style={{ ...tdBaseStyle, background: ri % 2 === 0 ? '#fff' : '#fafafa' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <MatrixCell
                        state={state}
                        onClick={() => onCellClick(dt.doc_type, role.id)}
                      />
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default MatrixGrid
