export type FormatId = 'square' | 'reels' | 'demo'
export type Motion = 'zoom-in' | 'zoom-out' | 'static'
export type ShapeKind = 'rect' | 'circle'
export type TransitionKind = 'cut' | 'fade' | 'slide'
export type BgFill = 'areia' | 'white' | 'tinta' | 'blur'
export type TextStyleId = 'tinta' | 'mata' | 'ipe' | 'uva' | 'white'

export interface FocusOverlay {
  id: string
  kind: 'focus'
  shape: ShapeKind
  /** 0–1 of the source image. */
  x: number
  y: number
  w: number
  h: number
  motion: Motion
  spotlight: boolean
  pulse: boolean
  /** null hides the numbered badge. */
  step: number | null
  /** Seconds into this step before it shows. */
  at?: number
}

export interface TextOverlay {
  id: string
  kind: 'text'
  text: string
  /** 0–1 of the video frame. Stays put while the camera zooms. */
  x: number
  y: number
  /** Fraction of the frame height. */
  fontSize: number
  style: TextStyleId
  /** Seconds into this step before it shows. */
  at?: number
}

export interface CursorOverlay {
  id: string
  kind: 'cursor'
  /** 0–1 of the screenshot. Where the finger taps. */
  x: number
  y: number
  click: boolean
  step: number | null
  /** Seconds into this step before it shows. */
  at?: number
}

export interface FireworkOverlay {
  id: string
  kind: 'firework'
  /** 0–1 of the video frame. */
  x: number
  y: number
  /** 1 is the usual burst. Larger fills more of the frame. */
  size?: number
  /** Seconds into this step before it bursts. */
  at?: number
}

export type Overlay = FocusOverlay | TextOverlay | CursorOverlay | FireworkOverlay
export type ElementKind = Overlay['kind']

export function makeOverlay(kind: ElementKind, at = 0): Overlay {
  const id = uid()
  if (kind === 'text') {
    return { id, kind, text: 'Your text', x: 0.5, y: 0.2, fontSize: 0.042, style: 'mata', at }
  }
  if (kind === 'cursor') {
    return { id, kind, x: 0.62, y: 0.58, click: true, step: null, at }
  }
  if (kind === 'firework') {
    return { id, kind, x: 0.5, y: 0.36, size: 1, at }
  }
  return {
    id,
    kind: 'focus',
    shape: 'rect',
    x: 0.28,
    y: 0.34,
    w: 0.44,
    h: 0.22,
    motion: 'static',
    spotlight: true,
    pulse: false,
    step: null,
    at,
  }
}

export const ELEMENT_MIME = 'application/x-gps-element'

export function elementDragData(kind: ElementKind) {
  return `gps-element:${kind}`
}

export function writeElementDrag(data: DataTransfer, kind: ElementKind) {
  data.setData(ELEMENT_MIME, kind)
  data.setData('text/plain', elementDragData(kind))
  data.effectAllowed = 'copy'
}

export function isElementDrag(data: DataTransfer) {
  return [...data.types].includes(ELEMENT_MIME)
}

export function readElementTransfer(data: DataTransfer): ElementKind | null {
  const custom = data.getData(ELEMENT_MIME)
  if (custom === 'text' || custom === 'cursor' || custom === 'focus' || custom === 'firework') return custom
  return readElementDrag(data.getData('text/plain'))
}

export function readElementDrag(data: string): ElementKind | null {
  if (!data.startsWith('gps-element:')) return null
  const kind = data.slice('gps-element:'.length)
  if (kind === 'text' || kind === 'cursor' || kind === 'focus' || kind === 'firework') return kind
  return null
}

export function overlayLabel(overlay: Overlay) {
  if (overlay.kind === 'text') return overlay.text || 'Text'
  if (overlay.kind === 'cursor') return 'Finger'
  if (overlay.kind === 'firework') return 'Firework'
  return 'Focus'
}

export type FrameFit = 'contain' | 'cover'
export type Tool = 'focus' | 'fit' | 'cursor'

export interface Slide {
  id: string
  imageId: string
  duration: number
  background: BgFill
  transition: TransitionKind
  overlays: Overlay[]
  /** contain shows the whole screenshot. cover fills the frame. */
  fit?: FrameFit
  /** Extra zoom on top of the fit. 1 is the natural size for that fit. */
  zoom?: number
  /** -1 to 1. 0 keeps the screenshot centered. */
  panX?: number
  panY?: number
}

export interface Project {
  format: FormatId
  slides: Slide[]
  /** One song for the whole video. Empty means silent. */
  song?: string | null
}

export const FORMATS: Record<FormatId, { label: string; ratio: string; w: number; h: number }> = {
  square: { label: 'Photo Motion', ratio: '1:1', w: 1080, h: 1080 },
  reels: { label: 'Reels', ratio: '9:16', w: 1080, h: 1920 },
  demo: { label: 'Demo', ratio: '16:9', w: 1920, h: 1080 },
}

export const FORMAT_ORDER: FormatId[] = ['square', 'reels', 'demo']

export const TEXT_STYLES: Record<TextStyleId, { bg: string; label: string }> = {
  tinta: { bg: '#1B2A3A', label: 'Tinta' },
  mata: { bg: '#0A7F3E', label: 'Mata' },
  ipe: { bg: '#FFC928', label: 'Ipê' },
  uva: { bg: '#7C5CFF', label: 'Uva' },
  white: { bg: '#FFFFFF', label: 'White' },
}

export const BACKGROUNDS: { id: BgFill; label: string; color: string }[] = [
  { id: 'areia', label: 'Areia', color: '#FFFCF5' },
  { id: 'white', label: 'White', color: '#FFFFFF' },
  { id: 'tinta', label: 'Tinta', color: '#1B2A3A' },
  { id: 'blur', label: 'Blur', color: '#D9D0BE' },
]

export const TRANSITIONS: { id: TransitionKind; label: string }[] = [
  { id: 'cut', label: 'Cut' },
  { id: 'fade', label: 'Smooth Fade' },
  { id: 'slide', label: 'Slide Left' },
]

export const MOTIONS: { id: Motion; label: string }[] = [
  { id: 'zoom-in', label: 'Zoom in' },
  { id: 'zoom-out', label: 'Zoom out' },
  { id: 'static', label: 'Hold' },
]

export const uid = () => crypto.randomUUID()

export function totalDuration(slides: Slide[]) {
  return slides.reduce((sum, slide) => sum + slide.duration, 0)
}

export function slideAt(slides: Slide[], time: number) {
  let acc = 0
  for (let i = 0; i < slides.length; i++) {
    const duration = slides[i].duration
    if (time < acc + duration || i === slides.length - 1) {
      const local = Math.min(Math.max(0, time - acc), duration)
      return { index: i, start: acc, local, progress: duration === 0 ? 0 : local / duration }
    }
    acc += duration
  }
  return { index: 0, start: 0, local: 0, progress: 0 }
}

export function slideName(index: number, count: number) {
  if (count <= 1 || index === 0) return 'Start'
  if (index === count - 1) return 'Final'
  return `Step ${index + 1}`
}

export function makeSlide(imageId: string, extras?: Partial<Slide>): Slide {
  return {
    id: uid(),
    imageId,
    duration: 3,
    background: 'areia',
    transition: 'fade',
    overlays: [],
    ...extras,
  }
}
