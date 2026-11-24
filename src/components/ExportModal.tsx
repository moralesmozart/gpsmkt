import { useEffect, useRef, useState } from 'react'
import { FORMATS, totalDuration } from '../types/project'
import { loadImages } from '../utils/images'
import { renderFrame } from '../utils/canvasRenderer'
import { exportVideo } from '../utils/videoExporter'
import { mixCues, soundCues, unlockAudio } from '../utils/sounds'
import { Logo } from './Logo'
import { useMkt } from '../store'

export function ExportModal({ sound }: { sound: boolean }) {
  const api = useMkt()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [progress, setProgress] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [ext, setExt] = useState('webm')
  const [error, setError] = useState('')
  const format = FORMATS[api.format]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const controller = new AbortController()
    let objectUrl = ''
    ;(async () => {
      try {
        await document.fonts.ready
        const images = await loadImages(api.urls, api.slides.map((slide) => slide.imageId))
        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) throw new Error('Canvas is not available.')
        const duration = Math.max(0.5, totalDuration(api.slides))
        const cues = sound ? soundCues(api.slides) : []
        if (sound) await unlockAudio()
        const result = await exportVideo({
          canvas,
          duration,
          signal: controller.signal,
          onProgress: setProgress,
          audio: sound ? () => mixCues(cues, duration) : undefined,
          draw: (time) => renderFrame(ctx, { slides: api.slides, images, time, w: canvas.width, h: canvas.height }),
        })
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(result.blob)
        setExt(result.ext)
        setUrl(objectUrl)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Could not create the video.')
      }
    })()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [api.slides, api.urls, api.format, sound])

  const download = () => {
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `gps-mkt-${api.format}.${ext}`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" onMouseDown={() => api.setExportOpen(false)}>
      <div
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-pop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <Logo size={32} />
          <span className="rounded-full bg-areia-100 px-3 py-1 text-xs font-extrabold text-ink-soft">{format.label}</span>
        </div>
        <div className="flex justify-center">
          {url ? (
            <video
              src={url}
              autoPlay
              loop
              controls
              playsInline
              className="max-h-[420px] w-auto rounded-3xl bg-areia-50 shadow-card"
            />
          ) : (
            <canvas
              ref={canvasRef}
              width={format.w}
              height={format.h}
              className="max-h-[420px] w-auto rounded-3xl bg-areia-50 shadow-card"
            />
          )}
        </div>
        {!url && !error && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-areia-100">
            <div className="h-full rounded-full bg-mata-500 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        {error && <p className="mt-3 text-center text-sm font-bold text-coral-500">{error}</p>}
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" className="btn-primary px-4 py-2 text-base" disabled={!url} onClick={download}>
            Download Video
          </button>
          <button type="button" className="btn-ghost px-4 py-2 text-base" onClick={() => api.setExportOpen(false)}>
            Back to Edit
          </button>
        </div>
      </div>
    </div>
  )
}

