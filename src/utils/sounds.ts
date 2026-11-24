import type { Slide } from '../types/project'

/**
 * Built-in audio, all CC0 from Kenney (www.kenney.nl):
 * interface taps, plus ten short jingles used as the step songs.
 */
export const SONGS: { id: string; label: string }[] = [
  { id: 'pop', label: 'Pop' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'spark', label: 'Spark' },
  { id: 'glow', label: 'Glow' },
  { id: 'cheer', label: 'Cheer' },
  { id: 'win', label: 'Win' },
  { id: 'coin', label: 'Coin' },
  { id: 'jump', label: 'Jump' },
  { id: 'quest', label: 'Quest' },
  { id: 'pixel', label: 'Pixel' },
]

const FILES: Record<string, string> = {
  tap: 'sounds/tap.wav',
  move: 'sounds/move.wav',
  done: 'sounds/done.wav',
  ...Object.fromEntries(SONGS.map((song) => [song.id, `sounds/${song.id}.wav`])),
}

const LEVEL: Record<string, number> = { tap: 0.45, move: 0.28, done: 0.5 }

export function songLabel(id: string) {
  return SONGS.find((song) => song.id === id)?.label ?? ''
}

let ctx: AudioContext | null = null
let buffers: Record<string, AudioBuffer> = {}
let loading: Promise<void> | null = null
let recordDest: MediaStreamAudioDestinationNode | null = null
const live = new Set<AudioBufferSourceNode>()

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
      Object.keys(FILES).map(async (name) => {
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

export function stopSounds() {
  for (const source of live) {
    try {
      source.stop()
    } catch {
      /* already finished */
    }
  }
  live.clear()
}

/** `duration` cuts the clip off, so a step song does not spill into the next step. */
export function playSound(name: string, at?: number, duration?: number) {
  const audio = ctx
  const buffer = buffers[name]
  if (!audio || !buffer || audio.state === 'closed') return
  const source = audio.createBufferSource()
  source.buffer = buffer
  const gain = audio.createGain()
  gain.gain.value = LEVEL[name] ?? 0.7
  source.connect(gain)
  gain.connect(audio.destination)
  if (recordDest) gain.connect(recordDest)
  const startAt = at ?? audio.currentTime
  source.onended = () => live.delete(source)
  live.add(source)
  source.start(startAt)
  if (duration && duration > 0) source.stop(startAt + duration)
}

export function audioNow() {
  return ctx?.currentTime ?? 0
}

export interface SoundCue {
  time: number
  name: string
  duration?: number
}

/** The step song at the start of each slide, plus the small interface accents. */
export function soundCues(slides: Slide[]) {
  const cues: SoundCue[] = []
  let acc = 0
  slides.forEach((slide, index) => {
    if (slide.song) cues.push({ time: acc, name: slide.song, duration: slide.duration })
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
