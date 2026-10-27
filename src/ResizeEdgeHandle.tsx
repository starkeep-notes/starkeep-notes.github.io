import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

type Props = {
  axis: 'horizontal' | 'vertical'
  label: string
  value: number
  maximum: number
  container?: 'group'
  onPreview: (value: number) => void
  onCommit: (value: number) => void
  onEnd: () => void
}

export function ResizeEdgeHandle({ axis, label, value, maximum, container, onPreview, onCommit, onEnd }: Props) {
  const latest = useRef(value)
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    const grid = container === 'group' ? handle.closest('.board-widget-group')?.parentElement : handle.closest('.board-notes-grid, .board-widget-grid, .board-widget-groups')
    const rect = grid?.getBoundingClientRect()
    const startPosition = axis === 'horizontal' ? event.clientX : event.clientY
    const step = axis === 'horizontal' && rect ? rect.width / maximum : 36
    latest.current = value
    let moved = false
    handle.setPointerCapture(event.pointerId)
    const update = (pointerEvent: PointerEvent) => {
      const position = axis === 'horizontal' ? pointerEvent.clientX : pointerEvent.clientY
      const distance = position - startPosition
      moved ||= Math.abs(distance) > 2
      const nextValue = Math.max(1, Math.min(maximum, value + Math.round(distance / step)))
      if (nextValue !== latest.current) { latest.current = nextValue; onPreview(nextValue) }
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', update)
      window.removeEventListener('pointerup', complete)
      window.removeEventListener('pointercancel', cancel)
      onEnd()
    }
    const complete = (pointerEvent: PointerEvent) => { update(pointerEvent); if (moved) onCommit(latest.current); cleanup() }
    const cancel = () => { cleanup() }
    window.addEventListener('pointermove', update)
    window.addEventListener('pointerup', complete)
    window.addEventListener('pointercancel', cancel)
  }
  const edge = axis === 'horizontal' ? 'right' : 'bottom'
  return <button type="button" className={`board-resize-edge board-resize-edge-${edge}`} aria-label={`Drag ${edge} edge to resize ${label}`} onPointerDown={onPointerDown}><span aria-hidden="true">{axis === 'horizontal' ? '↔' : '↕'}</span></button>
}
