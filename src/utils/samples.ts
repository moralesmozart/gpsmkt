import { makeSlide, uid, type FocusOverlay, type Project, type Slide, type TextOverlay } from '../types/project'

const W = 1080
const H = 1080
const phone = { x: 330, y: 80, w: 420, h: 920 }
const screen = { x: phone.x + 16, y: phone.y + 58, w: phone.w - 32, h: phone.h - 78 }
export const SAMPLE_CARD = { x: screen.x + 28, y: screen.y + 300, w: screen.w - 56, h: 250 }

function blobOf(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the sample.'))), 'image/png')
  })
}

function chrome(ctx: CanvasRenderingContext2D, paint: () => void) {
  ctx.fillStyle = '#FFFCF5'
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.shadowColor = 'rgba(27,42,58,0.18)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 12
  ctx.beginPath()
  ctx.roundRect(phone.x, phone.y, phone.w, phone.h, 48)
  ctx.fillStyle = '#1B2A3A'
  ctx.fill()
  ctx.restore()
  ctx.beginPath()
  ctx.roundRect(screen.x, screen.y, screen.w, screen.h, 28)
  ctx.fillStyle = '#FBF5E8'
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(phone.x + phone.w / 2 - 46, phone.y + 16, 92, 22, 11)
  ctx.fillStyle = '#1B2A3A'
  ctx.fill()
  ctx.fillStyle = '#5F6E80'
  ctx.font = '700 18px Nunito'
  ctx.textAlign = 'center'
  ctx.fillText('9:41', screen.x + 42, phone.y + 34)
  paint()
}

function row(ctx: CanvasRenderingContext2D, y: number, title: string, emoji: string) {
  ctx.beginPath()
  ctx.roundRect(screen.x + 24, y, screen.w - 48, 72, 18)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.font = '400 28px Nunito'
  ctx.textAlign = 'left'
  ctx.fillText(emoji, screen.x + 42, y + 46)
  ctx.fillStyle = '#1B2A3A'
  ctx.font = '800 22px Nunito'
  ctx.fillText(title, screen.x + 88, y + 46)
}

function drawHome(ctx: CanvasRenderingContext2D) {
  chrome(ctx, () => {
    ctx.fillStyle = '#1B2A3A'
    ctx.font = '800 36px "Baloo 2"'
    ctx.textAlign = 'left'
    ctx.fillText('Your city', screen.x + 28, screen.y + 70)
    ctx.fillStyle = '#5F6E80'
    ctx.font = '700 18px Nunito'
    ctx.fillText('Places nearby', screen.x + 28, screen.y + 104)
    row(ctx, screen.y + 140, 'Bakery', '🧀')
    row(ctx, screen.y + 228, 'City hall', '🏛️')
    row(ctx, screen.y + 316, 'Clinic', '🩺')
  })
}

function drawStep(ctx: CanvasRenderingContext2D) {
  chrome(ctx, () => {
    ctx.fillStyle = '#1B2A3A'
    ctx.font = '800 32px "Baloo 2"'
    ctx.textAlign = 'left'
    ctx.fillText('Padaria Sol', screen.x + 28, screen.y + 78)
    ctx.fillStyle = '#5F6E80'
    ctx.font = '700 18px Nunito'
    ctx.fillText('2 min walk', screen.x + 28, screen.y + 112)
    const card = SAMPLE_CARD
    ctx.beginPath()
    ctx.roundRect(card.x, card.y, card.w, card.h, 24)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.fillStyle = '#E8F1FF'
    ctx.beginPath()
    ctx.roundRect(card.x + 20, card.y + 22, card.w - 40, 54, 12)
    ctx.fill()
    ctx.fillStyle = '#4A5A6C'
    ctx.font = '700 16px Nunito'
    ctx.fillText('Open today · 8:00', card.x + 36, card.y + 54)
    ctx.beginPath()
    ctx.roundRect(card.x + 20, card.y + 96, card.w - 40, 64, 16)
    ctx.fillStyle = '#2F6BFF'
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '800 22px Nunito'
    ctx.textAlign = 'center'
    ctx.fillText('Check in', card.x + card.w / 2, card.y + 136)
  })
}

function drawFinal(ctx: CanvasRenderingContext2D) {
  chrome(ctx, () => {
    ctx.beginPath()
    ctx.arc(W / 2, screen.y + 250, 70, 0, Math.PI * 2)
    ctx.fillStyle = '#12A150'
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(W / 2 - 28, screen.y + 250)
    ctx.lineTo(W / 2 - 6, screen.y + 272)
    ctx.lineTo(W / 2 + 32, screen.y + 228)
    ctx.stroke()
    ctx.fillStyle = '#1B2A3A'
    ctx.font = '800 40px "Baloo 2"'
    ctx.textAlign = 'center'
    ctx.fillText('You did it', W / 2, screen.y + 390)
    ctx.beginPath()
    ctx.roundRect(W / 2 - 70, screen.y + 420, 140, 48, 24)
    ctx.fillStyle = '#FFC928'
    ctx.fill()
    ctx.fillStyle = '#1B2A3A'
    ctx.font = '800 22px Nunito'
    ctx.fillText('+15 XP', W / 2, screen.y + 451)
  })
}

async function paint(draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available.')
  draw(ctx)
  return blobOf(canvas)
}

export async function createSample(): Promise<Project & { images: { id: string; blob: Blob }[] }> {
  await document.fonts.ready
  const ids = [uid(), uid(), uid()]
  const blobs = await Promise.all([paint(drawHome), paint(drawStep), paint(drawFinal)])
  const focus: FocusOverlay = {
    id: uid(),
    kind: 'focus',
    shape: 'rect',
    x: SAMPLE_CARD.x / W,
    y: SAMPLE_CARD.y / H,
    w: SAMPLE_CARD.w / W,
    h: SAMPLE_CARD.h / H,
    motion: 'static',
    spotlight: false,
    pulse: true,
    step: 1,
  }
  const caption: TextOverlay = {
    id: uid(),
    kind: 'text',
    text: 'Product tutorial',
    x: 0.5,
    y: 0.2,
    fontSize: 0.04,
    style: 'mata',
  }
  const slides: Slide[] = [
    makeSlide(ids[0], { duration: 3, transition: 'fade' }),
    makeSlide(ids[1], { duration: 3, transition: 'fade', overlays: [focus, caption] }),
    makeSlide(ids[2], { duration: 3, transition: 'cut' }),
  ]
  return {
    format: 'square',
    slides,
    images: ids.map((id, index) => ({ id, blob: blobs[index] })),
  }
}
