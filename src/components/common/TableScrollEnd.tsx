import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Button, Tooltip } from 'antd'
import { DoubleLeftOutlined, DoubleRightOutlined } from '@ant-design/icons'

/**
 * Wraps an antd <Table scroll={{ x }}> and floats "jump to far right / far left"
 * buttons at the right edge, so wide tables can be scrolled to the end in one click.
 * The buttons only appear while the table actually overflows horizontally.
 */
const btnStyle: CSSProperties = {
  boxShadow: '0 2px 8px rgba(15,45,94,0.25)',
  background: '#1d4ed8',
  borderColor: '#1d4ed8',
  color: '#fff',
}

const TableScrollEnd = ({ children }: { children: ReactNode }) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLElement | null>(null)
  const [canRight, setCanRight] = useState(false)
  const [canLeft, setCanLeft] = useState(false)

  const update = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
    setCanLeft(el.scrollLeft > 2)
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let detach: (() => void) | undefined

    const attach = () => {
      const el =
        wrap.querySelector<HTMLElement>('.ant-table-body') && wrap.querySelector<HTMLElement>('.ant-table-body')!.scrollWidth > 0
          ? wrap.querySelector<HTMLElement>('.ant-table-body')
          : wrap.querySelector<HTMLElement>('.ant-table-content')
      if (!el || el === scrollerRef.current) { update(); return }
      detach?.()
      scrollerRef.current = el
      el.addEventListener('scroll', update, { passive: true })
      detach = () => el.removeEventListener('scroll', update)
      update()
    }

    attach()
    const ro = new ResizeObserver(() => { attach(); update() })
    ro.observe(wrap)
    const mo = new MutationObserver(() => { attach(); update() })
    mo.observe(wrap, { childList: true, subtree: true })
    return () => { ro.disconnect(); mo.disconnect(); detach?.() }
  }, [update])

  const goTo = (end: boolean) => {
    const el = scrollerRef.current
    if (el) el.scrollTo({ left: end ? el.scrollWidth : 0, behavior: 'smooth' })
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {(canRight || canLeft) && (
      <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {canRight && (
          <Tooltip title="เลื่อนไปขวาสุด" placement="left">
            <Button shape="circle" size="small" icon={<DoubleRightOutlined />} style={btnStyle} onClick={() => goTo(true)} />
          </Tooltip>
        )}
        {canLeft && (
          <Tooltip title="เลื่อนกลับซ้ายสุด" placement="left">
            <Button shape="circle" size="small" icon={<DoubleLeftOutlined />} style={btnStyle} onClick={() => goTo(false)} />
          </Tooltip>
        )}
      </div>
      )}
      {children}
    </div>
  )
}

export default TableScrollEnd
