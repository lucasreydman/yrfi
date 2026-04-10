import { kv } from '@vercel/kv'

const memoryStore = new Map<string, { value: unknown; expiresAt: number }>()

function isVercelKvAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (isVercelKvAvailable()) {
    return kv.get<T>(key)
  }
  const entry = memoryStore.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key)
    return null
  }
  return entry.value as T
}

export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  if (isVercelKvAvailable()) {
    if (ttlSeconds) {
      await kv.set(key, value, { ex: ttlSeconds })
    } else {
      await kv.set(key, value)
    }
    return
  }
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity
  memoryStore.set(key, { value, expiresAt })
}

export async function kvDel(key: string): Promise<void> {
  if (isVercelKvAvailable()) {
    await kv.del(key)
    return
  }
  memoryStore.delete(key)
}
