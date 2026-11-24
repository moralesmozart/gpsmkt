import type { BgFill, FocusOverlay, Overlay, Slide, TextOverlay, TransitionKind } from '../types/project'
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

export function fitImage(image: HTMLImageElement | null, w: number, h: number): Fit {
  if (!image?.naturalWidth) return { dx: w * 0.08, dy: h * 0.08, dw: w * 0.84, dh: h * 0.84 }
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight) * 0.94
  const dw = image.naturalWidth * scale
  const dh = image.naturalHeight * scale
  return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh }
}

function focusWorld(focus: FocusOverlay, fit: Fit) {
  return {
    x: fit.dx + focus.x * fit.dw,
    y: fit.dy + focus.y * fit.dh,
    w: Math.max(8, focus.w * fit.dw),
    h: Math.max(8, focus.h * fit.dh),
  }
}

function cameraFor(slide: Slide, fit: Fit, progress: number, w: number, h: number): Cam {
  const driver = slide.overlays.find((o): o is FocusOverlay => o.kind === 'focus' && o.motion !== 'static')
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

export function layoutSlide(slide: Slide, image: HTMLImageElement | null, progress: number, w: number, h: number) {
  const fit = fitImage(image, w, h)
  const cam = cameraFor(slide, fit, progress, w, h)
  const boxes = slide.overlays.map((overlay) => ({ id: overlay.id, box: overlayBox(overlay, fit, cam, w, h) }))
  return { fit, cam, boxes }
}

function overlayBox(overlay: Overlay, fit: Fit, cam: Cam, w: number, h: number): Box {
  if (overlay.kind === 'focus') {
    const world = focusWorld(overlay, fit)
    const origin = worldToScreen(world.x, world.y, cam, w, h)
    return { x: origin.x, y: origin.y, w: world.w * cam.z, h: world.h * cam.z }
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
) {
  const { fit, cam, boxes } = layoutSlide(slide, image, progress, w, h)
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

  const focuses = slide.overlays.filter((o): o is FocusOverlay => o.kind === 'focus')
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
    if (overlay.kind === 'text') drawText(ctx, overlay, w, h)
  }
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
  opts: { slides: Slide[]; images: Map<string, HTMLImageElement>; time: number; w: number; h: number },
) {
  const { slides, images, time, w, h } = opts
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
    renderSlide(ctx, slide, image, here.progress, w, h)
    return
  }

  const nextImage = images.get(next.imageId) ?? null
  if (blend.kind === 'fade') {
    renderSlide(ctx, slide, image, here.progress, w, h)
    ctx.save()
    ctx.globalAlpha = blend.p
    renderSlide(ctx, next, nextImage, 0, w, h)
    ctx.restore()
    return
  }

  ctx.save()
  ctx.translate(-blend.p * w, 0)
  renderSlide(ctx, slide, image, here.progress, w, h)
  ctx.restore()
  ctx.save()
  ctx.translate((1 - blend.p) * w, 0)
  renderSlide(ctx, next, nextImage, 0, w, h)
  ctx.restore()
}
