import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Copy, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { BACKGROUNDS, TRANSITIONS, slideName, totalDuration } from '../types/project'
import { useMkt } from '../store'
import { playSound, SONGS, songLabel, stopSounds, unlockAudio } from '../utils/sounds'

const DURATIONS = [2, 3, 5, 8]

export function TimelineDock() {
  const api = useMkt()
  const fileRef = useRef<HTMLInputElement>(null)
  const [openId, setOpenId] = useState<string | null>(null)
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
    <footer className="shrink-0 border-t-2 border-areia-200 bg-areia-100 px-6 pb-4 pt-3">
      <div className="mx-auto flex max-w-5xl items-end justify-center gap-4">
        <button
          type="button"
          onClick={() => {
            void unlockAudio()
            api.togglePlay()
          }}
          aria-label={api.playing ? 'Pause' : 'Play'}
          className="mb-8 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mata-600 text-white shadow-[0_4px_0_0_#086B34] transition active:translate-y-[3px] active:shadow-[0_1px_0_0_#086B34]"
        >
          {api.playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <div className="w-full max-w-2xl">
          <div className="relative mb-2 h-10 cursor-ew-resize" onPointerDown={scrub}>
            {ticks.map((tick) => (
              <div key={tick} className="absolute top-6" style={{ left: `${(tick / total) * 100}%` }}>
                <div className="h-2 w-px bg-ink/20" />
                {tick % 5 === 0 && (
                  <span className="absolute top-2 -translate-x-1/2 text-[11px] font-bold text-ink-mute">{tick}s</span>
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
                className="rounded-full bg-ink px-2.5 py-1 font-display text-sm font-extrabold text-white shadow-pop"
              >
                {api.time.toFixed(1)}s
              </button>
              <div className="mx-auto h-5 w-0.5 bg-ink" />
            </div>
          </div>
          <div className="flex">
            {api.slides.map((slide, index) => {
              const active = index === api.currentIndex
              return (
                <div key={slide.id} style={{ width: `${(slide.duration / total) * 100}%` }} className="px-1.5">
                  <div
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', slide.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      api.reorder(event.dataTransfer.getData('text/plain'), slide.id)
                    }}
                    onClick={() => api.seekSlide(slide.id)}
                    className={`w-full cursor-pointer rounded-2xl bg-white p-2 text-left shadow-card ${active ? 'ring-2 ring-ink' : ''}`}
                  >
                    <span className="relative block h-20 overflow-hidden rounded-xl bg-areia-50">
                      {api.urls[slide.imageId] && (
                        <img src={api.urls[slide.imageId]} alt="" className="h-full w-full object-contain" draggable={false} />
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setOpenId(openId === slide.id ? null : slide.id)
                        }}
                        className="absolute bottom-1.5 right-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold shadow-card"
                      >
                        {slide.duration}s
                      </button>
                    </span>
                    <span className="mt-1.5 block text-center text-sm font-extrabold">{slideName(index, api.slides.length)}</span>
                    {slide.song && <span className="block text-center text-[11px] font-bold text-mata-700">{songLabel(slide.song)}</span>}
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
                        <div className="mb-2">
                          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Song</div>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                stopSounds()
                                api.updateSlide(slide.id, { song: null })
                              }}
                              className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${!slide.song ? 'bg-ink text-white' : 'bg-areia-100 text-ink-soft'}`}
                            >
                              None
                            </button>
                            {SONGS.map((song) => (
                              <button
                                key={song.id}
                                type="button"
                                onClick={() => {
                                  api.updateSlide(slide.id, { song: song.id })
                                  void unlockAudio().then(() => {
                                    stopSounds()
                                    playSound(song.id)
                                  })
                                }}
                                className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${slide.song === song.id ? 'bg-mata-600 text-white' : 'bg-areia-100 text-ink-soft'}`}
                              >
                                {song.label}
                              </button>
                            ))}
                          </div>
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
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mb-8 grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-areia-200 bg-white text-ink-soft"
          aria-label="Add image"
        >
          <Plus className="h-5 w-5" />
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

function tickMarks(total: number) {
  const marks: number[] = []
  const step = total > 40 ? 5 : 1
  for (let t = 0; t <= total + 0.001; t += step) marks.push(Math.round(t))
  return marks
}
