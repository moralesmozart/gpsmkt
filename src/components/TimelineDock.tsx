import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Copy, Music, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { BACKGROUNDS, TRANSITIONS, isElementDrag, overlayLabel, overlaySpan, readElementTransfer, slideName, totalDuration, type ElementKind, type Overlay } from '../types/project'
import { useMkt } from '../store'
import { playSound, SONGS, songLabel, stopSounds, unlockAudio } from '../utils/sounds'

const DURATIONS = [2, 3, 5, 8]

export function TimelineDock() {
  const api = useMkt()
  const fileRef = useRef<HTMLInputElement>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [audioOpen, setAudioOpen] = useState(false)
  const total = Math.max(0.01, totalDuration(api.slides))
  const ticks = tickMarks(total)

  const scrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const seek = (clientX: number) => {
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      api.setPlaying(false)
      api.setTime(ratio * total)
    }
    seek(event.clientX)
    const move = (e: PointerEvent) => seek(e.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <footer className="shrink-0 border-t-2 border-areia-200 bg-areia-100 px-6 pb-2 pt-1.5">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            void unlockAudio()
            api.togglePlay()
          }}
          aria-label={api.playing ? 'Pause' : 'Play'}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mata-600 text-white shadow-[0_2px_0_0_#086B34] transition active:translate-y-[2px] active:shadow-none"
        >
          {api.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
        </button>
        <div className="w-full max-w-2xl">
          <div className="relative mb-1 h-6 cursor-ew-resize" onPointerDown={scrub}>
            {ticks.map((tick) => (
              <div key={tick} className="absolute top-3" style={{ left: `${(tick / total) * 100}%` }}>
                <div className="h-1.5 w-px bg-ink/20" />
                {tick % 5 === 0 && (
                  <span className="absolute top-1.5 -translate-x-1/2 text-[10px] font-bold text-ink-mute">{tick}s</span>
                )}
              </div>
            ))}
            <div className="absolute top-0 z-10 -translate-x-1/2" style={{ left: `${(api.time / total) * 100}%` }}>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  void unlockAudio()
                  api.togglePlay()
                }}
                className="rounded-full bg-ink px-1.5 py-0.5 font-display text-[11px] font-extrabold leading-none text-white shadow-pop"
              >
                {api.time.toFixed(1)}s
              </button>
              <div className="mx-auto h-3 w-0.5 bg-ink" />
            </div>
          </div>
          <div className="flex">
            {api.slides.map((slide, index) => {
              const active = index === api.currentIndex
              return (
                <div key={slide.id} style={{ width: `${(slide.duration / total) * 100}%` }} className="px-1">
                  <div
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', slide.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      const kind = readElementTransfer(event.dataTransfer)
                      if (kind) {
                        const rect = event.currentTarget.getBoundingClientRect()
                        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
                        api.placeElement(slide.id, kind, ratio * slide.duration)
                        return
                      }
                      api.reorder(event.dataTransfer.getData('text/plain'), slide.id)
                    }}
                    onClick={() => api.seekSlide(slide.id)}
                    className={`w-full cursor-pointer rounded-xl bg-white p-1 text-left shadow-card ${active ? 'ring-2 ring-ink' : ''}`}
                  >
                    <span className="relative block h-10 overflow-hidden rounded-lg bg-areia-50">
                      {api.urls[slide.imageId] && (
                        <img src={api.urls[slide.imageId]} alt="" className="h-full w-full object-contain" draggable={false} />
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setOpenId(openId === slide.id ? null : slide.id)
                        }}
                        className="absolute bottom-0.5 right-0.5 rounded-full bg-white px-1.5 py-0 text-[10px] font-extrabold shadow-card"
                      >
                        {slide.duration}s
                      </button>
                    </span>
                    <span className="mt-0.5 block text-center text-[11px] font-extrabold leading-tight">{slideName(index, api.slides.length)}</span>
                  </div>
                  {openId === slide.id && (
                    <div className="relative z-20">
                      <div className="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-2xl bg-white p-3 shadow-pop">
                        <div className="mb-2 flex flex-wrap gap-1">
                          {DURATIONS.map((duration) => (
                            <button
                              key={duration}
                              type="button"
                              onClick={() => api.updateSlide(slide.id, { duration })}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${slide.duration === duration ? 'bg-ink text-white' : 'bg-areia-100 text-ink-soft'}`}
                            >
                              {duration}s
                            </button>
                          ))}
                        </div>
                        <div className="mb-2 flex gap-1">
                          {BACKGROUNDS.map((bg) => (
                            <button
                              key={bg.id}
                              type="button"
                              title={bg.label}
                              onClick={() => api.updateSlide(slide.id, { background: bg.id })}
                              className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ${slide.background === bg.id ? 'ring-ink' : 'ring-transparent'}`}
                              style={{ background: bg.color }}
                            />
                          ))}
                        </div>
                        <div className="mb-2 flex flex-wrap gap-1">
                          {TRANSITIONS.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => api.updateSlide(slide.id, { transition: item.id })}
                              className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${slide.transition === item.id ? 'bg-mar-500 text-white' : 'bg-areia-100 text-ink-soft'}`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => api.duplicateSlide(slide.id)} className="inline-flex items-center gap-1 text-xs font-extrabold text-ink-soft">
                            <Copy className="h-3.5 w-3.5" /> Duplicate
                          </button>
                          <button type="button" onClick={() => api.removeSlide(slide.id)} className="inline-flex items-center gap-1 text-xs font-extrabold text-coral-500">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpenId(null)}
                          className="mt-3 w-full rounded-2xl bg-mata-600 py-2 text-sm font-extrabold text-white shadow-[0_3px_0_0_#086B34] active:translate-y-[3px] active:shadow-none"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <ElementsLane total={total} />
          <div className="relative mt-1">
            <button
              type="button"
              onClick={() => setAudioOpen((open) => !open)}
              className={`flex h-6 w-full items-center gap-1.5 rounded-lg px-2 text-left text-xs font-extrabold shadow-card ${api.song ? 'bg-mata-600 text-white' : 'bg-white text-ink-soft'}`}
            >
              <Music className="h-3 w-3 shrink-0" />
              {api.song ? songLabel(api.song) : 'Add audio'}
            </button>
            {audioOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-2 flex flex-wrap gap-1 rounded-2xl bg-white p-2 shadow-pop">
                <button
                  type="button"
                  onClick={() => {
                    stopSounds()
                    api.setSong(null)
                    setAudioOpen(false)
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${!api.song ? 'bg-ink text-white' : 'bg-areia-100 text-ink-soft'}`}
                >
                  None
                </button>
                {SONGS.map((song) => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => {
                      api.setSong(song.id)
                      void unlockAudio().then(() => {
                        stopSounds()
                        playSound(song.id, undefined, 8)
                      })
                      setAudioOpen(false)
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${api.song === song.id ? 'bg-mata-600 text-white' : 'bg-areia-100 text-ink-soft'}`}
                  >
                    {song.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border-2 border-dashed border-areia-200 bg-white text-ink-soft"
          aria-label="Add image"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void api.addFiles([...(event.target.files ?? [])])
            event.target.value = ''
          }}
        />
      </div>
    </footer>
  )
}

function ElementsLane({ total }: { total: number }) {
  const api = useMkt()
  const [hot, setHot] = useState(false)
  let start = 0
  const chips = api.slides.flatMap((slide) => {
    const slideStart = start
    start += slide.duration
    return slide.overlays.map((overlay) => {
      const { start: at, end } = overlaySpan(overlay, slide.duration)
      return {
        slideId: slide.id,
        slideStart,
        duration: slide.duration,
        overlay,
        from: slideStart + at,
        to: slideStart + end,
        left: ((slideStart + at) / total) * 100,
        width: Math.max(4, ((end - at) / total) * 100),
      }
    })
  })
  const lanes: number[] = []
  const placed = [...chips].sort((a, b) => a.from - b.from).map((chip) => {
    let row = lanes.findIndex((end) => end <= chip.from + 0.05)
    if (row < 0) {
      row = lanes.length
      lanes.push(chip.to)
    } else {
      lanes[row] = chip.to
    }
    return { ...chip, row }
  })

  const place = (clientX: number, lane: HTMLElement, kind: ElementKind) => {
    const rect = lane.getBoundingClientRect()
    const abs = Math.min(0.999, Math.max(0, (clientX - rect.left) / rect.width)) * total
    let cursor = 0
    for (const slide of api.slides) {
      if (abs < cursor + slide.duration || slide === api.slides[api.slides.length - 1]) {
        api.placeElement(slide.id, kind, abs - cursor)
        return
      }
      cursor += slide.duration
    }
  }

  return (
    <div
      className={`relative mt-1 max-h-14 overflow-x-hidden overflow-y-auto rounded-lg border border-dashed ${hot ? 'border-mata-500 bg-mata-50' : 'border-areia-200 bg-white'}`}
      style={{ height: Math.max(22, lanes.length * 16 + 6) }}
      onDragOver={(event) => {
        if (!isElementDrag(event.dataTransfer)) return
        event.preventDefault()
        setHot(true)
      }}
      onDragLeave={() => setHot(false)}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setHot(false)
        const kind = readElementTransfer(event.dataTransfer)
        if (kind) place(event.clientX, event.currentTarget, kind)
      }}
    >
      {placed.length === 0 && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] font-bold text-ink-mute">
          Drop an element here
        </span>
      )}
      {placed.map((chip) => (
        <button
          key={chip.overlay.id}
          type="button"
          title={overlayLabel(chip.overlay)}
          onPointerDown={(event) => {
            event.stopPropagation()
            event.preventDefault()
            const lane = event.currentTarget.parentElement
            if (!lane) return
            const rect = lane.getBoundingClientRect()
            api.selectOverlay(chip.overlay.id)
            api.setPlaying(false)
            const span = overlaySpan(chip.overlay, chip.duration)
            const length = span.end - span.start
            api.setTime(chip.slideStart + span.start)
            const move = (ev: PointerEvent) => {
              const abs = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)) * total
              const at = Math.round(Math.max(0, Math.min(chip.duration - length, abs - chip.slideStart)) * 10) / 10
              api.updateOverlay(chip.slideId, chip.overlay.id, { at, end: Math.round((at + length) * 10) / 10 })
              api.setTime(chip.slideStart + at)
            }
            const up = () => {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', up)
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
          }}
          className={`absolute h-3.5 truncate rounded px-1 text-left text-[10px] font-extrabold leading-[14px] ${chipColor(chip.overlay)} ${api.selectedId === chip.overlay.id ? 'ring-2 ring-ink' : ''}`}
          style={{ left: `${chip.left}%`, width: `${chip.width}%`, top: 3 + chip.row * 16 }}
        >
          {overlayLabel(chip.overlay)}
        </button>
      ))}
    </div>
  )
}

function chipColor(overlay: Overlay) {
  if (overlay.kind === 'text') return 'bg-mata-600 text-white'
  if (overlay.kind === 'cursor') return 'bg-mar-500 text-white'
  if (overlay.kind === 'firework') return 'bg-coral-500 text-white'
  return 'bg-ipe-400 text-ink'
}

function tickMarks(total: number) {
  const marks: number[] = []
  const step = total > 40 ? 5 : 1
  for (let t = 0; t <= total + 0.001; t += step) marks.push(Math.round(t))
  return marks
}
