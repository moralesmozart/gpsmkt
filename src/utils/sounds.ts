import type { Slide } from '../types/project'

/** Kenney Interface Sounds, CC0. www.kenney.nl */
export type SoundName = 'tap' | 'move' | 'done'

const FILES: Record<SoundName, string> = {
  tap: 'sounds/tap.wav',
  move: 'sounds/move.wav',
  done: 'sounds/done.wav',
}

const LEVEL: Record<SoundName, number> = { tap: 0.55, move: 0.32, done: 0.62 }

let ctx: AudioContext | null = null
let buffers: Partial<Record<SoundName, AudioBuffer>> = {}
let loading: Promise<void> | null = null
let recordDest: MediaStreamAudioDestinationNode | null = null

function context() {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

/** Call from a click so the browser allows sound. */
export function unlockAudio() {
  const audio = context()
  void audio.resume()
  if (!loading) {
    loading = Promise.all(
      (Object.keys(FILES) as SoundName[]).map(async (name) => {
        const response = await fetch(`${import.meta.env.BASE_URL}${FILES[name]}`)
        const data = await response.arrayBuffer()
        buffers[name] = await audio.decodeAudioData(data)
      }),
    ).then(() => undefined)
  }
  return loading
}

export function beginRecordingMix() {
  const audio = context()
  recordDest = audio.createMediaStreamDestination()
  return recordDest.stream.getAudioTracks()[0] ?? null
}

export function endRecordingMix() {
  recordDest = null
}

export function playSound(name: SoundName, at?: number) {
  const audio = ctx
  const buffer = buffers[name]
  if (!audio || !buffer || audio.state === 'closed') return
  const source = audio.createBufferSource()
  source.buffer = buffer
  const gain = audio.createGain()
  gain.gain.value = LEVEL[name]
  source.connect(gain)
  gain.connect(audio.destination)
  if (recordDest) gain.connect(recordDest)
  source.start(at ?? audio.currentTime)
}

export function audioNow() {
  return ctx?.currentTime ?? 0
}

/** Tap on a click-pulse, a short move on each transition, and a chime at the end. */
export function soundCues(slides: Slide[]) {
  const cues: { time: number; name: SoundName }[] = []
  let acc = 0
  slides.forEach((slide, index) => {
    if (slide.overlays.some((overlay) => overlay.kind === 'focus' && overlay.pulse)) {
      cues.push({ time: acc + slide.duration * 0.42, name: 'tap' })
    }
    if (slides[index + 1] && slide.transition !== 'cut') {
      const win = Math.min(0.45, slide.duration * 0.45)
      cues.push({ time: acc + Math.max(0, slide.duration - win), name: 'move' })
    }
    acc += slide.duration
  })
  if (acc > 0.4) cues.push({ time: Math.max(0, acc - 0.28), name: 'done' })
  return cues
}
