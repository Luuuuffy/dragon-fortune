import { useRef } from 'react'
import { RotateCw } from 'lucide-react'
import type { RoundIntent } from '../game/roundIntent'

export function RoundButton({ intent, label, onActivate }: {
  intent: RoundIntent | null; label: string; onActivate: (intent: RoundIntent) => void
}) {
  // This control is keyed by the action identity. Remounting cancels a gesture on the old control.
  const pointer = useRef<{ id: number; intent: RoundIntent } | null>(null)
  const space = useRef<RoundIntent | null>(null)
  return <button type="button" className="spin-button" disabled={!intent}
    onPointerDown={event => {
      if (intent && event.isPrimary && event.button === 0) pointer.current = { id: event.pointerId, intent }
    }}
    onPointerCancel={event => { if (pointer.current?.id === event.pointerId) pointer.current = null }}
    onBlur={() => { space.current = null }}
    onClick={event => {
      const pressed = pointer.current
      pointer.current = null
      const native = event.nativeEvent
      const fromPointer = event.detail > 0 || ('pointerType' in native && Boolean(native.pointerType))
      if (fromPointer) {
        if (pressed && (!('pointerId' in native) || native.pointerId === pressed.id)) onActivate(pressed.intent)
      } else if (intent) {
        onActivate(intent)
      }
    }}
    onKeyDown={event => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      event.preventDefault()
      if (!intent || event.repeat) return
      if (event.key === ' ') space.current = intent
      else onActivate(intent)
    }}
    onKeyUp={event => {
      if (event.key !== ' ') return
      event.preventDefault()
      const pressed = space.current
      space.current = null
      if (pressed) onActivate(pressed)
    }}>
    <RotateCw size={21} aria-hidden="true"/>{label}
  </button>
}
