import React from 'react'
import { Tag, Tooltip } from 'antd'
import type { FinancePaymentListItem } from '@/types/finance'

const label = (code: string, name?: string | null) => {
  const n = (name ?? '').replace(/\s+/g, ' ').trim()
  return n ? `${code} — ${n}` : code
}

// Single project: "CODE name" on one ellipsised line (as before). More than one project (petty cash
// lines can span several): a "หลายโครงการ (N)" Tag whose tooltip lists every "code — name".
const FinanceProjectsCell: React.FC<{ item: Pick<FinancePaymentListItem, 'project_code' | 'project_name' | 'project_count' | 'projects'> }> = ({ item }) => {
  if ((item.project_count ?? 0) > 1 && item.projects?.length) {
    return (
      <Tooltip
        title={
          <div>
            {item.projects.map((p) => (
              <div key={p.project_code}>{label(p.project_code, p.project_name)}</div>
            ))}
          </div>
        }
      >
        <Tag color="purple" style={{ cursor: 'default' }}>หลายโครงการ ({item.project_count})</Tag>
      </Tooltip>
    )
  }
  if (!item.project_code) return <>—</>
  const name = (item.project_name ?? '').replace(/\s+/g, ' ').trim()
  const text = name ? `${item.project_code} ${name}` : item.project_code
  return (
    <Tooltip title={text}>
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
    </Tooltip>
  )
}

export default FinanceProjectsCell
