import { Crosshair, MousePointer2, Sparkles, Type } from 'lucide-react'
import { slideAt, writeElementDrag, type ElementKind } from '../types/project'
import { useMkt } from '../store'

const ITEMS: { kind: ElementKind; label: string; hint: string; icon: typeof Type }[] = [
  { kind: 'text', label: 'Text', hint: 'A label', icon: Type },
  { kind: 'cursor', label: 'Finger', hint: 'Moves and taps', icon: MousePointer2 },
  { kind: 'focus', label: 'Focus', hint: 'A zoom box', icon: Crosshair },
  { kind: 'firework', label: 'Firework', hint: 'A short burst', icon: Sparkles },
]

export function ElementRail() {
  const api = useMkt()
  const slide = api.current
  const here = slideAt(api.slides, api.time)
  return (
    <aside className="flex w-40 shrink-0 flex-col rounded-3xl bg-white p-3 shadow-pop">
      <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Elements</div>
      <p className="mt-1 px-1 text-xs font-bold leading-snug text-ink-soft">Drag one onto the timeline.</p>
      <div className="mt-3 space-y-1.5">
        {ITEMS.map((item) => (
          <button
            key={item.kind}
            type="button"
            draggable
            onDragStart={(event) => writeElementDrag(event.dataTransfer, item.kind)}
            onClick={() => slide && api.placeElement(slide.id, item.kind, here.local)}
            className="flex w-full cursor-grab items-center gap-2 rounded-2xl px-2 py-2 text-left hover:bg-areia-50 active:cursor-grabbing"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-areia-100 text-ink">
              <item.icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-extrabold leading-tight">{item.label}</span>
              <span className="block text-[11px] font-bold text-ink-mute">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
