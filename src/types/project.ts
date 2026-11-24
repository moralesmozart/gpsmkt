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
}

export type Overlay = FocusOverlay | TextOverlay

export interface Slide {
  id: string
  imageId: string
  duration: number
  background: BgFill
  transition: TransitionKind
  overlays: Overlay[]
  /** Id from the built-in song library. Empty means this step is silent. */
  song?: string | null
}

export interface Project {
  format: FormatId
  slides: Slide[]
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
