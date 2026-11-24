import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { FORMAT_ORDER, FORMATS } from './types/project'
import { ExportModal } from './components/ExportModal'
import { InspectorPanel } from './components/InspectorPanel'
import { Logo } from './components/Logo'
import { StageCanvas } from './components/StageCanvas'
import { TimelineDock } from './components/TimelineDock'
import { MktProvider, useMkt } from './store'
import { playSound, soundCues, unlockAudio } from './utils/sounds'

export default function App() {
  return (
    <MktProvider>
      <Shell />
    </MktProvider>
  )
}

function Shell() {
  const api = useMkt()
  const [over, setOver] = useState(false)
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem('gps-mkt-sound') !== 'off'
    } catch {
      return true
    }
  })
  const timeRef = useRef(api.time)
  timeRef.current = api.time
  const slidesRef = useRef(api.slides)
  slidesRef.current = api.slides

  useEffect(() => {
    if (!api.playing || !sound) return
    let cancel = false
    const origin = timeRef.current
    const cues = soundCues(slidesRef.current).filter((cue) => cue.time >= origin - 0.03)
    const timers = cues.map((cue) =>
      window.setTimeout(() => {
        if (!cancel) playSound(cue.name)
      }, Math.max(0, (cue.time - origin) * 1000)),
    )
    return () => {
      cancel = true
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [api.playing, sound])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (event.key === ' ') {
        event.preventDefault()
        if (sound) void unlockAudio()
        api.togglePlay()
      }
      if (event.key === 'Escape') api.selectOverlay(null)
      if ((event.key === 'Backspace' || event.key === 'Delete') && api.selectedId && api.current) {
        event.preventDefault()
        api.removeOverlay(api.current.id, api.selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [api, sound])

  if (!api.ready) {
    return <div className="grid h-full place-items-center font-display text-3xl font-extrabold">GPS MKT</div>
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        void api.addFiles([...(event.dataTransfer.files ?? [])])
      }}
    >
      <header className="relative flex items-center justify-between gap-3 px-5 py-4">
        <Logo />
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 md:flex">
          <span className="text-sm font-extrabold text-ink-soft">Format:</span>
          {FORMAT_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => api.setFormat(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-extrabold ${api.format === id ? 'bg-ink text-white' : 'bg-areia-100 text-ink-soft'}`}
            >
              {FORMATS[id].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={sound}
            aria-label={sound ? 'Sound on' : 'Sound off'}
            onClick={() => {
              const next = !sound
              setSound(next)
              try {
                localStorage.setItem('gps-mkt-sound', next ? 'on' : 'off')
              } catch {
                /* private mode */
              }
              if (next) void unlockAudio().then(() => playSound('tap'))
            }}
            className="grid h-10 w-10 place-items-center rounded-2xl border-2 border-areia-200 bg-white text-ink shadow-[0_3px_0_0_#E7DCC4] active:translate-y-[2px] active:shadow-none"
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void api.clearProject()}
            className="rounded-2xl border-2 border-areia-200 bg-white px-3 py-2 text-sm font-extrabold shadow-[0_3px_0_0_#E7DCC4] transition active:translate-y-[2px] active:shadow-none"
          >
            New
          </button>
          <button
            type="button"
            disabled={!api.slides.length}
            onClick={() => {
              api.setPlaying(false)
              if (sound) void unlockAudio()
              api.setExportOpen(true)
            }}
            className="rounded-2xl bg-mata-600 px-4 py-2 text-sm font-extrabold text-white shadow-[0_4px_0_0_#086B34] transition hover:bg-mata-700 active:translate-y-[3px] active:shadow-[0_1px_0_0_#086B34] disabled:opacity-50"
          >
            Generate
          </button>
        </div>
      </header>

      <div className="flex justify-center gap-2 px-4 pb-2 md:hidden">
        {FORMAT_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => api.setFormat(id)}
            className={`rounded-full px-3 py-1 text-xs font-extrabold ${api.format === id ? 'bg-ink text-white' : 'bg-areia-100 text-ink-soft'}`}
          >
            {FORMATS[id].label}
          </button>
        ))}
      </div>

      {api.slides.length === 0 ? (
        <Dropzone hot={over} />
      ) : (
        <>
          <div className="flex min-h-0 flex-1 items-center justify-center px-4">
            <div className="flex items-center gap-8">
              <StageCanvas />
              <div className="hidden lg:block">
                <InspectorPanel />
              </div>
            </div>
          </div>
          <div className="px-4 pb-3 lg:hidden">
            <InspectorPanel />
          </div>
          <TimelineDock />
        </>
      )}
      {api.exportOpen && <ExportModal sound={sound} />}
    </div>
  )
}

function Dropzone({ hot }: { hot: boolean }) {
  const api = useMkt()
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="grid flex-1 place-items-center px-4 pb-8">
      <div className={`w-full max-w-xl rounded-4xl border-2 border-dashed px-8 py-16 text-center ${hot ? 'border-mata-500 bg-mata-50' : 'border-areia-200 bg-areia-100'}`}>
        <h1 className="font-display text-4xl font-extrabold">Drop screenshots</h1>
        <p className="mx-auto mt-2 max-w-md text-base text-ink-soft">
          Turn a few screens into a short tutorial. No account, and nothing leaves this browser.
        </p>
        <button type="button" className="btn-primary mt-6" onClick={() => fileRef.current?.click()}>
          Choose images
        </button>
        <div>
          <button type="button" className="btn-ghost mt-3" onClick={() => void api.loadSample()}>
            Load sample tutorial
          </button>
        </div>
        <input
          ref={fileRef}
          hidden
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            void api.addFiles([...(event.target.files ?? [])])
            event.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
