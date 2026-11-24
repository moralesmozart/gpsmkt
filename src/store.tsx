import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  makeSlide,
  slideAt,
  totalDuration,
  uid,
  type FocusOverlay,
  type FormatId,
  type Overlay,
  type Project,
  type Slide,
} from './types/project'
import { idbClear, idbDelete, idbGet, idbSet } from './utils/db'
import { clearImageCache } from './utils/images'
import { createSample } from './utils/samples'

interface MktApi {
  ready: boolean
  format: FormatId
  slides: Slide[]
  urls: Record<string, string>
  time: number
  playing: boolean
  selectedId: string | null
  exportOpen: boolean
  current: Slide | null
  currentIndex: number
  setFormat: (format: FormatId) => void
  setTime: (time: number) => void
  togglePlay: () => void
  setPlaying: (playing: boolean) => void
  selectOverlay: (id: string | null) => void
  addFiles: (files: File[]) => Promise<void>
  loadSample: () => Promise<void>
  clearProject: () => Promise<void>
  updateSlide: (id: string, patch: Partial<Slide>) => void
  updateOverlay: (slideId: string, overlayId: string, patch: Record<string, unknown>) => void
  addOverlay: (slideId: string, overlay: Overlay) => void
  removeOverlay: (slideId: string, overlayId: string) => void
  removeSlide: (id: string) => void
  duplicateSlide: (id: string) => void
  reorder: (fromId: string, toId: string) => void
  seekSlide: (id: string) => void
  applyZoomIn: () => void
  addText: () => void
  setExportOpen: (open: boolean) => void
}

const MktContext = createContext<MktApi | null>(null)

export function useMkt() {
  const api = useContext(MktContext)
  if (!api) throw new Error('useMkt outside provider')
  return api
}

export function MktProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [format, setFormat] = useState<FormatId>('square')
  const [slides, setSlides] = useState<Slide[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [time, setTimeState] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const timeRef = useRef(0)
  const slidesRef = useRef(slides)
  useLayoutEffect(() => {
    slidesRef.current = slides
  }, [slides])

  const setTime = (value: number) => {
    const next = Math.min(Math.max(0, value), totalDuration(slidesRef.current))
    timeRef.current = next
    setTimeState(next)
  }

  useEffect(() => {
    let cancel = false
    const urlsMade: string[] = []
    ;(async () => {
      const saved = await idbGet<Project>('project')
      if (cancel) return
      if (!saved?.slides?.length) {
        setReady(true)
        return
      }
      const nextUrls: Record<string, string> = {}
      const kept: Slide[] = []
      for (const slide of saved.slides) {
        if (nextUrls[slide.imageId]) {
          kept.push(slide)
          continue
        }
        const blob = await idbGet<Blob>(`img:${slide.imageId}`)
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        urlsMade.push(url)
        nextUrls[slide.imageId] = url
        kept.push(slide)
      }
      if (cancel) return
      setFormat(saved.format)
      setSlides(kept)
      setUrls(nextUrls)
      setReady(true)
    })()
    return () => {
      cancel = true
      urlsMade.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const handle = setTimeout(() => {
      void idbSet('project', { format, slides } satisfies Project)
    }, 200)
    return () => clearTimeout(handle)
  }, [ready, format, slides])

  useEffect(() => {
    const total = totalDuration(slides)
    if (timeRef.current > total) setTime(total)
  }, [slides])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const total = totalDuration(slidesRef.current)
      const next = timeRef.current + dt
      if (next >= total) {
        timeRef.current = total
        setTimeState(total)
        setPlaying(false)
        return
      }
      timeRef.current = next
      setTimeState(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const remember = async (files: { id: string; blob: Blob }[], nextSlides: Slide[], nextFormat = format) => {
    const added: Record<string, string> = {}
    for (const file of files) {
      await idbSet(`img:${file.id}`, file.blob)
      added[file.id] = URL.createObjectURL(file.blob)
    }
    setUrls((prev) => ({ ...prev, ...added }))
    setSlides(nextSlides)
    setFormat(nextFormat)
    setSelectedId(null)
    setPlaying(false)
    setTime(0)
  }

  const addFiles = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (!images.length) return
    const stored = images.map((file) => ({ id: uid(), blob: file }))
    const next = [...slidesRef.current, ...stored.map((file) => makeSlide(file.id))]
    await remember(stored, next)
  }

  const loadSample = async () => {
    const sample = await createSample()
    await Promise.all(slidesRef.current.map((slide) => idbDelete(`img:${slide.imageId}`)))
    Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
    clearImageCache()
    setUrls({})
    await remember(sample.images, sample.slides, sample.format)
  }

  const clearProject = async () => {
    if (slidesRef.current.length && !window.confirm('Clear this project from this browser?')) return
    Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
    clearImageCache()
    await idbClear()
    setSlides([])
    setUrls({})
    setSelectedId(null)
    setPlaying(false)
    setTime(0)
    setExportOpen(false)
  }

  const updateSlide = (id: string, patch: Partial<Slide>) => {
    setSlides((prev) => prev.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)))
  }

  const updateOverlay = (slideId: string, overlayId: string, patch: Record<string, unknown>) => {
    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === slideId
          ? { ...slide, overlays: slide.overlays.map((overlay) => (overlay.id === overlayId ? ({ ...overlay, ...patch } as Overlay) : overlay)) }
          : slide,
      ),
    )
  }

  const addOverlay = (slideId: string, overlay: Overlay) => {
    setSlides((prev) => prev.map((slide) => (slide.id === slideId ? { ...slide, overlays: [...slide.overlays, overlay] } : slide)))
    setSelectedId(overlay.id)
  }

  const removeOverlay = (slideId: string, overlayId: string) => {
    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === slideId ? { ...slide, overlays: slide.overlays.filter((overlay) => overlay.id !== overlayId) } : slide,
      ),
    )
    setSelectedId((current) => (current === overlayId ? null : current))
  }

  const removeSlide = (id: string) => {
    const prev = slidesRef.current
    const slide = prev.find((item) => item.id === id)
    const next = prev.filter((item) => item.id !== id)
    setSlides(next)
    setSelectedId(null)
    if (slide && !next.some((item) => item.imageId === slide.imageId)) {
      void idbDelete(`img:${slide.imageId}`)
      const url = urls[slide.imageId]
      if (url) URL.revokeObjectURL(url)
      setUrls((current) => {
        const copy = { ...current }
        delete copy[slide.imageId]
        return copy
      })
    }
    setTime(Math.min(timeRef.current, Math.max(0, totalDuration(next) - 0.01)))
  }

  const duplicateSlide = (id: string) => {
    const prev = slidesRef.current
    const index = prev.findIndex((slide) => slide.id === id)
    if (index < 0) return
    const source = prev[index]
    const copy: Slide = {
      ...source,
      id: uid(),
      overlays: source.overlays.map((overlay) => ({ ...overlay, id: uid() })),
    }
    const next = prev.slice()
    next.splice(index + 1, 0, copy)
    setSlides(next)
  }

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return
    const prev = slidesRef.current.slice()
    const from = prev.findIndex((slide) => slide.id === fromId)
    const to = prev.findIndex((slide) => slide.id === toId)
    if (from < 0 || to < 0) return
    const [item] = prev.splice(from, 1)
    prev.splice(to, 0, item)
    setSlides(prev)
  }

  const seekSlide = (id: string) => {
    let acc = 0
    for (const slide of slidesRef.current) {
      if (slide.id === id) {
        setPlaying(false)
        setSelectedId(null)
        setTime(acc)
        return
      }
      acc += slide.duration
    }
  }

  const here = slideAt(slides, time)
  const current = slides[here.index] ?? null

  const applyZoomIn = () => {
    if (!current) return
    const selected = current.overlays.find((overlay) => overlay.id === selectedId && overlay.kind === 'focus') as FocusOverlay | undefined
    const existing = selected ?? current.overlays.find((overlay): overlay is FocusOverlay => overlay.kind === 'focus')
    if (existing) {
      updateOverlay(current.id, existing.id, { motion: 'zoom-in' })
      setSelectedId(existing.id)
      return
    }
    addOverlay(current.id, {
      id: uid(),
      kind: 'focus',
      shape: 'rect',
      x: 0.28,
      y: 0.32,
      w: 0.44,
      h: 0.28,
      motion: 'zoom-in',
      spotlight: true,
      pulse: true,
      step: 1,
    })
  }

  const addText = () => {
    if (!current) return
    addOverlay(current.id, {
      id: uid(),
      kind: 'text',
      text: 'Your text',
      x: 0.5,
      y: 0.2,
      fontSize: 0.042,
      style: 'mata',
    })
  }

  const api: MktApi = {
    ready,
    format,
    slides,
    urls,
    time,
    playing,
    selectedId,
    exportOpen,
    current,
    currentIndex: here.index,
    setFormat,
    setTime,
    togglePlay: () => setPlaying((value) => !value),
    setPlaying,
    selectOverlay: setSelectedId,
    addFiles,
    loadSample,
    clearProject,
    updateSlide,
    updateOverlay,
    addOverlay,
    removeOverlay,
    removeSlide,
    duplicateSlide,
    reorder,
    seekSlide,
    applyZoomIn,
    addText,
    setExportOpen,
  }

  return <MktContext.Provider value={api}>{children}</MktContext.Provider>
}
