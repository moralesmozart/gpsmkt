import type { BgFill, CursorOverlay, FireworkOverlay, FocusOverlay, Overlay, Slide, TextOverlay, TransitionKind } from '../types/project'
import { slideAt } from '../types/project'
import { textOn } from './textOn'
import { TEXT_STYLES } from '../types/project'

export function easeInOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}

export interface Fit {
  dx: number
  dy: number
  dw: number
  dh: number
}

export interface Cam {
  z: number
  anchorX: number
  anchorY: number
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

const BG: Record<Exclude<BgFill, 'blur'>, string> = {
  areia: '#FFFCF5',
  white: '#FFFFFF',
  tinta: '#1B2A3A',
}

export function fitImage(image: HTMLImageElement | null, w: number, h: number, slide?: Slide): Fit {
  if (!image?.naturalWidth) return { dx: w * 0.08, dy: h * 0.08, dw: w * 0.84, dh: h * 0.84 }
  const contain = Math.min(w / image.naturalWidth, h / image.naturalHeight)
  const cover = Math.max(w / image.naturalWidth, h / image.naturalHeight)
  const untouched = slide?.fit == null && slide?.zoom == null
  const zoom = slide?.zoom ?? (untouched ? 0.94 : 1)
  const scale = (slide?.fit === 'cover' ? cover : contain) * zoom
  const dw = image.naturalWidth * scale
  const dh = image.naturalHeight * scale
  const panX = slide?.panX ?? 0
  const panY = slide?.panY ?? 0
  return {
    dx: span((w - dw) / 2, dw - w, panX),
    dy: span((h - dh) / 2, dh - h, panY),
    dw,
    dh,
  }
}

/** Slides the picture along its spare space. pan is -1..1, 0 stays centered. */
function span(centered: number, overflow: number, pan: number) {
  if (overflow <= 1) return centered + pan * Math.abs(centered)
  return centered - pan * (overflow / 2)
}

function focusWorld(focus: FocusOverlay, fit: Fit) {
  return {
    x: fit.dx + focus.x * fit.dw,
    y: fit.dy + focus.y * fit.dh,
    w: Math.max(8, focus.w * fit.dw),
    h: Math.max(8, focus.h * fit.dh),
  }
}

function visible(at: number | undefined, slide: Slide, progress: number, editing: boolean) {
  if (editing) return true
  return progress * slide.duration + 0.03 >= (at ?? 0)
}

function cameraFor(slide: Slide, fit: Fit, progress: number, w: number, h: number, editing = false): Cam {
  const driver = slide.overlays.find(
    (o): o is FocusOverlay => o.kind === 'focus' && o.motion !== 'static' && visible(o.at, slide, progress, editing),
  )
  if (!driver) return { z: 1, anchorX: w / 2, anchorY: h / 2 }
  const eased = easeInOutCubic(progress)
  const zoomT = driver.motion === 'zoom-out' ? 1 - eased : eased
  const world = focusWorld(driver, fit)
  const cx = world.x + world.w / 2
  const cy = world.y + world.h / 2
  const target = Math.min(3.4, Math.max(1.12, Math.min((w * 0.62) / world.w, (h * 0.62) / world.h)))
  return {
    z: 1 + (target - 1) * zoomT,
    anchorX: w / 2 + (cx - w / 2) * zoomT,
    anchorY: h / 2 + (cy - h / 2) * zoomT,
  }
}

export function screenToImage(px: number, py: number, fit: Fit, cam: Cam, w: number, h: number) {
  const worldX = (px - w / 2) / cam.z + cam.anchorX
  const worldY = (py - h / 2) / cam.z + cam.anchorY
  return { x: (worldX - fit.dx) / fit.dw, y: (worldY - fit.dy) / fit.dh }
}

function worldToScreen(x: number, y: number, cam: Cam, w: number, h: number) {
  return { x: w / 2 + (x - cam.anchorX) * cam.z, y: h / 2 + (y - cam.anchorY) * cam.z }
}

export function layoutSlide(slide: Slide, image: HTMLImageElement | null, progress: number, w: number, h: number, editing = false) {
  const fit = fitImage(image, w, h, slide)
  const cam = cameraFor(slide, fit, progress, w, h, editing)
  const boxes = slide.overlays.map((overlay) => ({ id: overlay.id, box: overlayBox(overlay, fit, cam, progress, w, h, editing) }))
  return { fit, cam, boxes }
}

function overlayBox(overlay: Overlay, fit: Fit, cam: Cam, progress: number, w: number, h: number, editing: boolean): Box {
  if (overlay.kind === 'focus') {
    const world = focusWorld(overlay, fit)
    const origin = worldToScreen(world.x, world.y, cam, w, h)
    return { x: origin.x, y: origin.y, w: world.w * cam.z, h: world.h * cam.z }
  }
  if (overlay.kind === 'cursor') {
    const point = cursorPoint(overlay, fit, cam, progress, w, h, editing)
    const size = Math.max(28, w * 0.05)
    return { x: point.x - size * 0.15, y: point.y - size * 0.12, w: size, h: size }
  }
  if (overlay.kind === 'firework') {
    const reach = fireworkReach(overlay.size, w, h)
    const span = reach * 2.5
    return { x: overlay.x * w - span / 2, y: overlay.y * h - span / 2, w: span, h: span }
  }
  const size = overlay.fontSize * h
  const ctx = measurer()
  ctx.font = `800 ${size}px Nunito`
  const tw = ctx.measureText(overlay.text || ' ').width
  const bw = tw + size * 1.44
  const bh = size * 1.7
  return { x: overlay.x * w - bw / 2, y: overlay.y * h - bh / 2, w: bw, h: bh }
}

let measureCtx: CanvasRenderingContext2D | null = null
function measurer() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  return measureCtx!
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number, blur: boolean) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight) * 1.12
  const dw = image.naturalWidth * scale
  const dh = image.naturalHeight * scale
  ctx.save()
  if (blur) ctx.filter = 'blur(28px)'
  ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh)
  ctx.restore()
}

function traceShape(ctx: CanvasRenderingContext2D, overlay: FocusOverlay, box: Box) {
  if (overlay.shape === 'circle') {
    ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2)
    return
  }
  const r = Math.min(box.w, box.h) * 0.1
  ctx.roundRect(box.x, box.y, box.w, box.h, r)
}

function renderSlide(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  image: HTMLImageElement | null,
  progress: number,
  w: number,
  h: number,
  editing: boolean,
) {
  const { fit, cam, boxes } = layoutSlide(slide, image, progress, w, h, editing)
  ctx.fillStyle = slide.background === 'blur' ? '#FBF5E8' : BG[slide.background]
  ctx.fillRect(0, 0, w, h)
  if (image?.naturalWidth && slide.background === 'blur') drawCover(ctx, image, w, h, true)

  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.scale(cam.z, cam.z)
  ctx.translate(-cam.anchorX, -cam.anchorY)
  if (image?.naturalWidth) ctx.drawImage(image, fit.dx, fit.dy, fit.dw, fit.dh)
  else {
    ctx.fillStyle = '#F3EAD6'
    ctx.beginPath()
    ctx.roundRect(fit.dx, fit.dy, fit.dw, fit.dh, 28)
    ctx.fill()
  }
  ctx.restore()

  const focuses = slide.overlays.filter((o): o is FocusOverlay => o.kind === 'focus' && visible(o.at, slide, progress, editing))
  const reveal = Math.min(1, progress / 0.22)
  const spotlight = focuses.filter((f) => f.spotlight)
  if (spotlight.length && reveal > 0) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
    for (const focus of spotlight) {
      const box = boxes.find((b) => b.id === focus.id)!.box
      traceShape(ctx, focus, box)
    }
    ctx.fillStyle = `rgba(27, 42, 58, ${0.65 * reveal})`
    ctx.fill('evenodd')
    ctx.restore()
  }

  for (const focus of focuses) {
    const box = boxes.find((b) => b.id === focus.id)!.box
    ctx.save()
    ctx.beginPath()
    traceShape(ctx, focus, box)
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.6 * reveal})`
    ctx.lineWidth = Math.max(3, w * 0.004)
    ctx.stroke()
    ctx.restore()

    if (focus.pulse) drawPulse(ctx, box, progress)
    if (focus.step !== null) drawBadge(ctx, box, focus.step, w, reveal)
  }

  for (const overlay of slide.overlays) {
    if (!visible(overlay.at, slide, progress, editing)) continue
    if (overlay.kind === 'text') drawText(ctx, overlay, w, h)
    if (overlay.kind === 'cursor') drawCursor(ctx, overlay, fit, cam, progress, w, h, editing)
    if (overlay.kind === 'firework') drawFirework(ctx, overlay, progress * slide.duration, w, h, editing)
  }
}

function cursorPoint(overlay: CursorOverlay, fit: Fit, cam: Cam, progress: number, w: number, h: number, editing: boolean) {
  const end = worldToScreen(fit.dx + overlay.x * fit.dw, fit.dy + overlay.y * fit.dh, cam, w, h)
  if (editing) return end
  const start = { x: end.x + w * 0.07, y: Math.min(h * 0.9, end.y + h * 0.16) }
  const t = easeInOutCubic(Math.min(1, progress / 0.68))
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }
}

function drawCursor(
  ctx: CanvasRenderingContext2D,
  overlay: CursorOverlay,
  fit: Fit,
  cam: Cam,
  progress: number,
  w: number,
  h: number,
  editing: boolean,
) {
  const end = worldToScreen(fit.dx + overlay.x * fit.dw, fit.dy + overlay.y * fit.dh, cam, w, h)
  const point = cursorPoint(overlay, fit, cam, progress, w, h, editing)
  const size = Math.max(26, w * 0.042)
  const pressing = !editing && overlay.click && progress > 0.7 && progress < 0.9
  if (editing) {
    const start = { x: end.x + w * 0.07, y: Math.min(h * 0.9, end.y + h * 0.16) }
    ctx.save()
    ctx.setLineDash([size * 0.18, size * 0.14])
    ctx.strokeStyle = 'rgba(27,42,58,0.45)'
    ctx.lineWidth = Math.max(2, size * 0.06)
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    ctx.restore()
  }
  if (pressing) {
    const u = (progress - 0.7) / 0.2
    ctx.save()
    ctx.globalAlpha = 1 - u
    ctx.beginPath()
    ctx.arc(point.x, point.y, size * (0.35 + u * 0.9), 0, Math.PI * 2)
    ctx.strokeStyle = '#2F6BFF'
    ctx.lineWidth = Math.max(3, size * 0.08)
    ctx.stroke()
    ctx.restore()
  }
  ctx.save()
  ctx.translate(point.x, point.y)
  if (pressing) ctx.scale(0.92, 0.92)
  const scale = size / 18
  ctx.scale(scale, scale)
  ctx.translate(-4.04, -4.04)
  ctx.fillStyle = '#FFFFFF'
  ctx.strokeStyle = '#1B2A3A'
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.fill(POINTER)
  ctx.stroke(POINTER)
  ctx.restore()
  if (overlay.step !== null) drawBadge(ctx, { x: point.x - size * 0.15, y: point.y - size * 0.7, w: size, h: size }, overlay.step, w, 1)
}

/** Same pointer as the left menu (Lucide mouse-pointer-2). Tip sits near 4,4. */
const POINTER = new Path2D(
  'M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z',
)

const SPARKS = ['#12A150', '#F5B400', '#2F6BFF', '#F25C3B', '#7C5CFF', '#FFFFFF']

function drawFirework(
  ctx: CanvasRenderingContext2D,
  overlay: FireworkOverlay,
  local: number,
  w: number,
  h: number,
  editing: boolean,
) {
  const elapsed = editing ? 0.42 : local - (overlay.at ?? 0)
  if (elapsed < 0 || elapsed > 1.25) return
  const cx = overlay.x * w
  const cy = overlay.y * h
  const reach = fireworkReach(overlay.size, w, h)
  const seed = hashString(overlay.id)
  const count = Math.round(14 + (overlay.size ?? 1) * 6)
  ctx.save()
  for (let burst = 0; burst < 3; burst++) {
    const start = burst * 0.1
    const t = (elapsed - start) / 0.85
    if (t <= 0 || t >= 1) continue
    const ox = ((unit(seed + burst * 17) - 0.5) * reach) * 0.35
    const oy = ((unit(seed + burst * 29) - 0.5) * reach) * 0.35
    for (let i = 0; i < count; i++) {
      const n = seed + burst * 100 + i
      const angle = unit(n) * Math.PI * 2
      const speed = reach * (0.45 + unit(n + 3) * 0.7)
      const fade = 1 - t
      const x = cx + ox + Math.cos(angle) * speed * t
      const y = cy + oy + Math.sin(angle) * speed * t + t * t * reach * 0.35
      ctx.globalAlpha = fade
      ctx.strokeStyle = SPARKS[(n + burst) % SPARKS.length]
      ctx.lineWidth = Math.max(2, reach * 0.035)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - Math.cos(angle) * speed * 0.12 * fade, y - Math.sin(angle) * speed * 0.12 * fade)
      ctx.stroke()
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(x, y, Math.max(1.5, reach * 0.025 * fade), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function fireworkReach(size: number | undefined, w: number, h: number) {
  return Math.min(w, h) * 0.16 * Math.min(2.6, Math.max(0.35, size ?? 1))
}

function hashString(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return hash >>> 0
}

function unit(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function drawPulse(ctx: CanvasRenderingContext2D, box: Box, progress: number) {
  const u = (progress - 0.4) / 0.38
  if (u < 0 || u > 1) return
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const radius = Math.min(box.w, box.h) * (0.16 + u * 0.5)
  ctx.save()
  ctx.globalAlpha = 1 - u
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = '#2F6BFF'
  ctx.lineWidth = Math.max(3, box.w * 0.02)
  ctx.stroke()
  ctx.restore()
}

function drawBadge(ctx: CanvasRenderingContext2D, box: Box, step: number, frameW: number, reveal: number) {
  const r = Math.max(14, frameW * 0.026)
  const cx = box.x + r * 0.15
  const cy = box.y + r * 0.15
  ctx.save()
  ctx.globalAlpha = 0.35 + 0.65 * reveal
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#FFC928'
  ctx.fill()
  ctx.lineWidth = Math.max(2, r * 0.16)
  ctx.strokeStyle = '#FFFFFF'
  ctx.stroke()
  ctx.fillStyle = textOn('#FFC928')
  ctx.font = `800 ${r * 1.05}px "Baloo 2"`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(step), cx, cy + r * 0.06)
  ctx.restore()
}

function drawText(ctx: CanvasRenderingContext2D, overlay: TextOverlay, w: number, h: number) {
  const size = overlay.fontSize * h
  const style = TEXT_STYLES[overlay.style]
  ctx.save()
  ctx.font = `800 ${size}px Nunito`
  const tw = ctx.measureText(overlay.text || ' ').width
  const bw = tw + size * 1.44
  const bh = size * 1.7
  const x = overlay.x * w - bw / 2
  const y = overlay.y * h - bh / 2
  ctx.beginPath()
  ctx.roundRect(x, y, bw, bh, bh / 2)
  ctx.fillStyle = style.bg
  ctx.fill()
  ctx.fillStyle = textOn(style.bg)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(overlay.text || ' ', overlay.x * w, overlay.y * h + size * 0.04)
  ctx.restore()
}

function transitionOf(slide: Slide, local: number, hasNext: boolean): { kind: TransitionKind; p: number } | null {
  if (!hasNext || slide.transition === 'cut') return null
  const win = Math.min(0.45, slide.duration * 0.45)
  if (win <= 0 || local < slide.duration - win) return null
  return { kind: slide.transition, p: easeInOutCubic((local - (slide.duration - win)) / win) }
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  opts: { slides: Slide[]; images: Map<string, HTMLImageElement>; time: number; w: number; h: number; editing?: boolean },
) {
  const { slides, images, time, w, h, editing = false } = opts
  ctx.clearRect(0, 0, w, h)
  if (!slides.length || w < 2 || h < 2) {
    ctx.fillStyle = '#FFFCF5'
    ctx.fillRect(0, 0, w, h)
    return
  }
  const here = slideAt(slides, time)
  const slide = slides[here.index]
  const next = slides[here.index + 1]
  const blend = next ? transitionOf(slide, here.local, true) : null
  const image = images.get(slide.imageId) ?? null

  if (!blend || !next) {
    renderSlide(ctx, slide, image, here.progress, w, h, editing)
    return
  }

  const nextImage = images.get(next.imageId) ?? null
  if (blend.kind === 'fade') {
    renderSlide(ctx, slide, image, here.progress, w, h, editing)
    ctx.save()
    ctx.globalAlpha = blend.p
    renderSlide(ctx, next, nextImage, 0, w, h, editing)
    ctx.restore()
    return
  }

  ctx.save()
  ctx.translate(-blend.p * w, 0)
  renderSlide(ctx, slide, image, here.progress, w, h, editing)
  ctx.restore()
  ctx.save()
  ctx.translate((1 - blend.p) * w, 0)
  renderSlide(ctx, next, nextImage, 0, w, h, editing)
  ctx.restore()
}
