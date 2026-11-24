const cache = new Map<string, Promise<HTMLImageElement>>()

export function loadImage(url: string) {
  let pending = cache.get(url)
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Could not read that image.'))
      image.src = url
    })
    cache.set(url, pending)
  }
  return pending
}

export function clearImageCache() {
  cache.clear()
}

export async function loadImages(urls: Record<string, string>, imageIds: string[]) {
  const unique = [...new Set(imageIds)]
  const entries = await Promise.all(
    unique.map(async (id) => {
      const url = urls[id]
      if (!url) return null
      return [id, await loadImage(url)] as const
    }),
  )
  return new Map(entries.filter((entry): entry is readonly [string, HTMLImageElement] => !!entry))
}
