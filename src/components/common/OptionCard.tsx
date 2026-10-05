import React, { useState } from 'react'

export interface OptionCardProps {
  icon: React.ReactNode
  label: string
  /** Optional smaller line under the label (e.g. Thai caption). */
  caption?: string
  base: string
  hover: string
  onClick: () => void
}

const OptionCard: React.FC<OptionCardProps> = ({ icon, label, caption, base, hover, onClick }) => {
  const [isHover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: '1 1 220px',
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        borderRadius: 12,
        cursor: 'pointer',
        color: '#fff',
        fontSize: 16,
        fontWeight: 600,
        background: isHover ? hover : base,
        boxShadow: isHover ? '0 8px 30px rgba(15,45,94,0.18)' : '0 2px 12px rgba(15,45,94,0.08)',
        transform: isHover ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s',
      }}
    >
      {icon}
      <div style={{ textAlign: 'center' }}>
        <div>{label}</div>
        {caption && <div style={{ fontSize: 13, fontWeight: 400, opacity: 0.9, marginTop: 2 }}>{caption}</div>}
      </div>
    </div>
  )
}

export default OptionCard
