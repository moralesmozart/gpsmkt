import type { ReactNode } from 'react'
import { Crosshair, Type, ZoomIn } from 'lucide-react'
import { MOTIONS, TEXT_STYLES, type FocusOverlay, type TextOverlay, type TextStyleId } from '../types/project'
import { textOn } from '../utils/textOn'
import { useMkt } from '../store'

export function InspectorPanel() {
  const api = useMkt()
  const current = api.current
  const selected = current?.overlays.find((overlay) => overlay.id === api.selectedId) ?? null
  const zooming = selected?.kind === 'focus' && selected.motion === 'zoom-in'

  return (
    <div className="w-52 shrink-0 rounded-3xl bg-white p-2 shadow-pop">
      <div className="grid grid-cols-3 gap-1">
        <Tool icon={ZoomIn} label="Zoom In" active={zooming} onClick={api.applyZoomIn} />
        <Tool icon={Crosshair} label="Focus" active={!selected || selected.kind === 'focus'} onClick={() => api.selectOverlay(null)} />
        <Tool icon={Type} label="Text" active={selected?.kind === 'text'} onClick={api.addText} />
      </div>
      {selected?.kind === 'focus' && current && <FocusSettings slideId={current.id} focus={selected} />}
      {selected?.kind === 'text' && current && <TextSettings slideId={current.id} text={selected} />}
    </div>
  )
}

function Tool({ icon: Icon, label, active, onClick }: { icon: typeof ZoomIn; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-extrabold ${active ? 'bg-areia-100 text-ink' : 'text-ink-soft hover:bg-areia-50'}`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  )
}

function FocusSettings({ slideId, focus }: { slideId: string; focus: FocusOverlay }) {
  const api = useMkt()
  const patch = (next: Partial<FocusOverlay>) => api.updateOverlay(slideId, focus.id, next)
  return (
    <div className="mt-1 space-y-3 border-t border-areia-200 px-1.5 py-3">
      <Field label="Motion">
        <div className="flex flex-wrap gap-1">
          {MOTIONS.map((motion) => (
            <Pill key={motion.id} on={focus.motion === motion.id} onClick={() => patch({ motion: motion.id })}>
              {motion.label}
            </Pill>
          ))}
        </div>
      </Field>
      <Field label="Shape">
        <div className="flex gap-1">
          <Pill on={focus.shape === 'rect'} onClick={() => patch({ shape: 'rect' })}>Rectangle</Pill>
          <Pill on={focus.shape === 'circle'} onClick={() => patch({ shape: 'circle' })}>Circle</Pill>
        </div>
      </Field>
      <Toggle label="Spotlight" on={focus.spotlight} onClick={() => patch({ spotlight: !focus.spotlight })} />
      <Toggle label="Click pulse" on={focus.pulse} onClick={() => patch({ pulse: !focus.pulse })} />
      <Toggle
        label="Step badge"
        on={focus.step !== null}
        onClick={() => patch({ step: focus.step === null ? 1 : null })}
      />
      {focus.step !== null && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-extrabold text-ink-soft">Number</span>
          <span className="flex items-center gap-2">
            <StepButton onClick={() => patch({ step: Math.max(1, focus.step! - 1) })}>−</StepButton>
            <span className="w-5 text-center font-display text-lg font-extrabold">{focus.step}</span>
            <StepButton onClick={() => patch({ step: focus.step! + 1 })}>+</StepButton>
          </span>
        </div>
      )}
      <button type="button" onClick={() => api.removeOverlay(slideId, focus.id)} className="px-1 text-sm font-extrabold text-coral-500">
        Delete focus
      </button>
    </div>
  )
}

function TextSettings({ slideId, text }: { slideId: string; text: TextOverlay }) {
  const api = useMkt()
  const patch = (next: Partial<TextOverlay>) => api.updateOverlay(slideId, text.id, next)
  return (
    <div className="mt-1 space-y-3 border-t border-areia-200 px-1.5 py-3">
      <input
        autoFocus
        value={text.text}
        onChange={(event) => patch({ text: event.target.value })}
        className="w-full rounded-2xl border-2 border-areia-200 px-3 py-2 text-sm font-bold outline-none focus:border-mar-500"
      />
      <Field label="Size">
        <input
          type="range"
          min={0.028}
          max={0.08}
          step={0.002}
          value={text.fontSize}
          onChange={(event) => patch({ fontSize: Number(event.target.value) })}
          className="w-full accent-mata-600"
        />
      </Field>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(TEXT_STYLES) as TextStyleId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => patch({ style: id })}
            className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${text.style === id ? 'ring-2 ring-ink ring-offset-2' : ''}`}
            style={{ background: TEXT_STYLES[id].bg, color: textOn(TEXT_STYLES[id].bg) }}
          >
            {TEXT_STYLES[id].label}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => api.removeOverlay(slideId, text.id)} className="text-sm font-extrabold text-coral-500">
        Delete text
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-mute">{label}</div>
      {children}
    </div>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${on ? 'bg-ink text-white' : 'bg-areia-100 text-ink-soft'}`}
    >
      {children}
    </button>
  )
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between px-1 text-sm font-extrabold">
      {label}
      <span className={`flex h-6 w-11 items-center rounded-full p-0.5 ${on ? 'bg-mata-500' : 'bg-areia-200'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow-card transition-transform ${on ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}

function StepButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid h-7 w-7 place-items-center rounded-full bg-areia-100 font-extrabold">
      {children}
    </button>
  )
}
