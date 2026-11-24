import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { layoutSlide, renderFrame, screenToImage, type Box } from '../utils/canvasRenderer'
import { FORMATS, uid, type FocusOverlay } from '../types/project'
import { useMkt } from '../store'

type Corner = 'nw' | 'ne' | 'sw' | 'se'

export function StageCanvas() {
  const api = useMkt()
  const apiRef = useRef(api)
  useLayoutEffect(() => {
    apiRef.current = api
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [fontsReady, setFontsReady] = useState(false)
  const [pixels, setPixels] = useState({ w: 0, h: 0 })
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(new Map())

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancel = false
    void document.fonts.ready.then(() => {
      if (!cancel) setFontsReady(true)
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    let cancel = false
    const ids = [...new Set(api.slides.map((slide) => slide.imageId))]
    void Promise.all(
      ids.map(async (id) => {
        const url = api.urls[id]
        if (!url) return null
        const image = new Image()
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve()
          image.onerror = () => reject()
          image.src = url
        })
        return [id, image] as const
      }),
    ).then((pairs) => {
      if (cancel) return
      setImages(new Map(pairs.filter((pair): pair is readonly [string, HTMLImageElement] => !!pair)))
    })
    return () => {
      cancel = true
    }
  }, [api.slides, api.urls])

  const format = FORMATS[api.format]
  const maxW = Math.max(220, Math.min(420, viewport.w - 360))
  const maxH = Math.max(240, Math.min(440, viewport.h - 420))
  let frameW = maxH * (format.w / format.h)
  let frameH = maxH
  if (frameW > maxW) {
    frameW = maxW
    frameH = maxW * (format.h / format.w)
  }

  const current = api.current
  const image = current ? images.get(current.imageId) ?? null : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.round(frameW * dpr)
    const h = Math.round(frameH * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      setPixels({ w, h })
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    renderFrame(ctx, { slides: api.slides, images, time: api.time, w: canvas.width, h: canvas.height })
  }, [api.slides, api.time, images, frameW, frameH, fontsReady, api.format])

  const layout = (() => {
    if (!current || !pixels.w) return null
    const placed = api.slides[api.currentIndex]
    if (!placed) return null
    return layoutSlide(placed, image, progressOf(api.slides, api.currentIndex, api.time), pixels.w, pixels.h)
  })()

  const selected = current?.overlays.find((overlay) => overlay.id === api.selectedId) ?? null
  const selectedBox = layout?.boxes.find((item) => item.id === api.selectedId)?.box ?? null

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!current || api.playing) return
    const canvas = canvasRef.current
    if (!canvas) return
    event.preventDefault()
    const point = localPoint(canvas, event)
    const live = layoutSlide(
      current,
      image,
      progressOf(api.slides, api.currentIndex, api.time),
      canvas.width,
      canvas.height,
    )
    const boxes = live.boxes
    const hit = [...boxes].reverse().find((item) => contains(item.box, point.x, point.y, 0))
    const handle = selectedBox ? hitCorner(selectedBox, point.x, point.y, Math.max(18, canvas.width * 0.02)) : null

    if (handle && selected?.kind === 'focus') {
      const focus = selected
      const anchor = opposite(focus, handle)
      api.selectOverlay(focus.id)
      track(event, (px, py) => {
        const spot = screenToImage(px, py, live.fit, live.cam, canvas.width, canvas.height)
        apiRef.current.updateOverlay(current.id, focus.id, clampBox(anchor.x, anchor.y, spot.x, spot.y))
      })
      return
    }

    if (hit) {
      const overlay = current.overlays.find((item) => item.id === hit.id)
      if (!overlay) return
      api.selectOverlay(overlay.id)
      const start = { ...overlay }
      track(event, (px, py) => {
        if (start.kind === 'focus') {
          const from = screenToImage(point.x, point.y, live.fit, live.cam, canvas.width, canvas.height)
          const to = screenToImage(px, py, live.fit, live.cam, canvas.width, canvas.height)
          apiRef.current.updateOverlay(current.id, start.id, {
            x: start.x + (to.x - from.x),
            y: start.y + (to.y - from.y),
          })
        } else {
          apiRef.current.updateOverlay(current.id, start.id, {
            x: clamp(start.x + (px - point.x) / canvas.width, 0.05, 0.95),
            y: clamp(start.y + (py - point.y) / canvas.height, 0.05, 0.95),
          })
        }
      })
      return
    }

    api.selectOverlay(null)
    const origin = screenToImage(point.x, point.y, live.fit, live.cam, canvas.width, canvas.height)
    const id = uid()
    const created: FocusOverlay = {
      id,
      kind: 'focus',
      shape: 'rect',
      x: origin.x,
      y: origin.y,
      w: 0.02,
      h: 0.02,
      motion: 'static',
      spotlight: false,
      pulse: false,
      step: current.overlays.filter((item) => item.kind === 'focus').length + 1,
    }
    api.addOverlay(current.id, created)
    let drew = false
    track(event, (px, py) => {
      const spot = screenToImage(px, py, live.fit, live.cam, canvas.width, canvas.height)
      const box = clampBox(origin.x, origin.y, spot.x, spot.y)
      if (box.w > 0.03 || box.h > 0.03) drew = true
      apiRef.current.updateOverlay(current.id, id, box)
    }, () => {
      if (!drew) apiRef.current.removeOverlay(current.id, id)
    })
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative rounded-3xl bg-white shadow-card" style={{ width: frameW, height: frameH }}>
        <canvas ref={canvasRef} className="block h-full w-full rounded-3xl" />
        <div className="absolute inset-0 touch-none" onPointerDown={onPointerDown}>
          {selectedBox && !api.playing && pixels.w > 0 && (
            <Selection box={selectedBox} width={pixels.w} height={pixels.h} onDelete={() => current && api.removeOverlay(current.id, selected!.id)} />
          )}
        </div>
      </div>
      {!api.selectedId && !api.playing && (
        <p className="mt-5 rounded-full bg-ink px-4 py-2 text-sm font-extrabold text-white shadow-pop">
          Configure on focus selection.
        </p>
      )}
    </div>
  )
}

function Selection({ box, width: frameW, height: frameH, onDelete }: { box: Box; width: number; height: number; onDelete: () => void }) {
  const left = (box.x / frameW) * 100
  const top = (box.y / frameH) * 100
  const width = (box.w / frameW) * 100
  const height = (box.h / frameH) * 100
  const corners: { corner: Corner; x: string; y: string }[] = [
    { corner: 'nw', x: '0%', y: '0%' },
    { corner: 'ne', x: '100%', y: '0%' },
    { corner: 'sw', x: '0%', y: '100%' },
    { corner: 'se', x: '100%', y: '100%' },
  ]
  return (
    <div className="absolute" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onDelete}
        className="absolute -top-11 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-coral-500 shadow-pop"
      >
        Delete
      </button>
      {corners.map((corner) => (
        <span
          key={corner.corner}
          className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-mar-500 shadow-pop"
          style={{ left: corner.x, top: corner.y }}
        />
      ))}
    </div>
  )
}

function track(start: ReactPointerEvent, move: (x: number, y: number) => void, done?: () => void) {
  const canvas = start.currentTarget.parentElement?.querySelector('canvas')
  if (!canvas) return
  const onMove = (event: PointerEvent) => {
    const point = localPoint(canvas, event)
    move(point.x, point.y)
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    done?.()
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function localPoint(canvas: HTMLCanvasElement, event: { clientX: number; clientY: number }) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  }
}

function contains(box: Box, x: number, y: number, pad: number) {
  return x >= box.x - pad && y >= box.y - pad && x <= box.x + box.w + pad && y <= box.y + box.h + pad
}

function hitCorner(box: Box, x: number, y: number, slop: number): Corner | null {
  const spots: [Corner, number, number][] = [
    ['nw', box.x, box.y],
    ['ne', box.x + box.w, box.y],
    ['sw', box.x, box.y + box.h],
    ['se', box.x + box.w, box.y + box.h],
  ]
  return spots.find(([, cx, cy]) => (cx - x) ** 2 + (cy - y) ** 2 <= slop ** 2)?.[0] ?? null
}

function opposite(focus: FocusOverlay, corner: Corner) {
  const east = corner === 'ne' || corner === 'se'
  const south = corner === 'sw' || corner === 'se'
  return {
    x: east ? focus.x : focus.x + focus.w,
    y: south ? focus.y : focus.y + focus.h,
  }
}

function clampBox(x1: number, y1: number, x2: number, y2: number) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.max(0.03, Math.abs(x2 - x1)),
    h: Math.max(0.03, Math.abs(y2 - y1)),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function slideStart(slides: { duration: number }[], index: number) {
  return slides.slice(0, index).reduce((sum, slide) => sum + slide.duration, 0)
}

function progressOf(slides: { duration: number }[], index: number, time: number) {
  const duration = slides[index]?.duration || 1
  return Math.min(1, Math.max(0, (time - slideStart(slides, index)) / duration))
}
