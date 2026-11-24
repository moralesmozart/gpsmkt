const DB_NAME = 'gps-mkt'
const STORE = 'kv'

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      const fail = (error: unknown) => {
        opening = null
        reject(error instanceof Error ? error : new Error('IndexedDB failed'))
      }
      const timer = window.setTimeout(() => fail(new Error('IndexedDB timed out')), 2000)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => {
        window.clearTimeout(timer)
        resolve(req.result)
      }
      req.onerror = () => {
        window.clearTimeout(timer)
        fail(req.error)
      }
      req.onblocked = () => {
        window.clearTimeout(timer)
        fail(new Error('IndexedDB blocked'))
      }
    })
  }
  return opening
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function idbSet(key: string, value: unknown) {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function idbDelete(key: string) {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function idbClear() {
  const db = await open()
  db.close()
  opening = null
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
