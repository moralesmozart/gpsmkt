import type { ReactNode } from 'react'
import { MOTIONS, TEXT_STYLES, overlayLabel, overlaySpan, type CursorOverlay, type FireworkOverlay, type FocusOverlay, type Overlay, type TextOverlay, type TextStyleId } from '../types/project'
import { textOn } from '../utils/textOn'
import { useMkt } from '../store'

export function InspectorPanel() {
  const api = useMkt()
  const current = api.current
  const selected = current?.overlays.find((overlay) => overlay.id === api.selectedId) ?? null

  return (
    <div className="max-h-full w-64 shrink-0 overflow-y-auto rounded-3xl bg-white p-3 shadow-pop">
      {current && <FitSettings />}
      {current && <Elements slideId={current.id} overlays={current.overlays} selectedId={api.selectedId} />}
      {selected?.kind === 'focus' && current && <FocusSettings slideId={current.id} focus={selected} />}
      {selected?.kind === 'cursor' && current && <CursorSettings slideId={current.id} cursor={selected} />}
      {selected?.kind === 'text' && current && <TextSettings slideId={current.id} text={selected} />}
      {selected?.kind === 'firework' && current && <FireworkSettings slideId={current.id} effect={selected} />}
    </div>
  )
}

function Elements({ overlays, selectedId }: { slideId: string; overlays: Overlay[]; selectedId: string | null }) {
  const api = useMkt()
  if (!overlays.length) return null
  return (
    <div className="mt-3 border-t border-areia-200 pt-3">
      <div className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-ink-mute">On this step</div>
      <div className="space-y-1">
        {overlays.map((overlay) => (
          <button
            key={overlay.id}
            type="button"
            onClick={() => api.selectOverlay(overlay.id)}
            className={`flex w-full items-center justify-between rounded-2xl px-2.5 py-2 text-left ${selectedId === overlay.id ? 'bg-areia-100' : 'hover:bg-areia-50'}`}
          >
            <span className="truncate text-sm font-extrabold">{overlayLabel(overlay)}</span>
            <span className="shrink-0 text-[11px] font-bold text-ink-mute">{spanLabel(overlay, api.slides.find((slide) => slide.overlays.some((item) => item.id === overlay.id))?.duration ?? 3)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function FitSettings() {
  const api = useMkt()
  const slide = api.current
  if (!slide) return null
  const zoom = slide.zoom ?? 1
  return (
    <div className="space-y-3 px-1">
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">Screenshot</div>
      <div className="flex gap-1">
        <Pill on={slide.fit !== 'cover'} onClick={() => api.updateSlide(slide.id, { fit: 'contain', zoom: 1, panX: 0, panY: 0 })}>
          Show all
        </Pill>
        <Pill on={slide.fit === 'cover'} onClick={() => api.updateSlide(slide.id, { fit: 'cover', zoom: 1, panX: 0, panY: 0 })}>
          Fill frame
        </Pill>
      </div>
      <Field label="Zoom">
        <input
          type="range"
          min={0.6}
          max={3}
          step={0.02}
          value={zoom}
          onChange={(event) => api.updateSlide(slide.id, { zoom: Number(event.target.value), fit: slide.fit ?? 'contain' })}
          className="w-full accent-mata-600"
        />
      </Field>
      <Toggle label="Move picture" on={api.tool === 'fit'} onClick={() => api.setTool(api.tool === 'fit' ? 'focus' : 'fit')} />
    </div>
  )
}

function CursorSettings({ slideId, cursor }: { slideId: string; cursor: CursorOverlay }) {
  const api = useMkt()
  const patch = (next: Partial<CursorOverlay>) => api.updateOverlay(slideId, cursor.id, next)
  return (
    <div className="mt-1 space-y-3 border-t border-areia-200 px-1.5 py-3">
      <Timing slideId={slideId} at={cursor.at ?? 0} end={cursor.end} onChange={patch} />
      <p className="px-1 text-xs font-bold text-ink-mute">
        {cursor.path && cursor.path.length > 1 ? 'Path drawn. Draw again to replace it.' : 'Draw on the picture to set where the finger moves.'}
      </p>
      {cursor.path && cursor.path.length > 1 && (
        <button type="button" onClick={() => patch({ path: undefined })} className="px-1 text-sm font-extrabold text-ink-soft">
          Clear path
        </button>
      )}
      <Toggle label="Tap" on={cursor.click} onClick={() => patch({ click: !cursor.click })} />
      <Toggle label="Step" on={cursor.step !== null} onClick={() => patch({ step: cursor.step === null ? 1 : null })} />
      {cursor.step !== null && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-extrabold text-ink-soft">Number</span>
          <span className="flex items-center gap-2">
            <StepButton onClick={() => patch({ step: Math.max(1, cursor.step! - 1) })}>−</StepButton>
            <span className="w-5 text-center font-display text-lg font-extrabold">{cursor.step}</span>
            <StepButton onClick={() => patch({ step: cursor.step! + 1 })}>+</StepButton>
          </span>
        </div>
      )}
      <button type="button" onClick={() => api.removeOverlay(slideId, cursor.id)} className="px-1 text-sm font-extrabold text-coral-500">
        Delete cursor
      </button>
    </div>
  )
}

function FocusSettings({ slideId, focus }: { slideId: string; focus: FocusOverlay }) {
  const api = useMkt()
  const patch = (next: Partial<FocusOverlay>) => api.updateOverlay(slideId, focus.id, next)
  return (
    <div className="mt-1 space-y-3 border-t border-areia-200 px-1.5 py-3">
      <Timing slideId={slideId} at={focus.at ?? 0} end={focus.end} onChange={patch} />
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
      <Timing slideId={slideId} at={text.at ?? 0} end={text.end} onChange={patch} />
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

function FireworkSettings({ slideId, effect }: { slideId: string; effect: FireworkOverlay }) {
  const api = useMkt()
  return (
    <div className="mt-1 space-y-3 border-t border-areia-200 px-1.5 py-3">
      <Timing slideId={slideId} at={effect.at ?? 0} end={effect.end} onChange={(next) => api.updateOverlay(slideId, effect.id, next)} />
      <Field label="Size">
        <input
          type="range"
          min={0.4}
          max={2.4}
          step={0.05}
          value={effect.size ?? 1}
          onChange={(event) => api.updateOverlay(slideId, effect.id, { size: Number(event.target.value) })}
          className="w-full accent-coral-500"
        />
      </Field>
      <p className="px-1 text-xs font-bold text-ink-mute">Drag a corner on the screen, or use Size.</p>
      <button type="button" onClick={() => api.removeOverlay(slideId, effect.id)} className="text-sm font-extrabold text-coral-500">
        Delete firework
      </button>
    </div>
  )
}

function spanLabel(overlay: { at?: number; end?: number }, duration: number) {
  const { start, end } = overlaySpan(overlay, duration)
  return `${start.toFixed(1)}–${end.toFixed(1)}s`
}

function Timing({
  slideId,
  at,
  end,
  onChange,
}: {
  slideId: string
  at: number
  end?: number
  onChange: (next: { at?: number; end?: number }) => void
}) {
  const api = useMkt()
  const duration = api.slides.find((slide) => slide.id === slideId)?.duration ?? 3
  const { start, end: finish } = overlaySpan({ at, end }, duration)
  const seek = (local: number) => {
    const origin = api.slides.slice(0, api.slides.findIndex((slide) => slide.id === slideId)).reduce((sum, slide) => sum + slide.duration, 0)
    api.setPlaying(false)
    api.setTime(origin + local)
  }
  return (
    <>
      <Field label={`Starts ${start.toFixed(1)}s`}>
        <input
          type="range"
          min={0}
          max={Math.max(0.2, finish - 0.2)}
          step={0.1}
          value={start}
          onChange={(event) => {
            const next = Number(event.target.value)
            onChange({ at: next, end: finish })
            seek(next)
          }}
          className="w-full accent-mata-600"
        />
      </Field>
      <Field label={`Ends ${finish.toFixed(1)}s`}>
        <input
          type="range"
          min={Math.min(duration, start + 0.2)}
          max={duration}
          step={0.1}
          value={finish}
          onChange={(event) => {
            const next = Number(event.target.value)
            onChange({ end: next })
            seek(next)
          }}
          className="w-full accent-mata-600"
        />
      </Field>
    </>
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
