const VIDEO_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
const AUDIO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']

export function pickMime(withAudio = false) {
  if (typeof MediaRecorder === 'undefined') return ''
  const types = withAudio ? AUDIO_TYPES : VIDEO_TYPES
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Plays the timeline in real time and, when the browser can, records the canvas.
 * Recording follows the wall clock so the file lasts as long as the preview.
 */
export async function exportVideo(opts: {
  canvas: HTMLCanvasElement
  duration: number
  draw: (time: number) => void
  onProgress: (progress: number) => void
  signal: AbortSignal
  mix?: () => MediaStreamTrack | null
  onCue?: (videoTime: number) => void
}): Promise<{ blob: Blob; ext: string }> {
  const { canvas, duration, draw, onProgress, signal, mix, onCue } = opts
  const fps = 30
  const frames = Math.max(1, Math.round(duration * fps))
  draw(0)
  const stream = canvas.captureStream(fps)
  const audio = mix?.()
  if (audio) stream.addTrack(audio)
  const mime = pickMime(!!audio) || pickMime(false)
  if (!mime) throw new Error('This browser cannot save a video file. Try Chrome.')
  if (audio && !pickMime(true)) stream.getAudioTracks().forEach((track) => stream.removeTrack(track))

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data)
  }
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = () => reject(new Error('Recording failed.'))
  })

  recorder.start(200)
  const started = performance.now()
  try {
    for (let i = 0; i <= frames; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const videoTime = Math.min(duration, i / fps)
      onCue?.(videoTime)
      draw(videoTime)
      onProgress(i / frames)
      const target = started + ((i + 1) / fps) * 1000
      const delay = target - performance.now()
      if (delay > 0) await wait(delay)
    }
  } finally {
    if (recorder.state !== 'inactive') recorder.stop()
    stream.getTracks().forEach((track) => track.stop())
  }
  await stopped
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const type = mime.split(';')[0]
  return { blob: new Blob(chunks, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm' }
}
