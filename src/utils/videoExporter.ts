import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_MEDIUM,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from 'mediabunny'

const VIDEO_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function exportVideo(opts: {
  canvas: HTMLCanvasElement
  duration: number
  draw: (time: number) => void
  onProgress: (progress: number) => void
  signal: AbortSignal
  /** Songs and effects mixed for the whole video. Omitted when sound is off. */
  audio?: () => Promise<AudioBuffer | null>
}): Promise<{ blob: Blob; ext: string }> {
  if (typeof VideoEncoder !== 'undefined') {
    const encoded = await exportEncoded(opts)
    if (encoded) return encoded
  }
  return exportRecorder(opts)
}

/**
 * MediaRecorder drops the whole file when an audio track is attached, so the
 * movie is encoded frame by frame and the song is muxed in as AAC.
 */
async function exportEncoded(opts: {
  canvas: HTMLCanvasElement
  duration: number
  draw: (time: number) => void
  onProgress: (progress: number) => void
  signal: AbortSignal
  audio?: () => Promise<AudioBuffer | null>
}): Promise<{ blob: Blob; ext: string } | null> {
  const { canvas, duration, draw, onProgress, signal, audio } = opts
  const width = canvas.width
  const height = canvas.height
  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'vp8'], {
    width,
    height,
    bitrate: QUALITY_MEDIUM,
  })
  if (!videoCodec) return null

  const mixed = audio ? await audio() : null
  const audioCodec = mixed
    ? await getFirstEncodableAudioCodec(['aac', 'opus'], {
        numberOfChannels: mixed.numberOfChannels,
        sampleRate: mixed.sampleRate,
      })
    : null

  const fps = 30
  const frames = Math.max(1, Math.round(duration * fps))
  const frameDuration = 1 / fps
  const target = new BufferTarget()
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  })
  const pictures = new CanvasSource(canvas, { codec: videoCodec, bitrate: QUALITY_MEDIUM })
  output.addVideoTrack(pictures, { frameRate: fps })
  const soundtrack = mixed && audioCodec ? new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_MEDIUM }) : null
  if (soundtrack) output.addAudioTrack(soundtrack)

  await output.start()
  try {
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      draw(Math.min(duration, i / fps))
      await pictures.add(i / fps, frameDuration, { keyFrame: i % (fps * 2) === 0 })
      onProgress((i + 1) / frames)
    }
    if (soundtrack && mixed) await soundtrack.add(mixed)
    await output.finalize()
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel()
    throw error
  }

  const buffer = target.buffer
  if (!buffer || buffer.byteLength < 1000) throw new Error('The video came out empty. Try Chrome.')
  return { blob: new Blob([buffer], { type: 'video/mp4' }), ext: 'mp4' }
}

/** Used only when the browser cannot encode frames directly. Video only, so the file is never empty. */
async function exportRecorder(opts: {
  canvas: HTMLCanvasElement
  duration: number
  draw: (time: number) => void
  onProgress: (progress: number) => void
  signal: AbortSignal
}): Promise<{ blob: Blob; ext: string }> {
  const { canvas, duration, draw, onProgress, signal } = opts
  if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot save a video file. Try Chrome.')
  const mime = VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
  if (!mime) throw new Error('This browser cannot save a video file. Try Chrome.')

  const fps = 30
  const frames = Math.max(1, Math.round(duration * fps))
  draw(0)
  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, { mimeType: mime })
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
      draw(Math.min(duration, i / fps))
      onProgress(i / frames)
      const delay = started + ((i + 1) / fps) * 1000 - performance.now()
      if (delay > 0) await wait(delay)
    }
    await wait(200)
  } finally {
    if (recorder.state !== 'inactive') recorder.stop()
    await stopped
    stream.getTracks().forEach((track) => track.stop())
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const type = mime.split(';')[0]
  const blob = new Blob(chunks, { type })
  if (blob.size < 1000) throw new Error('The video came out empty. Try Chrome.')
  return { blob, ext: type.includes('mp4') ? 'mp4' : 'webm' }
}
