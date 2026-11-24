import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react'
import { layoutSlide, renderFrame, screenToImage, type Box, type Cam, type Fit } from '../utils/canvasRenderer'
import { FORMATS, type CursorOverlay, type FocusOverlay } from '../types/project'
import { useMkt } from '../store'

type Corner = 'nw' | 'ne' | 'sw' | 'se'

export function StageCanvas() {
  const api = useMkt()
  const apiRef = useRef(api)
  useLayoutEffect(() => {
    apiRef.current = api
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<HTMLDivElement>(null)
  const [slot, setSlot] = useState({ w: 0, h: 0 })
  const [fontsReady, setFontsReady] = useState(false)
  const [pixels, setPixels] = useState({ w: 0, h: 0 })
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(new Map())

  useEffect(() => {
    const el = gestureRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      const live = apiRef.current
      if (live.tool !== 'fit' || !live.current || live.playing) return
      event.preventDefault()
      const zoom = clamp((live.current.zoom ?? 1) * (event.deltaY < 0 ? 1.06 : 0.94), 0.6, 3)
      live.updateSlide(live.current.id, { zoom, fit: live.current.fit ?? 'contain' })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const el = slotRef.current
    if (!el) return
    const measure = () => setSlot({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
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
  const availW = Math.max(180, slot.w - 8)
  const availH = Math.max(180, slot.h - 56)
  const ratio = format.w / format.h
  let frameW = availH * ratio
  let frameH = availH
  if (frameW > availW) {
    frameW = availW
    frameH = availW / ratio
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
    try {
      renderFrame(ctx, { slides: api.slides, images, time: api.time, w: canvas.width, h: canvas.height, editing: !api.playing, selectedId: api.selectedId })
    } catch (error) {
      console.error(error)
    }
  }, [api.slides, api.time, images, frameW, frameH, fontsReady, api.format])

  const layout = (() => {
    if (!current || !pixels.w) return null
    const placed = api.slides[api.currentIndex]
    if (!placed) return null
    return layoutSlide(placed, image, progressOf(api.slides, api.currentIndex, api.time), pixels.w, pixels.h, !api.playing)
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
      !api.playing,
    )
    const boxes = live.boxes

    if (api.tool === 'fit') {
      const start = { x: current.panX ?? 0, y: current.panY ?? 0 }
      const rangeX = Math.max(80, Math.abs(live.fit.dw - canvas.width))
      const rangeY = Math.max(80, Math.abs(live.fit.dh - canvas.height))
      track(event, (px, py) => {
        apiRef.current.updateSlide(current.id, {
          panX: clamp(start.x + ((px - point.x) * 2) / rangeX, -1, 1),
          panY: clamp(start.y + ((py - point.y) * 2) / rangeY, -1, 1),
          fit: current.fit ?? 'contain',
          zoom: current.zoom ?? 1,
        })
      })
      return
    }

    const hit = [...boxes].reverse().find((item) => contains(item.box, point.x, point.y, 16))
    const handle = selectedBox ? hitCorner(selectedBox, point.x, point.y, Math.max(18, canvas.width * 0.02)) : null

    if (handle && selected?.kind === 'firework') {
      const effect = selected
      const centerX = effect.x * canvas.width
      const centerY = effect.y * canvas.height
      const startDist = Math.max(20, Math.hypot(point.x - centerX, point.y - centerY))
      const startSize = effect.size ?? 1
      api.selectOverlay(effect.id)
      track(event, (px, py) => {
        const dist = Math.hypot(px - centerX, py - centerY)
        apiRef.current.updateOverlay(current.id, effect.id, { size: clamp((startSize * dist) / startDist, 0.4, 2.4) })
      })
      return
    }

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

    if (hit && !(selected?.kind === 'cursor' && hit.id !== selected.id)) {
      const overlay = current.overlays.find((item) => item.id === hit.id)
      if (!overlay) return
      api.selectOverlay(overlay.id)
      const start = { ...overlay }
      let moved = false
      track(event, (px, py) => {
        if (!moved && Math.hypot(px - point.x, py - point.y) < 5) return
        moved = true
        if (start.kind === 'focus' || start.kind === 'cursor') {
          const from = screenToImage(point.x, point.y, live.fit, live.cam, canvas.width, canvas.height)
          const to = screenToImage(px, py, live.fit, live.cam, canvas.width, canvas.height)
          const dx = to.x - from.x
          const dy = to.y - from.y
          apiRef.current.updateOverlay(current.id, start.id, {
            x: start.x + dx,
            y: start.y + dy,
            ...(start.kind === 'cursor' && start.path
              ? { path: start.path.map((spot) => ({ x: spot.x + dx, y: spot.y + dy })) }
              : {}),
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

    if (selected?.kind === 'cursor') {
      drawFingerPath(event, point, canvas, live, current.id, selected, apiRef)
      return
    }

    api.selectOverlay(null)
  }

  return (
    <div ref={slotRef} className="flex h-full w-full flex-col items-center justify-center">
      <div className="relative rounded-3xl bg-white shadow-card" style={{ width: frameW, height: frameH }}>
        <canvas ref={canvasRef} className="block h-full w-full rounded-3xl" />
        <div ref={gestureRef} className="absolute inset-0 touch-none" onPointerDown={onPointerDown}>
          {selectedBox && !api.playing && pixels.w > 0 &&
            (selected?.kind === 'focus' || selected?.kind === 'firework' ? (
              <Selection box={selectedBox} width={pixels.w} height={pixels.h} onDelete={() => current && api.removeOverlay(current.id, selected.id)} />
            ) : (
              <div
                className="pointer-events-none absolute rounded-2xl ring-2 ring-ink"
                style={{
                  left: `${(selectedBox.x / pixels.w) * 100}%`,
                  top: `${(selectedBox.y / pixels.h) * 100}%`,
                  width: `${(selectedBox.w / pixels.w) * 100}%`,
                  height: `${(selectedBox.h / pixels.h) * 100}%`,
                }}
              />
            ))}
        </div>
      </div>
      {api.tool === 'fit' && !api.playing && (
        <p className="mt-4 text-sm font-extrabold text-ink-soft">Drag the picture. Scroll to zoom.</p>
      )}
      {selected?.kind === 'cursor' && !api.playing && api.tool !== 'fit' && (
        <p className="mt-4 text-sm font-extrabold text-ink-soft">Draw the finger’s path on the picture.</p>
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

function drawFingerPath(
  event: ReactPointerEvent,
  point: { x: number; y: number },
  canvas: HTMLCanvasElement,
  live: { fit: Fit; cam: Cam },
  slideId: string,
  cursor: CursorOverlay,
  apiRef: MutableRefObject<ReturnType<typeof useMkt>>,
) {
  const points: { x: number; y: number }[] = []
  const previous = { path: cursor.path, x: cursor.x, y: cursor.y }
  const spotOf = (x: number, y: number) => {
    const spot = screenToImage(x, y, live.fit, live.cam, canvas.width, canvas.height)
    return { x: clamp(spot.x, 0.02, 0.98), y: clamp(spot.y, 0.02, 0.98) }
  }
  const push = (x: number, y: number) => {
    const next = spotOf(x, y)
    const last = points[points.length - 1]
    if (last && Math.hypot(last.x - next.x, last.y - next.y) < 0.012) return
    if (points.length >= 36) return
    points.push(next)
    const end = points[points.length - 1]
    apiRef.current.updateOverlay(slideId, cursor.id, { path: points.map((spot) => ({ ...spot })), x: end.x, y: end.y })
  }
  push(point.x, point.y)
  track(event, push, () => {
    const length = points.reduce((sum, spot, index) => {
      if (!index) return 0
      return sum + Math.hypot(spot.x - points[index - 1].x, spot.y - points[index - 1].y)
    }, 0)
    if (points.length < 2 || length < 0.03) {
      apiRef.current.updateOverlay(slideId, cursor.id, previous)
      apiRef.current.selectOverlay(null)
    }
  })
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
