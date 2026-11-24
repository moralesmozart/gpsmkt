import type { Slide } from '../types/project'

/**
 * Interface taps are Kenney CC0 (www.kenney.nl).
 * Piano beds are CC0 from OpenGameArt: Piano loop by frosty ham,
 * Soft emotional by Tozan, Bedazzled by Kistol.
 */
export const SONGS: { id: string; label: string }[] = [
  { id: 'piano', label: 'Piano loop' },
  { id: 'soft', label: 'Soft' },
  { id: 'bedazzled', label: 'Bedazzled' },
]

const FILES: Record<string, string> = {
  tap: 'sounds/tap.wav',
  ...Object.fromEntries(SONGS.map((song) => [song.id, `sounds/${song.id}.m4a`])),
}

const LEVEL: Record<string, number> = { tap: 0.35, piano: 0.55, soft: 0.5, bedazzled: 0.5 }
const SONG_IDS = new Set(SONGS.map((song) => song.id))

export function songLabel(id: string) {
  return SONGS.find((song) => song.id === id)?.label ?? ''
}

let ctx: AudioContext | null = null
let buffers: Record<string, AudioBuffer> = {}
let loading: Promise<void> | null = null
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

/** Mixes the step songs and interface sounds into one buffer for the exported file. */
export async function mixCues(cues: SoundCue[], duration: number) {
  const rate = 48000
  const length = Math.max(1, Math.ceil(Math.max(0.1, duration) * rate))
  const offline = new OfflineAudioContext(2, length, rate)
  let mixed = false
  for (const cue of cues) {
    const buffer = buffers[cue.name]
    if (!buffer) continue
    mixed = true
    const source = offline.createBufferSource()
    source.buffer = buffer
    const gain = offline.createGain()
    source.connect(gain)
    gain.connect(offline.destination)
    const start = Math.max(0, cue.time)
    const span = cue.duration ? Math.max(0, Math.min(duration, start + cue.duration) - start) : undefined
    arm(source, gain, LEVEL[cue.name] ?? 0.5, start, span, SONG_IDS.has(cue.name))
  }
  if (!mixed) return null
  return offline.startRendering()
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

/** Songs loop until `duration`, then fade. Effects play once. */
export function playSound(name: string, at?: number, duration?: number) {
  const audio = ctx
  const buffer = buffers[name]
  if (!audio || !buffer || audio.state === 'closed') return
  const source = audio.createBufferSource()
  source.buffer = buffer
  const gain = audio.createGain()
  source.connect(gain)
  gain.connect(audio.destination)
  source.onended = () => live.delete(source)
  live.add(source)
  arm(source, gain, LEVEL[name] ?? 0.5, at ?? audio.currentTime, duration, SONG_IDS.has(name))
}

function arm(source: AudioBufferSourceNode, gain: GainNode, level: number, start: number, duration: number | undefined, loop: boolean) {
  gain.gain.setValueAtTime(level, start)
  if (loop) source.loop = true
  source.start(start)
  if (!duration || duration <= 0) return
  const end = start + duration
  const fade = Math.min(0.7, duration * 0.3)
  if (fade > 0.05) {
    gain.gain.setValueAtTime(level, Math.max(start, end - fade))
    gain.gain.linearRampToValueAtTime(0.0001, end)
  }
  source.stop(end)
}

export function audioNow() {
  return ctx?.currentTime ?? 0
}

export interface SoundCue {
  time: number
  name: string
  duration?: number
}

/** The chosen song covers the whole video, plus the small interface accents. */
export function soundCues(slides: Slide[], song?: string | null) {
  const cues: SoundCue[] = []
  let acc = 0
  slides.forEach((slide) => {
    if (slide.overlays.some((overlay) => overlay.kind === 'focus' && overlay.pulse)) {
      cues.push({ time: acc + slide.duration * 0.42, name: 'tap' })
    }
    acc += slide.duration
  })
  if (song && SONG_IDS.has(song) && acc > 0) cues.unshift({ time: 0, name: song, duration: acc })
  return cues
}
